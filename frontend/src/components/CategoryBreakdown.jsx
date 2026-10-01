import { useState } from "react";
import { Cell, Pie, PieChart, Tooltip } from "recharts";
import { UNKNOWN_NAME, isUnknownCategory, unknownLabel } from "../categories.js";
import { formatYen } from "../month.js";
import { BudgetUsage } from "./BudgetList.jsx";

// カテゴリ別の支出【担当 B】（FR-022・FR-031、spec US2 シナリオ 3・US3、#69・#73）
// 金額順の一覧に、予算の使用率をまとめて出す。振込・現金は「用途不明金」として 1 行にまとめ、内訳（振込支払・現金引出）は
// カーソルを合わせる（パソコン）かタップする（スマホ）と開く
// 行を押すとそのカテゴリで取引を絞り込み、もう一度押すと解除する
// props: categories, selectedCategory, onSelect(category)

// 円グラフの色: 虹色にせず、チャコール・ゴールド・くすみグリーンの濃淡を金額の多い順に使う
// 使いみちの分かるカテゴリは最大 7 つ（食費・日用品・交通・住居・通信・娯楽・その他）。隣どうしで濃淡が交互になる並び
const SHADES = ["#2f2c28", "#a8843a", "#5f5a52", "#c7a55f", "#7d6331", "#6f7a5a", "#d9c48f"];
// 用途不明金は灰色（ほかのカテゴリと色味で区別する）
const UNKNOWN_COLOR = "#9b958b";

export default function CategoryBreakdown({ categories, selectedCategory, onSelect }) {
  const [unknownOpen, setUnknownOpen] = useState(false);

  function toggle(category) {
    onSelect(category === selectedCategory ? null : category);
  }

  const known = categories.filter((c) => !isUnknownCategory(c.category));
  const unknown = categories.filter((c) => isUnknownCategory(c.category));
  const unknownTotal = unknown.reduce((sum, c) => sum + c.amount, 0);
  const unknownRatio = unknown.reduce((sum, c) => sum + c.ratio, 0);
  // カテゴリ → 色（円グラフと一覧の色の印をそろえる）
  const colors = new Map(known.map((c, i) => [c.category, SHADES[i % SHADES.length]]));

  return (
    <section className="section section-category">
      <div className="section-head">
        <h2>カテゴリ別の支出</h2>
      </div>
      {categories.length === 0 && <p className="muted">この月の支出はありません</p>}

      {categories.length > 0 && (
        <MiniPie
          known={known}
          unknown={unknown}
          unknownTotal={unknownTotal}
          unknownRatio={unknownRatio}
          colors={colors}
          selectedCategory={selectedCategory}
          onToggle={toggle}
          onToggleUnknown={() => setUnknownOpen((open) => !open)}
        />
      )}

      <ul className="list">
        {known.map((c) => (
          <CategoryRow key={c.category} item={c} color={colors.get(c.category)} selectedCategory={selectedCategory} onToggle={toggle} />
        ))}
        {unknown.length > 0 && (
          <UnknownRow
            items={unknown}
            total={unknownTotal}
            ratio={unknownRatio}
            open={unknownOpen}
            onToggleOpen={() => setUnknownOpen((open) => !open)}
            selectedCategory={selectedCategory}
            onToggle={toggle}
          />
        )}
      </ul>
    </section>
  );
}

// 直径 120px の控えめな円グラフ。用途不明金は 1 つにまとめ、横に支出の合計と用途不明金の割合を添える
function MiniPie({ known, unknown, unknownTotal, unknownRatio, colors, selectedCategory, onToggle, onToggleUnknown }) {
  const slices = [
    ...known.map((c) => ({ key: c.category, amount: c.amount, color: colors.get(c.category) })),
    ...(unknown.length > 0 ? [{ key: UNKNOWN_NAME, amount: unknownTotal, color: UNKNOWN_COLOR }] : []),
  ];
  const total = slices.reduce((sum, s) => sum + s.amount, 0);
  const isSelected = (key) =>
    selectedCategory === key || (key === UNKNOWN_NAME && isUnknownCategory(selectedCategory));

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 16 }}>
      <PieChart width={120} height={120}>
        <Pie
          data={slices}
          dataKey="amount"
          nameKey="key"
          innerRadius={38}
          outerRadius={58}
          stroke="var(--panel)"
          strokeWidth={2}
          // 用途不明金は内訳を開く。ほかのカテゴリは取引を絞り込む
          onClick={(_, index) => (slices[index].key === UNKNOWN_NAME ? onToggleUnknown() : onToggle(slices[index].key))}
          isAnimationActive={false}
        >
          {slices.map((s) => (
            <Cell
              key={s.key}
              fill={s.color}
              opacity={selectedCategory && !isSelected(s.key) ? 0.3 : 1}
              style={{ cursor: "pointer" }}
            />
          ))}
        </Pie>
        <Tooltip content={<PieTooltip unknown={unknown} />} />
      </PieChart>
      <div>
        <div style={{ fontSize: 13 }}>支出</div>
        <div className="num" style={{ fontSize: 20, fontWeight: 600 }}>
          {formatYen(total)}
        </div>
        {unknown.length > 0 && (
          <div className="num" style={{ fontSize: 13 }}>
            うち{UNKNOWN_NAME} <strong>{Math.round(unknownRatio * 100)}%</strong>
          </div>
        )}
      </div>
    </div>
  );
}

// 円グラフにカーソルを合わせたときの表示。用途不明金は内訳（振込支払・現金引出）も出す
function PieTooltip({ active, payload, unknown }) {
  if (!active || !payload?.length) return null;
  const { key, amount } = payload[0].payload;
  return (
    <div className="small" style={{ padding: "6px 10px", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8 }}>
      <div style={{ fontWeight: 600 }}>
        {key} <span className="num">{formatYen(amount)}</span>
      </div>
      {key === UNKNOWN_NAME && <UnknownBreakdownText items={unknown} />}
    </div>
  );
}

function UnknownBreakdownText({ items }) {
  return items.map((c) => (
    <div key={c.category} className="num">
      {unknownLabel(c.category)} {formatYen(c.amount)}
    </div>
  ));
}

const rowButtonStyle = {
  display: "block",
  width: "100%",
  padding: "10px 0",
  border: "none",
  background: "none",
  textAlign: "left",
  cursor: "pointer",
};

function CategoryRow({ item: c, color, selectedCategory, onToggle }) {
  const selected = selectedCategory === c.category;
  return (
    <li style={{ borderBottom: "1px solid var(--line)" }}>
      <button
        type="button"
        onClick={() => onToggle(c.category)}
        aria-pressed={selected}
        // 絞り込み中は、選んだカテゴリ以外を薄くする
        style={{ ...rowButtonStyle, opacity: selectedCategory && !selected ? 0.4 : 1 }}
      >
        <span style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: selected ? 600 : 400 }}>
            {/* 円グラフの色の印 */}
            <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
            {c.category}
          </span>
          {c.budget == null && <span className="small muted num">{(c.ratio * 100).toFixed(1)}% ・ 予算なし</span>}
        </span>
        {/* 予算があれば予算に対する使用率、なければ支出全体に占める割合を棒で出す */}
        {c.budget != null ? (
          <BudgetUsage item={c} />
        ) : (
          <>
            <span className="num" style={{ display: "block" }}>{formatYen(c.amount)}</span>
            <span className="usage-bar" style={{ display: "block" }}>
              <span style={{ display: "block", width: `${c.ratio * 100}%`, background: "var(--faint)" }} />
            </span>
          </>
        )}
      </button>
    </li>
  );
}

// 用途不明金の 1 行。カーソルを合わせる（パソコン）か、タップする（スマホ）と内訳が開く
// 内訳の「振込支払」「現金引出」を押すと、その取引だけに絞り込む
function UnknownRow({ items, total, ratio, open, onToggleOpen, selectedCategory, onToggle }) {
  const [hover, setHover] = useState(false);
  const selectedHere = isUnknownCategory(selectedCategory);
  const expanded = open || hover || selectedHere;

  return (
    <li
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ borderBottom: "1px solid var(--line)", opacity: selectedCategory && !selectedHere ? 0.4 : 1 }}
    >
      <button type="button" onClick={onToggleOpen} aria-expanded={expanded} style={rowButtonStyle}>
        <span style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: UNKNOWN_COLOR }} />
            {UNKNOWN_NAME}
            <span className="small muted">{expanded ? "▴" : "▾"}</span>
          </span>
          <span className="small muted num">{(ratio * 100).toFixed(1)}%</span>
        </span>
        <span className="num" style={{ display: "block" }}>{formatYen(total)}</span>
        <span className="usage-bar unknown" style={{ display: "block" }}>
          <span style={{ display: "block", width: `${ratio * 100}%` }} />
        </span>
      </button>

      {expanded && (
        <div style={{ padding: "0 0 10px 16px" }}>
          <p className="small muted" style={{ margin: "0 0 4px" }}>
            ATM の引き出しや振込は、明細から使いみちが分かりません。
          </p>
          {items.map((c) => {
            const selected = selectedCategory === c.category;
            return (
              <button
                key={c.category}
                type="button"
                onClick={() => onToggle(c.category)}
                aria-pressed={selected}
                style={{
                  ...rowButtonStyle,
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px 0",
                  fontWeight: selected ? 600 : 400,
                }}
              >
                <span>{unknownLabel(c.category)}</span>
                <span className="num">{formatYen(c.amount)}</span>
              </button>
            );
          })}
        </div>
      )}
    </li>
  );
}
