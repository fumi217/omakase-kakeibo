// Lambda: kakeibo-api（ダッシュボード API・自作 API）
// 今はルーティングの土台と動作確認用の /api/health だけ。各 API は担当の Issue で追加する。
const { json, errorResponse } = require("../lib/http");

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method ?? "GET";
  const path = event.rawPath ?? "/";

  if (method === "GET" && path === "/api/health") {
    return json(200, { ok: true });
  }

  return errorResponse(404, "NOT_FOUND", "パスが見つかりません");
};
