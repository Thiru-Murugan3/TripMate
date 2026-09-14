import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  User,
  LoginRequest,
  LoginResponse,
  GoogleAuthConfig,
  RegisterRequest,
  RegistrationPendingResponse,
  VerifyEmailRequest,
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

  public currentUser = signal<User | null>(this.getStoredUser());
  public isAuthenticated = signal<boolean>(!!this.getToken());

  constructor(private http: HttpClient) {}

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap((res) => this.completeLogin(res))
    );
  }

  getGoogleAuthConfig(): Observable<GoogleAuthConfig> {
    return this.http.get<GoogleAuthConfig>(`${this.apiUrl}/google/config`);
  }

  loginWithGoogle(credential: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${this.apiUrl}/google`,
      { credential }
    ).pipe(
      tap((res) => this.completeLogin(res))
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
        this.logout();
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

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
    this.isAuthenticated.set(false);

    const google = (window as Window & { google?: { accounts?: { id?: { disableAutoSelect?: () => void } } } }).google;
    google?.accounts?.id?.disableAutoSelect?.();
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  private completeLogin(response: LoginResponse): void {
    this.saveToken(response.accessToken);
    this.saveRefreshToken(response.refreshToken);
    this.fetchCurrentUser().subscribe({
      error: () => {
        // fetchCurrentUser handles cleanup when the stored session cannot be loaded.
      }
    });
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
