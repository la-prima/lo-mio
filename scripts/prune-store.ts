/**
 * Deja en node_modules/.pnpm solo lo alcanzable desde los proyectos dados (siguiendo los symlinks
 * de sus node_modules). pnpm materializa el store virtual de todos los importers del lockfile aun
 * con --filter: sin esto, la imagen de la API traería Expo, Metro y Babel (y sus CVE).
 * Uso (en la etapa de build): node scripts/prune-store.ts <carpetas de los proyectos>
 */
import { existsSync, lstatSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const store = resolve("node_modules/.pnpm");
const reachable = new Set<string>();

/** Paquetes de un node_modules, con los scopes (@x/y) aplanados. */
const entries = (dir: string) =>
  readdirSync(dir)
    .filter((name) => !name.startsWith("."))
    .flatMap((name) =>
      name.startsWith("@") ? readdirSync(join(dir, name)).map((sub) => join(name, sub)) : [name],
    );

const pending = process.argv.slice(2).map((p) => join(resolve(p), "node_modules"));
while (pending.length > 0) {
  const dir = pending.pop() ?? "";
  if (!existsSync(dir)) continue;
  for (const name of entries(dir)) {
    const link = join(dir, name);
    if (!existsSync(link)) continue;
    const target = realpathSync(link);
    if (!target.startsWith(store + sep)) continue;
    // node_modules/.pnpm/<id>/node_modules/<paquete>: sus dependencias son hermanas en ese node_modules.
    const id = relative(store, target).split(sep)[0] ?? "";
    if (reachable.has(id)) continue;
    reachable.add(id);
    pending.push(join(store, id, "node_modules"));
  }
}

let removed = 0;
for (const id of readdirSync(store)) {
  if (id === "node_modules" || id.startsWith(".") || reachable.has(id)) continue;
  rmSync(join(store, id), { recursive: true, force: true });
  removed++;
}
// Los enlaces de hoisting (.pnpm/node_modules) que apuntaban a lo borrado quedan colgando.
const hoisted = join(store, "node_modules");
if (existsSync(hoisted)) {
  for (const name of entries(hoisted)) {
    const link = join(hoisted, name);
    if (lstatSync(link).isSymbolicLink() && !existsSync(link)) rmSync(link);
  }
}
process.stdout.write(`store: ${reachable.size} paquetes alcanzables, ${removed} quitados\n`);
