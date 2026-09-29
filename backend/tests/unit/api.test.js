const test = require("node:test");
const assert = require("node:assert/strict");
const { handler } = require("../../src/handlers/api");

function event(method, rawPath) {
  return { rawPath, requestContext: { http: { method, path: rawPath } } };
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
