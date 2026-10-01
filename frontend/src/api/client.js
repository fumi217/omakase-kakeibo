// kakeibo-api の呼び出し【担当 B】（contracts/api.md）
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

async function request(path) {
  const res = await fetch(`${API_BASE_URL}${path}`);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }
  return body;
}

// month: "YYYY-MM" → Monthly Summary（data-model.md）＋ items（新しい順の明細）・budgets（予算）
// 明細は集計と一緒に 1 回だけ取得する（#83。/api/transactions・/mock/budget は画面からは呼ばない）
export function getSummary(month) {
  return request(`/api/summary?month=${encodeURIComponent(month)}`);
}
