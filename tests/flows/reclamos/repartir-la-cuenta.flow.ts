import {
  claimItem,
  joinItem,
  listSessionBalances,
  listSessionItems,
  loadManualItems,
  shareItem,
} from "@lo-mio/client";
import { expect, idempotency, test } from "../fixtures.ts";

test.describe("Reclamos", () => {
  test.describe("Repartir la cuenta de la mesa", () => {
    test("Ana reclama su cerveza, tres comensales reparten una tabla y un cuarto se suma", async ({
      bar,
    }) => {
      const [ana, beto, caro, dani] =
        await test.step("Ana, Beto, Caro y Dani se unen a la mesa por QR", () =>
          Promise.all([bar.guest("Ana"), bar.guest("Beto"), bar.guest("Caro"), bar.guest("Dani")]));
      const feed = async () =>
        (await listSessionItems({ client: ana.api, path: { sessionId: ana.sessionId } })).data ??
        [];

      await test.step("El mesero carga una cerveza y una tabla en la mesa", async () => {
        for (const [name, amount] of [
          ["Schop", 4500],
          ["Tabla de quesos", 10_000],
        ] as const) {
          const { response } = await loadManualItems({
            client: bar.staff,
            body: {
              tableId: bar.table.id,
              name,
              unitPrice: { amount, currency: "CLP" },
              quantity: 1,
            },
            ...idempotency(),
          });
          expect(response?.status, `el mesero carga ${name}`).toBe(202);
        }
        await expect
          .poll(async () => (await feed()).length, {
            message: "los 2 ítems aparecen en el feed en menos de 5 s",
            timeout: 5_000,
          })
          .toBe(2);
      });

      const itemNamed = async (name: string) =>
        String((await feed()).find((i) => i.name === name)?.itemId);

      await test.step("Ana toca 'lo mío' en la cerveza", async () => {
        const { data } = await claimItem({
          client: ana.api,
          path: { itemId: await itemNamed("Schop") },
          ...idempotency(),
        });
        expect(data?.status, "la cerveza queda reclamada").toBe("claimed");
      });

      await test.step("Ana reparte la tabla en partes iguales con Beto y Caro", async () => {
        const owners = [ana, beto, caro].map((g) => ({ guestId: g.guestId, portions: 1 }));
        const { data } = await shareItem({
          client: ana.api,
          path: { itemId: await itemNamed("Tabla de quesos") },
          body: { owners },
          ...idempotency(),
        });
        expect(
          data?.shares.map((s) => s.amount.amount),
          "10.000 entre 3 = 3.334 + 3.333 + 3.333",
        ).toEqual([3334, 3333, 3333]);
      });

      await test.step("Dani también comió de la tabla y se suma", async () => {
        const { data } = await joinItem({
          client: dani.api,
          path: { itemId: await itemNamed("Tabla de quesos") },
          ...idempotency(),
        });
        expect(
          data?.shares.map((s) => s.amount.amount),
          "10.000 entre 4 = 2.500 cada uno",
        ).toEqual([2500, 2500, 2500, 2500]);
      });

      await test.step("Cada comensal ve su saldo: Ana paga su cerveza más su parte de la tabla", async () => {
        const balance = async (alias: string) =>
          (
            await listSessionBalances({ client: beto.api, path: { sessionId: beto.sessionId } })
          ).data?.find((b) => b.alias === alias)?.balance.amount;
        await expect
          .poll(() => balance("Ana"), { message: "saldo de Ana = 4.500 + 2.500", timeout: 5_000 })
          .toBe(7000);
        expect(await balance("Dani"), "saldo de Dani = 2.500").toBe(2500);
      });
    });

    test("dos comensales tocan 'lo mío' en la misma cerveza: solo uno se la queda", async ({
      bar,
    }) => {
      const [ana, beto] = await Promise.all([bar.guest("Ana"), bar.guest("Beto")]);
      await loadManualItems({
        client: bar.staff,
        body: {
          tableId: bar.table.id,
          name: "Pisco",
          unitPrice: { amount: 5000, currency: "CLP" },
          quantity: 1,
        },
        ...idempotency(),
      });
      const firstItem = async () =>
        (await listSessionItems({ client: ana.api, path: { sessionId: ana.sessionId } })).data?.[0]
          ?.itemId;
      await expect
        .poll(firstItem, { message: "el pisco aparece en el feed", timeout: 5_000 })
        .toBeDefined();
      const itemId = String(await firstItem());

      await test.step("Ana y Beto reclaman la misma cerveza al mismo tiempo", async () => {
        const results = await Promise.all(
          [ana, beto].map((g) => claimItem({ client: g.api, path: { itemId }, ...idempotency() })),
        );
        expect(
          results.map((r) => r.response?.status).sort(),
          "uno la obtiene (200) y el otro ve que ya tiene dueño (409)",
        ).toEqual([200, 409]);
      });
    });
  });
});
