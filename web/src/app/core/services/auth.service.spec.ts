import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { environment } from '../../../environments/environment';

describe('Registration automatic sign-in', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  const session = {accessToken:'verified-access',refreshToken:'verified-refresh'};
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({providers:[provideRouter([]),provideHttpClient(withInterceptors([authInterceptor])),provideHttpClientTesting()]});
    auth=TestBed.inject(AuthService);http=TestBed.inject(HttpTestingController);
  });
  afterEach(() => {http.verify();localStorage.clear();});
  it('stores the verified session and waits for the authenticated profile before completing', () => {
    let completed=false;
    auth.verifyEmail({email:'new@example.com',otp:'123456'}).subscribe(()=>completed=true);
    http.expectOne(`${environment.apiUrl}/auth/verify-email`).flush({message:'Verified',session});
    expect(auth.getRefreshToken()).toBe('verified-refresh');
    expect(completed).toBeFalse();
    const profile=http.expectOne(`${environment.apiUrl}/users/me`);
    expect(profile.request.headers.get('Authorization')).toBe('Bearer verified-access');
    profile.flush({id:10,name:'New Traveller',email:'new@example.com',systemRole:'USER',status:'ACTIVE'});
    expect(auth.currentUser()?.email).toBe('new@example.com');
    expect(auth.isAuthenticated()).toBeTrue();expect(completed).toBeTrue();
  });
  it('does not establish a session for an invalid OTP', () => {
    auth.verifyEmail({email:'new@example.com',otp:'000000'}).subscribe({error:()=>{}});
    http.expectOne(`${environment.apiUrl}/auth/verify-email`).flush({message:'Invalid OTP'},{status:400,statusText:'Bad Request'});
    expect(auth.getToken()).toBeNull();expect(auth.isAuthenticated()).toBeFalse();
    http.expectNone(`${environment.apiUrl}/users/me`);
  });
  it('clears partial login and explains recovery if profile loading fails after account creation', () => {
    let message='';
    auth.verifyEmail({email:'new@example.com',otp:'123456'}).subscribe({error:e=>message=e.message});
    http.expectOne(`${environment.apiUrl}/auth/verify-email`).flush({message:'Verified',session});
    http.expectOne(`${environment.apiUrl}/users/me`).flush({}, {status:503,statusText:'Unavailable'});
    expect(auth.getToken()).toBeNull();expect(auth.getRefreshToken()).toBeNull();
    expect(message).toContain('Your account was created');
  });
});
