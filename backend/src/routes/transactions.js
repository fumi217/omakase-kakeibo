// GET /api/transactions?month=YYYY-MM&category=【担当 B】（contracts/api.md）
const { json } = require("../lib/http");
const { parseMonth } = require("../lib/month");
// 分割代入せずにモジュールごと持つ（テストで getTransactions を差し替えられるように）
const transactionsService = require("../services/transactions");

// 新しい順。sunabar は古い順に返すので、同じ日の中も後の明細が先になるように並べ替える
function newestFirst(items) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => b.item.date.localeCompare(a.item.date) || b.index - a.index)
    .map(({ item }) => item);
}

module.exports = async (event) => {
  const month = event.queryStringParameters?.month;
  const category = event.queryStringParameters?.category;
  parseMonth(month); // 不正なら 400 INVALID_MONTH

  const all = await transactionsService.getTransactions(month);
  const items = category ? all.filter((t) => t.category === category) : all;
  return json(200, { month, items: newestFirst(items) });
};
