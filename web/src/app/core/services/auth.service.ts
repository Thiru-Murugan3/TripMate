import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, finalize, of, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AuthSession,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  RefreshResponse,
  RegisterRequest,
  RegisterResponse
} from '../models/auth.models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private static readonly SESSION_KEY = 'tripmate_auth_session';

  private readonly http = inject(HttpClient);
  private readonly sessionSubject = new BehaviorSubject<AuthSession | null>(this.readStoredSession());

  readonly session$ = this.sessionSubject.asObservable();

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(environment.apiUrl + '/auth/login', request)
      .pipe(tap((response) => this.storeSession(response)));
  }

  register(request: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(environment.apiUrl + '/auth/register', request);
  }

  refreshSession(): Observable<RefreshResponse> {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      throw new Error('No refresh token is available');
    }

    return this.http
      .post<RefreshResponse>(environment.apiUrl + '/auth/refresh', { refreshToken })
      .pipe(
        tap((response) => {
          const current = this.sessionSubject.value;

          if (!current) {
            return;
          }

          this.persistSession({
            ...current,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            tokenType: response.tokenType,
            expiresIn: response.expiresIn
          });
        })
      );
  }

  logout(): Observable<LogoutResponse | null> {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      this.clearSession();
      return of(null);
    }

    return this.http
      .post<LogoutResponse>(environment.apiUrl + '/auth/logout', { refreshToken })
      .pipe(finalize(() => this.clearSession()));
  }

  getAccessToken(): string | null {
    return this.sessionSubject.value?.accessToken ?? null;
  }

  getRefreshToken(): string | null {
    return this.sessionSubject.value?.refreshToken ?? null;
  }

  getCurrentSession(): AuthSession | null {
    return this.sessionSubject.value;
  }

  isAuthenticated(): boolean {
    const token = this.getAccessToken();
    return token !== null && !this.isTokenExpired(token);
  }

  clearSession(): void {
    sessionStorage.removeItem(AuthService.SESSION_KEY);
    this.sessionSubject.next(null);
  }

  private storeSession(response: LoginResponse): void {
    this.persistSession({
      userId: response.userId,
      name: response.name,
      email: response.email,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      tokenType: response.tokenType,
      expiresIn: response.expiresIn
    });
  }

  private persistSession(session: AuthSession): void {
    sessionStorage.setItem(AuthService.SESSION_KEY, JSON.stringify(session));
    this.sessionSubject.next(session);
  }

  private readStoredSession(): AuthSession | null {
    try {
      const raw = sessionStorage.getItem(AuthService.SESSION_KEY);
      return raw ? (JSON.parse(raw) as AuthSession) : null;
    } catch {
      sessionStorage.removeItem(AuthService.SESSION_KEY);
      return null;
    }
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payloadPart = token.split('.')[1];

      if (!payloadPart) {
        return true;
      }

      const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
      const payload = JSON.parse(atob(padded)) as { exp?: number };

      return !payload.exp || payload.exp * 1000 <= Date.now() + 5000;
    } catch {
      return true;
    }
  }
}
