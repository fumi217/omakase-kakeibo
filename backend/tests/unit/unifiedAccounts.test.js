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

test("基準の月（デモで見せる 9 月）は、{{MONTH}} をその月に置き換えるだけで、ひな形の金額・件数のまま返す", async () => {
  assert.equal(data.baseMonth, "2026-09");
  const accounts = await getUnifiedAccounts(ID, "2026-09", DEMO_DAY);

  assert.deepEqual(
    accounts,
    data.accounts.map((a) => ({
      ...a,
      transactions: a.transactions.map((t) => ({ ...t, date: t.date.replace("{{MONTH}}", "2026-09") })),
    })),
  );
});

// 基準の月以外の過去の月（発表日から見て）
const OTHER_MONTHS = ["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"];

async function flat(month) {
  return (await getUnifiedAccounts(ID, month, DEMO_DAY)).flatMap((a) => a.transactions);
}

test("基準の月以外は、金額をひな形の ±15%（10 円単位）で変え、1,000 円未満の明細だけを間引く", async () => {
  const template = new Map(allTransactions.map((t) => [t.id, t]));
  for (const month of OTHER_MONTHS) {
    const items = await flat(month);
    const kept = new Set(items.map((t) => t.id));
    for (const t of items) {
      const base = template.get(t.id).amount;
      assert.ok(t.date.startsWith(`${month}-`), `${month} ${t.id}`);
      assert.equal(t.amount % 10, 0, `${month} ${t.id}`);
      assert.ok(t.amount >= Math.floor(base * 0.85) - 10 && t.amount <= Math.ceil(base * 1.15) + 10, `${month} ${t.id} ${t.amount}`);
    }
    // 1,000 円以上の明細は間引かない（家賃の代わりになる大きい支出などが消えないように）
    for (const t of allTransactions.filter((x) => x.amount >= 1000)) {
      assert.ok(kept.has(t.id), `${month} ${t.id}`);
    }
  }
});

test("同じ月は何度取得しても同じ（乱数ではなく月から決まる。LINE と画面の金額が一致するように）", async () => {
  for (const month of OTHER_MONTHS) {
    assert.deepEqual(await flat(month), await flat(month), month);
  }
});

test("月ごとに金額・件数が変わる（毎月同じ明細にならない）", async () => {
  const signatures = await Promise.all(
    ["2026-09", ...OTHER_MONTHS].map(async (month) => (await flat(month)).map((t) => `${t.id}:${t.amount}`).join(",")),
  );
  assert.equal(new Set(signatures).size, signatures.length);
  const counts = await Promise.all(OTHER_MONTHS.map(async (month) => (await flat(month)).length));
  assert.ok(new Set(counts).size > 1, `件数: ${counts.join(",")}`);
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
