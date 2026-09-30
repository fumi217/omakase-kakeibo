// GET /mock/unified-accounts?unifiedId=&month=【担当 A】（contracts/api.md。#70 で B から移管）
// 自作 API のため、本物の銀行 API と区別できるよう x-mock-api ヘッダーを付ける
const { json, HttpError } = require("../lib/http");
const unified = require("../mock/unifiedAccounts");

module.exports = async (event) => {
  const { unifiedId, month } = event.queryStringParameters ?? {};
  if (!unifiedId) {
    throw new HttpError(400, "INVALID_PARAMETER", "unifiedId を指定してください");
  }
  // month がない・不正なら getUnifiedAccounts が INVALID_MONTH を投げる
  const accounts = await unified.getUnifiedAccounts(unifiedId, month);
  return json(200, { unifiedId, month, accounts }, { "x-mock-api": "true" });
};
