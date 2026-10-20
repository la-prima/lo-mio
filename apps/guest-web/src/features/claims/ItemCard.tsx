import { type Balance, claimItem, type Item, joinItem, shareItem } from "@lo-mio/client";
import { formatMoney } from "@lo-mio/kernel";
import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";

type Props = { item: Item; me: string; guests: Balance[]; onChange: (item: Item) => void };

const command = () =>
  ({ headers: { "Idempotency-Key": crypto.randomUUID() }, throwOnError: true }) as const;

/** Un ítem de la cuenta y lo que el comensal puede hacer con él: lo mío, compartir, yo también. */
export function ItemCard({ item, me, guests, onChange }: Props) {
  const titleId = useId();
  const [sharing, setSharing] = useState(false);
  const path = { itemId: item.itemId };
  const action = useMutation({
    mutationFn: async (run: () => Promise<{ data: Item }>) => (await run()).data,
    onSuccess: (updated) => {
      setSharing(false);
      onChange(updated);
    },
  });
  const mine = item.shares.find((s) => s.guestId === me);
  const owners = item.shares.map((s) => s.alias).join(", ");

  return (
    <li aria-labelledby={titleId} className="item">
      <div className="item-head">
        <h3 id={titleId}>{item.name}</h3>
        <span>{formatMoney(item.price)}</span>
      </div>
      {owners && <p className="muted">De: {owners}</p>}
      {mine && <p>Tu parte: {formatMoney(mine.amount)}</p>}
      {action.isError && (
        <p role="alert">Alguien cambió este ítem recién. Revisa cómo quedó y vuelve a intentar.</p>
      )}
      {!mine && item.status === "unowned" && !sharing && (
        <div className="actions">
          <button
            type="button"
            disabled={action.isPending}
            onClick={() => action.mutate(() => claimItem({ path, ...command() }))}
          >
            Es mío
          </button>
          <button type="button" className="secondary" onClick={() => setSharing(true)}>
            Compartir
          </button>
        </div>
      )}
      {!mine && item.status !== "unowned" && (
        <div className="actions">
          <button
            type="button"
            disabled={action.isPending}
            onClick={() => action.mutate(() => joinItem({ path, ...command() }))}
          >
            Yo también
          </button>
        </div>
      )}
      {sharing && (
        <ShareForm
          me={me}
          guests={guests}
          pending={action.isPending}
          onCancel={() => setSharing(false)}
          onShare={(owners) =>
            action.mutate(() => shareItem({ path, body: { owners }, ...command() }))
          }
        />
      )}
    </li>
  );
}

type ShareProps = {
  me: string;
  guests: Balance[];
  pending: boolean;
  onCancel: () => void;
  onShare: (owners: { guestId: string; portions: number }[]) => void;
};

/** Partes iguales entre el comensal y los que marque. */
function ShareForm({ me, guests, pending, onCancel, onShare }: ShareProps) {
  const [chosen, setChosen] = useState<string[]>([]);
  const others = guests.filter((g) => g.guestId !== me);
  const toggle = (id: string) =>
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onShare([me, ...chosen].map((guestId) => ({ guestId, portions: 1 })));
      }}
    >
      <fieldset>
        <legend>¿Con quién lo compartes?</legend>
        {others.length === 0 && <p className="muted">Todavía no hay nadie más en la mesa.</p>}
        {others.map((g) => (
          <label key={g.guestId}>
            <input
              type="checkbox"
              checked={chosen.includes(g.guestId)}
              onChange={() => toggle(g.guestId)}
            />
            {g.alias}
          </label>
        ))}
      </fieldset>
      <div className="actions">
        <button type="submit" disabled={pending || chosen.length === 0}>
          Compartir en partes iguales
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
