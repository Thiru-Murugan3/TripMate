import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {installNativePermissions} from './native-permissions.mjs';
test('Android generation registers the real permission plugin and version-scoped media declarations idempotently',()=>{
 const dir=mkdtempSync(join(tmpdir(),'suttru-native-permissions-'));
 try{
  const manifest=join(dir,'app/src/main/AndroidManifest.xml');mkdirSync(join(dir,'app/src/main'),{recursive:true});writeFileSync(manifest,'<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application/></manifest>');
  installNativePermissions(dir);const first=readFileSync(manifest,'utf8');installNativePermissions(dir);assert.equal(readFileSync(manifest,'utf8'),first);
  assert.match(first,/READ_MEDIA_IMAGES/);assert.match(first,/READ_MEDIA_VISUAL_USER_SELECTED/);assert.match(first,/READ_EXTERNAL_STORAGE" android:maxSdkVersion="32"/);assert.doesNotMatch(first,/READ_MEDIA_VIDEO|MANAGE_EXTERNAL_STORAGE/);
  const activity=readFileSync(join(dir,'app/src/main/java/in/suttru/app/MainActivity.java'),'utf8');assert.ok(activity.indexOf('registerPlugin(')<activity.indexOf('super.onCreate('));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
