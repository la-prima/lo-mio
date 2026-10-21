import { Stack } from "expo-router";
import { OpenTableScreen } from "../features/tables/OpenTableScreen.tsx";

export default function OpenTable() {
  return (
    <>
      <Stack.Screen options={{ title: "Abrir mesa" }} />
      <OpenTableScreen />
    </>
  );
}
