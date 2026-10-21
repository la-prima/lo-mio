import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator } from "react-native";
import { LoginScreen } from "../features/staff/LoginScreen.tsx";
import { SessionProvider, useSession } from "../features/staff/session.tsx";

const queryClient = new QueryClient();

/** Sin sesión del personal no hay navegación: solo el login. */
function Gate() {
  const { staff } = useSession();
  if (staff === undefined) return <ActivityIndicator style={{ flex: 1 }} />;
  if (!staff) return <LoginScreen />;
  return <Stack />;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <StatusBar style="auto" />
        <Gate />
      </SessionProvider>
    </QueryClientProvider>
  );
}
