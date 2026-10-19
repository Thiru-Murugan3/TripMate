import {AfterViewInit, Component, ElementRef, OnDestroy, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {device, DeviceAccess, PermissionSetup} from '../../../core/utils/device-access';

@Component({selector:'app-device-permissions',standalone:true,imports:[CommonModule],template:`
 <dialog #panel data-device-permissions aria-labelledby="device-access-title" (cancel)="cancel($event)">
  <h2 id="device-access-title" tabindex="-1" autofocus>Set up app access</h2>
  <p>Choose what Suttru can use on this phone.</p>
  <p *ngIf="error" role="alert" class="error">{{error}}</p>
  <section *ngIf="state">
   <article><h3>Photos</h3><p>Only photos you select. Android opens its photo picker when you choose a photo.</p>
    <button type="button" [disabled]="busy" (click)="state.photoSelection ? resetPhotos() : allow('photos')">{{state.photoSelection ? 'Ask next time' : 'Allow selected photos'}}</button>
    <small *ngIf="state.photoSelection">Photo selection allowed on this phone</small>
   </article>
   <article><h3>Camera</h3><p>Photograph tickets, receipts and other trip documents.</p><button type="button" [disabled]="busy || state.camera==='granted'" (click)="allow('camera')">{{state.camera==='granted' ? 'Camera allowed' : 'Allow camera'}}</button></article>
   <article><h3>Location</h3><p>Find nearby places and choose a route starting point.</p><button type="button" [disabled]="busy || state.location==='granted'" (click)="allow('location')">{{state.location==='granted' ? 'Location allowed' : 'Allow location'}}</button></article>
  </section>
  <p class="note">Access is optional. Change system permissions in Android Settings → Apps → Suttru → Permissions.</p>
  <footer><button type="button" class="secondary" [disabled]="busy" (click)="finish()">Not now</button><button type="button" [disabled]="busy" (click)="finish()">Continue</button></footer>
 </dialog>`,styles:[`
 :host{display:contents}dialog{box-sizing:border-box;border:0;border-radius:20px;padding:22px;width:min(440px,calc(100% - 24px));max-height:calc(100dvh - 40px);overflow:auto;color:#0f172a;background:#fff}dialog::backdrop{background:#0f172a80;backdrop-filter:blur(3px)}h2{font-size:21px;margin:0 0 8px}h3{font-size:15px;margin:0}p{font-size:13px;color:#64748b;line-height:1.5;margin:6px 0 12px}article{border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin:10px 0}button{font:inherit;font-size:13px;min-height:44px;border:0;border-radius:10px;padding:10px 16px;background:#2563eb;color:#fff;cursor:pointer;max-width:100%;overflow-wrap:anywhere}button:disabled{background:#e2e8f0;color:#475569;cursor:default}small{display:block;font-size:11px;color:#166534;margin-top:6px}.error{color:#b91c1c}.note{font-size:11px}footer{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}footer button{flex:1}.secondary{background:#eff6ff;color:#2563eb}button:focus-visible{outline:3px solid #38bdf8;outline-offset:2px}
 `]})
export class DevicePermissionsComponent implements AfterViewInit,OnDestroy {
 @ViewChild('panel',{static:true}) panel!:ElementRef<HTMLDialogElement>;
 state:PermissionSetup|null=null;busy=false;error='';private loading=false;private forced=false;private destroyed=false;private api:DeviceAccess|undefined;
 private open=()=>{void this.load(true);};
 ngAfterViewInit():void{window.addEventListener('suttru:open-permissions',this.open);void this.load(false);}
 private async load(force:boolean):Promise<void>{
  this.forced ||= force;if(this.loading)return;this.api=device();if(!this.api?.permissionSetup)return;this.loading=true;
  try{this.state=await this.api.permissionSetup();if(!this.destroyed && (this.forced || !this.state.completed) && !this.panel.nativeElement.open)this.panel.nativeElement.showModal();}
  catch{this.error='Unable to load app access. Please try again from Profile.';}
  finally{this.loading=false;this.forced=false;}
 }
 async allow(feature:'photos'|'camera'|'location'):Promise<void>{
  if(this.busy || !this.api?.requestPermission || !this.api.permissionSetup)return;this.busy=true;this.error='';
  try{await this.api.requestPermission(feature);this.state=await this.api.permissionSetup();}catch(e){this.error=e instanceof Error?e.message:'Unable to enable access. Please try again.';}finally{this.busy=false;}
 }
 async resetPhotos():Promise<void>{
  if(this.busy || !this.api?.resetPhotoSelection || !this.api.permissionSetup)return;this.busy=true;this.error='';
  try{await this.api.resetPhotoSelection();this.state=await this.api.permissionSetup();}catch{this.error='Unable to update photo selection. Please try again.';}finally{this.busy=false;}
 }
 async finish():Promise<void>{
  if(this.busy || !this.api?.completePermissionSetup)return;this.busy=true;this.error='';
  try{await this.api.completePermissionSetup();if(!this.destroyed)this.panel.nativeElement.close();}catch{this.error='Unable to remember this choice. Please try again.';}finally{this.busy=false;}
 }
 cancel(event:Event):void{event.preventDefault();void this.finish();}
 ngOnDestroy():void{this.destroyed=true;window.removeEventListener('suttru:open-permissions',this.open);if(this.panel.nativeElement.open)this.panel.nativeElement.close();}
}
