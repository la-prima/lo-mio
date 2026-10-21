/**
 * Cliente de la API para la app: URL por build (`EXPO_PUBLIC_API_URL`) y el token del personal
 * guardado en el llavero del dispositivo (expo-secure-store), enviado como Bearer.
 */
import { client } from "@lo-mio/client";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "lomio_staff";
// ponytail: en desarrollo y e2e la app habla con la API por port-forward + `adb reverse` (sin el
// Gateway: Android no confía en la CA local de kind). Producción usa https://api.lo-mio.cl.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

let token: string | null = null;

client.setConfig({ baseUrl: API_URL, auth: () => token ?? undefined });

export async function loadToken() {
  token = await SecureStore.getItemAsync(TOKEN_KEY);
  return token;
}

export async function saveToken(value: string | null) {
  token = value;
  if (value) await SecureStore.setItemAsync(TOKEN_KEY, value);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}
