import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { isApiRequest } from './api-timeout.interceptor';
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

function redirectToLogin(router: Router): void {
  const returnUrl = router.url;
  if (/^\/invite\/[A-Za-z0-9-]{1,200}$/.test(returnUrl)) {
    void router.navigate(['/login'], {queryParams:{returnUrl}});
  } else {
    void router.navigate(['/login']);
  }
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Login/OTP/password-reset/refresh/logout endpoints must not receive an
  // expired bearer token and must never recursively trigger token refresh.
  if (!isApiRequest(req.url)||isPublicAuthRequest(req.url)) {
    return next(req);
  }

  const generation=authService.getSessionGeneration();
  const originalToken=authService.getToken();
  const requestWithAuth = withAccessToken(req, authService.getToken());

  return next(requestWithAuth).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      if(generation!==authService.getSessionGeneration())return throwError(()=>error);
      const retry=()=>next(withAccessToken(req.clone({headers:req.headers.delete('Authorization')}),authService.getToken())).pipe(
        catchError(retryError=>{
          if(generation===authService.getSessionGeneration()&&retryError instanceof HttpErrorResponse&&retryError.status===401){authService.clearSession();redirectToLogin(router);}
          return throwError(()=>retryError);
        })
      );
      if(originalToken!==authService.getToken()&&authService.getToken())return retry();
      if(!authService.getRefreshToken()){
        authService.clearSession();redirectToLogin(router);return throwError(()=>error);
      }
      return authService.refreshSession().pipe(
        catchError(refreshError=>{
          if(generation===authService.getSessionGeneration()&&refreshError instanceof HttpErrorResponse&&[400,401,403].includes(refreshError.status)){
            authService.clearSession();redirectToLogin(router);
          }
          return throwError(()=>refreshError);
        }),
        switchMap(()=>retry())
      );
    })
  );
};
