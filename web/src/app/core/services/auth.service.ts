import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  Observable,
  catchError,
  finalize,
  map,
  of,
  shareReplay,
  tap,
  throwError,
  timeout
} from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  User,
  LoginRequest,
  LoginResponse,
  RefreshResponse,
  LogoutResponse,
  RegisterRequest,
  RegistrationPendingResponse,
  VerifyEmailRequest,
  ResendEmailOtpRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest
} from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private readonly TOKEN_KEY = 'tripmate_access_token';
  private readonly REFRESH_TOKEN_KEY = 'tripmate_refresh_token';
  private readonly USER_KEY = 'tripmate_user';

  private refreshRequest$: Observable<RefreshResponse> | null = null;

  public currentUser = signal<User | null>(this.getStoredUser());
  public isAuthenticated = signal<boolean>(!!this.getToken());

  constructor(private http: HttpClient) {}

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap((res) => {
        this.saveSessionTokens(res.accessToken, res.refreshToken);
        this.fetchCurrentUser().subscribe();
      })
    );
  }

  register(data: RegisterRequest): Observable<RegistrationPendingResponse> {
    return this.http.post<RegistrationPendingResponse>(`${this.apiUrl}/register`, data);
  }

  verifyEmail(data: VerifyEmailRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/verify-email`, data);
  }

  resendEmailOtp(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/resend-email-otp`, { email });
  }

  fetchCurrentUser(): Observable<User> {
    return this.http.get<User>(`${environment.apiUrl}/users/me`).pipe(
      tap((user) => {
        this.saveUser(user);
        this.currentUser.set(user);
        this.isAuthenticated.set(true);
      }),
      catchError((err) => {
        this.clearSession();
        return throwError(() => err);
      })
    );
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/forgot-password`, { email });
  }

  resetPassword(data: ResetPasswordRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/reset-password`, data);
  }

  /**
   * Returns the currently active refresh request when multiple API calls fail
   * with 401 at the same time. This guarantees one refresh-token rotation and
   * lets all waiting requests retry with the same newly issued access token.
   */
  refreshSession(): Observable<RefreshResponse> {
    if (this.refreshRequest$) {
      return this.refreshRequest$;
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('Refresh token is not available'));
    }

    this.refreshRequest$ = this.http
      .post<RefreshResponse>(`${this.apiUrl}/refresh`, { refreshToken })
      .pipe(
        tap((response) => {
          this.saveSessionTokens(response.accessToken, response.refreshToken);
        }),
        finalize(() => {
          this.refreshRequest$ = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );

    return this.refreshRequest$;
  }

  /**
   * Revokes the server-side refresh token before clearing browser session data.
   * Logout remains successful locally even when the backend is unavailable.
   */
  logout(): Observable<void> {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      this.clearSession();
      return of(void 0);
    }

    return this.http
      .post<LogoutResponse>(`${this.apiUrl}/logout`, { refreshToken })
      .pipe(
        timeout(5000),
        catchError(() => of({ message: 'Local logout completed' })),
        tap(() => this.clearSession()),
        map(() => void 0)
      );
  }

  clearSession(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  private saveSessionTokens(accessToken: string, refreshToken: string): void {
    this.saveToken(accessToken);
    this.saveRefreshToken(refreshToken);
  }

  private saveToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    this.isAuthenticated.set(true);
  }

  private saveRefreshToken(refreshToken: string): void {
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
  }

  private saveUser(user: User): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  private getStoredUser(): User | null {
    const raw = localStorage.getItem(this.USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }
}
