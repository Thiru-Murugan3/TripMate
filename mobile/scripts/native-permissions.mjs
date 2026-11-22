import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
export function installNativePermissions(androidRoot){
 const directory=join(androidRoot,'app/src/main/java/in/suttru/app');mkdirSync(directory,{recursive:true});
 for(const name of ['MainActivity.java','SuttruPermissionsPlugin.java'])writeFileSync(join(directory,name),readFileSync(new URL('../native-android/'+name,import.meta.url)));
 const manifest=join(androidRoot,'app/src/main/AndroidManifest.xml');let xml=readFileSync(manifest,'utf8');
 for(const permission of ['READ_MEDIA_IMAGES','READ_MEDIA_VISUAL_USER_SELECTED','READ_EXTERNAL_STORAGE']){
  if(!xml.includes(`android.permission.${permission}"`))xml=xml.replace('</manifest>',`<uses-permission android:name="android.permission.${permission}"${permission==='READ_EXTERNAL_STORAGE'?' android:maxSdkVersion="32"':''}/></manifest>`);
 }
 writeFileSync(manifest,xml);
}
