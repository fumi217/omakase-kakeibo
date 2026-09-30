// 月次サマリーの集計【担当 A】（data-model.md「Monthly Summary」）
// LINE Bot とダッシュボードの両方が getMonthlySummary だけを呼ぶ（金額を一致させるため。FR-027）
const { getTransactions } = require("./transactions");
const { getBudgets } = require("../mock/budget");
const sample = require("../../tests/fixtures/summary.sample.json");

// 純粋関数: 明細と予算から Monthly Summary を作る。「今日」は now で受け取る（テストで固定できるように）
// 土台（#21）のスタブ: contracts/api.md の例を返す。A2（#23）で実装する
function buildMonthlySummary(month, transactions, budgets, now = new Date()) {
  return { ...sample, month };
}

// 集計の入口: 明細の取得 → 予算の取得 → 集計
async function getMonthlySummary(month, now = new Date()) {
  const transactions = await getTransactions(month);
  const budgets = await getBudgets(month);
  return buildMonthlySummary(month, transactions, budgets, now);
}

module.exports = { buildMonthlySummary, getMonthlySummary };
