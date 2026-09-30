// 月次サマリーの集計【担当 A】（data-model.md「Monthly Summary」）
// LINE Bot とダッシュボードの両方が getMonthlySummary だけを呼ぶ（金額を一致させるため。FR-027）
// 分割代入せずにモジュールごと持つ（テストで getTransactions / getBudgets を差し替えられるように）
const transactionsService = require("./transactions");
const budget = require("../mock/budget");
const { parseMonth, jstDateTime } = require("../lib/month");

// data-model.md「Category」の表示順。金額が同じカテゴリはこの順に並べる
const CATEGORY_ORDER = ["食費", "日用品", "交通", "住居", "通信", "娯楽", "振込", "現金", "その他"];

function orderOf(category) {
  const i = CATEGORY_ORDER.indexOf(category);
  return i === -1 ? CATEGORY_ORDER.length : i;
}

// 月の 1 日〜末日。今月なら今日まで、未来の月なら空（支出 0 の日も含める）
function buildDaily(month, expenses, now) {
  const { to } = parseMonth(month);
  const today = jstDateTime(now).slice(0, 10);
  const lastDay = today < to ? today : to;
  const byDate = new Map();
  for (const t of expenses) byDate.set(t.date, (byDate.get(t.date) ?? 0) + t.amount);

  const daily = [];
  for (let day = 1; ; day++) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    if (date > lastDay) break;
    daily.push({ date, expense: byDate.get(date) ?? 0 });
  }
  return daily;
}

// 小数第 3 位で四捨五入（ratio・usage の表示用）
function round3(x) {
  return Math.round(x * 1000) / 1000;
}

// 予算に対する使用率と状態（FR-031・data-model.md）。予算のないカテゴリは null
// 状態は丸める前の値で判定する（1 円でも超えたら over にし、LINE の超過額の行と食い違わないように）
function budgetStatus(amount, budget) {
  if (!(budget > 0)) return { budget: null, usage: null, status: null };
  const usage = amount / budget;
  const status = usage > 1 ? "over" : usage >= 0.8 ? "warning" : "normal";
  return { budget, usage: round3(usage), status };
}

// 純粋関数: 明細と予算から Monthly Summary を作る。「今日」は now で受け取る（テストで固定できるように）
// 予算があっても支出のないカテゴリは categories に出さない（支出があったカテゴリだけを並べる）
function buildMonthlySummary(month, transactions, budgets, now = new Date()) {
  // 自分の口座間の振替は集計しない（FR-004）
  const targets = transactions.filter((t) => !t.isInternalTransfer);
  const incomes = targets.filter((t) => t.type === "income");
  const expenses = targets.filter((t) => t.type === "expense");
  const sum = (list) => list.reduce((total, t) => total + t.amount, 0);
  const totalIncome = sum(incomes);
  const totalExpense = sum(expenses);

  const byCategory = new Map();
  for (const t of expenses) byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount);
  const categories = [...byCategory]
    .sort(([a, x], [b, y]) => y - x || orderOf(a) - orderOf(b))
    .map(([category, amount]) => ({
      category,
      amount,
      ratio: round3(amount / totalExpense),
      ...budgetStatus(amount, budgets[category]),
    }));

  const sources = [...new Map(targets.map((t) => [t.source.id, t.source])).values()];

  return {
    month,
    totalIncome,
    totalExpense,
    categories,
    daily: buildDaily(month, expenses, now),
    transactionCount: targets.length,
    sources,
    generatedAt: `${jstDateTime(now)}+09:00`,
  };
}

// 集計の入口: 明細の取得 → 予算の取得 → 集計
async function getMonthlySummary(month, now = new Date()) {
  const transactions = await transactionsService.getTransactions(month);
  const budgets = await budget.getBudgets(month);
  return buildMonthlySummary(month, transactions, budgets, now);
}

module.exports = { buildMonthlySummary, getMonthlySummary };
