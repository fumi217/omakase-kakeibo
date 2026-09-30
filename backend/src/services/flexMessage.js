// LINE に返すメッセージを作る【担当 A】（contracts/line-bot.md）
// Monthly Summary をそのまま使い、集計はしない（金額を画面と一致させるため。FR-027）

const TOP_CATEGORIES = 3;
const MUTED = "#888888";
// 予算の状態の色（ダッシュボードの BudgetList.jsx と同じ）
const STATUS_COLOR = { warning: "#d97706", over: "#dc2626" };

// "2026-09" → "2026年9月"
function monthLabel(month) {
  const [year, mon] = month.split("-").map(Number);
  return `${year}年${mon}月`;
}

// 45000 → "¥45,000"
function yen(amount) {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

function row(label, value) {
  return {
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: label, size: "sm", flex: 3 },
      { type: "text", text: value, size: "sm", align: "end", flex: 2 },
    ],
  };
}

// 「1. 住居  ¥30,000  ⚠ 100%」。⚠ と使用率は注意・超過のカテゴリだけ（通常・予算なしは空けておく）
function categoryRow(c, i) {
  const color = STATUS_COLOR[c.status];
  return {
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: `${i + 1}. ${c.category}`, size: "sm", flex: 3 },
      { type: "text", text: yen(c.amount), size: "sm", align: "end", flex: 2 },
      color
        ? { type: "text", text: `⚠ ${Math.round(c.usage * 100)}%`, size: "sm", align: "end", flex: 2, color }
        : { type: "filler", flex: 2 },
    ],
  };
}

// 超過したカテゴリごとに「⚠ 交通が予算を ¥2,000 超過」（上位 3 件の外も含める。FR-032）
function overLines(categories) {
  return categories
    .filter((c) => c.status === "over")
    .map((c) => ({
      type: "text",
      text: `⚠ ${c.category}が予算を ${yen(c.amount - c.budget)} 超過`,
      size: "sm",
      color: STATUS_COLOR.over,
      wrap: true,
    }));
}

function note(text) {
  return { type: "text", text, size: "sm", color: MUTED, wrap: true };
}

function dashboardFooter(liffUrl) {
  return {
    type: "box",
    layout: "vertical",
    contents: [{ type: "button", style: "primary", action: { type: "uri", label: "ダッシュボードを開く", uri: liffUrl } }],
  };
}

function summaryBody(summary) {
  // 月は見出しに出ているので、本文には繰り返さない（ダッシュボードの文言とそろえる。spec US2）
  if (summary.transactionCount === 0) return [note("この月の入出金はありません")];

  const top = summary.categories.slice(0, TOP_CATEGORIES);
  const over = overLines(summary.categories);
  return [
    row("入金", yen(summary.totalIncome)),
    row("支出", yen(summary.totalExpense)),
    { type: "separator" },
    note("支出の多いカテゴリ"),
    ...(top.length === 0
      ? [note("支出はまだありません")]
      : top.map(categoryRow)),
    ...(over.length > 0 ? [{ type: "separator" }, ...over] : []),
  ];
}

// 月次サマリーカード。liffUrl がなければボタンを付けない
function summaryMessage(summary, liffUrl) {
  const label = monthLabel(summary.month);
  return {
    type: "flex",
    altText: `${label} 支出 ${yen(summary.totalExpense)}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [{ type: "text", text: `${label}の家計簿`, weight: "bold", size: "lg" }, ...summaryBody(summary)],
      },
      ...(liffUrl ? { footer: dashboardFooter(liffUrl) } : {}),
    },
  };
}

// 「ダッシュボード」への返信。liffUrl がなければ案内だけ返す
function dashboardMessage(liffUrl) {
  if (!liffUrl) return { type: "text", text: "ダッシュボードは準備中です" };
  return {
    type: "flex",
    altText: "ダッシュボードを開く",
    contents: {
      type: "bubble",
      body: { type: "box", layout: "vertical", contents: [note("グラフで支出を確認できます")] },
      footer: dashboardFooter(liffUrl),
    },
  };
}

function usageMessage() {
  return {
    type: "text",
    text: ["使える言葉:", "・今月 … 今月の支出", "・先月 … 先月の支出", "・ダッシュボード … グラフで見る", "下のメニューからも操作できます"].join("\n"),
  };
}

module.exports = { summaryMessage, dashboardMessage, usageMessage };
