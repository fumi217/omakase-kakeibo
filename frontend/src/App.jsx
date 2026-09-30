import { useState } from "react";
import { currentMonth } from "./month.js";
import useMonthlySummary from "./hooks/useMonthlySummary.js";
import SummaryCards from "./components/SummaryCards.jsx";
import MonthSwitcher from "./components/MonthSwitcher.jsx";
import CategoryPieChart from "./components/CategoryPieChart.jsx";
import DailyBarChart from "./components/DailyBarChart.jsx";
import BudgetList from "./components/BudgetList.jsx";
import TransactionList from "./components/TransactionList.jsx";
import LiffHeader from "./components/LiffHeader.jsx";

// 画面の骨組み【担当 B】
// ⚠️ コンポーネントの配置は土台（#21）で確定。各コンポーネントの中身は担当者が components/ に書く
// （BudgetList.jsx は A の担当。tasks.md「コンフリクトを防ぐ約束」）
export default function App() {
  const [month, setMonth] = useState(currentMonth);
  const [category, setCategory] = useState(null);
  const { summary, loading, error } = useMonthlySummary(month);
  const isEmpty = summary?.transactionCount === 0;

  // 月を変えたらカテゴリの絞り込みは解除する（その月にないカテゴリで 0 件に見えないように）
  function changeMonth(nextMonth) {
    setMonth(nextMonth);
    setCategory(null);
  }

  return (
    <main style={{ fontFamily: "sans-serif", padding: 16 }}>
      <LiffHeader />
      <MonthSwitcher month={month} onChange={changeMonth} />
      {loading && <p>読み込み中…</p>}
      {error && <p>データを取得できませんでした（{error}）</p>}
      <SummaryCards summary={summary} error={error} />
      {/* 明細が 0 件の月は、グラフの代わりにメッセージを出す（spec US2 シナリオ 4） */}
      {isEmpty ? (
        <p>この月の入出金はありません</p>
      ) : (
        <>
          <CategoryPieChart
            categories={summary?.categories ?? []}
            selectedCategory={category}
            onSelect={setCategory}
          />
          <DailyBarChart daily={summary?.daily ?? []} />
        </>
      )}
      <BudgetList categories={summary?.categories ?? []} />
      <TransactionList month={month} category={category} onClearCategory={() => setCategory(null)} />
    </main>
  );
}
