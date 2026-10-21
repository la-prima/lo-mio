import { listOpenSessionsOptions } from "@lo-mio/client";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Button, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSession } from "../staff/session.tsx";

/** Mesas abiertas del local, la más reciente primero. Tocar una lleva a cargar sus ítems. */
export function OpenTablesScreen() {
  const { staff, logout } = useSession();
  const open = useQuery({ ...listOpenSessionsOptions(), refetchInterval: 10_000 });
  return (
    <View style={styles.screen}>
      <Text style={styles.greeting} testID="greeting">
        Hola, {staff?.name}
      </Text>
      <Button title="Abrir mesa" onPress={() => router.push("/abrir")} testID="open-table" />
      <FlatList
        data={open.data ?? []}
        keyExtractor={(s) => s.id}
        refreshing={open.isFetching}
        onRefresh={open.refetch}
        ListEmptyComponent={<Text style={styles.muted}>No hay mesas abiertas.</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: "/mesa/[tableId]",
                params: { tableId: item.tableId, label: item.tableLabel, sessionId: item.id },
              })
            }
          >
            <Text style={styles.label}>Mesa {item.tableLabel}</Text>
            <Text style={styles.muted}>
              {item.guests === 1 ? "1 comensal" : `${item.guests} comensales`}
            </Text>
          </Pressable>
        )}
      />
      <Button title="Cerrar sesión" onPress={logout} testID="logout" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, gap: 12 },
  greeting: { fontSize: 20 },
  row: { paddingVertical: 14, borderBottomWidth: 1, borderColor: "#e5e7eb" },
  label: { fontSize: 18, fontWeight: "600" },
  muted: { color: "#4b5563" },
});
