import { useEffect, useState } from "react";
import { initLiff, login } from "../liff.js";

// 画面の見出し。LINE の表示名で「○○さんの家計簿」と出す【担当 B】（US2 シナリオ 1・5、FR-021）
export default function LiffHeader() {
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    initLiff()
      .then((result) =>
        setState(result.needsLogin ? { status: "needsLogin" } : { status: "ready", profile: result.profile }),
      )
      .catch((err) => setState({ status: "error", message: err.message }));
  }, []);

  switch (state.status) {
    case "loading":
      return <h1>家計簿ダッシュボード</h1>;
    case "needsLogin":
      return (
        <header>
          <h1>家計簿ダッシュボード</h1>
          <p>LINE アプリから開くか、LINE でログインしてください。</p>
          <button type="button" onClick={login}>
            LINE でログイン
          </button>
        </header>
      );
    case "error":
      return (
        <header>
          <h1>家計簿ダッシュボード</h1>
          <p>LINE との接続に失敗しました（{state.message}）</p>
        </header>
      );
    default:
      return <h1>{state.profile.displayName}さんの家計簿</h1>;
  }
}
