import { useEffect, useState } from "react";
import { getSummary } from "../api/client.js";

// 指定した月の Monthly Summary を取得する【担当 B】
// 戻り値: { summary, loading, error }
export default function useMonthlySummary(month) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 前の月の表示が残らないように消してから取り直す
    let ignore = false;
    setSummary(null);
    setError(null);
    setLoading(true);
    getSummary(month)
      .then((data) => {
        if (!ignore) setSummary(data);
      })
      .catch((err) => {
        if (!ignore) setError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    // 月をすばやく切り替えたとき、古い月の応答が後から届いても捨てる
    return () => {
      ignore = true;
    };
  }, [month]);

  return { summary, loading, error };
}
