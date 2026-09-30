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

// month: "YYYY-MM" → Monthly Summary（data-model.md）
export function getSummary(month) {
  return request(`/api/summary?month=${encodeURIComponent(month)}`);
}

// month: "YYYY-MM"、category: 省略可 → { month, items: Transaction[] }
export function getTransactions(month, category) {
  const query = new URLSearchParams({ month });
  if (category) query.set("category", category);
  return request(`/api/transactions?${query}`);
}
