const test = require("node:test");
const assert = require("node:assert/strict");
const { summaryMessage, dashboardMessage, usageMessage } = require("../../src/services/flexMessage");
const sample = require("../fixtures/summary.sample.json");

const LIFF_URL = "https://miniapp.line.me/0000000000-abcdefgh";

// Flex Message の入れ子から text を順に集める（レイアウトの細部に左右されずに中身を確かめるため）
function texts(node) {
  if (Array.isArray(node)) return node.flatMap(texts);
  if (!node || typeof node !== "object") return [];
  return [...(node.type === "text" ? [node.text] : []), ...Object.values(node).flatMap(texts)];
}

// uri アクションのボタンを集める
function uriButtons(node) {
  if (Array.isArray(node)) return node.flatMap(uriButtons);
  if (!node || typeof node !== "object") return [];
  return [...(node.type === "button" && node.action?.type === "uri" ? [node.action] : []), ...Object.values(node).flatMap(uriButtons)];
}

function summary(overrides = {}) {
  return { ...sample, ...overrides };
}

test("見出しは「2026年10月の家計簿」、入金と支出を ¥ とカンマで出す", () => {
  const all = texts(summaryMessage(summary(), LIFF_URL));
  assert.equal(all[0], "2026年10月の家計簿");
  assert.ok(all.includes("¥300,000"));
  assert.ok(all.includes("¥45,000"));
});

test("月は 0 埋めしない（2026-09 → 2026年9月）", () => {
  const all = texts(summaryMessage(summary({ month: "2026-09" }), LIFF_URL));
  assert.equal(all[0], "2026年9月の家計簿");
});

test("altText は「2026年10月 支出 ¥45,000」", () => {
  const message = summaryMessage(summary(), LIFF_URL);
  assert.equal(message.type, "flex");
  assert.equal(message.altText, "2026年10月 支出 ¥45,000");
  assert.equal(message.contents.type, "bubble");
});

test("支出の多いカテゴリは上位 3 つまで、順位と金額を付ける", () => {
  const categories = ["住居", "食費", "交通", "その他"].map((category, i) => ({
    category,
    amount: 40000 - i * 10000,
    ratio: 0,
    budget: null,
    usage: null,
    status: null,
  }));
  const all = texts(summaryMessage(summary({ categories }), LIFF_URL));

  assert.ok(all.includes("支出の多いカテゴリ"));
  assert.ok(all.includes("1. 住居"));
  assert.ok(all.includes("2. 食費"));
  assert.ok(all.includes("3. 交通"));
  assert.ok(all.includes("¥20,000"));
  assert.ok(!all.includes("4. その他"));
});

test("明細が 0 件の月は、本文を「2026年9月の入出金はありません」にする", () => {
  const empty = summary({ month: "2026-09", totalIncome: 0, totalExpense: 0, transactionCount: 0, categories: [] });
  const message = summaryMessage(empty, LIFF_URL);
  const all = texts(message);

  assert.ok(all.includes("2026年9月の入出金はありません"));
  assert.ok(!all.includes("支出の多いカテゴリ"));
  assert.equal(message.altText, "2026年9月 支出 ¥0");
});

test("入金だけで支出がない月は、カテゴリ欄に「支出はまだありません」と出す", () => {
  const incomeOnly = summary({ totalExpense: 0, transactionCount: 1, categories: [] });
  const all = texts(summaryMessage(incomeOnly, LIFF_URL));

  assert.ok(all.includes("¥300,000"));
  assert.ok(all.includes("¥0"));
  assert.ok(all.includes("支出はまだありません"));
});

test("LIFF_URL があれば「ダッシュボードを開く」ボタンを付ける", () => {
  assert.deepEqual(uriButtons(summaryMessage(summary(), LIFF_URL)), [
    { type: "uri", label: "ダッシュボードを開く", uri: LIFF_URL },
  ]);
});

test("LIFF_URL が未設定ならボタンを付けない", () => {
  const message = summaryMessage(summary(), undefined);
  assert.deepEqual(uriButtons(message), []);
  assert.equal(message.contents.footer, undefined);
});

test("ダッシュボードのメッセージは LIFF_URL を開くボタンを持つ", () => {
  const message = dashboardMessage(LIFF_URL);
  assert.equal(message.type, "flex");
  assert.ok(message.altText);
  assert.deepEqual(uriButtons(message), [{ type: "uri", label: "ダッシュボードを開く", uri: LIFF_URL }]);
});

test("LIFF_URL が未設定なら、ダッシュボードのメッセージは準備中のテキストにする", () => {
  const message = dashboardMessage(undefined);
  assert.equal(message.type, "text");
  assert.match(message.text, /準備中/);
});

test("使い方メッセージは contracts の文言どおり", () => {
  assert.deepEqual(usageMessage(), {
    type: "text",
    text: ["使える言葉:", "・今月 … 今月の支出", "・先月 … 先月の支出", "・ダッシュボード … グラフで見る", "下のメニューからも操作できます"].join("\n"),
  });
});
