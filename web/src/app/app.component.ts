import { DevicePermissionsComponent } from './shared/components/device-permissions/device-permissions.component';
import { AfterViewInit, Component, NgZone, OnDestroy } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';

import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { MobileNavigationComponent } from './shared/components/mobile-navigation/mobile-navigation.component';
import { FooterComponent } from './shared/components/footer/footer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DevicePermissionsComponent,RouterOutlet, NavbarComponent, FooterComponent, MobileNavigationComponent],
  template: `
    <app-device-permissions></app-device-permissions>
    <div class="app-layout" [class.mobile-inner-view]="isMobileInnerView" [class.has-app-shell]="showAppShell">
      @if (showAppShell) {
        <app-navbar></app-navbar>
      }

      <main class="main-content">
        <router-outlet></router-outlet>
      </main>

      @if (showAppShell) {
        <app-footer class="desktop-footer"></app-footer>
        <app-mobile-navigation></app-mobile-navigation>
      }
    </div>
  `,
  styles: [`
    @media(max-width:760px) {
      .has-app-shell .main-content { padding-bottom:calc(96px + var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px))); background:#f8fafc; }
      .desktop-footer { display:none; }
      .mobile-inner-view app-navbar { display:none; }
    }

    .app-layout {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    :host { display: block; width: 100%; min-width: 0; }

    .main-content {
      min-width: 0;
      width: 100%;
      flex: 1;
    }
  `]
})
export class AppComponent implements OnDestroy, AfterViewInit {
  get isMobileInnerView():boolean { return this.router.url.split('?')[0] !== '/dashboard'; }
  title = 'Suttru';
  showAppShell = false;

  private selectionGestureStartedInField = false;
  private readonly routerSubscription: Subscription;

  private readonly authOnlyRoutes = [
    '/login',
    '/register',
    '/verify-email',
    '/forgot-password',
    '/reset-password'
  ];

  private readonly handlePointerDownCapture = (event: PointerEvent): void => {
    const target = event.target as HTMLElement | null;

    this.selectionGestureStartedInField = Boolean(
      target?.closest(
        '.modal-backdrop input, .modal-backdrop textarea, .modal-backdrop [contenteditable="true"]'
      )
    );
  };

  private readonly handleClickCapture = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    const clickedBackdrop = target?.classList.contains('modal-backdrop') ?? false;

    // A text-selection drag can start inside an input/textarea and finish on the
    // modal backdrop. Browsers then emit a backdrop click, which used to close
    // the modal and look like an unexpected Back/navigation action.
    if (clickedBackdrop && this.selectionGestureStartedInField) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    this.selectionGestureStartedInField = false;
  };

  constructor(private readonly router: Router, private readonly zone: NgZone) {
    this.showAppShell = !this.isAuthOnlyRoute(window.location.pathname);

    this.routerSubscription = this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd =>
            event instanceof NavigationEnd
        )
      )
      .subscribe((event) => {
        this.showAppShell = !this.isAuthOnlyRoute(event.urlAfterRedirects);
      });

    document.addEventListener('pointerdown', this.handlePointerDownCapture, true);
    document.addEventListener('click', this.handleClickCapture, true);
  }

  private readonly openNativeInvitation = (): void => {
    const nativeWindow = window as Window & { SuttruPendingInvitationPath?: string };
    const path = nativeWindow.SuttruPendingInvitationPath;
    if (typeof path !== 'string' || !/^\/invite\/[A-Za-z0-9-]{1,200}$/.test(path)) return;
    delete nativeWindow.SuttruPendingInvitationPath;
    this.zone.run(() => { void this.router.navigateByUrl(path); });
  };

  ngAfterViewInit(): void {
    window.addEventListener('suttru:invitation-link', this.openNativeInvitation);
    // Native launch data can arrive before Angular finishes its initial navigation.
    setTimeout(this.openNativeInvitation, 0);
  }

  ngOnDestroy(): void {
    window.removeEventListener('suttru:invitation-link', this.openNativeInvitation);
    this.routerSubscription.unsubscribe();
    document.removeEventListener('pointerdown', this.handlePointerDownCapture, true);
    document.removeEventListener('click', this.handleClickCapture, true);
  }

  private isAuthOnlyRoute(url: string): boolean {
    const path = url.split('?')[0].split('#')[0];

    if (path === '/' || path === '') {
      return true;
    }

    return this.authOnlyRoutes.some(
      (route) => path === route || path.startsWith(`${route}/`)
    );
  }
}
