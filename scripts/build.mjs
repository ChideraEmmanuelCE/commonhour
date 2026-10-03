import { cp, rm, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const source = fileURLToPath(new URL('../public/', import.meta.url));
const target = fileURLToPath(new URL('../dist/', import.meta.url));
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
console.log('Commonhour built. Publish the dist folder; no server or API keys are required.');
