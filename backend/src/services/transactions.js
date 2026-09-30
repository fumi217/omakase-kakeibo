// 集計対象の明細を集める【担当 B】
// 今は sunabar の明細だけ。US4（#38）で統一 ID の他行明細（mock/unifiedAccounts.js）を合算する
const { parseMonth } = require("../lib/month");
const { fetchTransactions } = require("./sunabar");

// month: "YYYY-MM" → Transaction[]
async function getTransactions(month) {
  const { from, to } = parseMonth(month);
  return fetchTransactions(process.env.SUNABAR_ACCOUNT_ID, from, to);
}

module.exports = { getTransactions };
