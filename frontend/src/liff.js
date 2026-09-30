import liff from "@line/liff";

const LIFF_ID = import.meta.env.VITE_LIFF_ID;
// Mock は開発サーバー（npm run dev）のときだけ。本番ビルドでは VITE_LIFF_MOCK=true でも使わない
// （import.meta.env.DEV は本番ビルドで false に置き換わり、Mock の読み込みごとバンドルから消える）
const USE_MOCK = import.meta.env.DEV && import.meta.env.VITE_LIFF_MOCK === "true";

let initPromise;

// LIFF を 1 回だけ初期化する（React の StrictMode で useEffect が 2 回呼ばれても二重に初期化しない）
// 戻り値: { profile } … LINE の表示名などを取得できた / { needsLogin: true } … LINE の外のブラウザで未ログイン
export function initLiff() {
  initPromise ??= doInit();
  return initPromise;
}

async function doInit() {
  if (USE_MOCK) {
    // ローカル開発用: LINE アプリなしで LIFF の API を試せる（表示名は Mock の「Brown」）
    // 本番ビルドでは読み込まれないよう、必要なときだけ読み込む
    const { LiffMockPlugin } = await import("@line/liff-mock");
    liff.use(new LiffMockPlugin());
    await liff.init({ liffId: LIFF_ID || "mock-liff-id", mock: true });
    if (!liff.isInClient()) liff.login(); // Mock のログイン（画面は移動しない）
  } else {
    if (!LIFF_ID) throw new Error("VITE_LIFF_ID が設定されていません");
    await liff.init({ liffId: LIFF_ID });
    // LINE アプリ内ではログイン済み。外のブラウザでは自動で移動せず、画面で案内する
    if (!liff.isLoggedIn()) return { needsLogin: true };
  }

  return { profile: await liff.getProfile() };
}

export function login() {
  liff.login();
}
