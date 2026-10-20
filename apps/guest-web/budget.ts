/** Presupuesto de la carga inicial (docs/arquitectura.md, sección 7): JS + CSS en gzip. */
import { globSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const LIMIT_KB = 150;
const files = globSync("dist/assets/*.{js,css}");
const kb = files.reduce((sum, f) => sum + gzipSync(readFileSync(f)).length, 0) / 1024;
process.stdout.write(`carga inicial: ${kb.toFixed(1)} KB gzip (límite ${LIMIT_KB} KB)\n`);
if (kb > LIMIT_KB) process.exit(1);
