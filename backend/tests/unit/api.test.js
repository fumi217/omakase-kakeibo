const test = require("node:test");
const assert = require("node:assert/strict");
const { handler } = require("../../src/handlers/api");
const summary = require("../../src/services/summary");

function event(method, rawPath, queryStringParameters = {}) {
  return { rawPath, queryStringParameters, requestContext: { http: { method, path: rawPath } } };
}

test("GET /api/health は 200 と { ok: true } を返す", async () => {
  const res = await handler(event("GET", "/api/health"));
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { ok: true });
});

test("存在しないパスは 404 と共通エラー形式を返す", async () => {
  const res = await handler(event("GET", "/nope"));
  assert.equal(res.statusCode, 404);
  assert.equal(JSON.parse(res.body).error.code, "NOT_FOUND");
});

// 集計（sunabar の呼び出しを含む）は差し替えて、ルートの動きだけを確かめる。
// sunabar のトークンがないテスト環境でも、A1 / A2 の実装後に落ちないようにするため
const SOURCE = { id: "sunabar", name: "sunabar", kind: "bank" };
function tx(id, date) {
  return { id, date, type: "expense", amount: 1000, description: id, category: "食費", source: SOURCE, isInternalTransfer: false };
}

test("GET /api/summary は Monthly Summary に、新しい順の明細（items）と予算（budgets）を足して返す（#83）", async (t) => {
  // sunabar の古い順の後ろに、他行の明細がつながった順（getTransactions の戻り値のまま）
  const transactions = [tx("sunabar:1", "2026-11-01"), tx("sunabar:2", "2026-11-03"), tx("card-a:1", "2026-11-02")];
  t.mock.method(summary, "getMonthlyDashboard", async (month) => ({
    summary: { month, categories: [] },
    transactions,
    budgets: { 食費: 30000, 住居: 60000 },
  }));

  const res = await handler(event("GET", "/api/summary", { month: "2026-11" }));
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.month, "2026-11");
  assert.deepEqual(body.categories, []);
  assert.deepEqual(
    body.items.map((i) => i.id),
    ["sunabar:2", "card-a:1", "sunabar:1"],
  );
  assert.deepEqual(body.budgets, { 食費: 30000, 住居: 60000 });
  assert.equal(summary.getMonthlyDashboard.mock.callCount(), 1, "明細の取得を含む集計は 1 回だけ");
  assert.equal(summary.getMonthlyDashboard.mock.calls[0].arguments[0], "2026-11");
});

test("GET /api/summary は month が不正なら 400 INVALID_MONTH（集計は呼ばない）", async (t) => {
  t.mock.method(summary, "getMonthlyDashboard", async () => ({}));

  const res = await handler(event("GET", "/api/summary", { month: "abc" }));
  assert.equal(res.statusCode, 400);
  assert.equal(JSON.parse(res.body).error.code, "INVALID_MONTH");
  assert.equal(summary.getMonthlyDashboard.mock.callCount(), 0);
});

test("GET /mock/categorize は判定結果と x-mock-api ヘッダーを返す（contracts/api.md）", async () => {
  const res = await handler(event("GET", "/mock/categorize", { description: "ATM セブン" }));
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["x-mock-api"], "true");
  assert.deepEqual(JSON.parse(res.body), {
    description: "ATM セブン",
    category: "現金",
    merchant: null,
    matchedKeyword: "ATM",
  });
});

test("GET /mock/categorize は description がないと 400 INVALID_PARAMETER", async () => {
  const res = await handler(event("GET", "/mock/categorize"));
  assert.equal(res.statusCode, 400);
  assert.equal(JSON.parse(res.body).error.code, "INVALID_PARAMETER");
});
