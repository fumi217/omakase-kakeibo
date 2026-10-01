import { formatYen } from "../month.js";

// 予算の使用率（1 カテゴリ分）【担当 A】FR-031・spec US3
// #69 で「カテゴリ別の支出」（CategoryBreakdown.jsx）の各行に統合したため、一覧ではなく 1 行分の部品として export する
// 注意・超過の色は LINE のカード（backend/src/services/flexMessage.js）と同じ。通常は色を付けない（静かな表示にする）
const STATUS = {
  normal: { label: "", color: "#6e675d" },
  warning: { label: "注意", color: "#d97706" },
  over: { label: "超過", color: "#dc2626" },
};

// props: item（Monthly Summary の categories の 1 件。budget がある前提）
// CategoryBreakdown の行の <button> の中に置かれるので、div ではなく span（display: block / flex）で組む（#78）
export function BudgetUsage({ item: c }) {
  const { label, color } = STATUS[c.status] ?? STATUS.normal;
  const percent = Math.round(c.usage * 100);
  return (
    <>
      <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span className="num">
          {formatYen(c.amount)}
          <span className="small muted"> / {formatYen(c.budget)}</span>
        </span>
        <span className="small num" style={{ color: label ? color : "var(--muted)", fontWeight: label ? 600 : 400 }}>
          {percent}%{label && ` ${label}`}
        </span>
      </span>
      {/* バーは 100% で頭打ち。超過は色と文字で伝える */}
      <span
        role="progressbar"
        aria-label={`${c.category}の予算の使用率`}
        aria-valuenow={Math.min(percent, 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${percent}%${label && ` ${label}`}`}
        className="usage-bar"
        style={{ display: "block" }}
      >
        <span style={{ display: "block", width: `${Math.min(percent, 100)}%`, background: color }} />
      </span>
    </>
  );
}
