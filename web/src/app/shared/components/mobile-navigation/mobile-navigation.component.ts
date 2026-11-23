import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

type Tab = 'home' | 'trips' | 'expenses' | 'profile';

@Component({
  selector: 'app-mobile-navigation', standalone: true, imports: [RouterLink],
  template: `
    <nav class="mobile-navigation" aria-label="Main navigation" [style.--slot]="slot()" [class.has-active]="slot() >= 0">
      <span class="glider" aria-hidden="true"></span>
      <a routerLink="/dashboard" [class.active]="active('home')" [attr.aria-current]="active('home') ? 'page' : null"><span class="ico" style="--icon:url(assets/mobile/home.svg)"></span><span class="lbl">Home</span></a>
      <a routerLink="/trips" [class.active]="active('trips')" [attr.aria-current]="active('trips') ? 'page' : null"><span class="ico" style="--icon:url(assets/mobile/trips.svg)"></span><span class="lbl">Trips</span></a>
      <a class="create-trip" routerLink="/dashboard" [queryParams]="{createTrip: 1}" aria-label="Plan a new trip">
        <span class="orbit" aria-hidden="true"></span><span class="ico" style="--icon:url(assets/mobile/plus-white.svg)"></span>
      </a>
      <a routerLink="/expenses" [class.active]="active('expenses')" [attr.aria-current]="active('expenses') ? 'page' : null"><span class="ico" style="--icon:url(assets/mobile/expense-muted.svg)"></span><span class="lbl">Expenses</span></a>
      <a routerLink="/account" [class.active]="active('profile')" [attr.aria-current]="active('profile') ? 'page' : null"><span class="ico" style="--icon:url(assets/mobile/profile.svg)"></span><span class="lbl">Profile</span></a>
    </nav>`,
  styles: [`
    :host { display:none; }
    @media(max-width:760px) {
      :host { display:block; }
      /* A floating navy island; a glider slides to the active tab. */
      .mobile-navigation {
        --slot:-1;
        position:fixed; left:12px; right:12px; bottom:calc(10px + var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px))); z-index:1100;
        display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); align-items:center;
        height:66px; padding:0 6px; border-radius:24px;
        background:linear-gradient(135deg, rgba(4, 30, 37,.96), rgba(6, 40, 48,.96) 60%, rgba(17, 94, 107,.96));
        -webkit-backdrop-filter:blur(16px) saturate(1.3); backdrop-filter:blur(16px) saturate(1.3);
        border:1px solid rgba(255,255,255,.08);
        box-shadow:0 18px 40px -16px rgba(4, 30, 37,.75), inset 0 1px 0 rgba(255,255,255,.06);
      }
      .glider {
        position:absolute; top:7px; bottom:7px; left:6px; width:calc((100% - 12px) / 5);
        border-radius:18px; background:rgba(255,255,255,.08); box-shadow:inset 0 0 0 1px rgba(255,255,255,.06);
        translate:calc(var(--slot) * 100%) 0; opacity:0;
        transition:translate .45s cubic-bezier(.3,1.4,.4,1), opacity .2s;
      }
      .has-active .glider { opacity:1; }
      a { position:relative; z-index:1; display:flex; min-width:0; height:52px; flex-direction:column; gap:4px; align-items:center; justify-content:center; text-decoration:none; color:#9bb8ba; font-size:10.5px; font-weight:600; letter-spacing:.01em; border-radius:16px; transition:color .25s; -webkit-tap-highlight-color:transparent; }
      /* Icons are masks so they follow the text colour. */
      .ico { width:22px; height:22px; background:currentColor; -webkit-mask:var(--icon) center/contain no-repeat; mask:var(--icon) center/contain no-repeat; transition:translate .35s cubic-bezier(.3,1.4,.4,1); }
      a.active { color:#fff; font-weight:700; }
      a.active .ico { color:#f6d27a; translate:0 -1px; }
      a.active .lbl::after { content:""; display:block; width:4px; height:4px; margin:3px auto 0; border-radius:50%; background:#f2c14e; }
      a.active .lbl { margin-bottom:-7px; }

      .create-trip { justify-self:center; width:56px; height:56px; margin-top:-30px; border-radius:20px; color:#0b3c49;
        background:linear-gradient(145deg,#f8dc8f,#f2c14e); box-shadow:0 0 0 6px #f2fbfa, 0 14px 26px -10px rgba(242, 193, 78,.9); transition:scale .15s, rotate .35s cubic-bezier(.3,1.4,.4,1); }
      .create-trip .ico { width:24px; height:24px; color:#0b3c49; }
      .create-trip:active { scale:.92; rotate:90deg; }
      /* A dashed orbit slowly circles the create button: a quiet "start a journey" cue. */
      .orbit { position:absolute; inset:-11px; border-radius:26px; border:1.5px dashed rgba(242, 193, 78,.55); animation:orbit 14s linear infinite; pointer-events:none; }
      @keyframes orbit { to { rotate:360deg; } }
      a:focus-visible { outline:3px solid #f6d27a; outline-offset:2px; }
      @media (prefers-reduced-motion: reduce) { .orbit { animation:none; } .glider, .ico, .create-trip { transition:none; } }
    }
  `]
})
export class MobileNavigationComponent {
  private readonly router = inject(Router);
  private readonly slots: Record<Tab, number> = { home: 0, trips: 1, expenses: 3, profile: 4 };

  /** Grid column of the active tab for the sliding glider, or -1 when none is active. */
  slot(): number {
    const tab = (Object.keys(this.slots) as Tab[]).find(t => this.active(t));
    return tab ? this.slots[tab] : -1;
  }

  active(tab: Tab): boolean {
    const url = this.router.parseUrl(this.router.url);
    const path = this.router.url.split('?')[0];
    if (tab === 'home') return path === '/dashboard';
    if (tab === 'profile') return path === '/account';
    const expenses = path === '/expenses' || url.queryParams['tab'] === 'EXPENSES';
    return tab === 'expenses' ? expenses : path.startsWith('/trips') && !expenses;
  }
}
