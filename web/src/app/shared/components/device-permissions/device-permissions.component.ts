import {Component, OnDestroy, effect, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {NavigationEnd, Router} from '@angular/router';
import {HttpClient} from '@angular/common/http';
import {filter, firstValueFrom} from 'rxjs';
import {AuthService} from '../../../core/services/auth.service';
import {device, DeviceAccess, PermissionSetup} from '../../../core/utils/device-access';
import {environment} from '../../../../environments/environment';

/** Await each Android prompt. Denial is a choice; native transport failures are retryable. */
export async function requestPendingPermissions(api:DeviceAccess,state:PermissionSetup,active:()=>boolean):Promise<void>{
 let failure:unknown;
 for(const feature of ['photos','camera','location'] as const){
  if(!active())return;
  if(feature==='photos'?state.photoSelection:state[feature]==='granted')continue;
  try{await api.requestPermission!(feature);}catch(error){failure ||= error;}
 }
 if(!active())return;
 if(failure)throw failure;
 await api.completePermissionSetup!();
}
@Component({selector:'app-device-permissions',standalone:true,imports:[CommonModule],template:`
 <aside *ngIf="error" role="status"><span>{{error}}</span><button type="button" (click)="error=''" aria-label="Dismiss permission message">Close</button></aside>
 `,styles:[`:host{display:contents}aside{position:fixed;z-index:3000;bottom:calc(96px + env(safe-area-inset-bottom,0px));left:12px;right:12px;max-width:480px;margin:auto;padding:14px;border-radius:12px;background:#0f172a;color:white;font-size:13px;line-height:1.5;display:flex;gap:12px;align-items:center}button{min-height:44px;border:0;border-radius:8px;background:#e2e8f0;padding:8px 12px;cursor:pointer}`]})
export class DevicePermissionsComponent implements OnDestroy {
 private readonly auth=inject(AuthService);private readonly router=inject(Router);private readonly http=inject(HttpClient);
 private readonly eligible=signal(this.allowedRoute(this.router.url));private epoch=0;private running=false;private attempted='';private destroyed=false;
 error='';
 private readonly subscription=this.router.events.pipe(filter((event):event is NavigationEnd=>event instanceof NavigationEnd)).subscribe(event=>this.eligible.set(this.allowedRoute(event.urlAfterRedirects)));
 private readonly openSettings=()=>{
  if(!this.auth.isAuthenticated()||!this.eligible())return;
  void device()?.openPermissionSettings?.().catch(()=>{this.error='Open Android Settings → Apps → Suttru → Permissions to change access.';});
 };
 constructor(){
  window.addEventListener('suttru:open-permissions',this.openSettings);
  effect(()=>{if(!this.auth.isAuthenticated()||!this.auth.currentUser()||!this.eligible()){this.epoch++;this.error='';return;}void this.start();});
 }
 private allowedRoute(url:string):boolean{
  const path=url.split(/[?#]/)[0];return !!path&&path!=='/'&&!/^\/(login|register|verify-email|forgot-password|reset-password)(\/|$)/.test(path);
 }
 private async start():Promise<void>{
  const api=device(),token=this.auth.getToken(),id=this.auth.currentUser()?.id,key=id+':'+token;
  if(this.running||!token||!id||this.attempted===key||!api?.permissionSetup||!api.requestPermission||!api.completePermissionSetup)return;
  this.running=true;this.attempted=key;const epoch=this.epoch;
  const active=()=>!this.destroyed&&this.epoch===epoch&&this.eligible()&&this.auth.isAuthenticated()&&this.auth.getToken()===token&&this.auth.currentUser()?.id===id;
  try{
   const state=await api.permissionSetup();if(state.completed||!active())return;
   // A cached token/user alone must never trigger permission prompts before session verification.
   const user=await firstValueFrom(this.http.get<{id:number}>(`${environment.apiUrl}/users/me`));
   if(!active()||user.id!==id)return;
   await requestPendingPermissions(api,state,active);
  }catch{if(active())this.error='Permission setup could not finish. You can change access in Profile → App permissions.';}
  finally{this.running=false;if(!this.destroyed&&(this.auth.getToken()!==token||this.auth.currentUser()?.id!==id||this.epoch!==epoch))queueMicrotask(()=>{if(this.auth.isAuthenticated()&&this.eligible()){this.attempted='';void this.start();}});}
 }
 ngOnDestroy():void{this.destroyed=true;this.epoch++;this.subscription.unsubscribe();window.removeEventListener('suttru:open-permissions',this.openSettings);}
}
