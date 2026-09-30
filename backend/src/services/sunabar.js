// sunabar 入出金明細 API の呼び出しと Transaction への変換【担当 A】（research R-003・data-model.md「Transaction」）
// 土台（#21）のスタブ: 空配列を返す。A1（#22）で実装する

// accountId: 口座 ID（12 桁）、from / to: "YYYY-MM-DD"（日本時間）→ Transaction[]
async function fetchTransactions(accountId, from, to) {
  return [];
}

module.exports = { fetchTransactions };
