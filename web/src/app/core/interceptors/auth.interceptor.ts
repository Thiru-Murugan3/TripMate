import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

const PUBLIC_AUTH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/verify-email',
  '/auth/resend-email-otp',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/refresh',
  '/auth/logout'
];

function isPublicAuthRequest(url: string): boolean {
  const urlWithoutQuery = url.split('?')[0];
  return PUBLIC_AUTH_PATHS.some((path) => urlWithoutQuery.endsWith(path));
}

function withAccessToken(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  if (!token || req.headers.has('Authorization')) {
    return req;
  }

  return req.clone({
    headers: req.headers.set('Authorization', `Bearer ${token}`)
  });
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Login/OTP/password-reset/refresh/logout endpoints must not receive an
  // expired bearer token and must never recursively trigger token refresh.
  if (isPublicAuthRequest(req.url)) {
    return next(req);
  }

  const requestWithAuth = withAccessToken(req, authService.getToken());

  return next(requestWithAuth).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      if (!authService.getRefreshToken()) {
        authService.clearSession();
        void router.navigate(['/login']);
        return throwError(() => error);
      }

      return authService.refreshSession().pipe(
        switchMap(() => {
          const retryRequest = req.clone({
            headers: req.headers.delete('Authorization')
          });

          return next(withAccessToken(retryRequest, authService.getToken()));
        }),
        catchError((refreshOrRetryError: unknown) => {
          authService.clearSession();
          void router.navigate(['/login']);
          return throwError(() => refreshOrRetryError);
        })
      );
    })
  );
};
