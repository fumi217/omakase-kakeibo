// 自作 API: 支出カテゴリ判定【担当 B】（data-model.md「Category Rule」）
// 明細の摘要（remarks）に含まれるキーワードで、カテゴリと店舗名を推定する。
// ルールは category-rules.json の上から順に評価し、最初に一致したものを採用する。
// ⚠️ ATM のルールは一番上に置く（sunabar の摘要は「ATM セブン」のように店名を含むため。#53）
const rules = require("./data/category-rules.json");

// 半角カナ → 全角カナ、全角英数字 → 半角、全角スペース → 半角スペース（NFKC）に加えて、英字を大文字にそろえる
function normalize(text) {
  return String(text ?? "").normalize("NFKC").toUpperCase();
}

// 比較用に、キーワードも読み込み時に一度だけ正規化しておく
const normalizedRules = rules.map((rule) => ({
  ...rule,
  keywords: rule.keywords.map((keyword) => ({ original: keyword, normalized: normalize(keyword) })),
}));

// description: 明細の内容（摘要）→ { category, merchant, matchedKeyword }
function categorize(description) {
  const target = normalize(description);
  if (target) {
    for (const rule of normalizedRules) {
      const hit = rule.keywords.find((keyword) => target.includes(keyword.normalized));
      if (hit) {
        return { category: rule.category, merchant: rule.merchant ?? null, matchedKeyword: hit.original };
      }
    }
  }
  return { category: "その他", merchant: null, matchedKeyword: null };
}

module.exports = { categorize };
