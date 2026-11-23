import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withViewTransitions } from '@angular/router';
import { routes } from './app.routes';
import { apiTimeoutInterceptor } from './core/interceptors/api-timeout.interceptor';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Native page transitions; browsers without the View Transitions API simply navigate.
    provideRouter(routes, withViewTransitions({ skipInitialTransition: true })),
    provideHttpClient(withInterceptors([apiTimeoutInterceptor,authInterceptor]))
  ]
};
