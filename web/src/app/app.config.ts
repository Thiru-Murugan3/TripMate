import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ActivatedRouteSnapshot, provideRouter, ViewTransitionInfo, withViewTransitions } from '@angular/router';
import { routes } from './app.routes';
import { apiTimeoutInterceptor } from './core/interceptors/api-timeout.interceptor';
import { authInterceptor } from './core/interceptors/auth.interceptor';

function leaf(snapshot: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
  let route = snapshot;
  while (route.firstChild) route = route.firstChild;
  return route;
}

/**
 * Animate only real screen changes. Query-param-only navigations (trip tabs, filters,
 * create-trip prompts) keep the page still so in-page interaction is never interrupted.
 */
export function skipSameScreenTransition({ transition, from, to }: ViewTransitionInfo): void {
  // Skipped or interrupted transitions reject these promises; that is expected, not an app error.
  transition.ready.catch(() => undefined);
  transition.finished.catch(() => undefined);
  const a = leaf(from), b = leaf(to);
  if (a.routeConfig === b.routeConfig && JSON.stringify(a.params) === JSON.stringify(b.params)) {
    transition.skipTransition();
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Native page transitions; browsers without the View Transitions API simply navigate.
    provideRouter(routes, withViewTransitions({ skipInitialTransition: true, onViewTransitionCreated: skipSameScreenTransition })),
    provideHttpClient(withInterceptors([apiTimeoutInterceptor,authInterceptor]))
  ]
};
