// Lambda: kakeibo-api（ダッシュボード API・自作 API）
// ルート表だけを持つ。処理は routes/ の各ファイル（1 ファイル 1 担当）に書く。
// ⚠️ ルート表は土台（#21）で確定。変えるときは 2 人で合意する（tasks.md「コンフリクトを防ぐ約束」3）
const { json, errorResponse, HttpError } = require("../lib/http");

const routes = {
  "GET /api/health": async () => json(200, { ok: true }),
  "GET /api/summary": require("../routes/summary"), // 担当 B
  "GET /api/transactions": require("../routes/transactions"), // 担当 B
  "GET /mock/categorize": require("../routes/mockCategorize"), // 担当 B
  "GET /mock/budget": require("../routes/mockBudget"), // 担当 A
  "GET /mock/unified-accounts": require("../routes/mockUnifiedAccounts"), // 担当 B
};

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method ?? "GET";
  const path = event.rawPath ?? "/";
  const route = routes[`${method} ${path}`];

  if (!route) {
    return errorResponse(404, "NOT_FOUND", "パスが見つかりません");
  }

  try {
    return await route(event);
  } catch (err) {
    if (err instanceof HttpError) {
      return errorResponse(err.statusCode, err.code, err.message);
    }
    // 詳細はログにだけ出す（トークンや口座番号を含めない）
    console.error(err);
    return errorResponse(500, "INTERNAL_ERROR", "エラーが発生しました");
  }
};
