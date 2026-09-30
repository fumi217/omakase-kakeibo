// 使いみちの分からないカテゴリ【担当 B】（#69）
// ATM の引き出し（現金）と振込は「お金の動かし方」で、明細から使いみちが分からない。
// 画面ではほかのカテゴリと分けて示す（銀行が使いみちのデータを出せば分かる、という発表の主張につなげる）
export const UNKNOWN_CATEGORIES = ["振込", "現金"];

export function isUnknownCategory(category) {
  return UNKNOWN_CATEGORIES.includes(category);
}
