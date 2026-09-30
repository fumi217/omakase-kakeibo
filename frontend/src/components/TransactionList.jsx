import { useEffect, useState } from "react";
import { getTransactions } from "../api/client.js";
import { formatYen } from "../month.js";

// 明細一覧【担当 B】（FR-024・FR-026、spec US2 シナリオ 3）
// props: month, category（絞り込み。null なら全件）, onClearCategory（絞り込みの解除）
export default function TransactionList({ month, category, onClearCategory }) {
  const [state, setState] = useState({ status: "loading", items: [] });

  // 明細は月ごとに 1 回だけ取得し、カテゴリの絞り込みは画面側で行う
  // （絞り込むたびに sunabar へ問い合わせると数秒かかるため。#66 のレビュー指摘 1）
  useEffect(() => {
    // 月を切り替えたとき、古い応答が後から届いても捨てる
    let ignore = false;
    setState({ status: "loading", items: [] });
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

  return (
    <section>
      <h2>明細（新しい順）</h2>
      {category && <FilterBar category={category} items={items} ready={status === "ready"} onClear={onClearCategory} />}
      {status === "loading" && <p>読み込み中…</p>}
      {status === "error" && <p>明細を取得できませんでした（{state.message}）</p>}
      {status === "ready" && items.length === 0 && (
        <p>{category ? `${category}の明細はありません` : "この月の明細はありません"}</p>
      )}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((t) => (
          <TransactionRow key={t.id} transaction={t} />
        ))}
      </ul>
    </section>
  );
}

// 「食費で絞り込み中（6 件・¥11,000） 解除 ×」
function FilterBar({ category, items, ready, onClear }) {
  const total = items.filter((t) => t.type === "expense" && !t.isInternalTransfer).reduce((sum, t) => sum + t.amount, 0);
  return (
    <p style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span>
        {category}で絞り込み中{ready && `（${items.length} 件・${formatYen(total)}）`}
      </span>
      <button type="button" onClick={onClear}>
        解除 ×
      </button>
    </p>
  );
}

function TransactionRow({ transaction: t }) {
  const [, mon, day] = t.date.split("-").map(Number);
  const isIncome = t.type === "income";
  return (
    // 自分の口座間の振替は、一覧には出すが集計に含まれないので薄く表示する（data-model・FR-004）
    <li style={{ padding: "8px 0", borderBottom: "1px solid #eee", opacity: t.isInternalTransfer ? 0.5 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span>
          {mon}/{day} {t.description}
        </span>
        <strong style={{ color: isIncome ? "#1a7f37" : "inherit", whiteSpace: "nowrap" }}>
          {isIncome ? "+" : "−"}
          {formatYen(t.amount)}
        </strong>
      </div>
      <div style={{ fontSize: 12, color: "#666" }}>
        {t.isInternalTransfer ? "振替（集計外）" : t.category} ・ {t.source?.name ?? "不明"}
      </div>
    </li>
  );
}
