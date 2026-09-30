const test = require("node:test");
const assert = require("node:assert/strict");
const { getUnifiedAccounts } = require("../../src/mock/unifiedAccounts");
const data = require("../../src/mock/data/unified-accounts.json");
const { categorize } = require("../../src/mock/categorize");
const { handler } = require("../../src/handlers/api");

const ID = "demo-user-0001";
// 発表の日（日本時間 2026-10-02 10:00）。今月 = 2026-10、先月 = 2026-09
const DEMO_DAY = new Date("2026-10-02T01:00:00Z");

function event(queryStringParameters = {}) {
  return {
    rawPath: "/mock/unified-accounts",
    queryStringParameters,
    requestContext: { http: { method: "GET", path: "/mock/unified-accounts" } },
  };
}

const allTransactions = data.accounts.flatMap((a) => a.transactions);

test("ダミー明細: 日付は {{MONTH}}-DD（どの月にもある 28 日まで）、金額は正の整数、id は重複しない", () => {
  for (const t of allTransactions) {
    assert.match(t.date, /^\{\{MONTH\}\}-(0[1-9]|1\d|2[0-8])$/, t.id);
    assert.ok(Number.isInteger(t.amount) && t.amount > 0, t.id);
  }
  const ids = allTransactions.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("ダミー明細: すべて category-rules.json のキーワードに当たる（「その他」にならない）", () => {
  const unmatched = allTransactions.filter((t) => categorize(t.description).matchedKeyword == null);
  assert.deepEqual(unmatched, []);
});

test("過去の月は、{{MONTH}} をその月に置き換えて全件を返す", async () => {
  const accounts = await getUnifiedAccounts(ID, "2026-09", DEMO_DAY);

  assert.deepEqual(
    accounts.map((a) => [a.institutionId, a.institutionName, a.kind, a.transactions.length]),
    data.accounts.map((a) => [a.institutionId, a.institutionName, a.kind, a.transactions.length]),
  );
  const [first] = accounts[0].transactions;
  assert.deepEqual(first, { ...data.accounts[0].transactions[0], date: data.accounts[0].transactions[0].date.replace("{{MONTH}}", "2026-09") });
  assert.ok(accounts.flatMap((a) => a.transactions).every((t) => t.date.startsWith("2026-09-")));
});

test("今月は、今日（日本時間）より後の日付を除く", async () => {
  const accounts = await getUnifiedAccounts(ID, "2026-10", DEMO_DAY);
  const dates = accounts.flatMap((a) => a.transactions).map((t) => t.date);

  assert.ok(dates.length > 0, "月初でも今日までの明細は出る");
  assert.ok(dates.every((d) => d <= "2026-10-02"), dates.join(","));
});

test("未来の月は明細なし（口座は返す）", async () => {
  const accounts = await getUnifiedAccounts(ID, "2026-11", DEMO_DAY);
  assert.equal(accounts.length, data.accounts.length);
  assert.ok(accounts.every((a) => a.transactions.length === 0));
});

test("元のダミーデータは書き換えない", async () => {
  await getUnifiedAccounts(ID, "2026-09", DEMO_DAY);
  assert.ok(allTransactions.every((t) => t.date.startsWith("{{MONTH}}")));
});

test("知らない統一 ID は、連携口座なし（空の配列）", async () => {
  assert.deepEqual(await getUnifiedAccounts("someone-else", "2026-09", DEMO_DAY), []);
});

test("month が不正なら INVALID_MONTH", async () => {
  await assert.rejects(getUnifiedAccounts(ID, "2026-13", DEMO_DAY), { code: "INVALID_MONTH", statusCode: 400 });
});

test("GET /mock/unified-accounts は統一 ID・月・口座と x-mock-api ヘッダーを返す（contracts/api.md）", async () => {
  const res = await handler(event({ unifiedId: ID, month: "2026-09" }));

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["x-mock-api"], "true");
  const body = JSON.parse(res.body);
  assert.equal(body.unifiedId, ID);
  assert.equal(body.month, "2026-09");
  assert.equal(body.accounts.length, data.accounts.length);
});

test("GET /mock/unified-accounts は unifiedId がないと 400 INVALID_PARAMETER", async () => {
  const res = await handler(event({ month: "2026-09" }));
  assert.equal(res.statusCode, 400);
  assert.equal(JSON.parse(res.body).error.code, "INVALID_PARAMETER");
});

test("GET /mock/unified-accounts は month がない・不正なら 400 INVALID_MONTH", async () => {
  for (const query of [{ unifiedId: ID }, { unifiedId: ID, month: "abc" }]) {
    const res = await handler(event(query));
    assert.equal(res.statusCode, 400);
    assert.equal(JSON.parse(res.body).error.code, "INVALID_MONTH");
  }
});
