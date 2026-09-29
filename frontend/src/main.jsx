import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// LIFF の初期化は、LIFF の Issue でここに追加する
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
