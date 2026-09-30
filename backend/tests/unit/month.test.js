const test = require("node:test");
const assert = require("node:assert/strict");
const { parseMonth, currentMonth, previousMonth } = require("../../src/lib/month");

test("parseMonth は月の初日と末日を返す（うるう年を含む）", () => {
  assert.deepEqual(parseMonth("2026-10"), { from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(parseMonth("2026-02"), { from: "2026-02-01", to: "2026-02-28" });
  assert.deepEqual(parseMonth("2028-02"), { from: "2028-02-01", to: "2028-02-29" });
});

test("parseMonth は形式が不正なら INVALID_MONTH", () => {
  for (const bad of ["abc", "2026-13", "2026-1", "", undefined]) {
    assert.throws(() => parseMonth(bad), { code: "INVALID_MONTH", statusCode: 400 });
  }
});

test("currentMonth は日本時間で判定する（UTC の月末夜は日本時間では翌月）", () => {
  assert.equal(currentMonth(new Date("2026-09-30T20:00:00Z")), "2026-10");
  assert.equal(currentMonth(new Date("2026-09-30T14:59:59Z")), "2026-09");
});

test("previousMonth は年をまたげる", () => {
  assert.equal(previousMonth("2026-10"), "2026-09");
  assert.equal(previousMonth("2026-01"), "2025-12");
});
