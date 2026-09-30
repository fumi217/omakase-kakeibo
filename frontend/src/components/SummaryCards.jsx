import { formatYen } from "../month.js";

// 入金・支出の合計。props: summary（Monthly Summary。読み込み中は null）【担当 B】（FR-003）
export default function SummaryCards({ summary }) {
  return (
    <section style={{ display: "flex", gap: 12, margin: "12px 0" }}>
      <Card label="入金" amount={summary?.totalIncome} />
      <Card label="支出" amount={summary?.totalExpense} />
    </section>
  );
}

function Card({ label, amount }) {
  return (
    <div style={{ flex: 1, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
      <div style={{ fontSize: 14, color: "#666" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: "bold" }}>{amount == null ? "…" : formatYen(amount)}</div>
    </div>
  );
}
