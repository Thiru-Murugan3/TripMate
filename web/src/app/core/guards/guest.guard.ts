import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { authReturnUrl } from '../utils/auth-return-url';

/**
 * Sign-in pages are for signed-out visitors. A signed-in user (for example the app opening on
 * its default /login page) goes straight to where they were heading, or their trips.
 */
export const guestGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return true;
  }

  return router.parseUrl(authReturnUrl(route.queryParams['returnUrl']));
};
