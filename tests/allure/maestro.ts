/**
 * Lleva los flujos de Maestro (JUnit + videos) a resultados Allure con la jerarquía común
 * (labels.ts): los `tags` del flujo son [contexto, flujo de usuario] y su `name`, el escenario.
 * Uso: node tests/allure/maestro.ts <carpeta de flujos> <junit.xml> <carpeta de videos> <destino>
 */
import {
  copyFileSync,
  globSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { flowLabels } from "./labels.ts";

const [flows = "", junit = "", videos = "", to = ""] = process.argv.slice(2);
mkdirSync(to, { recursive: true });

type Flow = { name: string; tags: string[]; recording?: string };

/** Cabecera de cada flujo (el documento antes de `---`) y el nombre de su grabación. */
const header = (file: string): Flow => {
  const text = readFileSync(join(flows, file), "utf8");
  const [config = ""] = text.split(/^---$/m);
  const { name, tags = [] } = parse(config) as { name: string; tags?: string[] };
  return { name, tags, recording: text.match(/startRecording:\s*(\S+)/)?.[1] };
};
const byName = new Map(
  readdirSync(flows)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => [header(f).name, header(f)]),
);

const xml = readFileSync(junit, "utf8");
const cases = xml.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g);
for (const [, attributes = "", body = ""] of cases) {
  const attr = (key: string) => attributes.match(new RegExp(`${key}="([^"]*)"`))?.[1] ?? "";
  const flow = byName.get(attr("name"));
  if (!flow) throw new Error(`el flujo "${attr("name")}" no tiene cabecera con name y tags`);
  const labels = flowLabels(flow.tags, flow.name);
  const uuid = crypto.randomUUID();
  const stop = Date.now();
  const failure = body.match(/<failure[^>]*>([\s\S]*?)<\/failure>/)?.[1];
  // Maestro guarda cada grabación en <flujo>/startRecording/<nombre>.mp4.
  const [video] = flow.recording ? globSync(`**/${flow.recording}.mp4`, { cwd: videos }) : [];
  const attachments = [];
  if (video) {
    const source = `${uuid}-video.mp4`;
    copyFileSync(join(videos, video), join(to, source));
    attachments.push({ name: "video", source, type: "video/mp4" });
  }
  const result = {
    uuid,
    historyId: flow.name,
    name: flow.name,
    status: failure === undefined ? "passed" : "failed",
    statusDetails: failure === undefined ? {} : { message: failure },
    start: stop - Number(attr("time")) * 1000,
    stop,
    attachments,
    labels: [
      { name: "epic", value: labels.epic },
      { name: "feature", value: labels.feature },
      { name: "story", value: labels.story },
      { name: "tag", value: "mobile" },
      { name: "framework", value: "maestro" },
    ],
  };
  writeFileSync(join(to, `${uuid}-result.json`), JSON.stringify(result));
}
