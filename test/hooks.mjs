// Lets node resolve the bare "three" specifier to the vendored build (same as the browser import map).
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
export async function resolve(spec, ctx, next) {
  if (spec === 'three') return { url: pathToFileURL(path.join(here, '../vendor/three.module.min.js')).href, shortCircuit: true };
  return next(spec, ctx);
}
