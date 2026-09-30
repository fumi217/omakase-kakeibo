// GET /api/summary?month=YYYY-MM【担当 B】（contracts/api.md）
const { json } = require("../lib/http");
const { parseMonth } = require("../lib/month");
// 分割代入せずにモジュールごと持つ（テストで getMonthlySummary を差し替えられるように）
const summary = require("../services/summary");

module.exports = async (event) => {
  const month = event.queryStringParameters?.month;
  parseMonth(month); // 不正なら 400 INVALID_MONTH
  return json(200, await summary.getMonthlySummary(month));
};
