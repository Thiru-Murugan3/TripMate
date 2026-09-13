import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

const PUBLIC_AUTH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/refresh'
];

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const isTripMateApi = request.url.startsWith(environment.apiUrl);
  const isPublicAuthRequest = PUBLIC_AUTH_PATHS.some((path) => request.url.endsWith(path));
  const accessToken = authService.getAccessToken();

  const requestWithToken =
    isTripMateApi && !isPublicAuthRequest && accessToken
      ? request.clone({
          setHeaders: {
            Authorization: 'Bearer ' + accessToken
          }
        })
      : request;

  return next(requestWithToken).pipe(
    catchError((error: HttpErrorResponse) => {
      const canRefresh =
        isTripMateApi &&
        !isPublicAuthRequest &&
        error.status === 401 &&
        authService.getRefreshToken() !== null;

      if (!canRefresh) {
        return throwError(() => error);
      }

      return authService.refreshSession().pipe(
        switchMap((response) =>
          next(
            request.clone({
              setHeaders: {
                Authorization: 'Bearer ' + response.accessToken
              }
            })
          )
        ),
        catchError((refreshError) => {
          authService.clearSession();
          return throwError(() => refreshError);
        })
      );
    })
  );
};
