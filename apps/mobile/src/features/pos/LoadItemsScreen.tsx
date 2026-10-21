import {
  listProductsOptions,
  listSessionItemsOptions,
  loadManualItems,
  type Product,
} from "@lo-mio/client";
import { formatMoney, newId } from "@lo-mio/kernel";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { matches, Search } from "../Search.tsx";

type Props = { tableId: string; sessionId: string };

/** Carga manual desde el catálogo del local: el precio sale del catálogo, nunca se escribe. */
export function LoadItemsScreen({ tableId, sessionId }: Props) {
  const products = useQuery(listProductsOptions());
  // Los ítems llegan a claims por el bus (eventual): se refresca la cuenta mientras está abierta.
  // ponytail: sondeo cada 3 s; pasar al feed en vivo (useSessionFeed con Bearer) si pesa.
  const items = useQuery({
    ...listSessionItemsOptions({ path: { sessionId } }),
    refetchInterval: 3_000,
  });
  const [order, setOrder] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const add = (id: string, delta: number) =>
    setOrder((o) => ({ ...o, [id]: Math.max(0, (o[id] ?? 0) + delta) }));
  const count = items.data?.length ?? 0;
  const chosen = (products.data ?? []).filter((p) => (order[p.id] ?? 0) > 0);

  const load = useMutation({
    // Un pedido por producto, cada uno con su clave: reintentar nunca duplica ítems.
    mutationFn: async (lines: { product: Product; quantity: number }[]) => {
      for (const { product, quantity } of lines) {
        await loadManualItems({
          body: { tableId, name: product.name, unitPrice: product.price, quantity },
          headers: { "Idempotency-Key": newId() },
          throwOnError: true,
        });
      }
    },
    onSuccess: () => {
      setOrder({});
      items.refetch();
    },
  });

  return (
    <View style={styles.screen}>
      <Search label="Buscar producto" value={query} onChange={setQuery} />
      {/* Arriba y no al pie: con el teclado abierto (edge-to-edge en Android 15+ no achica la
          vista) el botón quedaría tapado en pantallas chicas. */}
      {load.isError && <Text accessibilityRole="alert">No se pudo cargar. Intenta de nuevo.</Text>}
      <Button
        title="Cargar a la mesa"
        testID="load-items"
        disabled={chosen.length === 0 || load.isPending}
        onPress={() =>
          load.mutate(chosen.map((product) => ({ product, quantity: order[product.id] ?? 0 })))
        }
      />
      <Text style={styles.muted} testID="loaded-count">
        En la cuenta: {count === 1 ? "1 ítem" : `${count} ítems`}
      </Text>
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={(products.data ?? []).filter((p) => matches(p.name, query))}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.grow}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.muted}>{formatMoney(item.price)}</Text>
            </View>
            <Stepper
              label={item.name}
              count={order[item.id] ?? 0}
              onChange={(delta) => add(item.id, delta)}
            />
          </View>
        )}
      />
    </View>
  );
}

function Stepper({
  label,
  count,
  onChange,
}: {
  label: string;
  count: number;
  onChange: (delta: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        style={styles.step}
        accessibilityLabel={`Quitar ${label}`}
        onPress={() => onChange(-1)}
      >
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <Text style={styles.count} accessibilityLabel={`${count} ${label}`}>
        {count}
      </Text>
      <Pressable
        style={styles.step}
        accessibilityLabel={`Agregar ${label}`}
        onPress={() => onChange(1)}
      >
        <Text style={styles.stepText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 8 },
  grow: { flex: 1 },
  name: { fontSize: 17 },
  muted: { color: "#4b5563" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  step: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#1d4ed8",
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { fontSize: 22, color: "#1d4ed8" },
  count: { minWidth: 24, textAlign: "center", fontSize: 17 },
});
