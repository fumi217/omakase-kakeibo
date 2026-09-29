import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Docker のバインドマウント（特に WSL で Windows 側に置いた場合）は変更通知が届かないことがあるため
    watch: { usePolling: true },
  },
});
