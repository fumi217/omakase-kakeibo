const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const line = require("@line/bot-sdk");
const summary = require("../../src/services/summary");
const { HttpError } = require("../../src/lib/http");
const { handler } = require("../../src/handlers/webhook");

// LINE は呼ばずに返信を差し替える。シークレット・トークンはテスト用のダミー
const SECRET = "test-channel-secret";
process.env.LINE_CHANNEL_SECRET = SECRET;
process.env.LINE_CHANNEL_ACCESS_TOKEN = "test-token";
process.env.LIFF_URL = "https://miniapp.line.me/0000000000-abcdefgh";

function sign(body, secret = SECRET) {
  return crypto.createHmac("sha256", secret).update(body).digest("base64");
}

function textEvent(text, replyToken = "reply-token-1") {
  return { type: "message", replyToken, message: { type: "text", text } };
}

// 関数 URL が渡すイベント。base64 で届く場合も再現できるようにする
function webhookEvent(events, { signature, base64 = false } = {}) {
  const body = JSON.stringify({ destination: "U0000", events });
  return {
    headers: { "x-line-signature": signature ?? sign(body) },
    body: base64 ? Buffer.from(body).toString("base64") : body,
    isBase64Encoded: base64,
  };
}

function mockReply(t) {
  return t.mock.method(line.messagingApi.MessagingApiClient.prototype, "replyMessage", async () => ({}));
}

function mockSummary(t, impl = async (month) => ({ month, totalIncome: 0, totalExpense: 1200, transactionCount: 1, categories: [] })) {
  return t.mock.method(summary, "getMonthlySummary", impl);
}

// 「今」を日本時間 2026-10-01 05:00（UTC では 9/30）に固定する。今月 = 2026-10、先月 = 2026-09
function fixNow(t) {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-09-30T20:00:00Z") });
}

function repliedMessage(reply, i = 0) {
  const [request] = reply.mock.calls[i].arguments;
  assert.equal(request.messages.length, 1);
  return request.messages[0];
}

test("署名が正しくなければ 401 を返し、返信しない", async (t) => {
  const reply = mockReply(t);
  const getSummary = mockSummary(t);

  const res = await handler(webhookEvent([textEvent("今月")], { signature: sign("other body") }));

  assert.equal(res.statusCode, 401);
  assert.equal(reply.mock.callCount(), 0);
  assert.equal(getSummary.mock.callCount(), 0);
});

test("署名のヘッダーがなければ 401", async (t) => {
  const reply = mockReply(t);
  const event = webhookEvent([textEvent("今月")]);
  delete event.headers["x-line-signature"];

  assert.equal((await handler(event)).statusCode, 401);
  assert.equal(reply.mock.callCount(), 0);
});

test("チャネルシークレットが未設定なら 401（空のキーで署名した偽の Webhook を通さない）", async (t) => {
  const reply = mockReply(t);
  t.mock.method(console, "error", () => {});
  t.after(() => (process.env.LINE_CHANNEL_SECRET = SECRET));
  delete process.env.LINE_CHANNEL_SECRET;

  const body = JSON.stringify({ events: [textEvent("今月")] });
  const res = await handler({ headers: { "x-line-signature": sign(body, "") }, body, isBase64Encoded: false });

  assert.equal(res.statusCode, 401);
  assert.equal(reply.mock.callCount(), 0);
});

test("LINE Developers の検証（events が空）には 200", async (t) => {
  const reply = mockReply(t);
  const res = await handler(webhookEvent([]));
  assert.equal(res.statusCode, 200);
  assert.equal(reply.mock.callCount(), 0);
});

test("署名が正しくても本文が JSON でなければ、200 を返して何もしない", async (t) => {
  const reply = mockReply(t);
  t.mock.method(console, "error", () => {});
  const body = "not json";

  const res = await handler({ headers: { "x-line-signature": sign(body) }, body, isBase64Encoded: false });

  assert.equal(res.statusCode, 200);
  assert.equal(reply.mock.callCount(), 0);
});

test("本文が base64 で届いても、デコードした本文で署名を検証する", async (t) => {
  fixNow(t);
  const reply = mockReply(t);
  mockSummary(t);

  const res = await handler(webhookEvent([textEvent("今月")], { base64: true }));

  assert.equal(res.statusCode, 200);
  assert.equal(reply.mock.callCount(), 1);
});

for (const text of ["今月", "今月の支出", "  今月 "]) {
  test(`「${text}」には今月（日本時間）のサマリーカードを返す`, async (t) => {
    fixNow(t);
    const reply = mockReply(t);
    const getSummary = mockSummary(t);

    await handler(webhookEvent([textEvent(text)]));

    assert.deepEqual(getSummary.mock.calls.map((c) => c.arguments[0]), ["2026-10"]);
    assert.equal(reply.mock.calls[0].arguments[0].replyToken, "reply-token-1");
    const message = repliedMessage(reply);
    assert.equal(message.type, "flex");
    assert.equal(message.altText, "2026年10月 支出 ¥1,200");
  });
}

for (const text of ["先月", "先月の支出"]) {
  test(`「${text}」には前の月のサマリーカードを返す`, async (t) => {
    fixNow(t);
    const reply = mockReply(t);
    const getSummary = mockSummary(t);

    await handler(webhookEvent([textEvent(text)]));

    assert.deepEqual(getSummary.mock.calls.map((c) => c.arguments[0]), ["2026-09"]);
    assert.equal(repliedMessage(reply).altText, "2026年9月 支出 ¥1,200");
  });
}

test("「ダッシュボード」には LIFF_URL を開くボタンを返す（集計は呼ばない）", async (t) => {
  const reply = mockReply(t);
  const getSummary = mockSummary(t);

  await handler(webhookEvent([textEvent("ダッシュボード")]));

  assert.equal(getSummary.mock.callCount(), 0);
  assert.match(JSON.stringify(repliedMessage(reply)), /"uri":"https:\/\/miniapp\.line\.me\/0000000000-abcdefgh"/);
});

test("それ以外の言葉には使い方を返す", async (t) => {
  const reply = mockReply(t);
  const getSummary = mockSummary(t);

  await handler(webhookEvent([textEvent("あいうえお")]));

  assert.equal(getSummary.mock.callCount(), 0);
  const message = repliedMessage(reply);
  assert.equal(message.type, "text");
  assert.match(message.text, /^使える言葉:/);
});

test("テキスト以外のメッセージや友だち追加には何もしない", async (t) => {
  const reply = mockReply(t);
  const events = [
    { type: "message", replyToken: "r1", message: { type: "sticker", packageId: "1", stickerId: "1" } },
    { type: "follow", replyToken: "r2" },
  ];

  const res = await handler(webhookEvent(events));

  assert.equal(res.statusCode, 200);
  assert.equal(reply.mock.callCount(), 0);
});

test("複数のイベントには、それぞれの replyToken で返信する", async (t) => {
  const reply = mockReply(t);

  await handler(webhookEvent([textEvent("あ", "r1"), textEvent("い", "r2")]));

  assert.deepEqual(reply.mock.calls.map((c) => c.arguments[0].replyToken), ["r1", "r2"]);
});

const errorCases = [
  ["sunabar がタイムアウト", new HttpError(504, "BANK_API_UNAVAILABLE", "銀行とつながりませんでした。少し時間をおいて試してください"), "銀行とつながりませんでした。少し時間をおいて試してください"],
  ["sunabar が認証エラー", new HttpError(502, "BANK_API_ERROR", "銀行との接続設定を確認してください"), "銀行との接続設定を確認してください"],
  ["その他の例外", new Error("boom"), "エラーが発生しました。もう一度試してください"],
];
for (const [label, error, expected] of errorCases) {
  test(`${label}のときは「${expected}」と返信し、200 を返す`, async (t) => {
    const reply = mockReply(t);
    t.mock.method(console, "error", () => {});
    mockSummary(t, async () => {
      throw error;
    });

    const res = await handler(webhookEvent([textEvent("今月")]));

    assert.equal(res.statusCode, 200);
    assert.deepEqual(repliedMessage(reply), { type: "text", text: expected });
  });
}

test("返信に失敗しても 200 を返し、ログにトークンやシークレットを出さない", async (t) => {
  const error = t.mock.method(console, "error", () => {});
  t.mock.method(line.messagingApi.MessagingApiClient.prototype, "replyMessage", async () => {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  });

  const res = await handler(webhookEvent([textEvent("あいうえお")]));

  assert.equal(res.statusCode, 200);
  assert.equal(error.mock.callCount(), 1);
  const logged = JSON.stringify(error.mock.calls.map((c) => c.arguments.map(String)));
  assert.doesNotMatch(logged, /test-token|test-channel-secret/);
});

test("1 件目の返信に失敗しても、2 件目には返信する", async (t) => {
  t.mock.method(console, "error", () => {});
  const reply = t.mock.method(line.messagingApi.MessagingApiClient.prototype, "replyMessage", async ({ replyToken }) => {
    if (replyToken === "r1") throw Object.assign(new Error("Bad Request"), { status: 400 });
    return {};
  });

  const res = await handler(webhookEvent([textEvent("あ", "r1"), textEvent("い", "r2")]));

  assert.equal(res.statusCode, 200);
  assert.deepEqual(reply.mock.calls.map((c) => c.arguments[0].replyToken), ["r1", "r2"]);
});
