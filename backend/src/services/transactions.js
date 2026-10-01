// 集計対象の明細を集める【担当 B】
// sunabar の明細に、統一 ID でつながる他の金融機関（カード・QR 決済。ダミー）の明細を合算する（US4・FR-040〜042）
const { parseMonth } = require("../lib/month");
// 分割代入せずにモジュールごと持つ（テストで fetchTransactions / getUnifiedAccounts / categorize を差し替えられるように）
const sunabar = require("./sunabar");
const unified = require("../mock/unifiedAccounts");
const categorizer = require("../mock/categorize");

// デモ用の統一 ID。本番ではログインしている利用者の統一 ID を使う（本人確認は講座の範囲外）
const UNIFIED_ID = "demo-user-0001";

// Linked Account[] → Transaction[]（data-model.md「Transaction」。他行の明細はすべて支出）
function toUnifiedTransactions(accounts) {
  return accounts.flatMap((account) =>
    account.transactions.map((t) => ({
      id: t.id,
      date: t.date,
      type: "expense",
      amount: t.amount,
      description: t.description,
      category: categorizer.categorize(t.description).category,
      source: { id: account.institutionId, name: account.institutionName, kind: account.kind },
      isInternalTransfer: false,
    })),
  );
}

// month: "YYYY-MM" → Transaction[]
// UNIFIED_ID_ENABLED=true のときだけ他行の明細を合算する（FR-042。発表で「連携あり / なし」を見比べられるように）
async function getTransactions(month) {
  const { from, to } = parseMonth(month);
  const own = await sunabar.fetchTransactions(process.env.SUNABAR_ACCOUNT_ID, from, to);
  if (process.env.UNIFIED_ID_ENABLED !== "true") return own;

  const accounts = await unified.getUnifiedAccounts(UNIFIED_ID, month);
  return [...own, ...toUnifiedTransactions(accounts)];
}

module.exports = { getTransactions, toUnifiedTransactions };
