import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { packageWeb } from './package-web.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const api = packageWeb(resolve(root, '../web/dist/tripmate-web/browser'), resolve(root, 'www'), process.env.MOBILE_API_BASE);
await build({ entryPoints:[resolve(root,'src/native.ts')], outfile:resolve(root,'www/suttru-native.js'), bundle:true, minify:true, format:'iife', target:'es2022' });
console.log(`Packaged Suttru for Android using ${api}.`);
