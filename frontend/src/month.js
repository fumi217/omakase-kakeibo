// 画面で使う月（"YYYY-MM"）の計算【担当 B】。月はすべて日本時間で扱う

// 日本時間の今月
export function currentMonth(now = new Date()) {
  return now.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }).slice(0, 7);
}

// "2026-01" と -1 → "2025-12"
export function addMonths(month, delta) {
  const [year, mon] = month.split("-").map(Number);
  const d = new Date(Date.UTC(year, mon - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

// "2026-09" → "2026年9月"（LINE のカードの見出しとそろえる）
export function formatMonth(month) {
  const [year, mon] = month.split("-").map(Number);
  return `${year}年${mon}月`;
}

// 30000 → "¥30,000"
export function formatYen(amount) {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

// 日本時間の今日の日付（1〜31）
export function todayDate(now = new Date()) {
  return Number(now.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }).slice(8, 10));
}

// "2026-02" → 28
export function daysInMonth(month) {
  const [year, mon] = month.split("-").map(Number);
  return new Date(Date.UTC(year, mon, 0)).getUTCDate();
}
