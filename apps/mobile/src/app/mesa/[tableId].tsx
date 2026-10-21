import { Stack, useLocalSearchParams } from "expo-router";
import { LoadItemsScreen } from "../../features/pos/LoadItemsScreen.tsx";

export default function Table() {
  const { tableId, label, sessionId } = useLocalSearchParams<{
    tableId: string;
    label: string;
    sessionId: string;
  }>();
  return (
    <>
      <Stack.Screen options={{ title: `Mesa ${label}` }} />
      <LoadItemsScreen tableId={tableId} sessionId={sessionId} />
    </>
  );
}
