import { clearNativeFiles } from '../utils/native-files';
import { clearOffline } from '../../../../public/offline-store.js';
import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  Observable,
  defer,
  catchError,
  finalize,
  map,
  of,
  shareReplay,
  switchMap,
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
  VerifyEmailResponse,
  ResendEmailOtpRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest
} from '../models/auth.model';

export const AUTH_TIMEOUT_MS=45000;
export const PROFILE_TIMEOUT_MS=20000;
export const REFRESH_TIMEOUT_MS=20000;

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private readonly TOKEN_KEY = 'tripmate_access_token';
  private readonly REFRESH_TOKEN_KEY = 'tripmate_refresh_token';
  private readonly USER_KEY = 'tripmate_user';

  private sessionGeneration=0;
  getSessionGeneration():number {return this.sessionGeneration;}

  private verifiedGeneration=-1;
  isSessionVerified():boolean {return this.verifiedGeneration===this.sessionGeneration&&!!this.currentUser()&&!!this.getToken();}

  private refreshRequest$: Observable<RefreshResponse> | null = null;

  public currentUser = signal<User | null>(this.getStoredUser());
  public isAuthenticated = signal<boolean>(!!this.getToken());

  constructor(private http: HttpClient) {}

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.authenticate(this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials),res=>res);
  }

  private authenticate<T>(request:Observable<T>,session:(value:T)=>LoginResponse):Observable<T> {
    return defer(()=>{
      const generation=++this.sessionGeneration;this.refreshRequest$=null;let saved=false,complete=false;
      return request.pipe(
        timeout(AUTH_TIMEOUT_MS),
        tap(value=>{
          if(generation!==this.sessionGeneration)throw new Error('Sign-in was cancelled. Please try again.');
          const tokens=session(value);this.currentUser.set(null);
          this.saveSessionTokens(tokens.accessToken,tokens.refreshToken);saved=true;
        }),
        switchMap(value=>{
          const user=session(value).user;
          if(this.isValidSessionUser(user)){
            this.acceptUser(user);return of(value);
          }
          // Compatibility with older backend versions during a rolling deployment.
          return this.fetchCurrentUser().pipe(map(()=>value));
        }),
        tap(()=>complete=true),
        finalize(()=>{if(saved&&!complete&&generation===this.sessionGeneration)this.clearSession();})
      );
    });
  }

  private isValidSessionUser(user:User|undefined):user is User {
    return !!user&&Number.isSafeInteger(user.id)&&user.id>0&&typeof user.name==='string'&&typeof user.email==='string'
      &&['USER','ADMIN'].includes(user.systemRole)&&user.status==='ACTIVE';
  }

  private acceptUser(user:User):void {
    this.saveUser(user);this.currentUser.set(user);this.isAuthenticated.set(true);this.verifiedGeneration=this.sessionGeneration;
  }

  register(data: RegisterRequest): Observable<RegistrationPendingResponse> {
    return this.http.post<RegistrationPendingResponse>(`${this.apiUrl}/register`, data);
  }

  verifyEmail(data: VerifyEmailRequest): Observable<VerifyEmailResponse> {
    return defer(()=>{
      let verified=false;
      return this.authenticate(this.http.post<VerifyEmailResponse>(`${this.apiUrl}/verify-email`,data).pipe(tap(()=>verified=true)),res=>res.session).pipe(
        catchError(error=>verified?throwError(()=>new Error('Your account was created, but automatic sign-in could not finish. Please sign in to continue.')):throwError(()=>error))
      );
    });
  }

  resendEmailOtp(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/resend-email-otp`, { email });
  }

  fetchCurrentUser(): Observable<User> {
    return defer(()=>{
      const generation=this.sessionGeneration;
      return this.http.get<User>(`${environment.apiUrl}/users/me`).pipe(
        timeout(PROFILE_TIMEOUT_MS),
        tap(user=>{
          if(generation!==this.sessionGeneration)throw new Error('Session changed. Please sign in again.');
          this.acceptUser(user);
        }),
        catchError(error=>{
          if(generation===this.sessionGeneration&&error instanceof HttpErrorResponse&&[401,403].includes(error.status))this.clearSession();
          return throwError(()=>error);
        })
      );
    });
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

    const generation=this.sessionGeneration;
    const shared=this.http.post<RefreshResponse>(`${this.apiUrl}/refresh`,{refreshToken}).pipe(
      timeout(REFRESH_TIMEOUT_MS),
      tap(response=>{
        if(generation!==this.sessionGeneration||this.getRefreshToken()!==refreshToken)throw new Error('Session changed.');
        this.saveSessionTokens(response.accessToken,response.refreshToken);
      }),
      finalize(()=>{if(this.refreshRequest$===shared)this.refreshRequest$=null;}),
      shareReplay({bufferSize:1,refCount:false})
    );
    this.refreshRequest$=shared;
    return shared;
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

    const generation=this.sessionGeneration;
    return this.http
      .post<LogoutResponse>(`${this.apiUrl}/logout`, { refreshToken })
      .pipe(
        timeout(5000),
        catchError(() => of({ message: 'Local logout completed' })),
        tap(() => {if(generation===this.sessionGeneration)this.clearSession();}),
        map(() => void 0)
      );
  }

  clearSession(): void {
    this.sessionGeneration++;
    this.verifiedGeneration=-1;
    this.refreshRequest$=null;
    clearNativeFiles();
    void clearOffline().catch(() => { /* Session epoch already invalidates remaining copies. */ });
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
    const previous = this.getStoredUser();
    if (previous && previous.id !== user.id) void clearOffline().catch(() => {});
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
