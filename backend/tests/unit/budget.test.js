const test = require("node:test");
const assert = require("node:assert/strict");
const { getBudgets } = require("../../src/mock/budget");
const budgets = require("../../src/mock/data/budgets.json");
const { handler } = require("../../src/handlers/api");

function event(queryStringParameters = {}) {
  return { rawPath: "/mock/budget", queryStringParameters, requestContext: { http: { method: "GET", path: "/mock/budget" } } };
}

test("budgets.json は default を持ち、金額はすべて正の数（data-model.md「Budget」）", () => {
  assert.equal(typeof budgets.default, "object");
  const all = [budgets.default, ...Object.values(budgets.months ?? {})];
  for (const b of all) {
    for (const [category, amount] of Object.entries(b)) {
      assert.ok(Number.isInteger(amount) && amount > 0, `${category}: ${amount}`);
    }
  }
});

test("月ごとの指定がない月は default を返す", async () => {
  assert.deepEqual(await getBudgets("2099-01"), budgets.default);
});

test("月ごとの指定がある月は、指定したカテゴリだけ default を上書きする", async (t) => {
  t.mock.property(budgets, "months", { "2026-10": { 食費: 40000 } });

  const result = await getBudgets("2026-10");

  assert.deepEqual(result, { ...budgets.default, 食費: 40000 });
  assert.notEqual(budgets.default.食費, 40000, "default は書き換えない");
});

test("getBudgets は month が不正なら INVALID_MONTH", async () => {
  await assert.rejects(getBudgets("2026-13"), { code: "INVALID_MONTH", statusCode: 400 });
});

test("GET /mock/budget は月と予算、x-mock-api ヘッダーを返す（contracts/api.md）", async () => {
  const res = await handler(event({ month: "2099-01" }));

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["x-mock-api"], "true");
  assert.deepEqual(JSON.parse(res.body), { month: "2099-01", budgets: budgets.default });
});

test("GET /mock/budget は month がない・不正なら 400 INVALID_MONTH", async () => {
  for (const query of [{}, { month: "abc" }]) {
    const res = await handler(event(query));
    assert.equal(res.statusCode, 400);
    assert.equal(JSON.parse(res.body).error.code, "INVALID_MONTH");
  }
});
