import { writeFileSync } from 'node:fs';

const rawBaseUrl = process.env.TRIPMATE_API_BASE?.trim();

if (!rawBaseUrl) {
  console.error('TRIPMATE_API_BASE is required for the Render production build.');
  process.exit(1);
}

const apiBaseUrl = rawBaseUrl.replace(/\/+$/, '');
const apiUrl = `${apiBaseUrl}/api/v1`;

writeFileSync(
  'public/config.js',
  `window.__TRIPMATE_CONFIG__ = {\n  apiUrl: ${JSON.stringify(apiUrl)}\n};\n`,
  'utf8'
);

console.log(`TripMate runtime API configured for ${apiUrl}`);
