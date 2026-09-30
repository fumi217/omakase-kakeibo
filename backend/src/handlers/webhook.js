// Lambda: kakeibo-webhook（LINE の Webhook）【担当 A】（contracts/line-bot.md）
// 集計は services/summary.js の getMonthlySummary だけを呼ぶ（tasks.md T023）。
// 分割代入せずにモジュールごと持つ（テストで getMonthlySummary / replyMessage を差し替えられるように）
const line = require("@line/bot-sdk");
const summary = require("../services/summary");
const flexMessage = require("../services/flexMessage");
const { currentMonth, previousMonth } = require("../lib/month");
const { HttpError } = require("../lib/http");

const GENERIC_ERROR = "エラーが発生しました。もう一度試してください";

// 関数 URL では本文が base64 で届くことがある。署名はデコードした生の本文で検証する
function rawBody(event) {
  const body = event.body ?? "";
  return event.isBase64Encoded ? Buffer.from(body, "base64").toString("utf8") : body;
}

function isValidSignature(body, signature) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) {
    // 空のキーで検証すると、誰でも正しい署名を作れてしまう
    console.error("LINE_CHANNEL_SECRET が設定されていません");
    return false;
  }
  return Boolean(signature) && line.validateSignature(body, secret, signature);
}

async function summaryReply(month) {
  try {
    return flexMessage.summaryMessage(await summary.getMonthlySummary(month), process.env.LIFF_URL);
  } catch (err) {
    // sunabar のエラーは services/sunabar.js でログ済み。それ以外の詳細はログにだけ出す
    if (err instanceof HttpError) return { type: "text", text: err.message };
    console.error(err);
    return { type: "text", text: GENERIC_ERROR };
  }
}

async function replyFor(text) {
  switch (text.trim()) {
    case "今月":
    case "今月の支出":
      return summaryReply(currentMonth(new Date()));
    case "先月":
      return summaryReply(previousMonth(currentMonth(new Date())));
    case "ダッシュボード":
      return flexMessage.dashboardMessage(process.env.LIFF_URL);
    default:
      return flexMessage.usageMessage();
  }
}

exports.handler = async (event) => {
  const body = rawBody(event);
  if (!isValidSignature(body, event.headers?.["x-line-signature"])) {
    return { statusCode: 401, body: "" };
  }

  // 署名が正しければ、処理の結果にかかわらず 200 を返す（LINE の再送を防ぐ）
  let events;
  try {
    events = JSON.parse(body).events ?? [];
  } catch {
    console.error("Webhook の本文が JSON ではありません");
    return { statusCode: 200, body: "" };
  }
  const client = new line.messagingApi.MessagingApiClient({ channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN });
  for (const e of events) {
    if (e.type !== "message" || e.message?.type !== "text") continue;
    try {
      // 返信は集計を await してから送る（待たずに返すと空のメッセージになる）
      const message = await replyFor(e.message.text);
      await client.replyMessage({ replyToken: e.replyToken, messages: [message] });
    } catch (err) {
      // SDK のエラーには要求の内容が含まれうるので、ステータスだけを出す（トークンを出さない）
      console.error(`LINE への返信に失敗しました: ${err.status ?? err.name}`);
    }
  }
  return { statusCode: 200, body: "" };
};
