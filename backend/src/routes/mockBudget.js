// GET /mock/budget【担当 A】（contracts/api.md）
// 土台（#21）のスタブ: 501 を返す。A6（#27）で実装する
const { errorResponse } = require("../lib/http");

module.exports = async (event) => {
  return errorResponse(501, "NOT_IMPLEMENTED", "まだ実装されていません");
};
