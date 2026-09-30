// 月（"YYYY-MM"）と期間の変換。日付はすべて日本時間で扱う（Lambda は UTC で動くため）【担当 A】
const { HttpError } = require("./http");

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// "2026-10" → { from: "2026-10-01", to: "2026-10-31" }。形式が不正なら INVALID_MONTH
function parseMonth(month) {
  const m = MONTH_PATTERN.exec(month ?? "");
  if (!m) {
    throw new HttpError(400, "INVALID_MONTH", "month は YYYY-MM の形式で指定してください");
  }
  const year = Number(m[1]);
  const monthIndex = Number(m[2]); // 1〜12
  const lastDay = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

// 日本時間での「今月」。例: UTC 2026-09-30T20:00Z は日本時間 10/1 5:00 なので "2026-10"
function currentMonth(now = new Date()) {
  return new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 7);
}

// "2026-01" → "2025-12"
function previousMonth(month) {
  parseMonth(month);
  const [year, mon] = month.split("-").map(Number);
  const d = new Date(Date.UTC(year, mon - 2, 1));
  return d.toISOString().slice(0, 7);
}

module.exports = { parseMonth, currentMonth, previousMonth };
