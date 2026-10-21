import { listTablesOptions, openTableSessionMutation } from "@lo-mio/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text } from "react-native";
import { matches, Search } from "../Search.tsx";

/** Elegir una mesa del local para abrirla (si ya estaba abierta, se entra a la misma sesión). */
export function OpenTableScreen() {
  const tables = useQuery(listTablesOptions());
  const [query, setQuery] = useState("");
  const open = useMutation({
    ...openTableSessionMutation(),
    onSuccess: (session, { path }) => {
      const label = tables.data?.find((t) => t.id === path.tableId)?.label ?? "";
      router.replace({
        pathname: "/mesa/[tableId]",
        params: { tableId: session.tableId, label, sessionId: session.id },
      });
    },
  });
  return (
    <FlatList
      contentContainerStyle={styles.list}
      // Con el buscador abierto, un toque elige la mesa (no solo cierra el teclado).
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={<Search label="Buscar mesa" value={query} onChange={setQuery} />}
      data={(tables.data ?? []).filter((t) => matches(t.label, query))}
      keyExtractor={(t) => t.id}
      renderItem={({ item }) => (
        <Pressable
          style={styles.row}
          accessibilityRole="button"
          disabled={open.isPending}
          onPress={() => open.mutate({ path: { tableId: item.id } })}
        >
          <Text style={styles.label}>Mesa {item.label}</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16 },
  row: { paddingVertical: 14, borderBottomWidth: 1, borderColor: "#e5e7eb" },
  label: { fontSize: 18 },
});
