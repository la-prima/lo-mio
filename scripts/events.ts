/**
 * Genera el catálogo de eventos de un contexto desde su asyncapi.yaml: tópico → schema zod.
 * Los payloads se definen una sola vez en `components.schemas` del openapi.yaml del contexto
 * (hey-api genera su zod con tipos); el AsyncAPI solo declara tópicos y referencia esos schemas.
 */
type Channel = { address?: unknown; messages?: Record<string, { payload?: { $ref?: unknown } }> };
type AsyncApiDoc = { channels?: Record<string, Channel> };

const PAYLOAD_REF = /^\.\/openapi\.yaml#\/components\/schemas\/([A-Za-z][A-Za-z0-9]*)$/;

const TOPIC = /^([a-z][a-z0-9-]*)\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.v[1-9][0-9]*$/;

function topicOf(context: string, name: string, channel: Channel): string {
  const topic = String(channel.address ?? "");
  if (TOPIC.exec(topic)?.[1] !== context) {
    throw new Error(
      `${context}: el canal "${name}" debe tener address ${context}.<agregado>.<hecho>.v<n> (tiene "${topic}")`,
    );
  }
  return topic;
}

function payloadSchemaOf(context: string, topic: string, channel: Channel): string {
  const messages = Object.values(channel.messages ?? {});
  if (messages.length !== 1)
    throw new Error(`${context}: ${topic} debe declarar exactamente un mensaje`);
  const match = String(messages[0]?.payload?.$ref ?? "").match(PAYLOAD_REF);
  if (!match?.[1]) {
    throw new Error(
      `${context}: el payload de ${topic} debe ser $ref: ./openapi.yaml#/components/schemas/<Nombre>`,
    );
  }
  return match[1];
}

/** Código fuente de `contracts/generated/events.gen.ts`. */
export function eventCatalogSource(context: string, doc: AsyncApiDoc): string {
  const entries = Object.entries(doc.channels ?? {}).map(([name, channel]) => {
    const topic = topicOf(context, name, channel);
    return { topic, schema: `z${payloadSchemaOf(context, topic, channel)}` };
  });
  const topics = entries.map((e) => e.topic);
  const repeated = topics.find((t, i) => topics.indexOf(t) !== i);
  if (repeated) throw new Error(`${context}: el tópico ${repeated} está declarado dos veces`);

  const schemas = [...new Set(entries.map((e) => e.schema))].sort();
  const lines = ["// Generado por scripts/contracts.ts desde asyncapi.yaml. No editar.", ""];
  if (schemas.length > 0) lines.push(`import { ${schemas.join(", ")} } from "./zod.gen.ts";`, "");
  lines.push("/** Eventos que publica el contexto: tópico → schema del payload. */");
  lines.push("export const events = {");
  for (const e of entries.sort((a, b) => a.topic.localeCompare(b.topic)))
    lines.push(`  "${e.topic}": ${e.schema},`);
  lines.push("} as const;", "");
  return lines.join("\n");
}
