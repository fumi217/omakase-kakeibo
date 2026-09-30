// Lambda 関数 URL のレスポンス形式を作る（contracts/api.md の共通エラー形式に合わせる）

function json(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
    body: JSON.stringify(body),
  };
}

function errorResponse(statusCode, code, message) {
  return json(statusCode, { error: { code, message } });
}

// ルートの処理から throw すると、api.js が contracts の共通エラー形式に変換する
class HttpError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

module.exports = { json, errorResponse, HttpError };
