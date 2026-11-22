import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { NgZone, signal } from '@angular/core';
import { BackendReadinessService } from '../../core/services/backend-readiness.service';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { AppComponent } from '../../app.component';
import { AuthService } from '../../core/services/auth.service';
import { RegisterComponent } from '../auth/register/register.component';
import { LoginComponent } from '../auth/login/login.component';

describe('Mobile invitation navigation',()=>{
 it('consumes queued cold-start links and later warm-start links without reloading',fakeAsync(()=>{
  const navigate=jasmine.createSpy().and.resolveTo(true);
  const router={url:'/login',events:new Subject(),navigateByUrl:navigate} as unknown as Router;
  const nativeWindow=window as Window & {SuttruPendingInvitationPath?:string};
  const app=new AppComponent(router,new NgZone({enableLongStackTrace:false}));
  try {
   nativeWindow.SuttruPendingInvitationPath='/invite/cold-token';
   app.ngAfterViewInit();tick();
   expect(navigate).toHaveBeenCalledWith('/invite/cold-token');
   expect(nativeWindow.SuttruPendingInvitationPath).toBeUndefined();
   nativeWindow.SuttruPendingInvitationPath='/invite/warm-token';window.dispatchEvent(new Event('suttru:invitation-link'));
   expect(navigate).toHaveBeenCalledWith('/invite/warm-token');
   nativeWindow.SuttruPendingInvitationPath='https://evil.test';window.dispatchEvent(new Event('suttru:invitation-link'));
   expect(navigate).toHaveBeenCalledTimes(2);
  } finally {app.ngOnDestroy();delete nativeWindow.SuttruPendingInvitationPath;}
 }));
 it('passes the invitation through registration into OTP verification',()=>{
  const register=jasmine.createSpy().and.returnValue(of({email:'friend@example.com'}));
  TestBed.configureTestingModule({providers:[provideRouter([]),{provide:ActivatedRoute,useValue:{snapshot:{queryParams:{returnUrl:'/invite/abc-123'}}}},{provide:AuthService,useValue:{register}}]});
  const fixture=TestBed.createComponent(RegisterComponent);
  const navigate=spyOn(TestBed.inject(Router),'navigate').and.resolveTo(true);
  fixture.componentInstance.registerForm.setValue({name:'Friend',email:'friend@example.com',mobile:'9876543210',password:'Password@123',confirmPassword:'Password@123'});
  fixture.componentInstance.submit();
  expect(navigate).toHaveBeenCalledWith(['/verify-email'],{queryParams:{email:'friend@example.com',returnUrl:'/invite/abc-123'}});
  fixture.destroy();
 });
 it('returns an existing user to the invitation after login',()=>{
  TestBed.configureTestingModule({providers:[{provide:BackendReadinessService,useValue:{ready:()=>of(void 0),connecting:signal(false)}}]});
  TestBed.configureTestingModule({providers:[provideRouter([]),{provide:ActivatedRoute,useValue:{snapshot:{queryParams:{returnUrl:'/invite/abc-123'}}}},{provide:AuthService,useValue:{login:()=>of({})}}]});
  const fixture=TestBed.createComponent(LoginComponent);
  const navigate=spyOn(TestBed.inject(Router),'navigateByUrl').and.resolveTo(true);
  fixture.componentInstance.loginForm.patchValue({email:'friend@example.com',password:'Password@123'});
  fixture.componentInstance.onSubmit();expect(navigate).toHaveBeenCalledWith('/invite/abc-123');fixture.destroy();
 });
});
