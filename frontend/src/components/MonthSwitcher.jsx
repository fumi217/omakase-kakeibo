import { addMonths, currentMonth, formatMonth } from "../month.js";

// 前の月 / 次の月。props: month（YYYY-MM）, onChange(month)【担当 B】（FR-025）
// 今月を表示しているときは「次の月」を押せない（未来の月には進まない。2 人で決定）
export default function MonthSwitcher({ month, onChange }) {
  const isCurrentMonth = month >= currentMonth();

  return (
    <nav className="month-switcher">
      <button type="button" onClick={() => onChange(addMonths(month, -1))} aria-label="前の月">
        ‹
      </button>
      <strong className="num">{formatMonth(month)}</strong>
      <button type="button" onClick={() => onChange(addMonths(month, 1))} disabled={isCurrentMonth} aria-label="次の月">
        ›
      </button>
    </nav>
  );
}
