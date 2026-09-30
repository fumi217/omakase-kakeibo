// GET /mock/budget?month=【担当 A】（contracts/api.md）
// 自作 API のため、本物の銀行 API と区別できるよう x-mock-api ヘッダーを付ける
const { json } = require("../lib/http");
const budget = require("../mock/budget");

module.exports = async (event) => {
  const month = event.queryStringParameters?.month;
  // month がない・不正なら getBudgets が INVALID_MONTH を投げる
  return json(200, { month, budgets: await budget.getBudgets(month) }, { "x-mock-api": "true" });
};
