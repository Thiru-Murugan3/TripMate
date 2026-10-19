import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeviceAccess} from '../src/device-access.mjs';
function setup(cameraState='prompt',locationState='prompt') {
  const calls=[];
  const camera={checkPermissions:async()=>({camera:cameraState}),requestPermissions:async options=>{calls.push(['camera-permission',options]);return {camera:'granted'};},getPhoto:async options=>{calls.push(['camera',options]);return {webPath:'local-photo'};}};
  const location={checkPermissions:async()=>({location:locationState,coarseLocation:locationState}),requestPermissions:async options=>{calls.push(['location-permission',options]);return {location:'denied',coarseLocation:'granted'};},getCurrentPosition:async options=>{calls.push(['position',options]);return {coords:{latitude:11,longitude:76}};}};
  const deps={camera,location,confirmAction:()=>true,readPhoto:async()=>new Blob(['photo']),makeFile:(blob,name)=>({blob,name})};
  return {calls,deps,access:()=>createDeviceAccess(deps)};
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
