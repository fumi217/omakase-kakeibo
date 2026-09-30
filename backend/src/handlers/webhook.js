// Lambda: kakeibo-webhook（LINE の Webhook）【担当 A】
// 土台（#21）のスタブ。署名検証・コマンドの処理・返信は A4（#25）で実装する。
// 集計は services/summary.js の getMonthlySummary だけを呼ぶ（tasks.md T023）。
exports.handler = async () => {
  return { statusCode: 200, body: "" };
};
