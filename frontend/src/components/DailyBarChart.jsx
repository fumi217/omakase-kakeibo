import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatYen } from "../month.js";

// "2026-09-05" → 5
function dayOf(date) {
  return Number(date.slice(8, 10));
}

// 1 万円以上は「1.2万」のように短くする（スマホの幅で目盛りが切れないように）
function shortYen(n) {
  return n >= 10000 ? `${n / 10000}万` : n.toLocaleString("ja-JP");
}

// 日別の支出グラフ。props: daily（[{ date, expense }]。0 円の日も含む）【担当 B】（FR-023）
export default function DailyBarChart({ daily }) {
  return (
    <section>
      <h2>日別の支出</h2>
      {daily.length > 0 && (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={daily} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#eee" />
            <XAxis dataKey="date" tickFormatter={dayOf} interval="preserveStartEnd" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={shortYen} width={44} tick={{ fontSize: 12 }} />
            <Tooltip
              labelFormatter={(date) => `${Number(date.slice(5, 7))}/${dayOf(date)}`}
              formatter={(value) => [formatYen(value), "支出"]}
            />
            <Bar dataKey="expense" fill="#3b82c4" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
