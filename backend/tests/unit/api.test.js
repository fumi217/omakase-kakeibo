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
test("GET /api/summary は getMonthlySummary の結果をそのまま返す", async (t) => {
  t.mock.method(summary, "getMonthlySummary", async (month) => ({ month, categories: [] }));

  const res = await handler(event("GET", "/api/summary", { month: "2026-11" }));
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { month: "2026-11", categories: [] });
  assert.equal(summary.getMonthlySummary.mock.callCount(), 1);
  assert.equal(summary.getMonthlySummary.mock.calls[0].arguments[0], "2026-11");
});

test("GET /api/summary は month が不正なら 400 INVALID_MONTH（集計は呼ばない）", async (t) => {
  t.mock.method(summary, "getMonthlySummary", async () => ({}));

  const res = await handler(event("GET", "/api/summary", { month: "abc" }));
  assert.equal(res.statusCode, 400);
  assert.equal(JSON.parse(res.body).error.code, "INVALID_MONTH");
  assert.equal(summary.getMonthlySummary.mock.callCount(), 0);
});

test("未実装のルートは 501 NOT_IMPLEMENTED を返す（ルート表には登録済み）", async () => {
  for (const path of ["/api/transactions", "/mock/categorize", "/mock/budget", "/mock/unified-accounts"]) {
    const res = await handler(event("GET", path));
    assert.equal(res.statusCode, 501, path);
    assert.equal(JSON.parse(res.body).error.code, "NOT_IMPLEMENTED");
  }
});
