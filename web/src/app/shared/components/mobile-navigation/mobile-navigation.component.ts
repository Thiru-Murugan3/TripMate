import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-mobile-navigation', standalone: true, imports: [RouterLink],
  template: `
    <nav class="mobile-navigation" aria-label="Main navigation">
      <a routerLink="/dashboard" [class.active]="active('home')" [attr.aria-current]="active('home') ? 'page' : null"><img src="assets/mobile/home.svg" alt="" />Home</a>
      <a routerLink="/trips" [class.active]="active('trips')" [attr.aria-current]="active('trips') ? 'page' : null"><img src="assets/mobile/trips.svg" alt="" />Trips</a>
      <a class="create-trip" routerLink="/dashboard" [queryParams]="{createTrip: 1}" aria-label="Plan a new trip"><img src="assets/mobile/plus-white.svg" alt="" /></a>
      <a routerLink="/expenses" [class.active]="active('expenses')" [attr.aria-current]="active('expenses') ? 'page' : null"><img src="assets/mobile/expense-muted.svg" alt="" />Expenses</a>
      <a routerLink="/account" [class.active]="active('profile')" [attr.aria-current]="active('profile') ? 'page' : null"><img src="assets/mobile/profile.svg" alt="" />Profile</a>
    </nav>`,
  styles: [`
    :host { display:none; }
    @media(max-width:760px) {
      :host { display:block; }
      .mobile-navigation {
        position:fixed; inset:auto 0 0; z-index:1100; display:grid;
        grid-template-columns:repeat(5,minmax(0,1fr)); align-items:start;
        min-height:72px; padding:8px 8px calc(8px + var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)));
        background:#fff; border-top:1px solid #e2e8f0; box-shadow:0 -4px 20px #0f172a06;
      }
      a { display:flex; min-width:0; min-height:52px; flex-direction:column; gap:5px; align-items:center; justify-content:center; text-decoration:none; color:#64748b; font-size:10px; font-weight:600; border-radius:12px; }
      a.active { color:#2563eb; background:#eff6ff; }
      a:not(.active):not(.create-trip) img { filter:grayscale(1); opacity:.8; }
      .create-trip { position:relative; top:-24px; justify-self:center; width:52px; height:52px; border-radius:50%; background:#2563eb; box-shadow:0 6px 16px #2563eb40; }
      a:focus-visible { outline:3px solid #38bdf8; outline-offset:2px; }
    }
  `]
})
export class MobileNavigationComponent {
  private readonly router = inject(Router);
  active(tab: 'home'|'trips'|'expenses'|'profile'): boolean {
    const url = this.router.parseUrl(this.router.url);
    const path = this.router.url.split('?')[0];
    if (tab === 'home') return path === '/dashboard';
    if (tab === 'profile') return path === '/account';
    const expenses = path === '/expenses' || url.queryParams['tab'] === 'EXPENSES';
    return tab === 'expenses' ? expenses : path.startsWith('/trips') && !expenses;
  }
}
