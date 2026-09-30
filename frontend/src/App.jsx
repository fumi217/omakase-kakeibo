import { useEffect, useState } from "react";
import { getSummary } from "./api/client.js";
import SummaryCards from "./components/SummaryCards.jsx";
import MonthSwitcher from "./components/MonthSwitcher.jsx";
import CategoryPieChart from "./components/CategoryPieChart.jsx";
import DailyBarChart from "./components/DailyBarChart.jsx";
import BudgetList from "./components/BudgetList.jsx";
import TransactionList from "./components/TransactionList.jsx";

// 日本時間の今月（"YYYY-MM"）
function currentMonth() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }).slice(0, 7);
}

// 画面の骨組み【担当 B】
// ⚠️ コンポーネントの配置は土台（#21）で確定。各コンポーネントの中身は担当者が components/ に書く
// （BudgetList.jsx は A の担当。tasks.md「コンフリクトを防ぐ約束」）
export default function App() {
  const [month, setMonth] = useState(currentMonth);
  const [category, setCategory] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 前の月の表示が残らないように消してから取り直す
    let ignore = false;
    setSummary(null);
    setError(null);
    getSummary(month)
      .then((data) => {
        if (!ignore) setSummary(data);
      })
      .catch((err) => {
        if (!ignore) setError(err.message);
      });
    // 月をすばやく切り替えたとき、古い月の応答が後から届いても捨てる
    return () => {
      ignore = true;
    };
  }, [month]);

  // 月を変えたらカテゴリの絞り込みは解除する（その月にないカテゴリで 0 件に見えないように）
  function changeMonth(nextMonth) {
    setMonth(nextMonth);
    setCategory(null);
  }

  return (
    <main style={{ fontFamily: "sans-serif", padding: 16 }}>
      <h1>家計簿ダッシュボード</h1>
      <MonthSwitcher month={month} onChange={changeMonth} />
      {error && <p>データを取得できませんでした（{error}）</p>}
      <SummaryCards summary={summary} />
      <CategoryPieChart
        categories={summary?.categories ?? []}
        selectedCategory={category}
        onSelect={setCategory}
      />
      <DailyBarChart daily={summary?.daily ?? []} />
      <BudgetList categories={summary?.categories ?? []} />
      <TransactionList month={month} category={category} />
    </main>
  );
}
