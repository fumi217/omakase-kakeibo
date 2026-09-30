// 自作 API: 予算【担当 A】（data-model.md「Budget」）
// 「銀行アプリで設定した予算を API で取得できたら」という提案。予算は固定値で、画面からは編集しない（spec「範囲外」）
const budgets = require("./data/budgets.json");
const { parseMonth } = require("../lib/month");

// month: "YYYY-MM" → { [category]: 金額 }。振込・現金・その他は使い道が分からないので予算を置かない
// 月ごとの指定（months）があれば、そのカテゴリだけ default を上書きする
async function getBudgets(month) {
  parseMonth(month);
  return { ...budgets.default, ...budgets.months?.[month] };
}

module.exports = { getBudgets };
