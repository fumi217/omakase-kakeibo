import { currentMonth, daysInMonth, formatYen, todayDate } from "../month.js";

// 画面の主役: 今月の支出と予算の残り。補助指標（収入・収支・貯蓄率・件数）は下に小さく【担当 B】（FR-003・FR-031、#69）
// props: month, summary（Monthly Summary。読み込み中は null）, error（取得に失敗したときのメッセージ）
export default function SummaryCards({ month, summary, error }) {
  const failed = Boolean(error);
  // 読み込み中は「…」、取得に失敗したら「-」（#64 のレビュー指摘 1）
  const show = (value, format = formatYen) => (failed ? "-" : value == null ? "…" : format(value));
  const label = month === currentMonth() ? "今月" : `${Number(month.slice(5))}月`;

  const income = summary?.totalIncome;
  const expense = summary?.totalExpense;
  const balance = summary ? income - expense : null;
  // 貯蓄率 = (収入 − 支出) / 収入。収入がない月は出さない
  const savingRate = summary && income > 0 ? balance / income : null;

  return (
    <section className="hero">
      <div className="muted">{label}の支出</div>
      <div className="hero-amount num">{show(expense)}</div>
      <BudgetProgress month={month} categories={summary?.categories} budgets={summary?.budgets} />

      <dl className="stats">
        <Stat label="収入" value={show(income)} />
        <Stat label="収支" value={show(balance, (n) => `${n >= 0 ? "+" : "−"}${formatYen(Math.abs(n))}`)} />
        <Stat label="貯蓄率" value={summary && savingRate == null ? "-" : show(savingRate, (r) => `${(r * 100).toFixed(1)}%`)} />
        <Stat label="取引" value={show(summary?.transactionCount, (n) => `${n} 件`)} />
      </dl>
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className="num">{value}</dd>
    </div>
  );
}

// 予算の残りと進捗。予算は /api/summary の budgets（/mock/budget と同じ形）を使う（#83）
// サマリーの categories には支出のあったカテゴリの予算しか入らないため、合計は budgets から出す
function BudgetProgress({ month, categories, budgets }) {
  if (!budgets || !categories) return null;
  const total = Object.values(budgets).reduce((sum, n) => sum + n, 0);
  if (total === 0) return null;

  // 予算のあるカテゴリの支出だけを数える（振込・現金は使いみちが分からず、予算もない）
  const used = categories.filter((c) => budgets[c.category] != null).reduce((sum, c) => sum + c.amount, 0);
  const remaining = total - used;
  const overs = categories.filter((c) => c.status === "over");
  const isCurrent = month === currentMonth();
  const days = daysInMonth(month);
  // 目安の位置: 今月は今日まで経過した割合、過去の月は月末（100%）
  const elapsed = isCurrent ? todayDate() / days : 1;

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <span>
          <span className="muted">{remaining >= 0 ? "残り " : "超過 "}</span>
          <strong className="num" style={{ fontSize: 20, color: remaining < 0 ? "var(--danger)" : undefined }}>
            {formatYen(Math.abs(remaining))}
          </strong>
        </span>
        <span className="small muted num">予算 {formatYen(total)}</span>
      </div>
      <div
        className="budget-bar"
        role="progressbar"
        aria-label="予算の使用率"
        aria-valuenow={Math.min(Math.round((used / total) * 100), 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="fill"
          style={{ width: `${Math.min((used / total) * 100, 100)}%`, background: remaining < 0 ? "var(--danger)" : "var(--accent)" }}
        />
        {isCurrent && <div className="marker" style={{ left: `calc(${elapsed * 100}% - 1px)` }} title="今日までの目安" />}
      </div>
      {/* 合計が予算内でも、超過したカテゴリは隠さない（LINE のカードの「⚠ 交通が予算を ¥2,000 超過」とそろえる。#72 のレビュー指摘 1） */}
      {overs.map((c) => (
        <div key={c.category} className="small" style={{ color: "var(--danger)", fontWeight: 600 }}>
          {c.category}が予算を {formatYen(c.amount - c.budget)} 超過しています。
        </div>
      ))}
      <div className="small muted">
        {budgetMessage({ used, total, remaining, isCurrent, elapsed, days, hasOver: overs.length > 0 })}
      </div>
    </div>
  );
}

// 予算について 1 行で伝える。今月は「目安（今日までに使ってよい額）」と比べる
function budgetMessage({ used, total, remaining, isCurrent, elapsed, days, hasOver }) {
  if (remaining < 0) return "予算を超えています。";
  // 超過したカテゴリがある月は「収まりました」と言わない
  if (!isCurrent) return hasOver ? "" : "予算内に収まりました。";
  const pace = Math.round(total * elapsed);
  if (used > pace) return `今日までの目安（${formatYen(pace)}）より ${formatYen(used - pace)} 多く使っています。`;
  const daysLeft = days - Math.round(elapsed * days) + 1;
  return `残り ${daysLeft} 日、1 日あたり ${formatYen(Math.floor(remaining / daysLeft))} まで使えます。`;
}
