import { useState } from "react";
import { UNKNOWN_NAME, isUnknownCategory, unknownLabel } from "../categories.js";
import { formatYen } from "../month.js";

// 最初に出す件数。残りは「すべて表示」で開く（絞り込み中は全件）
const INITIAL_COUNT = 8;
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

// 明細一覧【担当 B】（FR-024・FR-026、spec US2 シナリオ 3）
// props: items（/api/summary の items。新しい順。読み込み中は null）, error（取得に失敗したときのメッセージ）,
//        category（絞り込み。null なら全件）, onClearCategory（絞り込みの解除）
// 明細は集計と一緒に 1 回だけ取得する（#83）。カテゴリの絞り込みは画面側で行う（#66 のレビュー指摘 1）
// 月を切り替えたら「すべて表示」を閉じるため、App.jsx で key={month} を付けて作り直している
export default function TransactionList({ items: allItems, error, category, onClearCategory }) {
  const [showAll, setShowAll] = useState(false);

  const status = error ? "error" : allItems ? "ready" : "loading";
  const all = allItems ?? [];
  const items = category ? all.filter((t) => t.category === category) : all;
  const visible = category || showAll ? items : items.slice(0, INITIAL_COUNT);

  return (
    <section className="section section-tx">
      <div className="section-head">
        <h2>取引</h2>
        {category ? (
          <FilterBar category={category} items={items} ready={status === "ready"} onClear={onClearCategory} />
        ) : (
          status === "ready" && <span className="small muted">新しい順</span>
        )}
      </div>
      {status === "loading" && <p className="muted">読み込み中…</p>}
      {status === "error" && <p className="muted">明細を取得できませんでした（{error}）</p>}
      {status === "ready" && items.length === 0 && (
        <p className="muted">{category ? `${unknownLabel(category) ?? category}の明細はありません` : "この月の明細はありません"}</p>
      )}
      {groupByDate(visible).map(([date, rows]) => (
        <DateGroup key={date} date={date} rows={rows} />
      ))}
      {visible.length < items.length && (
        <button type="button" className="text-button" onClick={() => setShowAll(true)}>
          すべて表示（{items.length} 件）
        </button>
      )}
    </section>
  );
}

// 新しい順に並んだ明細を、日付ごとのまとまりにする → [[date, rows], ...]
function groupByDate(items) {
  const groups = new Map();
  for (const t of items) {
    if (!groups.has(t.date)) groups.set(t.date, []);
    groups.get(t.date).push(t);
  }
  return [...groups];
}

// 「9月30日（水）」の見出しと、その日の支出の合計
function DateGroup({ date, rows }) {
  const [year, mon, day] = date.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, mon - 1, day)).getUTCDay()];
  const spent = rows.filter((t) => t.type === "expense" && !t.isInternalTransfer).reduce((sum, t) => sum + t.amount, 0);
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        className="small muted"
        style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 4px", borderBottom: "1px solid var(--line)" }}
      >
        <span>
          {mon}月{day}日（{weekday}）
        </span>
        {spent > 0 && <span className="num">支出 {formatYen(spent)}</span>}
      </div>
      <ul className="list">
        {rows.map((t) => (
          <TransactionRow key={t.id} transaction={t} />
        ))}
      </ul>
    </div>
  );
}

// 「食費で絞り込み中（6 件・¥11,000） 解除」
function FilterBar({ category, items, ready, onClear }) {
  const total = items.filter((t) => t.type === "expense" && !t.isInternalTransfer).reduce((sum, t) => sum + t.amount, 0);
  return (
    <span className="small" style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span className="num">
        {unknownLabel(category) ?? category}で絞り込み中{ready && `（${items.length} 件・${formatYen(total)}）`}
      </span>
      <button type="button" className="text-button" onClick={onClear}>
        解除
      </button>
    </span>
  );
}

function TransactionRow({ transaction: t }) {
  const isIncome = t.type === "income";
  const unknown = !isIncome && !t.isInternalTransfer && isUnknownCategory(t.category);
  return (
    // 自分の口座間の振替は、一覧には出すが集計に含まれないので薄く表示する（data-model・FR-004）
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid var(--line)",
        opacity: t.isInternalTransfer ? 0.5 : 1,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</div>
        <div className="small muted">
          {t.isInternalTransfer
            ? "振替（集計外）"
            : isIncome
              ? "入金"
              : unknown
                ? `${UNKNOWN_NAME}（${unknownLabel(t.category)}）`
                : t.category}{" "}
          ・ {t.source?.name ?? "不明"}
        </div>
      </div>
      {/* 支出は普通の文字色。入金だけ + を付けて緑にする */}
      <span className="num" style={{ whiteSpace: "nowrap", fontWeight: 600, color: isIncome ? "var(--positive)" : undefined }}>
        {isIncome ? "+" : ""}
        {formatYen(t.amount)}
      </span>
    </li>
  );
}
