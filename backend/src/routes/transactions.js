// GET /api/transactions?month=YYYY-MM&category=【担当 B】（contracts/api.md）
const { json } = require("../lib/http");
const { parseMonth } = require("../lib/month");
// 分割代入せずにモジュールごと持つ（テストで getTransactions を差し替えられるように）
const transactionsService = require("../services/transactions");
const { newestFirst } = require("../lib/newestFirst");

module.exports = async (event) => {
  const month = event.queryStringParameters?.month;
  const category = event.queryStringParameters?.category;
  parseMonth(month); // 不正なら 400 INVALID_MONTH

  const all = await transactionsService.getTransactions(month);
  const items = category ? all.filter((t) => t.category === category) : all;
  return json(200, { month, items: newestFirst(items) });
};
