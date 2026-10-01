const test = require("node:test");
const assert = require("node:assert/strict");
const transactionsService = require("../../src/services/transactions");
const sunabar = require("../../src/services/sunabar");
const unified = require("../../src/mock/unifiedAccounts");

const { getTransactions, toUnifiedTransactions } = transactionsService;

// sunabar の明細（sunabar.js が変換したあとの形）
const own = [
  {
    id: "sunabar:1",
    date: "2026-09-30",
    type: "expense",
    amount: 2000,
    description: "ATM セブン",
    category: "現金",
    source: { id: "sunabar", name: "sunabar", kind: "bank" },
    isInternalTransfer: false,
  },
];

// 他行の明細（contracts/api.md「GET /mock/unified-accounts」の accounts の形）
const accounts = [
  {
    institutionId: "card-a",
    institutionName: "○○カード",
    kind: "card",
    transactions: [{ id: "card-a:1", date: "2026-09-03", amount: 6200, description: "ｲｵﾝ" }],
  },
  {
    institutionId: "qr-a",
    institutionName: "△△ペイ",
    kind: "qr",
    transactions: [{ id: "qr-a:1", date: "2026-09-01", amount: 1600, description: "ｽｲｶ ﾁｬｰｼﾞ" }],
  },
];

// UNIFIED_ID_ENABLED をテストの間だけ変えて、終わったら元に戻す
function withUnified(t, value) {
  const before = process.env.UNIFIED_ID_ENABLED;
  process.env.UNIFIED_ID_ENABLED = value;
  t.after(() => {
    if (before === undefined) delete process.env.UNIFIED_ID_ENABLED;
    else process.env.UNIFIED_ID_ENABLED = before;
  });
}

test("他行の明細を Transaction の形にそろえる（支出・カテゴリ判定・出どころ。data-model.md）", () => {
  assert.deepEqual(toUnifiedTransactions(accounts), [
    {
      id: "card-a:1",
      date: "2026-09-03",
      type: "expense",
      amount: 6200,
      description: "ｲｵﾝ",
      category: "食費",
      source: { id: "card-a", name: "○○カード", kind: "card" },
      isInternalTransfer: false,
    },
    {
      id: "qr-a:1",
      date: "2026-09-01",
      type: "expense",
      amount: 1600,
      description: "ｽｲｶ ﾁｬｰｼﾞ",
      category: "交通",
      source: { id: "qr-a", name: "△△ペイ", kind: "qr" },
      isInternalTransfer: false,
    },
  ]);
});

test("連携口座がなければ他行の明細はない", () => {
  assert.deepEqual(toUnifiedTransactions([]), []);
});

test("UNIFIED_ID_ENABLED=true なら sunabar の明細に他行の明細を合算する（FR-040）", async (t) => {
  withUnified(t, "true");
  t.mock.method(sunabar, "fetchTransactions", async () => own);
  const getUnifiedAccounts = t.mock.method(unified, "getUnifiedAccounts", async () => accounts);

  const items = await getTransactions("2026-09");

  assert.deepEqual(
    items.map((x) => x.id),
    ["sunabar:1", "card-a:1", "qr-a:1"],
  );
  assert.deepEqual(getUnifiedAccounts.mock.calls[0].arguments, ["demo-user-0001", "2026-09"]);
});

test("UNIFIED_ID_ENABLED が true 以外なら sunabar の明細だけ（他行の API は呼ばない。FR-042）", async (t) => {
  // 値ごとにサブテストに分け、それぞれのあとで環境変数を元に戻す（#75 のレビュー提案）
  for (const value of ["false", ""]) {
    await t.test(`UNIFIED_ID_ENABLED="${value}"`, async (st) => {
      withUnified(st, value);
      st.mock.method(sunabar, "fetchTransactions", async () => own);
      const getUnifiedAccounts = st.mock.method(unified, "getUnifiedAccounts", async () => accounts);

      assert.deepEqual(await getTransactions("2026-09"), own);
      assert.equal(getUnifiedAccounts.mock.callCount(), 0);
    });
  }
});

test("sunabar には対象月の初日から末日までを問い合わせる", async (t) => {
  withUnified(t, "false");
  const fetchTransactions = t.mock.method(sunabar, "fetchTransactions", async () => []);

  await getTransactions("2026-02");

  const [, from, to] = fetchTransactions.mock.calls[0].arguments;
  assert.equal(from, "2026-02-01");
  assert.equal(to, "2026-02-28");
});
