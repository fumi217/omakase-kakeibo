import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatYen } from "../month.js";

// カテゴリごとの色。月を切り替えても同じカテゴリは同じ色にする（category-rules.json のカテゴリ）
const COLORS = {
  食費: "#f28b30",
  日用品: "#58a55c",
  交通: "#3b82c4",
  住居: "#8e6cc7",
  通信: "#1fa5a5",
  娯楽: "#e05a8a",
  振込: "#9aa3ad",
  現金: "#c9a227",
  その他: "#b0b7bf",
};
const FALLBACK_COLOR = "#b0b7bf";

// カテゴリ別の円グラフ。props: categories, selectedCategory, onSelect(category)【担当 B】（FR-022、spec US2 シナリオ 3）
// 円か下の一覧を押すとそのカテゴリで絞り込み、もう一度押すと解除する
export default function CategoryPieChart({ categories, selectedCategory, onSelect }) {
  function toggle(category) {
    onSelect(category === selectedCategory ? null : category);
  }

  return (
    <section>
      <h2>カテゴリ別の支出</h2>
      {categories.length === 0 ? (
        <p>この月の支出はありません</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={categories}
                dataKey="amount"
                nameKey="category"
                innerRadius={50}
                outerRadius={90}
                onClick={(_, index) => toggle(categories[index].category)}
                isAnimationActive={false}
              >
                {categories.map((c) => (
                  <Cell
                    key={c.category}
                    fill={COLORS[c.category] ?? FALLBACK_COLOR}
                    // 絞り込み中は選んだカテゴリ以外を薄くする
                    opacity={selectedCategory && selectedCategory !== c.category ? 0.3 : 1}
                    style={{ cursor: "pointer" }}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatYen(value)} />
            </PieChart>
          </ResponsiveContainer>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {categories.map((c) => (
              <li key={c.category}>
                <button
                  type="button"
                  onClick={() => toggle(c.category)}
                  aria-pressed={selectedCategory === c.category}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "6px 4px",
                    border: "none",
                    background: selectedCategory === c.category ? "#f0f4f8" : "transparent",
                    font: "inherit",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{ width: 12, height: 12, borderRadius: 2, background: COLORS[c.category] ?? FALLBACK_COLOR }}
                  />
                  <span style={{ flex: 1 }}>{c.category}</span>
                  <span>{formatYen(c.amount)}</span>
                  <span style={{ width: 48, textAlign: "right", color: "#666" }}>{Math.round(c.ratio * 100)}%</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
