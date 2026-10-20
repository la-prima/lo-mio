import type { Balance } from "@lo-mio/client";
import { formatMoney } from "@lo-mio/kernel";

/** Lo que paga cada comensal según lo que reclamó y compartió. */
export function Balances({ balances, me }: { balances: Balance[]; me: string }) {
  const mine = balances.find((b) => b.guestId === me);
  return (
    <section aria-labelledby="saldos">
      <h2 id="saldos">Saldos</h2>
      {mine && (
        <p className="my-balance" aria-live="polite">
          Tu saldo: <strong>{formatMoney(mine.balance)}</strong>
        </p>
      )}
      <ul className="balances">
        {balances.map((b) => (
          <li key={b.guestId}>
            <span>{b.guestId === me ? `${b.alias} (tú)` : b.alias}</span>
            <span>{formatMoney(b.balance)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
