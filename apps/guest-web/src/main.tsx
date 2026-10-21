import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { JoinTable } from "./features/tables/JoinTable.tsx";
import "./styles.css";

const queryClient = new QueryClient();
// El QR abre /m/<código>; no hay otras pantallas, así que no hace falta un router.
const qrCode = location.pathname.match(/^\/m\/([A-Za-z0-9_-]+)$/)?.[1];
const root = document.getElementById("root");
if (!root) throw new Error("falta #root en index.html");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <main>
        {qrCode ? <JoinTable qrCode={qrCode} /> : <p>Escanea el QR de tu mesa para empezar.</p>}
      </main>
    </QueryClientProvider>
  </StrictMode>,
);
