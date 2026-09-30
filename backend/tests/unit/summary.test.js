const test = require("node:test");
const assert = require("node:assert/strict");
const summary = require("../../src/services/summary");
const transactionsService = require("../../src/services/transactions");
const budget = require("../../src/mock/budget");

const { buildMonthlySummary, getMonthlySummary } = summary;

const SUNABAR = { id: "sunabar", name: "sunabar", kind: "bank" };
const CARD = { id: "card-a", name: "○○カード", kind: "card" };
// 過去の月を集計するときの「今」（2026-10-15 12:00 日本時間）
const NOW = new Date("2026-10-15T03:00:00Z");

let seq = 0;
function tx(date, type, amount, category, extra = {}) {
  seq += 1;
  return {
    id: `sunabar:${seq}`,
    date,
    type,
    amount,
    description: "",
    category: type === "income" ? "入金" : category,
    source: SUNABAR,
    isInternalTransfer: false,
    ...extra,
  };
}

// spec US1 シナリオ 1: 入金 2 件（合計 300,000 円）と支出 5 件（合計 45,000 円）
const september = [
  tx("2026-09-25", "income", 250000),
  tx("2026-09-10", "income", 50000),
  tx("2026-09-02", "expense", 30000, "住居"),
  tx("2026-09-03", "expense", 8000, "食費"),
  tx("2026-09-03", "expense", 4000, "食費"),
  tx("2026-09-12", "expense", 2000, "交通"),
  tx("2026-09-20", "expense", 1000, "その他"),
];

test("入金合計・支出合計・件数を集計する（spec US1 シナリオ 1）", () => {
  const s = buildMonthlySummary("2026-09", september, {}, NOW);
  assert.equal(s.month, "2026-09");
  assert.equal(s.totalIncome, 300000);
  assert.equal(s.totalExpense, 45000);
  assert.equal(s.transactionCount, 7);
});

test("カテゴリ別は支出の多い順。ratio は小数第 3 位で四捨五入。予算がなければ budget / usage / status は null", () => {
  const s = buildMonthlySummary("2026-09", september, {}, NOW);
  const empty = { budget: null, usage: null, status: null };
  assert.deepEqual(s.categories, [
    { category: "住居", amount: 30000, ratio: 0.667, ...empty },
    { category: "食費", amount: 12000, ratio: 0.267, ...empty },
    { category: "交通", amount: 2000, ratio: 0.044, ...empty },
    { category: "その他", amount: 1000, ratio: 0.022, ...empty },
  ]);
});

test("金額が同じカテゴリは、data-model のカテゴリの順に並べる", () => {
  const s = buildMonthlySummary(
    "2026-09",
    [tx("2026-09-01", "expense", 1000, "その他"), tx("2026-09-01", "expense", 1000, "食費"), tx("2026-09-01", "expense", 1000, "交通")],
    {},
    NOW,
  );
  assert.deepEqual(s.categories.map((c) => c.category), ["食費", "交通", "その他"]);
});

test("明細が 0 件の月はエラーにせず、合計 0・カテゴリなしを返す（contracts/api.md）", () => {
  const s = buildMonthlySummary("2026-09", [], {}, NOW);
  assert.equal(s.totalIncome, 0);
  assert.equal(s.totalExpense, 0);
  assert.equal(s.transactionCount, 0);
  assert.deepEqual(s.categories, []);
  assert.deepEqual(s.sources, []);
  assert.equal(s.daily.length, 30);
  assert.ok(s.daily.every((d) => d.expense === 0));
});

test("自分の口座間の振替は、合計・カテゴリ・日別・件数に含めない（FR-004）", () => {
  const withTransfer = [...september, tx("2026-09-05", "expense", 10000, "振込", { isInternalTransfer: true })];
  const s = buildMonthlySummary("2026-09", withTransfer, {}, NOW);
  assert.equal(s.totalExpense, 45000);
  assert.equal(s.transactionCount, 7);
  assert.ok(!s.categories.some((c) => c.category === "振込"));
  assert.equal(s.daily.find((d) => d.date === "2026-09-05").expense, 0);
});

test("日別は、過去の月なら 1 日〜末日。支出 0 の日も含め、同じ日の支出は合計する", () => {
  const s = buildMonthlySummary("2026-09", september, {}, NOW);
  assert.equal(s.daily.length, 30);
  assert.deepEqual(s.daily[0], { date: "2026-09-01", expense: 0 });
  assert.deepEqual(s.daily[1], { date: "2026-09-02", expense: 30000 });
  assert.deepEqual(s.daily[2], { date: "2026-09-03", expense: 12000 });
  assert.deepEqual(s.daily[29], { date: "2026-09-30", expense: 0 });
  // 入金は日別の支出に含めない
  assert.equal(s.daily.find((d) => d.date === "2026-09-25").expense, 0);
});

test("日別は、今月なら今日（日本時間）まで", () => {
  const s = buildMonthlySummary("2026-10", [], {}, NOW);
  assert.equal(s.daily.length, 15);
  assert.equal(s.daily.at(-1).date, "2026-10-15");
});

test("「今日」は日本時間で判定する（UTC 9/30 15:30 は日本時間 10/1）", () => {
  const s = buildMonthlySummary("2026-10", [], {}, new Date("2026-09-30T15:30:00Z"));
  assert.deepEqual(s.daily, [{ date: "2026-10-01", expense: 0 }]);
});

test("未来の月は日別を空にする", () => {
  const s = buildMonthlySummary("2026-11", [], {}, NOW);
  assert.deepEqual(s.daily, []);
});

test("sources は集計に含めた出どころの一覧（重複なし）", () => {
  const s = buildMonthlySummary("2026-09", [...september, tx("2026-09-04", "expense", 680, "食費", { source: CARD })], {}, NOW);
  assert.deepEqual(s.sources, [SUNABAR, CARD]);
});

test("generatedAt は now を日本時間の ISO 8601（+09:00）で表す", () => {
  const s = buildMonthlySummary("2026-09", [], {}, NOW);
  assert.equal(s.generatedAt, "2026-10-15T12:00:00+09:00");
});

// 予算の状態（FR-031・data-model.md）: usage < 0.8 → normal、0.8 ≤ usage ≤ 1.0 → warning、1.0 < usage → over
function foodBudget(amount, budget = 30000) {
  const s = buildMonthlySummary("2026-09", [tx("2026-09-03", "expense", amount, "食費")], { 食費: budget }, NOW);
  return s.categories[0];
}

test("予算があるカテゴリは budget と usage（小数第 3 位で四捨五入）を付ける", () => {
  const c = foodBudget(10000);
  assert.equal(c.budget, 30000);
  assert.equal(c.usage, 0.333);
});

test("status の境目: 80% 未満は normal、80% ちょうどから warning（spec US3 シナリオ 1）", () => {
  assert.equal(foodBudget(23999).status, "normal");
  assert.equal(foodBudget(24000).status, "warning");
  assert.equal(foodBudget(24000).usage, 0.8);
});

test("status: 90% は warning、100% ちょうども warning、103% は over（spec US3 の Independent Test）", () => {
  assert.equal(foodBudget(27000).status, "warning");
  assert.equal(foodBudget(30000).status, "warning");
  assert.deepEqual(foodBudget(31000), { category: "食費", amount: 31000, ratio: 1, budget: 30000, usage: 1.033, status: "over" });
});

test("status は丸める前の値で判定する（1 円でも超えたら over。usage は 1 に丸まる）", () => {
  const c = foodBudget(30001);
  assert.equal(c.usage, 1);
  assert.equal(c.status, "over");
});

test("予算があっても支出のないカテゴリは出さない。予算のないカテゴリは null（spec US3 シナリオ 3）", () => {
  const s = buildMonthlySummary("2026-09", september, { 食費: 30000, 娯楽: 10000 }, NOW);
  assert.deepEqual(
    s.categories.map((c) => [c.category, c.budget, c.usage, c.status]),
    [
      ["住居", null, null, null],
      ["食費", 30000, 0.4, "normal"],
      ["交通", null, null, null],
      ["その他", null, null, null],
    ],
  );
});

test("getMonthlySummary は明細と予算を取得して集計する（本番コードで fixture を読まない）", async (t) => {
  const getTransactions = t.mock.method(transactionsService, "getTransactions", async () => september);
  const getBudgets = t.mock.method(budget, "getBudgets", async () => ({ 住居: 30000 }));

  const s = await getMonthlySummary("2026-09", NOW);

  assert.equal(getTransactions.mock.calls[0].arguments[0], "2026-09");
  assert.equal(getBudgets.mock.calls[0].arguments[0], "2026-09");
  assert.equal(s.totalExpense, 45000);
  assert.equal(s.categories[0].status, "warning", "取得した予算を集計に使う");
  assert.equal(s.generatedAt, "2026-10-15T12:00:00+09:00");
});
