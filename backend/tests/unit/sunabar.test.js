const test = require("node:test");
const assert = require("node:assert/strict");
const categorizer = require("../../src/mock/categorize");
const { fetchTransactions } = require("../../src/services/sunabar");
const sample = require("../fixtures/sunabar-transactions.sample.json");

// sunabar は呼ばずに fetch を差し替える。トークンはテスト用のダミー
process.env.SUNABAR_ACCESS_TOKEN = "dummy";

function response(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

function page(transactions, { hasNext = "false", nextItemKey } = {}) {
  return { ...sample, hasNext, ...(nextItemKey ? { nextItemKey } : {}), count: String(transactions.length), transactions };
}

// カテゴリ判定（B の担当）の中身に左右されないよう、摘要をそのまま返す判定に差し替える
function mockCategorize(t) {
  return t.mock.method(categorizer, "categorize", (description) => ({
    category: `判定:${description}`,
    merchant: null,
    matchedKeyword: null,
  }));
}

test("実レスポンス（fixture）を Transaction に変換する", async (t) => {
  mockCategorize(t);
  t.mock.method(globalThis, "fetch", async () => response(sample));

  const items = await fetchTransactions("301011234567", "2026-09-01", "2026-09-30");

  const source = { id: "sunabar", name: "sunabar", kind: "bank" };
  assert.deepEqual(items, [
    { id: "sunabar:27545", date: "2026-09-30", type: "income", amount: 10000, description: "ATM セブン", category: "入金", source, isInternalTransfer: false },
    { id: "sunabar:27546", date: "2026-09-30", type: "expense", amount: 3000, description: "振込 スナバ　タロウ", category: "判定:振込 スナバ　タロウ", source, isInternalTransfer: false },
    { id: "sunabar:27548", date: "2026-09-30", type: "expense", amount: 2000, description: "ATM セブン", category: "判定:ATM セブン", source, isInternalTransfer: false },
  ]);
});

test("入金はカテゴリ判定を呼ばず、支出だけ判定する", async (t) => {
  const categorize = mockCategorize(t);
  t.mock.method(globalThis, "fetch", async () => response(sample));

  await fetchTransactions("301011234567", "2026-09-01", "2026-09-30");

  assert.deepEqual(
    categorize.mock.calls.map((c) => c.arguments[0]),
    ["振込 スナバ　タロウ", "ATM セブン"],
  );
});

test("口座 ID・期間・トークンを付けて入出金明細 API を呼ぶ", async (t) => {
  mockCategorize(t);
  const fetch = t.mock.method(globalThis, "fetch", async () => response(page([])));

  await fetchTransactions("301011234567", "2026-09-01", "2026-09-30");

  assert.equal(fetch.mock.callCount(), 1);
  const [url, options] = fetch.mock.calls[0].arguments;
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, "https://api.sunabar.gmo-aozora.com/personal/v1/accounts/transactions");
  assert.equal(u.searchParams.get("accountId"), "301011234567");
  assert.equal(u.searchParams.get("dateFrom"), "2026-09-01");
  assert.equal(u.searchParams.get("dateTo"), "2026-09-30");
  assert.equal(u.searchParams.has("nextItemKey"), false);
  assert.equal(options.headers["x-access-token"], "dummy");
  assert.ok(options.signal, "タイムアウト用の signal を渡す");
});

test("明細が 0 件なら空の配列を返す", async (t) => {
  mockCategorize(t);
  t.mock.method(globalThis, "fetch", async () => response(page([])));

  assert.deepEqual(await fetchTransactions("301011234567", "2026-09-01", "2026-09-30"), []);
});

test("摘要（remarks）がない明細は、内容を空文字にする", async (t) => {
  mockCategorize(t);
  const { remarks, ...noRemarks } = sample.transactions[1];
  t.mock.method(globalThis, "fetch", async () => response(page([noRemarks])));

  const [item] = await fetchTransactions("301011234567", "2026-09-01", "2026-09-30");
  assert.equal(item.description, "");
});

for (const hasNext of ["true", true]) {
  test(`hasNext が ${JSON.stringify(hasNext)} なら nextItemKey を付けて続きを取得する`, async (t) => {
    mockCategorize(t);
    const [first, second, third] = sample.transactions;
    const fetch = t.mock.method(globalThis, "fetch", async (url) =>
      new URL(url).searchParams.get("nextItemKey") === "27546"
        ? response(page([third]))
        : response(page([first, second], { hasNext, nextItemKey: "27546" })),
    );

    const items = await fetchTransactions("301011234567", "2026-09-01", "2026-09-30");

    assert.equal(fetch.mock.callCount(), 2);
    assert.equal(new URL(fetch.mock.calls[1].arguments[0]).searchParams.get("nextItemKey"), "27546");
    assert.deepEqual(items.map((i) => i.id), ["sunabar:27545", "sunabar:27546", "sunabar:27548"]);
  });
}

test('hasNext が文字列の "false" なら続きを取りに行かない（sunabar は文字列で返す）', async (t) => {
  mockCategorize(t);
  const fetch = t.mock.method(globalThis, "fetch", async () => response(page(sample.transactions, { hasNext: "false" })));

  await fetchTransactions("301011234567", "2026-09-01", "2026-09-30");
  assert.equal(fetch.mock.callCount(), 1);
});

test("続きが終わらなくても 5 回で打ち切り、ログを出す", async (t) => {
  mockCategorize(t);
  const warn = t.mock.method(console, "warn", () => {});
  let n = 0;
  const fetch = t.mock.method(globalThis, "fetch", async () => {
    n += 1;
    return response(page([{ ...sample.transactions[0], itemKey: String(n) }], { hasNext: "true", nextItemKey: String(n) }));
  });

  const items = await fetchTransactions("301011234567", "2026-09-01", "2026-09-30");

  assert.equal(fetch.mock.callCount(), 5);
  assert.equal(items.length, 5);
  assert.equal(warn.mock.callCount(), 1);
});

test("sunabar がエラーを返したら 502 BANK_API_ERROR（ログにトークンを出さない）", async (t) => {
  mockCategorize(t);
  const error = t.mock.method(console, "error", () => {});
  t.mock.method(globalThis, "fetch", async () => response({ errorCode: "WG_ERR_001" }, { ok: false, status: 401 }));

  await assert.rejects(fetchTransactions("301011234567", "2026-09-01", "2026-09-30"), {
    statusCode: 502,
    code: "BANK_API_ERROR",
    message: "銀行との接続設定を確認してください",
  });
  assert.equal(error.mock.callCount(), 1);
  assert.doesNotMatch(JSON.stringify(error.mock.calls[0].arguments), /dummy/);
});

test("タイムアウトしたら 504 BANK_API_UNAVAILABLE", async (t) => {
  mockCategorize(t);
  t.mock.method(console, "error", () => {});
  t.mock.method(globalThis, "fetch", async () => {
    throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
  });

  await assert.rejects(fetchTransactions("301011234567", "2026-09-01", "2026-09-30"), {
    statusCode: 504,
    code: "BANK_API_UNAVAILABLE",
    message: "銀行とつながりませんでした。少し時間をおいて試してください",
  });
});

test("通信そのものに失敗したら 504 BANK_API_UNAVAILABLE", async (t) => {
  mockCategorize(t);
  t.mock.method(console, "error", () => {});
  t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("fetch failed");
  });

  await assert.rejects(fetchTransactions("301011234567", "2026-09-01", "2026-09-30"), {
    statusCode: 504,
    code: "BANK_API_UNAVAILABLE",
  });
});
