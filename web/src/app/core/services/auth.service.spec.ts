import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService, AUTH_TIMEOUT_MS, PROFILE_TIMEOUT_MS, REFRESH_TIMEOUT_MS } from './auth.service';
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
  it('completes OTP sign-in directly when the verified response supplies the user',()=>{
    const user={id:10,name:'New Traveller',email:'new@example.com',systemRole:'USER',status:'ACTIVE'};
    let done=false;auth.verifyEmail({email:user.email,otp:'123456'}).subscribe(()=>done=true);
    http.expectOne(`${environment.apiUrl}/auth/verify-email`).flush({message:'Verified',session:{...session,user}});
    http.expectNone(`${environment.apiUrl}/users/me`);expect(done).toBeTrue();expect(auth.isSessionVerified()).toBeTrue();
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

describe('Login and session recovery',()=>{
 let auth:AuthService,http:HttpTestingController;
 beforeEach(()=>{localStorage.clear();TestBed.configureTestingModule({providers:[provideRouter([]),provideHttpClient(withInterceptors([authInterceptor])),provideHttpClientTesting()]});auth=TestBed.inject(AuthService);http=TestBed.inject(HttpTestingController);});
 afterEach(()=>{http.verify();localStorage.clear();});
 const profile={id:10,name:'Traveller',email:'new@example.com',systemRole:'USER',status:'ACTIVE'};
 const session={accessToken:'new-access',refreshToken:'new-refresh'};
 it('finishes login only after the profile, with no detached profile subscription',()=>{
  let complete=false;auth.login({email:profile.email,password:'password'}).subscribe(()=>complete=true);
  http.expectOne(`${environment.apiUrl}/auth/login`).flush(session);expect(complete).toBeFalse();expect(auth.currentUser()).toBeNull();
  http.expectOne(`${environment.apiUrl}/users/me`).flush(profile);expect(complete).toBeTrue();expect(auth.currentUser()?.id).toBe(10);
 });
 it('clears a partial login on profile failure and allows another attempt',()=>{
  let failures=0;auth.login({email:profile.email,password:'password'}).subscribe({error:()=>failures++});
  http.expectOne(`${environment.apiUrl}/auth/login`).flush(session);http.expectOne(`${environment.apiUrl}/users/me`).flush({}, {status:503,statusText:'Unavailable'});
  expect(failures).toBe(1);expect(auth.getToken()).toBeNull();
  auth.login({email:profile.email,password:'password'}).subscribe();http.expectOne(`${environment.apiUrl}/auth/login`).flush(session);http.expectOne(`${environment.apiUrl}/users/me`).flush(profile);
  expect(auth.isAuthenticated()).toBeTrue();
 });
 it('aborts and clears partial sign-in when the user cancels',()=>{
  const subscription=auth.login({email:profile.email,password:'password'}).subscribe();http.expectOne(`${environment.apiUrl}/auth/login`).flush(session);
  const pending=http.expectOne(`${environment.apiUrl}/users/me`);subscription.unsubscribe();expect(pending.cancelled).toBeTrue();expect(auth.getToken()).toBeNull();expect(auth.currentUser()).toBeNull();
 });
 it('keeps an established session during a transient profile failure',()=>{
  localStorage.setItem('tripmate_access_token','existing');auth.fetchCurrentUser().subscribe({error:()=>{}});
  http.expectOne(`${environment.apiUrl}/users/me`).flush({}, {status:503,statusText:'Unavailable'});expect(auth.getToken()).toBe('existing');
 });
 it('ignores a profile response that arrives after the session was cleared',()=>{
  localStorage.setItem('tripmate_access_token','existing');auth.fetchCurrentUser().subscribe({error:()=>{}});const pending=http.expectOne(`${environment.apiUrl}/users/me`);
  auth.clearSession();pending.flush(profile);expect(auth.currentUser()).toBeNull();expect(auth.isAuthenticated()).toBeFalse();
 });
 it('cannot restore tokens from a refresh response after logout',()=>{
  localStorage.setItem('tripmate_refresh_token','old');auth.refreshSession().subscribe({error:()=>{}});const pending=http.expectOne(`${environment.apiUrl}/auth/refresh`);
  auth.clearSession();pending.flush(session);expect(auth.getToken()).toBeNull();expect(auth.getRefreshToken()).toBeNull();
 });
 it('times out a hung login and cancels the HTTP request',fakeAsync(()=>{
  let error:any;auth.login({email:profile.email,password:'password'}).subscribe({error:e=>error=e});const pending=http.expectOne(`${environment.apiUrl}/auth/login`);
  tick(AUTH_TIMEOUT_MS);expect(error.name).toBe('TimeoutError');expect(pending.cancelled).toBeTrue();expect(auth.getToken()).toBeNull();
 }));
 it('times out a hung login profile and removes partial credentials',fakeAsync(()=>{
  let error:any;auth.login({email:profile.email,password:'password'}).subscribe({error:e=>error=e});http.expectOne(`${environment.apiUrl}/auth/login`).flush(session);
  const pending=http.expectOne(`${environment.apiUrl}/users/me`);tick(PROFILE_TIMEOUT_MS);expect(error.name).toBe('TimeoutError');expect(pending.cancelled).toBeTrue();expect(auth.getToken()).toBeNull();
 }));
 it('shares a refresh timeout and permits retry without discarding credentials',fakeAsync(()=>{
  localStorage.setItem('tripmate_refresh_token','old');let errors=0;auth.refreshSession().subscribe({error:()=>errors++});auth.refreshSession().subscribe({error:()=>errors++});
  const pending=http.expectOne(`${environment.apiUrl}/auth/refresh`);tick(REFRESH_TIMEOUT_MS);expect(errors).toBe(2);expect(pending.cancelled).toBeTrue();expect(auth.getRefreshToken()).toBe('old');
  auth.refreshSession().subscribe();http.expectOne(`${environment.apiUrl}/auth/refresh`).flush(session);expect(auth.getToken()).toBe('new-access');
 }));

 it('completes sign-in directly from the authenticated response without an extra profile request',()=>{
  let done=false;auth.login({email:profile.email,password:'password'}).subscribe(()=>done=true);
  http.expectOne(`${environment.apiUrl}/auth/login`).flush({...session,user:profile});
  http.expectNone(`${environment.apiUrl}/users/me`);expect(done).toBeTrue();expect(auth.currentUser()?.id).toBe(10);expect(auth.isSessionVerified()).toBeTrue();
  auth.clearSession();expect(auth.isSessionVerified()).toBeFalse();
 });
 it('does not treat a cached user as a freshly verified session',()=>{
  localStorage.setItem('tripmate_access_token','cached');auth.currentUser.set(profile as any);expect(auth.isSessionVerified()).toBeFalse();
 });
 it('falls back to profile verification when the new session identity is incomplete',()=>{
  auth.login({email:profile.email,password:'password'}).subscribe();http.expectOne(`${environment.apiUrl}/auth/login`).flush({...session,user:{id:10,name:'Incomplete'}});
  http.expectOne(`${environment.apiUrl}/users/me`).flush(profile);expect(auth.isSessionVerified()).toBeTrue();
 });

});
