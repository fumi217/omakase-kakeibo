import { useState } from "react";
import { currentMonth } from "./month.js";
import useMonthlySummary from "./hooks/useMonthlySummary.js";
import SummaryCards from "./components/SummaryCards.jsx";
import MonthSwitcher from "./components/MonthSwitcher.jsx";
import CategoryBreakdown from "./components/CategoryBreakdown.jsx";
import DailyBarChart from "./components/DailyBarChart.jsx";
import TransactionList from "./components/TransactionList.jsx";
import LiffHeader from "./components/LiffHeader.jsx";

// 画面の骨組み【担当 B】
// 主役（今月の支出と予算）を上に大きく置き、その下の 1 枚のパネルに 取引・日別の支出・カテゴリ別の支出 をまとめる（#69）
// 予算の使用率（A の BudgetList.jsx の BudgetUsage）は、カテゴリ別の支出の各行に出す
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
              <CategoryBreakdown
                categories={summary?.categories ?? []}
                selectedCategory={category}
                onSelect={setCategory}
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
