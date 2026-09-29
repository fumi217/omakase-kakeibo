import { useEffect, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// 環境構築の確認用画面。backend とつながっているかだけを表示する
export default function App() {
  const [status, setStatus] = useState("確認中…");

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/health`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setStatus(data.ok ? "backend と接続できました" : "backend の応答が不正です"))
      .catch((err) => setStatus(`backend に接続できません（${err.message}）`));
  }, []);

  return (
    <main style={{ fontFamily: "sans-serif", padding: 16 }}>
      <h1>家計簿ダッシュボード</h1>
      <p>{status}</p>
    </main>
  );
}
