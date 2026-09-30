import { formatYen } from "../month.js";

// 予算の使用率。props: categories（Monthly Summary の categories。budget / usage / status を含む）【担当 A】
// FR-031・spec US3。並びはサマリーと同じ支出の多い順。予算のないカテゴリは金額だけ出す（シナリオ 3）
// 色は LINE のカード（backend/src/services/flexMessage.js）と同じ
const STATUS = {
  normal: { label: "", color: "#1a7f37" },
  warning: { label: "注意", color: "#d97706" },
  over: { label: "超過", color: "#dc2626" },
};

export default function BudgetList({ categories }) {
  // 読み込み中・取得失敗・支出のない月は categories が空。案内は App.jsx と SummaryCards が出すので、ここは何も出さない
  if (categories.length === 0) return null;

  return (
    <section>
      <h2>予算</h2>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {categories.map((c) => (
          <BudgetRow key={c.category} item={c} />
        ))}
      </ul>
    </section>
  );
}

function BudgetRow({ item: c }) {
  if (c.budget == null) {
    return (
      <li style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span>{c.category}</span>
          <span>
            {formatYen(c.amount)}
            <span style={{ fontSize: 12, color: "#666" }}>（予算なし）</span>
          </span>
        </div>
      </li>
    );
  }

  const { label, color } = STATUS[c.status] ?? STATUS.normal;
  const percent = Math.round(c.usage * 100);
  return (
    <li style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span>{c.category}</span>
        <span>
          {formatYen(c.amount)} / {formatYen(c.budget)}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
        {/* バーは 100% で頭打ち。超過は色と文字で伝える */}
        <div
          role="progressbar"
          aria-label={`${c.category}の予算の使用率`}
          aria-valuenow={Math.min(percent, 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={`${percent}%${label && ` ${label}`}`}
          style={{ flex: 1, height: 8, background: "#eee", borderRadius: 4, overflow: "hidden" }}
        >
          <div style={{ width: `${Math.min(percent, 100)}%`, height: "100%", background: color }} />
        </div>
        <strong style={{ color, whiteSpace: "nowrap", fontSize: 14 }}>
          {percent}%{label && ` ${label}`}
        </strong>
      </div>
    </li>
  );
}
