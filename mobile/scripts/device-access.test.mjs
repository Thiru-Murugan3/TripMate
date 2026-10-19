import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeviceAccess} from '../src/device-access.mjs';
function setup(){
 const calls=[],saved=new Map(),state={photos:'denied',camera:'denied',location:'denied'};
 const permissions={status:async()=>({...state}),requestPhotos:async()=>{calls.push('photos');state.photos='limited';return {...state};},requestCamera:async()=>{calls.push('camera-permission');state.camera='granted';return {...state};},requestLocation:async()=>{calls.push('location-permission');state.location='granted';return {...state};},openSettings:async()=>{calls.push('settings');}};
 const camera={getPhoto:async options=>{calls.push(options);return {webPath:'local-photo'};}};
 const location={getCurrentPosition:async options=>{calls.push(options);return {coords:{latitude:11,longitude:76}};}};
 const preferences={get:async({key})=>({value:saved.get(key)||null}),set:async({key,value})=>saved.set(key,value)};
 const deps={permissions,camera,location,preferences,readPhoto:async()=>new Blob(['photo']),makeFile:(blob,name)=>({blob,name})};
 return {calls,saved,state,deps,access:()=>createDeviceAccess(deps)};
}
test('construction and status checks never request a permission or open a picker',async()=>{
 const s=setup();await s.access().permissionSetup();assert.equal(s.calls.length,0);
});
test('native photo permission must resolve before the gallery picker opens',async()=>{
 const s=setup();await s.access().pickDocumentPhoto();assert.equal(s.calls[0],'photos');assert.equal(s.calls[1].source,'PHOTOS');
 assert.equal((await s.access().permissionSetup()).photoAccess,'limited');
 await s.access().pickDocumentPhoto();assert.equal(s.calls.filter(c=>c==='photos').length,1);
});
test('denying native photo access never opens the gallery',async()=>{
 const s=setup();s.deps.permissions.requestPhotos=async()=>({...s.state});
 await assert.rejects(s.access().pickDocumentPhoto(),/Photo access is off/);assert.equal(s.calls.length,0);
});
test('camera permission precedes capture, without saving to public gallery',async()=>{
 const s=setup();await s.access().takeDocumentPhoto();assert.equal(s.calls[0],'camera-permission');assert.equal(s.calls[1].source,'CAMERA');assert.equal(s.calls[1].saveToGallery,false);
});
test('cancelled capture returns no file; oversized photos are rejected',async()=>{
 const s=setup();s.deps.camera.getPhoto=async()=>{throw new Error('User cancelled photos app');};assert.equal(await s.access().takeDocumentPhoto(),null);
 s.deps.camera.getPhoto=async()=>({webPath:'local-photo'});s.deps.readPhoto=async()=>new Blob([new Uint8Array(10*1024*1024+1)]);await assert.rejects(s.access().takeDocumentPhoto(),/under 10 MB/);
});
test('granted camera and approximate location are reused without another prompt',async()=>{
 const s=setup();s.state.camera='granted';s.state.location='granted';await s.access().takeDocumentPhoto();await s.access().currentPosition();
 assert.equal(s.calls.some(c=>typeof c==='string'),false);assert.equal(s.calls[1].enableHighAccuracy,false);
});
test('completed post-login setup persists and ignores the old pre-login preference',async()=>{
 const s=setup();s.saved.set('permission-setup-v1','done');assert.equal((await s.access().permissionSetup()).completed,false);
 await s.access().completePermissionSetup();assert.equal((await s.access().permissionSetup()).completed,true);
});
test('revoked grants are checked live and Profile opens genuine Android settings',async()=>{
 const s=setup();s.state.photos='full';await s.access().completePermissionSetup();s.state.photos='denied';
 await s.access().pickDocumentPhoto();assert.equal(s.calls[0],'photos');await s.access().openPermissionSettings();assert.equal(s.calls.at(-1),'settings');
});
