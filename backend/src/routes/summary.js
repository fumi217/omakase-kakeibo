// GET /api/summary?month=YYYY-MM【担当 B】（contracts/api.md）
// Monthly Summary に、集計に使った明細の一覧（items）と予算（budgets）を足して返す。
// 明細は 1 回だけ取得し、同じ明細から集計と一覧を作る（合計と一覧が食い違わない。#83・FR-027）
const { json } = require("../lib/http");
const { parseMonth } = require("../lib/month");
const { newestFirst } = require("../lib/newestFirst");
// 分割代入せずにモジュールごと持つ（テストで getMonthlyDashboard を差し替えられるように）
const summary = require("../services/summary");

module.exports = async (event) => {
  const month = event.queryStringParameters?.month;
  parseMonth(month); // 不正なら 400 INVALID_MONTH
  const { summary: monthly, transactions, budgets } = await summary.getMonthlyDashboard(month);
  return json(200, { ...monthly, items: newestFirst(transactions), budgets });
};
