import { type Guest, type JoinTableError, joinTable } from "@lo-mio/client";
import { useQuery } from "@tanstack/react-query";
import { TableFeed } from "../claims/TableFeed.tsx";

/**
 * Une al comensal a la mesa del QR. Es un POST, pero se usa como query: React Query deduplica
 * las llamadas (StrictMode, re-renders) y recargar devuelve el mismo comensal (cookie de la sesión).
 */
export function JoinTable({ qrCode }: { qrCode: string }) {
  // throwOnError lanza el problem+json del contrato: el error trae su `status`.
  const join = useQuery<Guest, JoinTableError>({
    queryKey: ["join", qrCode],
    queryFn: async () => (await joinTable({ path: { qrCode }, body: {}, throwOnError: true })).data,
    staleTime: Number.POSITIVE_INFINITY,
    // La mesa llega a `tables` por el bus (consistencia eventual): un QR recién registrado o rotado
    // puede no reconocerse durante un instante. Un QR inválido de verdad muestra el aviso a los ~3 s.
    retry: (failures, error) => failures < 2 && error.status === 404,
    retryDelay: 1000,
  });

  if (join.error?.status === 404) {
    return <p role="alert">No encontramos esta mesa. Pide al mesero un QR nuevo.</p>;
  }
  if (join.isError) {
    return <p role="alert">No pudimos unirte a la mesa. Intenta de nuevo en un momento.</p>;
  }
  if (!join.data) return <p aria-busy="true">Uniéndote a la mesa…</p>;
  return (
    <>
      <header>
        <h1>Mesa {join.data.tableLabel}</h1>
        <p>
          Estás como <strong>{join.data.alias}</strong>
        </p>
      </header>
      <TableFeed guest={join.data} />
    </>
  );
}
