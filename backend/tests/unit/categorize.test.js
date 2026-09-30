const test = require("node:test");
const assert = require("node:assert/strict");
const { categorize } = require("../../src/mock/categorize");

// data-model.md「Category」「Category Rule」
const CATEGORIES = ["食費", "日用品", "交通", "住居", "通信", "娯楽", "振込", "現金", "その他"];

test("sunabar の実際の摘要: ATM は「セブン」を含んでも現金（ATM のルールをコンビニより上に置く）", () => {
  assert.equal(categorize("ATM セブン").category, "現金");
  assert.equal(categorize("ATM ローソン").category, "現金");
});

test("sunabar の実際の摘要: 振込先名で判定できない振込は「振込」（名前の間は全角スペース）", () => {
  assert.equal(categorize("振込 スナバ　タロウ").category, "振込");
});

test("振込先名で判定できる振込は、そのカテゴリになる（振込のルールより上）", () => {
  assert.equal(categorize("振込 ヤチン").category, "住居");
  assert.equal(categorize("振込 ケータイ").category, "通信");
});

test("半角カナ・全角英数字・大文字小文字の違いを正規化してから比べる", () => {
  assert.equal(categorize("ｾﾌﾞﾝｲﾚﾌﾞﾝ ｼﾌﾞﾔ").category, "食費");
  assert.equal(categorize("ＡＴＭ　セブン").category, "現金");
  assert.equal(categorize("atm").category, "現金");
  assert.equal(categorize("ﾌﾘｺﾐ ﾔﾁﾝ").category, "住居");
});

test("店舗名（merchant）と一致したキーワード（matchedKeyword）を返す", () => {
  assert.deepEqual(categorize("ｾﾌﾞﾝｲﾚﾌﾞﾝ ｼﾌﾞﾔ"), {
    category: "食費",
    merchant: "コンビニ",
    matchedKeyword: "セブン",
  });
});

test("どのルールにも一致しない・空・undefined は「その他」（FR-006）", () => {
  const other = { category: "その他", merchant: null, matchedKeyword: null };
  assert.deepEqual(categorize("アイウエオ"), other);
  assert.deepEqual(categorize(""), other);
  assert.deepEqual(categorize(undefined), other);
});

test("判定結果のカテゴリは data-model の Category のどれか", () => {
  for (const d of ["ATM セブン", "振込 ヤチン", "ローソン", "スイカ チャージ", "ドラッグストア", "ネットフリックス", "アイウエオ"]) {
    assert.ok(CATEGORIES.includes(categorize(d).category), d);
  }
});
