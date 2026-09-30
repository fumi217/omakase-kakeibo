// 自作 API: 統一 ID で他の金融機関の明細を取得【担当 A】（data-model.md「Linked Account」。#70 で B から移管）
// 「国主導の統一 ID で、銀行・カード・QR 決済の明細をまとめて取れたら」という提案。中身はダミー
const data = require("./data/unified-accounts.json");
const { parseMonth, jstDateTime } = require("../lib/month");

// unifiedId: 統一 ID、month: "YYYY-MM" → Linked Account[]（明細はすべて支出）
// 日付の {{MONTH}} を対象月に置き換えるので、どの月でもデモできる。
// 今日（日本時間）より後の日付は除く（月の途中で開いたとき、まだ来ていない支出を合計に入れないため）
async function getUnifiedAccounts(unifiedId, month, now = new Date()) {
  parseMonth(month);
  if (unifiedId !== data.unifiedId) return [];

  const today = jstDateTime(now).slice(0, 10);
  return data.accounts.map((account) => ({
    ...account,
    transactions: account.transactions
      .map((t) => ({ ...t, date: t.date.replace("{{MONTH}}", month) }))
      .filter((t) => t.date <= today),
  }));
}

module.exports = { getUnifiedAccounts };
