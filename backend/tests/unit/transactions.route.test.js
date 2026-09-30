const test = require("node:test");
const assert = require("node:assert/strict");
const { handler } = require("../../src/handlers/api");
const transactionsService = require("../../src/services/transactions");

function event(queryStringParameters = {}) {
  return {
    rawPath: "/api/transactions",
    queryStringParameters,
    requestContext: { http: { method: "GET", path: "/api/transactions" } },
  };
}

const SOURCE = { id: "sunabar", name: "sunabar", kind: "bank" };
// sunabar は古い順に返す（services/sunabar.js）。同じ日の中も古い順
function tx(id, date, category, type = "expense") {
  return { id, date, type, amount: 1000, description: id, category, source: SOURCE, isInternalTransfer: false };
}
const SAMPLE = [
  tx("sunabar:1", "2026-09-01", "入金", "income"),
  tx("sunabar:2", "2026-09-10", "食費"),
  tx("sunabar:3", "2026-09-30", "現金"),
  tx("sunabar:4", "2026-09-30", "食費"),
];

// 明細の取得（sunabar の呼び出し）は差し替えて、ルートの動きだけを確かめる
test("GET /api/transactions は指定した月の明細を新しい順に返す（同じ日は後の明細が先）", async (t) => {
  t.mock.method(transactionsService, "getTransactions", async () => SAMPLE);

  const res = await handler(event({ month: "2026-09" }));
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.month, "2026-09");
  assert.deepEqual(
    body.items.map((i) => i.id),
    ["sunabar:4", "sunabar:3", "sunabar:2", "sunabar:1"],
  );
  assert.equal(transactionsService.getTransactions.mock.calls[0].arguments[0], "2026-09");
});

test("category を指定すると、そのカテゴリの明細だけを返す", async (t) => {
  t.mock.method(transactionsService, "getTransactions", async () => SAMPLE);

  const res = await handler(event({ month: "2026-09", category: "食費" }));
  assert.deepEqual(
    JSON.parse(res.body).items.map((i) => i.id),
    ["sunabar:4", "sunabar:2"],
  );
});

test("明細が 0 件の月・一致するカテゴリがないときは、空の items を返す（エラーにしない）", async (t) => {
  t.mock.method(transactionsService, "getTransactions", async () => SAMPLE);
  const res = await handler(event({ month: "2026-09", category: "娯楽" }));
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body).items, []);

  transactionsService.getTransactions.mock.mockImplementation(async () => []);
  const empty = await handler(event({ month: "2020-01" }));
  assert.deepEqual(JSON.parse(empty.body), { month: "2020-01", items: [] });
});

test("month が不正なら 400 INVALID_MONTH（明細は取りに行かない）", async (t) => {
  t.mock.method(transactionsService, "getTransactions", async () => SAMPLE);

  const res = await handler(event({ month: "abc" }));
  assert.equal(res.statusCode, 400);
  assert.equal(JSON.parse(res.body).error.code, "INVALID_MONTH");
  assert.equal(transactionsService.getTransactions.mock.callCount(), 0);
});
