import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authService: AuthService;
  let router: Router;

  const refreshUrl = `${environment.apiUrl}/auth/refresh`;
  const logoutUrl = `${environment.apiUrl}/auth/logout`;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting()
      ]
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('attaches the access token to protected API requests', () => {
    localStorage.setItem('tripmate_access_token', 'access-old');

    http.get('/api/v1/trips').subscribe();

    const request = httpMock.expectOne('/api/v1/trips');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-old');
    request.flush([]);
  });

  it('refreshes an expired access token and retries the original request', () => {
    localStorage.setItem('tripmate_access_token', 'access-old');
    localStorage.setItem('tripmate_refresh_token', 'refresh-old');

    let response: unknown;
    http.get('/api/v1/trips').subscribe((value) => {
      response = value;
    });

    const firstAttempt = httpMock.expectOne('/api/v1/trips');
    expect(firstAttempt.request.headers.get('Authorization')).toBe('Bearer access-old');
    firstAttempt.flush(
      { message: 'Expired access token' },
      { status: 401, statusText: 'Unauthorized' }
    );

    const refresh = httpMock.expectOne(refreshUrl);
    expect(refresh.request.method).toBe('POST');
    expect(refresh.request.body).toEqual({ refreshToken: 'refresh-old' });
    expect(refresh.request.headers.has('Authorization')).toBeFalse();

    refresh.flush({
      accessToken: 'access-new',
      refreshToken: 'refresh-new',
      tokenType: 'Bearer',
      expiresIn: 900
    });

    const retry = httpMock.expectOne('/api/v1/trips');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-new');
    retry.flush([{ id: 1 }]);

    expect(response).toEqual([{ id: 1 }]);
    expect(localStorage.getItem('tripmate_access_token')).toBe('access-new');
    expect(localStorage.getItem('tripmate_refresh_token')).toBe('refresh-new');
  });

  it('shares one refresh request across simultaneous 401 responses', () => {
    localStorage.setItem('tripmate_access_token', 'access-old');
    localStorage.setItem('tripmate_refresh_token', 'refresh-old');

    let completed = 0;
    http.get('/api/v1/trips/1').subscribe(() => completed++);
    http.get('/api/v1/notifications').subscribe(() => completed++);

    const tripRequest = httpMock.expectOne('/api/v1/trips/1');
    const notificationRequest = httpMock.expectOne('/api/v1/notifications');

    tripRequest.flush(null, { status: 401, statusText: 'Unauthorized' });
    notificationRequest.flush(null, { status: 401, statusText: 'Unauthorized' });

    const refreshRequests = httpMock.match(refreshUrl);
    expect(refreshRequests.length).toBe(1);

    refreshRequests[0].flush({
      accessToken: 'access-new',
      refreshToken: 'refresh-new',
      tokenType: 'Bearer',
      expiresIn: 900
    });

    const tripRetry = httpMock.expectOne('/api/v1/trips/1');
    const notificationRetry = httpMock.expectOne('/api/v1/notifications');

    expect(tripRetry.request.headers.get('Authorization')).toBe('Bearer access-new');
    expect(notificationRetry.request.headers.get('Authorization')).toBe('Bearer access-new');

    tripRetry.flush({ id: 1 });
    notificationRetry.flush([]);

    expect(completed).toBe(2);
  });

  it('clears the session and redirects to login when refresh fails', () => {
    localStorage.setItem('tripmate_access_token', 'access-old');
    localStorage.setItem('tripmate_refresh_token', 'refresh-old');
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);

    let requestFailed = false;
    http.get('/api/v1/trips').subscribe({
      error: () => {
        requestFailed = true;
      }
    });

    httpMock
      .expectOne('/api/v1/trips')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    httpMock
      .expectOne(refreshUrl)
      .flush(
        { message: 'Refresh token expired' },
        { status: 401, statusText: 'Unauthorized' }
      );

    expect(requestFailed).toBeTrue();
    expect(localStorage.getItem('tripmate_access_token')).toBeNull();
    expect(localStorage.getItem('tripmate_refresh_token')).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });

  it('does not attach a stale bearer token or refresh a failed login request', () => {
    localStorage.setItem('tripmate_access_token', 'access-old');
    localStorage.setItem('tripmate_refresh_token', 'refresh-old');

    let loginFailed = false;
    http.post(`${environment.apiUrl}/auth/login`, {
      email: 'test@example.com',
      password: 'wrong-password'
    }).subscribe({
      error: () => {
        loginFailed = true;
      }
    });

    const login = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
    expect(login.request.headers.has('Authorization')).toBeFalse();
    login.flush(
      { message: 'Invalid email or password' },
      { status: 401, statusText: 'Unauthorized' }
    );

    expect(loginFailed).toBeTrue();
    httpMock.expectNone(refreshUrl);
  });

  it('revokes the refresh token on the backend before clearing local session data', () => {
    localStorage.setItem('tripmate_access_token', 'access-old');
    localStorage.setItem('tripmate_refresh_token', 'refresh-old');
    localStorage.setItem('tripmate_user', JSON.stringify({ id: 1 }));

    let logoutCompleted = false;
    authService.logout().subscribe(() => {
      logoutCompleted = true;
    });

    expect(localStorage.getItem('tripmate_refresh_token')).toBe('refresh-old');

    const logout = httpMock.expectOne(logoutUrl);
    expect(logout.request.method).toBe('POST');
    expect(logout.request.body).toEqual({ refreshToken: 'refresh-old' });
    expect(logout.request.headers.has('Authorization')).toBeFalse();

    logout.flush({ message: 'Logged out successfully' });

    expect(logoutCompleted).toBeTrue();
    expect(localStorage.getItem('tripmate_access_token')).toBeNull();
    expect(localStorage.getItem('tripmate_refresh_token')).toBeNull();
    expect(localStorage.getItem('tripmate_user')).toBeNull();
  });
});
