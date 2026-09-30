// LINE に返すメッセージを作る【担当 A】（contracts/line-bot.md）
// Monthly Summary をそのまま使い、ここでは計算しない（金額を画面と一致させるため。FR-027）
// 予算の超過の行（FR-032）は A6（#27・T047）で入れる

const TOP_CATEGORIES = 3;
const MUTED = "#888888";

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
  const label = monthLabel(summary.month);
  if (summary.transactionCount === 0) return [note(`${label}の入出金はありません`)];

  const top = summary.categories.slice(0, TOP_CATEGORIES);
  return [
    row("入金", yen(summary.totalIncome)),
    row("支出", yen(summary.totalExpense)),
    { type: "separator" },
    note("支出の多いカテゴリ"),
    ...(top.length === 0
      ? [note("支出はまだありません")]
      : top.map((c, i) => row(`${i + 1}. ${c.category}`, yen(c.amount)))),
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
