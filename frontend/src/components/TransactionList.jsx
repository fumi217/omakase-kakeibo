import { useEffect, useState } from "react";
import { getTransactions } from "../api/client.js";
import { isUnknownCategory } from "../categories.js";
import { formatYen } from "../month.js";

// 最初に出す件数。残りは「すべて表示」で開く（絞り込み中は全件）
const INITIAL_COUNT = 8;
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

// 明細一覧【担当 B】（FR-024・FR-026、spec US2 シナリオ 3）
// props: month, category（絞り込み。null なら全件）, onClearCategory（絞り込みの解除）
export default function TransactionList({ month, category, onClearCategory }) {
  const [state, setState] = useState({ status: "loading", items: [] });
  const [showAll, setShowAll] = useState(false);

  // 明細は月ごとに 1 回だけ取得し、カテゴリの絞り込みは画面側で行う
  // （絞り込むたびに sunabar へ問い合わせると数秒かかるため。#66 のレビュー指摘 1）
  useEffect(() => {
    // 月を切り替えたとき、古い応答が後から届いても捨てる
    let ignore = false;
    setState({ status: "loading", items: [] });
    setShowAll(false);
    getTransactions(month)
      .then((data) => {
        if (!ignore) setState({ status: "ready", items: data.items ?? [] });
      })
      .catch((err) => {
        if (!ignore) setState({ status: "error", message: err.message, items: [] });
      });
    return () => {
      ignore = true;
    };
  }, [month]);

  const { status } = state;
  const items = category ? state.items.filter((t) => t.category === category) : state.items;
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
      {status === "error" && <p className="muted">明細を取得できませんでした（{state.message}）</p>}
      {status === "ready" && items.length === 0 && (
        <p className="muted">{category ? `${category}の明細はありません` : "この月の明細はありません"}</p>
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
        {category}で絞り込み中{ready && `（${items.length} 件・${formatYen(total)}）`}
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
          {t.isInternalTransfer ? "振替（集計外）" : isIncome ? "入金" : t.category}
          {unknown && "（使いみち不明）"} ・ {t.source?.name ?? "不明"}
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
