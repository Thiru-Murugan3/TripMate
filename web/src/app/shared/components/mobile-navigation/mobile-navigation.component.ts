import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-mobile-navigation', standalone: true, imports: [RouterLink],
  template: `
    <nav class="mobile-navigation" aria-label="Main navigation">
      <a routerLink="/dashboard" [class.active]="active('home')" [attr.aria-current]="active('home') ? 'page' : null"><span class="ico" style="--icon:url(assets/mobile/home.svg)"></span>Home</a>
      <a routerLink="/trips" [class.active]="active('trips')" [attr.aria-current]="active('trips') ? 'page' : null"><span class="ico" style="--icon:url(assets/mobile/trips.svg)"></span>Trips</a>
      <a class="create-trip" routerLink="/dashboard" [queryParams]="{createTrip: 1}" aria-label="Plan a new trip"><span class="ico" style="--icon:url(assets/mobile/plus-white.svg)"></span></a>
      <a routerLink="/expenses" [class.active]="active('expenses')" [attr.aria-current]="active('expenses') ? 'page' : null"><span class="ico" style="--icon:url(assets/mobile/expense-muted.svg)"></span>Expenses</a>
      <a routerLink="/account" [class.active]="active('profile')" [attr.aria-current]="active('profile') ? 'page' : null"><span class="ico" style="--icon:url(assets/mobile/profile.svg)"></span>Profile</a>
    </nav>`,
  styles: [`
    :host { display:none; }
    @media(max-width:760px) {
      :host { display:block; }
      .mobile-navigation {
        position:fixed; inset:auto 0 0; z-index:1100; display:grid;
        grid-template-columns:repeat(5,minmax(0,1fr)); align-items:start;
        min-height:72px; padding:8px 10px calc(8px + var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)));
        background:rgba(255,255,255,.94); -webkit-backdrop-filter:saturate(1.4) blur(14px); backdrop-filter:saturate(1.4) blur(14px);
        border-top:1px solid #e3e5ee; box-shadow:0 -10px 30px -18px rgba(20,26,51,.35);
      }
      a { position:relative; display:flex; min-width:0; min-height:52px; flex-direction:column; gap:4px; align-items:center; justify-content:center; text-decoration:none; color:#5d6481; font-size:10.5px; font-weight:600; letter-spacing:.01em; border-radius:14px; transition:color .2s; }
      /* Icons are masks so they follow the text colour: muted, saffron when active, navy on the + button. */
      .ico { width:22px; height:22px; background:currentColor; -webkit-mask:var(--icon) center/contain no-repeat; mask:var(--icon) center/contain no-repeat; }
      a.active { color:#141a33; font-weight:700; }
      a.active .ico { color:#e8860c; }
      a.active::after { content:""; position:absolute; top:-8px; left:50%; width:22px; height:3px; margin-left:-11px; border-radius:0 0 3px 3px; background:#e8860c; }
      .create-trip { top:-22px; justify-self:center; width:54px; height:54px; border-radius:18px; color:#141a33; background:linear-gradient(145deg,#f4a340,#e8860c); box-shadow:0 0 0 5px #fff, 0 12px 24px -8px rgba(232,134,12,.75); transition:transform .15s; }
      .create-trip .ico { width:24px; height:24px; }
      .create-trip:active { transform:scale(.94); }
      a:focus-visible { outline:3px solid #f4a340; outline-offset:2px; }
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
