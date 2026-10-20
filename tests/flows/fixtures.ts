/**
 * Fixtures de los flujos. `api` es el cliente generado desde el contrato (un flujo no puede
 * llamar algo que no esté declarado). Cada request y su respuesta se adjuntan al paso en curso.
 * `bar` prepara un local listo para usar: sesión del administrador local (seed) y una mesa nueva.
 */
import {
  createClient,
  createConfig,
  createStaffSession,
  joinTable,
  registerTable,
} from "@lo-mio/client";
import { test as base, expect, type TestInfo } from "@playwright/test";
import * as allure from "allure-js-commons";
import { flowLabels } from "../allure/labels.ts";

type Api = ReturnType<typeof createClient>;
/** Credenciales del administrador del seed local (deploy/helm/lo-mio/values-local.yaml). */
const ADMIN = { email: "admin@lo-mio.localhost", password: "admin-local-123" };

const describeHeaders = (headers: Headers, prefix: string) =>
  [...headers.entries()].map(
    ([k, v]) => `${prefix} ${k}: ${/cookie|authorization/i.test(k) ? "[oculto]" : v}`,
  );

/** Cliente con los adjuntos de request/response y headers propios (cookie del comensal, Bearer). */
function client(baseUrl: string, testInfo: TestInfo, headers: Record<string, string> = {}): Api {
  const api = createClient(createConfig({ baseUrl, headers }));
  // fetch consume el body al enviar: se lee antes, en el interceptor de request.
  const bodies = new WeakMap<Request, string>();
  api.interceptors.request.use(async (request) => {
    if (request.body) bodies.set(request, await request.clone().text());
    return request;
  });
  api.interceptors.response.use(async (response, request) => {
    const requestBody = bodies.get(request) ?? "";
    const exchange = [
      `> ${request.method} ${request.url}`,
      ...describeHeaders(request.headers, ">"),
      ...(requestBody ? ["", requestBody] : []),
      "",
      `< ${response.status} ${response.statusText}`,
      ...describeHeaders(response.headers, "<"),
      "",
      await response.clone().text(),
    ].join("\n");
    const path = new URL(request.url).pathname;
    await testInfo.attach(`${request.method} ${path} → ${response.status}`, {
      body: exchange,
      contentType: "text/plain",
    });
    return response;
  });
  return api;
}

const idempotency = () => ({ headers: { "Idempotency-Key": crypto.randomUUID() } });

export type Bar = {
  /** Cliente del personal (administrador local). */
  staff: Api;
  table: { id: string; label: string; qrCode: string };
  /** Un comensal que escanea el QR de la mesa: su propio cliente, con su cookie. */
  guest: (
    alias: string,
  ) => Promise<{ api: Api; guestId: string; sessionId: string; alias: string }>;
};

export const test = base.extend<{ api: Api; bar: Bar; allureLabels: void }>({
  // Contexto → flujo → escenario en el reporte, desde los describe (ver tests/allure/labels.ts).
  allureLabels: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright lee las dependencias del fixture desde este patrón.
    async ({}, provide, testInfo) => {
      const labels = flowLabels(testInfo.titlePath.slice(1, -1), testInfo.title);
      await allure.epic(labels.epic);
      await allure.feature(labels.feature);
      await allure.story(labels.story);
      await allure.tag("flujo");
      await provide();
    },
    { auto: true },
  ],
  api: async ({ baseURL }, provide, testInfo) => provide(client(baseURL ?? "", testInfo)),
  bar: async ({ baseURL, api }, provide, testInfo) => {
    // El login tiene su propio límite (10/min): si Schemathesis lo agotó, se espera a que se libere.
    let token = "";
    const login = async () => {
      const { data, response } = await createStaffSession({ client: api, body: ADMIN });
      token = data?.token ?? "";
      return response?.status;
    };
    await expect
      .poll(login, {
        message: "el administrador inicia sesión",
        timeout: 70_000,
        intervals: [5_000],
      })
      .toBe(201);
    const staff = client(baseURL ?? "", testInfo, { Authorization: `Bearer ${token}` });
    const label = `F${Date.now().toString(36).slice(-5)}`;
    const table = (
      await registerTable({ client: staff, body: { label }, ...idempotency(), throwOnError: true })
    ).data;
    const guest = async (alias: string) => {
      // La mesa llega a `tables` por el bus: el QR puede tardar unos instantes en reconocerse.
      let joined: Awaited<ReturnType<typeof joinTable>> | undefined;
      const tryJoin = async () => {
        joined = await joinTable({ client: api, path: { qrCode: table.qrCode }, body: { alias } });
        return joined.response?.status;
      };
      await expect
        .poll(tryJoin, { message: `${alias} puede unirse a la mesa por QR`, timeout: 10_000 })
        .toBe(200);
      const cookie = joined?.response?.headers.get("set-cookie")?.split(";")[0] ?? "";
      const data = joined?.data as { guestId: string; sessionId: string; alias: string };
      return { api: client(baseURL ?? "", testInfo, { Cookie: cookie }), ...data };
    };
    await provide({ staff, table, guest });
  },
});

export { expect, idempotency };
