import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// En desarrollo la API va por el mismo origen, igual que detrás del Gateway (HTTPRoute de guestWeb).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/v1": { target: "https://api.lo-mio.localhost", changeOrigin: true, ws: true } },
  },
});
