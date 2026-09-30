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

// 予算の状態つきのカテゴリ（summary.js の出力と同じ形）
function cat(category, amount, budget = null, usage = null, status = null) {
  return { category, amount, ratio: 0, budget, usage, status };
}

// Flex Message の入れ子から、指定した文言の text ノードを探す
function findText(node, text) {
  if (Array.isArray(node)) return node.map((n) => findText(n, text)).find(Boolean);
  if (!node || typeof node !== "object") return undefined;
  if (node.type === "text" && node.text === text) return node;
  return findText(Object.values(node), text);
}

test("上位 3 件のうち注意・超過のカテゴリには ⚠ と使用率（%）を付ける。通常・予算なしには付けない", () => {
  const categories = [
    cat("住居", 30000, 30000, 1, "warning"),
    cat("食費", 12000, 30000, 0.4, "normal"),
    cat("その他", 3000),
  ];
  const message = summaryMessage(summary({ categories }), LIFF_URL);
  const all = texts(message);

  assert.ok(all.includes("⚠ 100%"));
  assert.equal(all.filter((t) => t.startsWith("⚠")).length, 1);
  assert.equal(findText(message, "⚠ 100%").color, "#d97706");
});

test("超過したカテゴリは「⚠ 交通が予算を ¥2,000 超過」の行を出す（spec US3 シナリオ 2・FR-032）", () => {
  const categories = [cat("交通", 12000, 10000, 1.2, "over")];
  const message = summaryMessage(summary({ categories }), LIFF_URL);
  const all = texts(message);

  assert.ok(all.includes("⚠ 120%"));
  assert.equal(findText(message, "⚠ 120%").color, "#dc2626");
  assert.ok(all.includes("⚠ 交通が予算を ¥2,000 超過"));
});

test("超過の行は、上位 3 件に入らないカテゴリも含めて、超過したカテゴリごとに出す", () => {
  const categories = [
    cat("住居", 70000, 60000, 1.167, "over"),
    cat("食費", 20000, 30000, 0.667, "normal"),
    cat("その他", 15000),
    cat("交通", 10001, 10000, 1, "over"),
  ];
  const all = texts(summaryMessage(summary({ categories }), LIFF_URL));

  assert.deepEqual(
    all.filter((t) => t.includes("超過")),
    ["⚠ 住居が予算を ¥10,000 超過", "⚠ 交通が予算を ¥1 超過"],
  );
  assert.ok(!all.includes("4. 交通"));
});

test("超過したカテゴリがなければ、超過の行は出さない", () => {
  const categories = [cat("食費", 27000, 30000, 0.9, "warning")];
  const all = texts(summaryMessage(summary({ categories }), LIFF_URL));

  assert.ok(all.includes("⚠ 90%"));
  assert.ok(!all.some((t) => t.includes("超過")));
});

test("明細が 0 件の月は、本文を「この月の入出金はありません」にする（月は見出しに出す）", () => {
  const empty = summary({ month: "2026-09", totalIncome: 0, totalExpense: 0, transactionCount: 0, categories: [] });
  const message = summaryMessage(empty, LIFF_URL);
  const all = texts(message);

  assert.equal(all[0], "2026年9月の家計簿");
  assert.ok(all.includes("この月の入出金はありません"));
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
