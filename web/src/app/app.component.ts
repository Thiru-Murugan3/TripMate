import { Component, OnDestroy } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';

import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { FooterComponent } from './shared/components/footer/footer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent],
  template: `
    <div class="app-layout">
      @if (showAppShell) {
        <app-navbar></app-navbar>
      }

      <main class="main-content">
        <router-outlet></router-outlet>
      </main>

      @if (showAppShell) {
        <app-footer></app-footer>
      }
    </div>
  `,
  styles: [`
    .app-layout {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .main-content {
      flex: 1;
    }
  `]
})
export class AppComponent implements OnDestroy {
  title = 'TripMate';
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

  constructor(private readonly router: Router) {
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

  ngOnDestroy(): void {
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
