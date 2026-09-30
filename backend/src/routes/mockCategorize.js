// GET /mock/categorize?description=【担当 B】（contracts/api.md）
// 自作 API のため、本物の銀行 API と区別できるよう x-mock-api ヘッダーを付ける
const { json, HttpError } = require("../lib/http");
const categorizer = require("../mock/categorize");

module.exports = async (event) => {
  const description = event.queryStringParameters?.description;
  if (!description) {
    throw new HttpError(400, "INVALID_PARAMETER", "description を指定してください");
  }
  return json(200, { description, ...categorizer.categorize(description) }, { "x-mock-api": "true" });
};
