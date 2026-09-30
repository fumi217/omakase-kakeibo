// sunabar 入出金明細 API の呼び出しと Transaction への変換【担当 A】（research R-003・data-model.md「Transaction」）
const { HttpError } = require("../lib/http");
// 分割代入せずにモジュールごと持つ（テストで categorize を差し替えられるように）
const categorizer = require("../mock/categorize");

const TRANSACTIONS_URL = "https://api.sunabar.gmo-aozora.com/personal/v1/accounts/transactions";
// LINE への応答を 5 秒以内に返すため（SC-001）
const TIMEOUT_MS = 4000;
// 1 回 500 件。ページングが止まらないときの保険（plan.md「リスクと対策」）
const MAX_PAGES = 5;
const SOURCE = { id: "sunabar", name: "sunabar", kind: "bank" };

// 仕様書では真偽値だが、sunabar の実レスポンスは文字列（"false"）で返る（research R-003）
function hasNextPage(body) {
  return body.hasNext === true || body.hasNext === "true";
}

function toTransaction(item) {
  const type = item.transactionType === "1" ? "income" : "expense";
  const description = item.remarks ?? "";
  return {
    id: `sunabar:${item.itemKey}`,
    date: item.transactionDate,
    type,
    amount: Number(item.amount),
    description,
    // 入金はカテゴリを判定しない（data-model.md）
    category: type === "income" ? "入金" : categorizer.categorize(description).category,
    source: { ...SOURCE },
    // 12 桁の口座 ID で照会すると、つかいわけ口座間の振替は明細に出ない（research R-003）
    isInternalTransfer: false,
  };
}

async function requestPage(accountId, from, to, nextItemKey) {
  const url = new URL(TRANSACTIONS_URL);
  url.searchParams.set("accountId", accountId);
  url.searchParams.set("dateFrom", from);
  url.searchParams.set("dateTo", to);
  if (nextItemKey) url.searchParams.set("nextItemKey", nextItemKey);

  let res;
  try {
    res = await fetch(url, {
      headers: { "x-access-token": process.env.SUNABAR_ACCESS_TOKEN ?? "", Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    // タイムアウト・通信の失敗。詳細はログにだけ出す（トークンは含めない）
    console.error(`sunabar API に接続できません: ${err.name}`);
    throw new HttpError(504, "BANK_API_UNAVAILABLE", "銀行とつながりませんでした。少し時間をおいて試してください");
  }

  if (!res.ok) {
    console.error(`sunabar API エラー: ${res.status}`);
    throw new HttpError(502, "BANK_API_ERROR", "銀行との接続設定を確認してください");
  }
  return res.json();
}

// accountId: 口座 ID（12 桁）、from / to: "YYYY-MM-DD"（日本時間）→ Transaction[]（古い順）
async function fetchTransactions(accountId, from, to) {
  const items = [];
  let nextItemKey;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const body = await requestPage(accountId, from, to, nextItemKey);
    items.push(...(body.transactions ?? []).map(toTransaction));
    if (!hasNextPage(body)) return items;
    nextItemKey = body.nextItemKey;
  }
  console.warn(`sunabar の明細が ${MAX_PAGES} 回で取り切れなかったため、途中までで集計します（${from}〜${to}）`);
  return items;
}

module.exports = { fetchTransactions };
