import { formatYen } from "../month.js";

// 入金・支出の合計。props: summary（Monthly Summary。読み込み中は null）, error（取得失敗のとき true 相当）【担当 B】（FR-003）
export default function SummaryCards({ summary, error }) {
  return (
    <section style={{ display: "flex", gap: 12, margin: "12px 0" }}>
      <Card label="入金" amount={summary?.totalIncome} failed={Boolean(error)} />
      <Card label="支出" amount={summary?.totalExpense} failed={Boolean(error)} />
    </section>
  );
}

// 読み込み中は「…」、取得に失敗したら「-」（#64 のレビュー指摘 1）
function Card({ label, amount, failed }) {
  const text = failed ? "-" : amount == null ? "…" : formatYen(amount);
  return (
    <div style={{ flex: 1, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
      <div style={{ fontSize: 14, color: "#666" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: "bold" }}>{text}</div>
    </div>
  );
}
