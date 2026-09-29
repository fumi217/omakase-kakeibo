// Lambda 関数 URL のレスポンス形式を作る（contracts/api.md の共通エラー形式に合わせる）

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}

function errorResponse(statusCode, code, message) {
  return json(statusCode, { error: { code, message } });
}

module.exports = { json, errorResponse };
