import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
const cap = (...args) => execFileSync(process.execPath, ['node_modules/@capacitor/cli/bin/capacitor', ...args], { stdio:'inherit' });
if (!existsSync('www/suttru-native.js')) throw new Error('Run npm run prepare:web before generating Android.');
if (!existsSync('android')) cap('add','android');
cap('sync','android');
const manifest = 'android/app/src/main/AndroidManifest.xml';
let xml = readFileSync(manifest, 'utf8').replace(/\sandroid:(?:allowBackup|fullBackupContent|usesCleartextTraffic)="[^"]*"/g, '');
xml = xml.replace('<application', '<application android:allowBackup="false" android:fullBackupContent="false" android:usesCleartextTraffic="false"');
writeFileSync(manifest, xml);
const gradle = 'android/app/build.gradle';
let build = readFileSync(gradle, 'utf8').replace(/versionName ["'][^"']*["']/, 'versionName "0.1.0"');
if (!build.includes('applicationIdSuffix')) build = build.replace('buildTypes {', 'buildTypes {\n        debug { applicationIdSuffix ".debug" }');
writeFileSync(gradle, build);
const resource = 'android/app/src/main/res';
for (const [density, size] of Object.entries({ mdpi:48, hdpi:72, xhdpi:96, xxhdpi:144, xxxhdpi:192 })) {
  const directory = `${resource}/mipmap-${density}`;
  mkdirSync(directory, { recursive:true });
  for (const name of ['ic_launcher','ic_launcher_round']) {
    await sharp('../web/public/suttru-icon.svg').resize(size,size).png().toFile(`${directory}/${name}.png`);
  }
  const foregroundSize = Math.round(size * 108 / 48), markSize = Math.round(foregroundSize * .6);
  const logo = await sharp('../web/public/suttru-icon.svg').resize(markSize,markSize).png().toBuffer();
  await sharp({create:{width:foregroundSize,height:foregroundSize,channels:4,background:'#f8fafc'}})
    .composite([{input:logo,gravity:'centre'}]).png().toFile(`${directory}/ic_launcher_foreground.png`);
}
mkdirSync(`${resource}/mipmap-anydpi-v26`,{recursive:true});
for (const name of ['ic_launcher','ic_launcher_round']) {
  writeFileSync(`${resource}/mipmap-anydpi-v26/${name}.xml`, '<?xml version="1.0" encoding="utf-8"?><adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/suttru_launcher_background"/><foreground android:drawable="@mipmap/ic_launcher_foreground"/></adaptive-icon>');
}
writeFileSync(`${resource}/values/suttru_launcher.xml`, '<?xml version="1.0" encoding="utf-8"?><resources><color name="suttru_launcher_background">#f8fafc</color></resources>');
console.log('Android synced with bundled web assets and the existing Suttru icon.');
