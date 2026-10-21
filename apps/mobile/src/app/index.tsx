import { Stack } from "expo-router";
import { Button, StyleSheet, Text, View } from "react-native";
import { useSession } from "../features/staff/session.tsx";

export default function Home() {
  const { staff, logout } = useSession();
  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: "Mesas" }} />
      <Text style={styles.greeting} testID="greeting">
        Hola, {staff?.name}
      </Text>
      <Button title="Cerrar sesión" onPress={logout} testID="logout" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, gap: 12 },
  greeting: { fontSize: 20 },
});
