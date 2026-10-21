import { Stack } from "expo-router";
import { OpenTablesScreen } from "../features/tables/OpenTablesScreen.tsx";

export default function Home() {
  return (
    <>
      <Stack.Screen options={{ title: "Mesas abiertas" }} />
      <OpenTablesScreen />
    </>
  );
}
