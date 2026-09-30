// GET /mock/unified-accounts【担当 B】（contracts/api.md）
// 土台（#21）のスタブ: 501 を返す。B11（#38）で実装する
const { errorResponse } = require("../lib/http");

module.exports = async (event) => {
  return errorResponse(501, "NOT_IMPLEMENTED", "まだ実装されていません");
};
