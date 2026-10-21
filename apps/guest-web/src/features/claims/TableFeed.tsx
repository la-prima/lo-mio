import { type Guest, useSessionFeed } from "@lo-mio/client";
import { Balances } from "../settlement/Balances.tsx";
import { ItemCard } from "./ItemCard.tsx";

/** La cuenta de la mesa en vivo: los ítems que carga el mesero y los saldos de cada comensal. */
export function TableFeed({ guest }: { guest: Guest }) {
  const feed = useSessionFeed(guest.sessionId, location.origin);
  return (
    <>
      {!feed.connected && (
        <p role="status" className="muted">
          Conectando con la mesa…
        </p>
      )}
      <section aria-labelledby="cuenta">
        <h2 id="cuenta">La cuenta</h2>
        {feed.items.length === 0 ? (
          <p className="muted">Aquí aparecerá lo que pidan en cuanto el mesero lo cargue.</p>
        ) : (
          <ul className="items">
            {feed.items.map((item) => (
              <ItemCard
                key={item.itemId}
                item={item}
                me={guest.guestId}
                guests={feed.balances}
                onChange={feed.applyItem}
              />
            ))}
          </ul>
        )}
      </section>
      <Balances balances={feed.balances} me={guest.guestId} />
    </>
  );
}
