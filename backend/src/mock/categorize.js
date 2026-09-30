// 自作 API: 支出カテゴリ判定【担当 B】（data-model.md「Category Rule」）
// 土台（#21）のスタブ: すべて「その他」。B4（#31）で判定ルールを実装する

// description: 明細の内容（摘要）→ { category, merchant, matchedKeyword }
function categorize(description) {
  return { category: "その他", merchant: null, matchedKeyword: null };
}

module.exports = { categorize };
