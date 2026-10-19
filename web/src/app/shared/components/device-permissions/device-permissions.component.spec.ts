import {TestBed} from '@angular/core/testing';
import {DevicePermissionsComponent} from './device-permissions.component';
describe('First-launch permission setup',()=>{
 const target=window as any;
 afterEach(()=>{delete target.SuttruDevice;});
 function setup(completed=false){
  const state={completed,photoSelection:false,camera:'prompt',location:'prompt'};
  const api={permissionSetup:jasmine.createSpy().and.callFake(async()=>({...state})),requestPermission:jasmine.createSpy().and.callFake(async(feature:string)=>{if(feature==='photos')state.photoSelection=true;return true;}),completePermissionSetup:jasmine.createSpy().and.callFake(async()=>{state.completed=true;}),resetPhotoSelection:jasmine.createSpy().and.callFake(async()=>{state.photoSelection=false;})};
  target.SuttruDevice=api;const f=TestBed.createComponent(DevicePermissionsComponent);f.detectChanges();return {f,state,api};
 }
 it('shows setup once without requesting access automatically and remembers skip',async()=>{
  const {f,api,state}=setup();await f.whenStable();expect(f.componentInstance.panel.nativeElement.open).toBeTrue();expect(api.requestPermission).not.toHaveBeenCalled();
  await f.componentInstance.finish();expect(state.completed).toBeTrue();expect(f.componentInstance.panel.nativeElement.open).toBeFalse();f.destroy();
  const next=setup(true);await next.f.whenStable();expect(next.f.componentInstance.panel.nativeElement.open).toBeFalse();next.f.destroy();
 });
 it('allows a specific choice, resets photo consent, and can reopen from Profile',async()=>{
  const {f,api}=setup(true);await f.whenStable();window.dispatchEvent(new Event('suttru:open-permissions'));await f.whenStable();expect(f.componentInstance.panel.nativeElement.open).toBeTrue();
  await f.componentInstance.allow('photos');expect(api.requestPermission).toHaveBeenCalledOnceWith('photos');expect(f.componentInstance.state?.photoSelection).toBeTrue();
  await f.componentInstance.resetPhotos();expect(f.componentInstance.state?.photoSelection).toBeFalse();f.destroy();
 });
 it('shows recovery after denial and stays open if saving the one-time choice fails',async()=>{
  const {f,api}=setup();await f.whenStable();api.requestPermission.and.rejectWith(new Error('Open Android Settings'));
  await f.componentInstance.allow('camera');expect(f.componentInstance.error).toContain('Android Settings');expect(f.componentInstance.busy).toBeFalse();
  api.completePermissionSetup.and.rejectWith(new Error('storage unavailable'));await f.componentInstance.finish();expect(f.componentInstance.panel.nativeElement.open).toBeTrue();expect(f.componentInstance.error).toContain('Unable to remember');f.destroy();
 });
});
