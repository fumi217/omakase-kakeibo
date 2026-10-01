// 自作 API: 統一 ID で他の金融機関の明細を取得【担当 A】（data-model.md「Linked Account」。#70 で B から移管）
// 「国主導の統一 ID で、銀行・カード・QR 決済の明細をまとめて取れたら」という提案。中身はダミー
const data = require("./data/unified-accounts.json");
const { parseMonth, jstDateTime } = require("../lib/month");

// 基準の月以外で、金額を変える幅（±15%）と、間引いてよい少額の明細（1,000 円未満）・間引く割合
const AMOUNT_SPREAD = 0.15;
const SMALL_AMOUNT = 1000;
const SKIP_RATE = 0.3;

// 月から決まる疑似乱数（mulberry32）。同じ月なら毎回同じ値の並びになる（LINE と画面の金額を一致させるため）
function randomFor(month) {
  let state = Number(month.replace("-", ""));
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 基準の月はひな形のまま。それ以外は毎月同じ明細にならないよう、金額を変えて少額の明細を間引く（#76）
function varyByMonth(accounts, month) {
  if (month === data.baseMonth) return accounts;
  const random = randomFor(month);
  return accounts.map((account) => ({
    ...account,
    transactions: account.transactions.flatMap((t) => {
      // 明細ごとに必ず 2 つ引く（間引いても後ろの明細の値がずれないように）
      const skip = random() < SKIP_RATE;
      const factor = 1 - AMOUNT_SPREAD + random() * AMOUNT_SPREAD * 2;
      if (skip && t.amount < SMALL_AMOUNT) return [];
      return [{ ...t, amount: Math.max(10, Math.round((t.amount * factor) / 10) * 10) }];
    }),
  }));
}

// unifiedId: 統一 ID、month: "YYYY-MM" → Linked Account[]（明細はすべて支出）
// 日付の {{MONTH}} を対象月に置き換えるので、どの月でもデモできる。
// 今日（日本時間）より後の日付は除く（月の途中で開いたとき、まだ来ていない支出を合計に入れないため）
async function getUnifiedAccounts(unifiedId, month, now = new Date()) {
  parseMonth(month);
  if (unifiedId !== data.unifiedId) return [];

  const today = jstDateTime(now).slice(0, 10);
  return varyByMonth(data.accounts, month).map((account) => ({
    ...account,
    transactions: account.transactions
      .map((t) => ({ ...t, date: t.date.replace("{{MONTH}}", month) }))
      .filter((t) => t.date <= today),
  }));
}

module.exports = { getUnifiedAccounts };
