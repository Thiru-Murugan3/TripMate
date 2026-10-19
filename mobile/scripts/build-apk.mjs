import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
if (!existsSync('android/gradlew')) throw new Error('Run npm run android:sync first.');
const tasks = ['assembleDebug','lintDebug','--no-daemon'];
if (process.platform === 'win32') {
  execFileSync('cmd.exe', ['/d','/c','gradlew.bat',...tasks], { cwd:'android', stdio:'inherit' });
} else {
  execFileSync('./gradlew', tasks, { cwd:'android', stdio:'inherit' });
}
mkdirSync('dist',{recursive:true});
copyFileSync('android/app/build/outputs/apk/debug/app-debug.apk','dist/Suttru-debug.apk');
console.log('Created mobile/dist/Suttru-debug.apk (debug-signed testing build).');
