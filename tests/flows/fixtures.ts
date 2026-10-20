/**
 * Fixture `api`: el cliente generado desde el contrato (un flujo no puede llamar algo que no esté
 * declarado). Cada request y su respuesta se adjuntan al paso en curso: el reporte muestra qué
 * se envió y qué respondió la API en cada paso del flujo.
 */
import { createClient, createConfig } from "@lo-mio/client";
import { test as base, expect } from "@playwright/test";
import * as allure from "allure-js-commons";
import { flowLabels } from "../allure/labels.ts";

type Api = ReturnType<typeof createClient>;

const describeHeaders = (headers: Headers, prefix: string) =>
  [...headers.entries()].map(([k, v]) => `${prefix} ${k}: ${v}`);

export const test = base.extend<{ api: Api; allureLabels: void }>({
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
  api: async ({ baseURL }, provide, testInfo) => {
    const api = createClient(createConfig({ baseUrl: baseURL ?? "" }));
    api.interceptors.response.use(async (response, request) => {
      const requestBody = request.body ? await request.clone().text() : "";
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
    await provide(api);
  },
});

export { expect };
