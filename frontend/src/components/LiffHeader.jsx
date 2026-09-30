import { useCallback, useEffect, useState } from "react";
import { initLiff, login } from "../liff.js";

// 画面の見出し。LINE の表示名で「○○さんの家計簿」と出す【担当 B】（US2 シナリオ 1・5、FR-021）
export default function LiffHeader() {
  const [state, setState] = useState({ status: "loading" });

  const connect = useCallback(() => {
    setState({ status: "loading" });
    initLiff()
      .then((result) =>
        setState(result.needsLogin ? { status: "needsLogin" } : { status: "ready", profile: result.profile }),
      )
      .catch((err) => setState({ status: "error", message: err.message }));
  }, []);

  useEffect(() => {
    connect();
  }, [connect]);

  const title = state.status === "ready" ? `${state.profile.displayName}さんの家計簿` : "家計簿ダッシュボード";

  return (
    <div>
      <h1>{title}</h1>
      {state.status === "needsLogin" && (
        <p className="small muted" style={{ margin: "4px 0 0" }}>
          LINE アプリから開くか、LINE でログインしてください。{" "}
          <button type="button" className="text-button" onClick={login}>
            LINE でログイン
          </button>
        </p>
      )}
      {state.status === "error" && (
        <p className="small muted" style={{ margin: "4px 0 0" }}>
          LINE との接続に失敗しました（{state.message}）{" "}
          <button type="button" className="text-button" onClick={connect}>
            もう一度試す
          </button>
        </p>
      )}
    </div>
  );
}
