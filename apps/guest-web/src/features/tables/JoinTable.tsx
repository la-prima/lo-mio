import { joinTable } from "@lo-mio/client";
import { useQuery } from "@tanstack/react-query";

/**
 * Une al comensal a la mesa del QR. Es un POST, pero se usa como query: React Query deduplica
 * las llamadas (StrictMode, re-renders) y recargar devuelve el mismo comensal (cookie de la sesión).
 */
export function JoinTable({ qrCode }: { qrCode: string }) {
  const join = useQuery({
    queryKey: ["join", qrCode],
    queryFn: async () => (await joinTable({ path: { qrCode }, body: {}, throwOnError: true })).data,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });

  if (join.isError) {
    return <p role="alert">No encontramos esta mesa. Pide al mesero un QR nuevo.</p>;
  }
  if (!join.data) return <p aria-busy="true">Uniéndote a la mesa…</p>;
  return (
    <header>
      <h1>Mesa {join.data.tableLabel}</h1>
      <p>
        Estás como <strong>{join.data.alias}</strong>
      </p>
    </header>
  );
}
