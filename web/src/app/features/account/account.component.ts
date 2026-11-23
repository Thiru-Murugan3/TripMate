import { device } from '../../core/utils/device-access';
import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector:'app-account', standalone:true, imports:[CommonModule,RouterLink],
  template:`
    <main class="account-page">
      <h1>Profile</h1>
      <section class="identity" aria-label="Your account">
        <img *ngIf="auth.currentUser()?.avatarUrl; else initials" [src]="auth.currentUser()?.avatarUrl" alt="Your profile" width="80" height="80" (error)="avatarFailed=true" [hidden]="avatarFailed" />
        <ng-template #initials><div class="avatar" aria-hidden="true">{{ initialsText }}</div></ng-template>
        <div *ngIf="avatarFailed" class="avatar" aria-hidden="true">{{ initialsText }}</div>
        <h2>{{ auth.currentUser()?.name || 'Traveller' }}</h2><p>{{ auth.currentUser()?.email }}</p>
      </section>
      <section class="account-details"><h3>Account details</h3><dl><div><dt>Email</dt><dd>{{ auth.currentUser()?.email }}</dd></div><div *ngIf="auth.currentUser()?.mobile"><dt>Mobile</dt><dd>{{ auth.currentUser()?.mobile }}</dd></div></dl></section>
      <nav class="account-menu" aria-label="Account options">
        <a routerLink="/trips"><span class="menu-ico material-symbols-outlined" aria-hidden="true">luggage</span>My trips<span aria-hidden="true">›</span></a>
        <a routerLink="/expenses"><span class="menu-ico material-symbols-outlined" aria-hidden="true">payments</span>Trip expenses<span aria-hidden="true">›</span></a>
        <a routerLink="/notifications"><span class="menu-ico material-symbols-outlined" aria-hidden="true">notifications</span>Notifications<span aria-hidden="true">›</span></a>
        <a routerLink="/invitations"><span class="menu-ico material-symbols-outlined" aria-hidden="true">group_add</span>Group invitations<span aria-hidden="true">›</span></a>
        <a href="/offline.html"><span class="menu-ico material-symbols-outlined" aria-hidden="true">download_for_offline</span>Saved offline trips<span aria-hidden="true">›</span></a>
        <a *ngIf="auth.currentUser()?.systemRole==='ADMIN'" routerLink="/admin/discovery"><span class="menu-ico material-symbols-outlined" aria-hidden="true">verified</span>Verify tourism data<span aria-hidden="true">›</span></a>
        <button *ngIf="nativePermissions" type="button" class="permissions-button" (click)="openPermissions()"><span class="menu-ico material-symbols-outlined" aria-hidden="true">tune</span>App permissions<span aria-hidden="true">›</span></button>
        <button type="button" (click)="logout()" [disabled]="signingOut">{{ signingOut ? 'Signing out…' : 'Sign out' }}</button>
      </nav>
      <p class="about">Suttru · Explore beyond</p>
    </main>`,
  styles:[`
    :host{display:block;background:#f8fafc;color:#0f172a;min-height:100vh}.account-page{max-width:560px;margin:auto;padding:20px;overflow-wrap:anywhere}h1{font-size:22px;margin:0 0 24px;font-weight:800}.identity{text-align:center;margin-bottom:24px}.identity>img,.avatar{border-radius:50%;object-fit:cover}.avatar{width:80px;height:80px;display:grid;place-items:center;margin:auto;background:#ffedd5;color:#b45309;font-size:24px;font-weight:800}h2{font-size:20px;margin:12px 0 4px}.identity p{font-size:13px;color:#64748b;margin:0}.account-details{padding:16px;background:white;border-radius:16px;margin-bottom:20px;box-shadow:0 4px 16px #b4530908}h3{font-size:14px;margin:0 0 12px}dl{margin:0}dl>div{display:grid;gap:4px;margin-top:12px}dt{color:#64748b;font-size:12px}dd{margin:0;font-size:14px}.account-menu{background:white;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden}.account-menu a,.account-menu button{display:flex;align-items:center;gap:12px;width:100%;min-height:56px;padding:14px 16px;text-decoration:none;color:#0f172a;font-size:14px;font-weight:600;border:0;border-bottom:1px solid #e2e8f0;background:white;text-align:left;font-family:inherit}.account-menu a>span:last-child{margin-left:auto;color:#94a3b8}.account-menu button{color:#dc2626;cursor:pointer;border-bottom:0}.menu-symbol{width:20px;text-align:center;color:#64748b}.about{text-align:center;color:#94a3b8;font-size:12px;margin:24px 0}
    .account-menu .permissions-button{color:#0f172a;border-bottom:1px solid #e2e8f0}.permissions-button span:last-child{margin-left:auto}
    /* Navy + saffron profile */
    :host{background:#f7f7fa;color:#141a33}h1{letter-spacing:-.03em}
    .avatar{background:linear-gradient(135deg,#141a33,#232c55);color:#f4a340;box-shadow:0 0 0 4px #fff,0 16px 30px -18px rgba(20,26,51,.8)}
    .identity h2{color:#141a33;font-weight:800;letter-spacing:-.02em}.identity p{color:#5d6481}
    .account-details{border:1px solid #eceef4;border-radius:20px;box-shadow:0 1px 2px rgba(20,26,51,.04),0 16px 32px -26px rgba(20,26,51,.55)}
    .account-details h3{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#5d6481}dt{color:#5d6481}dd{font-weight:600}
    .account-menu{border-color:#eceef4;border-radius:20px;box-shadow:0 1px 2px rgba(20,26,51,.04),0 16px 32px -26px rgba(20,26,51,.55)}
    .account-menu a,.account-menu button{gap:14px;color:#141a33;border-bottom-color:#f0f1f6}
    .menu-ico{display:grid;place-items:center;flex:none;width:36px;height:36px;border-radius:12px;background:#fff1dd;color:#b45309;font-size:20px}
    .account-menu a:nth-child(even) .menu-ico{background:#eef0f8;color:#232c55}
    .account-menu a>span:last-child{font-size:20px;color:#a3a9c4}
    .account-menu button:last-child{justify-content:center;color:#b91c1c;font-weight:700}
    .about{color:#a3a9c4;letter-spacing:.04em}
    @media(max-width:760px){.account-page{padding-bottom:calc(112px + env(safe-area-inset-bottom,0px))}}
  `]
})
export class AccountComponent {
  readonly auth=inject(AuthService); private readonly router=inject(Router);
  readonly nativePermissions=!!device()?.permissionSetup;
  openPermissions():void{window.dispatchEvent(new Event("suttru:open-permissions"));}
  signingOut=false; avatarFailed=false;
  get initialsText():string {return (this.auth.currentUser()?.name || 'Traveller').trim().split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase();}
  logout():void {if(this.signingOut)return;this.signingOut=true;this.auth.logout().subscribe(()=>void this.router.navigate(['/login']));}
}
