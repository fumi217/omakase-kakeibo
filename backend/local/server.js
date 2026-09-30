// ローカル開発用サーバー（Lambda では使わない）
// HTTP リクエストを Lambda 関数 URL と同じ形式のイベントに変換して、ハンドラーを呼ぶ。
// これで、同じハンドラーのコードをそのまま Lambda にデプロイできる。
const http = require("node:http");
const api = require("../src/handlers/api");
const webhook = require("../src/handlers/webhook");

// Lambda では関数が 2 つ（kakeibo-webhook / kakeibo-api）に分かれる。ローカルではパスで振り分ける
function pickHandler(method, pathname) {
  return method === "POST" && pathname === "/webhook" ? webhook : api;
}

const PORT = Number(process.env.PORT ?? 3000);
// Lambda では関数 URL の CORS 設定で許可する。ローカルでは同じ動きをここで再現する
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "http://localhost:5173";

function toFunctionUrlEvent(req, body) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  return {
    version: "2.0",
    rawPath: url.pathname,
    rawQueryString: url.search.slice(1),
    queryStringParameters: Object.fromEntries(url.searchParams),
    headers: req.headers,
    requestContext: { http: { method: req.method, path: url.pathname } },
    body,
    isBase64Encoded: false,
  };
}

const server = http.createServer(async (req, res) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const event = toFunctionUrlEvent(req, Buffer.concat(chunks).toString() || undefined);

  try {
    const result = await pickHandler(req.method, event.rawPath).handler(event);
    res.writeHead(result.statusCode, { ...corsHeaders, ...result.headers });
    res.end(result.body);
  } catch (err) {
    // 詳細はログにだけ出す（レスポンスには内部情報を含めない）
    console.error(err);
    res.writeHead(500, { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "エラーが発生しました" } }));
  }
});

server.listen(PORT, () => {
  console.log(`backend: http://localhost:${PORT}`);
});
