// 自作 API: 統一 ID で他の金融機関の明細を取得【担当 B】（data-model.md「Linked Account」）
// 土台（#21）のスタブ: 連携口座なし。B11（#38）でダミーデータを返す

// unifiedId: 統一 ID、month: "YYYY-MM" → Linked Account[]
async function getUnifiedAccounts(unifiedId, month) {
  return [];
}

module.exports = { getUnifiedAccounts };
