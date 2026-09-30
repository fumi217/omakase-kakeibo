import { Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatYen } from "../month.js";

// "2026-09-05" → 5
function dayOf(date) {
  return Number(date.slice(8, 10));
}

// 日別の支出グラフ。props: daily（[{ date, expense }]。0 円の日も含む）【担当 B】（FR-023）
// 横長・低めにし、縦の目盛りと罫線は出さない。意味のある線は「日平均」だけにする（#69）
// 棒の色はカテゴリと関係のないチャコール（特定のカテゴリの支出に見えないように。#68 のレビュー提案 2）
export default function DailyBarChart({ daily }) {
  const total = daily.reduce((sum, d) => sum + d.expense, 0);
  const average = daily.length > 0 ? Math.round(total / daily.length) : 0;
  const max = daily.reduce((top, d) => (d.expense > (top?.expense ?? 0) ? d : top), null);
  // 目盛りは 1 日と 5 日おき（1, 5, 10, …）にそろえる（自動だと間隔がばらつくため）
  const ticks = daily.map((d) => d.date).filter((date) => dayOf(date) === 1 || dayOf(date) % 5 === 0);

  return (
    <section className="section section-daily">
      <div className="section-head">
        <h2>日別の支出</h2>
        {total > 0 && (
          <span className="small muted num">
            日平均 {formatYen(average)}
            {max && ` ・ 最大 ${Number(max.date.slice(5, 7))}/${dayOf(max.date)} ${formatYen(max.expense)}`}
          </span>
        )}
      </div>
      {daily.length > 0 && (
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={daily} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap="20%">
            <XAxis
              dataKey="date"
              ticks={ticks}
              interval={0}
              tickFormatter={dayOf}
              tick={{ fontSize: 11, fill: "#45403a" }}
              axisLine={{ stroke: "#e6e0d5" }}
              tickLine={false}
            />
            {/* 日平均の線を引くための縦軸（表示はしない） */}
            <YAxis hide />
            <Tooltip
              cursor={{ fill: "#f1ede5" }}
              labelFormatter={(date) => `${Number(date.slice(5, 7))}/${dayOf(date)}`}
              formatter={(value) => [formatYen(value), "支出"]}
            />
            {average > 0 && <ReferenceLine y={average} stroke="#a39d93" strokeDasharray="3 3" />}
            <Bar dataKey="expense" fill="#6e675d" radius={[2, 2, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
