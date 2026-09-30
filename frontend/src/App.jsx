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
// 主役（今月の支出と予算）を上に大きく置き、その下の 1 枚のパネルに 取引・日別の支出・カテゴリ別の支出 をまとめる（#69）
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
    <main className="page">
      <header className="topbar">
        <LiffHeader />
        <MonthSwitcher month={month} onChange={changeMonth} />
      </header>
      {loading && <p className="notice">読み込み中…</p>}
      {error && <p className="notice error">データを取得できませんでした（{error}）</p>}

      <SummaryCards month={month} summary={summary} error={error} />

      {/* スマホはこの順（取引 → 日別 → カテゴリ）。パソコンでの配置（日別が全幅）は index.css の .panel-body で決める */}
      <div className="panel">
        <div className="panel-body">
          <TransactionList month={month} category={category} onClearCategory={() => setCategory(null)} />
          {/* 明細が 0 件の月は、グラフの代わりにメッセージを出す（spec US2 シナリオ 4） */}
          {isEmpty ? (
            <p className="section section-daily muted" style={{ margin: 0 }}>
              この月の入出金はありません
            </p>
          ) : (
            <>
              <DailyBarChart daily={summary?.daily ?? []} />
              {/* カテゴリ別の支出と予算の使用率の見た目は、次の PR（一覧への統合）で整える */}
              <div className="section section-category">
                <CategoryPieChart
                  categories={summary?.categories ?? []}
                  selectedCategory={category}
                  onSelect={setCategory}
                />
                <BudgetList categories={summary?.categories ?? []} />
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
