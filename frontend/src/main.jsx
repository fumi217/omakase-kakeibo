import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// LIFF の初期化は components/LiffHeader.jsx（src/liff.js）で行う
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
