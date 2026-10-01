// 明細を新しい順に並べる【担当 B】（/api/summary と /api/transactions で同じ並びにする。#83）
// sunabar は古い順に返すので、同じ日の中も後の明細が先になるように並べ替える
function newestFirst(items) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => b.item.date.localeCompare(a.item.date) || b.index - a.index)
    .map(({ item }) => item);
}

module.exports = { newestFirst };
