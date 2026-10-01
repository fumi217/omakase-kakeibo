// 用途不明金【担当 B】（#69・#73）
// ATM の引き出し（現金）と振込は「お金の動かし方」で、明細から使いみちが分からない。
// 画面では「用途不明金」としてまとめて示す（銀行が使いみちのデータを出せば分かる、という発表の主張につなげる）
export const UNKNOWN_NAME = "用途不明金";

// カテゴリ → 用途不明金の内訳での呼び方
const UNKNOWN_LABELS = { 振込: "振込支払", 現金: "現金引出" };

export function isUnknownCategory(category) {
  return category in UNKNOWN_LABELS;
}

export function unknownLabel(category) {
  return UNKNOWN_LABELS[category];
}
