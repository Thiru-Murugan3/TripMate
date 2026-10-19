import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeviceAccess} from '../src/device-access.mjs';
function setup(cameraState='prompt',locationState='prompt') {
  const calls=[],saved=new Map();
  const preferences={get:async({key})=>({value:saved.get(key)||null}),set:async({key,value})=>{saved.set(key,value);},remove:async({key})=>{saved.delete(key);}};
  const camera={checkPermissions:async()=>({camera:cameraState}),requestPermissions:async options=>{calls.push(['camera-permission',options]);return {camera:'granted'};},getPhoto:async options=>{calls.push(['camera',options]);return {webPath:'local-photo'};}};
  const location={checkPermissions:async()=>({location:locationState,coarseLocation:locationState}),requestPermissions:async options=>{calls.push(['location-permission',options]);return {location:'denied',coarseLocation:'granted'};},getCurrentPosition:async options=>{calls.push(['position',options]);return {coords:{latitude:11,longitude:76}};}};
  const deps={preferences,camera,location,confirmAction:()=>true,readPhoto:async()=>new Blob(['photo']),makeFile:(blob,name)=>({blob,name})};
  return {calls,deps,saved,access:()=>createDeviceAccess(deps)};
}
test('does not ask on startup; camera request precedes capture and never requests library access',async()=>{
  const s=setup(),access=s.access();assert.equal(s.calls.length,0);
  const file=await access.takeDocumentPhoto();assert.match(file.name,/\.jpg$/);
  assert.deepEqual(s.calls[0],['camera-permission',{permissions:['camera']}]);
  assert.equal(s.calls[1][1].saveToGallery,false);assert.equal(s.calls[1][1].source,'CAMERA');
});
test('declining the explanation or cancelling the camera preserves user choice',async()=>{
  const s=setup();s.deps.confirmAction=()=>false;assert.equal(await s.access().takeDocumentPhoto(),null);assert.equal(s.calls.length,0);
  s.deps.confirmAction=()=>true;s.deps.camera.getPhoto=async()=>{throw new Error('User cancelled photos app');};assert.equal(await s.access().takeDocumentPhoto(),null);
});
test('denial does not open the camera and permanent denial gives Settings recovery',async()=>{
  const s=setup('denied');await assert.rejects(s.access().takeDocumentPhoto(),/Android Settings/);assert.equal(s.calls.length,0);
  const fresh=setup();fresh.deps.camera.requestPermissions=async()=>({camera:'denied'});await assert.rejects(fresh.access().takeDocumentPhoto(),/Camera access is off/);assert.equal(fresh.calls.length,0);
});
test('granted permission is reused and oversized camera photos are rejected',async()=>{
  const s=setup('granted');s.deps.readPhoto=async()=>new Blob([new Uint8Array(10*1024*1024+1)]);
  await assert.rejects(s.access().takeDocumentPhoto(),/under 10 MB/);assert.deepEqual(s.calls.map(c=>c[0]),['camera']);
});
test('accepts approximate location and never starts background tracking',async()=>{
  const s=setup(),result=await s.access().currentPosition();assert.equal(result.coords.latitude,11);
  assert.deepEqual(s.calls[0],['location-permission',{permissions:['location']}]);assert.equal(s.calls[1][1].enableHighAccuracy,false);
  const denied=setup('prompt','denied');await assert.rejects(denied.access().currentPosition(),/Location access is off/);assert.equal(denied.calls.length,0);
});

test('setup completion survives recreation without requesting hardware access',async()=>{
 const s=setup(),first=s.access();assert.equal((await first.permissionSetup()).completed,false);assert.equal(s.calls.length,0);
 await first.completePermissionSetup();assert.equal((await s.access().permissionSetup()).completed,true);assert.equal(s.calls.length,0);
});
test('asks before the first gallery selection and remembers consent across restarts',async()=>{
 const s=setup();let prompts=0;s.deps.confirmAction=()=>{prompts++;return true;};
 await s.access().pickDocumentPhoto();await s.access().pickDocumentPhoto();assert.equal(prompts,1);
 assert.deepEqual(s.calls.map(c=>c[1].source),['PHOTOS','PHOTOS']);assert.equal((await s.access().permissionSetup()).photoSelection,true);
 await s.access().resetPhotoSelection();await s.access().pickDocumentPhoto();assert.equal(prompts,2);
});
test('declining gallery access never opens the picker or records approval',async()=>{
 const s=setup();s.deps.confirmAction=()=>false;assert.equal(await s.access().pickDocumentPhoto(),null);assert.equal(s.calls.length,0);assert.equal((await s.access().permissionSetup()).photoSelection,false);
});
test('startup opt-in remembers selected-photo approval without opening the gallery',async()=>{
 const s=setup();await s.access().requestPermission('photos');await s.access().completePermissionSetup();assert.equal(s.calls.length,0);
 s.deps.confirmAction=()=>{throw new Error('Consent repeated');};await s.access().pickDocumentPhoto();assert.equal(s.calls[0][1].source,'PHOTOS');
});
