import {TestBed,fakeAsync,flushMicrotasks} from '@angular/core/testing';
import {signal} from '@angular/core';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController,provideHttpClientTesting} from '@angular/common/http/testing';
import {NavigationEnd,Router} from '@angular/router';
import {Subject} from 'rxjs';
import {AuthService} from '../../../core/services/auth.service';
import {DevicePermissionsComponent,requestPendingPermissions} from './device-permissions.component';
const initial=()=>({completed:false,photoSelection:false,camera:'denied',location:'denied'});
describe('Native permission prompts after login',()=>{
 const target=window as any;
 afterEach(()=>{TestBed.inject(HttpTestingController).verify();delete target.SuttruDevice;});
 function setup(authenticated=false,path='/login',completed=false,verified=false){
  const state={...initial(),completed},events=new Subject<any>(),order:string[]=[];
  const auth={isSessionVerified:()=>verified,isAuthenticated:signal(authenticated),currentUser:signal<any>(authenticated?{id:1}:null),token:authenticated?'token-1':null as string|null,getToken:()=>auth.token};
  const api={permissionSetup:jasmine.createSpy().and.callFake(async()=>({...state})),requestPermission:jasmine.createSpy().and.callFake(async(feature:string)=>{order.push(feature);return false;}),completePermissionSetup:jasmine.createSpy().and.callFake(async()=>{state.completed=true;}),openPermissionSettings:jasmine.createSpy().and.resolveTo()};
  target.SuttruDevice=api;
  TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting(),{provide:AuthService,useValue:auth},{provide:Router,useValue:{url:path,events}}]});
  const f=TestBed.createComponent(DevicePermissionsComponent);f.detectChanges();return {f,auth,api,events,order,state,http:TestBed.inject(HttpTestingController)};
 }
 it('never prompts on login; verifies the signed-in session before requesting one permission at a time',fakeAsync(()=>{
  const s=setup();flushMicrotasks();expect(s.api.permissionSetup).not.toHaveBeenCalled();s.http.expectNone(()=>true);
  s.auth.token='token-1';s.auth.currentUser.set({id:1});s.auth.isAuthenticated.set(true);s.f.detectChanges();flushMicrotasks();expect(s.api.requestPermission).not.toHaveBeenCalled();
  s.events.next(new NavigationEnd(1,'/dashboard','/dashboard'));s.f.detectChanges();flushMicrotasks();
  const request=s.http.expectOne(r=>r.url.endsWith('/users/me'));expect(s.order).toEqual([]);request.flush({id:1});flushMicrotasks();
  expect(s.order).toEqual(['photos','camera','location']);expect(s.api.completePermissionSetup).toHaveBeenCalledTimes(1);s.f.destroy();
 }));
 it('reuses a profile verified by this sign-in without a second server request',fakeAsync(()=>{
  const s=setup(true,'/dashboard',false,true);flushMicrotasks();s.http.expectNone(()=>true);expect(s.order).toEqual(['photos','camera','location']);expect(s.api.completePermissionSetup).toHaveBeenCalled();s.f.destroy();
 }));
 it('reuses completed setup and opens Android settings from Profile',async()=>{
  const s=setup(true,'/account',true);await s.f.whenStable();s.http.expectNone(()=>true);expect(s.api.requestPermission).not.toHaveBeenCalled();
  window.dispatchEvent(new Event('suttru:open-permissions'));expect(s.api.openPermissionSettings).toHaveBeenCalledTimes(1);s.f.destroy();
 });
 it('does not start prompts when logout happens during session verification',async()=>{
  const s=setup(true,'/dashboard');await s.f.whenStable();const request=s.http.expectOne(r=>r.url.endsWith('/users/me'));
  s.auth.token=null;s.auth.isAuthenticated.set(false);s.auth.currentUser.set(null);s.f.detectChanges();request.flush({id:1});await s.f.whenStable();
  expect(s.api.requestPermission).not.toHaveBeenCalled();expect(s.api.completePermissionSetup).not.toHaveBeenCalled();s.f.destroy();
 });
 it('never prompts for a mismatched cached user',async()=>{
  const s=setup(true,'/dashboard');await s.f.whenStable();s.http.expectOne(r=>r.url.endsWith('/users/me')).flush({id:2});await s.f.whenStable();
  expect(s.api.requestPermission).not.toHaveBeenCalled();s.f.destroy();
 });
});
describe('Sequential native permission requests',()=>{
 it('awaits the current native dialog, continues after denial, and skips existing grants',async()=>{
  const order:string[]=[];let finish!:(allowed:boolean)=>void,complete=false;
  const api:any={requestPermission:async(feature:string)=>{order.push(feature);if(feature==='photos')return new Promise<boolean>(r=>finish=r);return false;},completePermissionSetup:async()=>{complete=true;}};
  const pending=requestPendingPermissions(api,initial(),()=>true);expect(order).toEqual(['photos']);finish(false);await pending;
  expect(order).toEqual(['photos','camera','location']);expect(complete).toBeTrue();order.length=0;
  await requestPendingPermissions(api,{...initial(),photoSelection:true,camera:'granted',location:'granted'},()=>true);expect(order).toEqual([]);
 });
 it('stops queued prompts if sign-in ends while a dialog is open',async()=>{
  const order:string[]=[];let active=true,finish!:(value:boolean)=>void;const complete=jasmine.createSpy().and.resolveTo();
  const api:any={requestPermission:(feature:string)=>{order.push(feature);return new Promise<boolean>(r=>finish=r);},completePermissionSetup:complete};
  const pending=requestPendingPermissions(api,initial(),()=>active);active=false;finish(true);await pending;
  expect(order).toEqual(['photos']);expect(complete).not.toHaveBeenCalled();
 });
});
