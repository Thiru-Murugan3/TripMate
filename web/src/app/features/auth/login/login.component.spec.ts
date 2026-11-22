import {TestBed,fakeAsync,tick} from '@angular/core/testing';
import {provideRouter,ActivatedRoute,Router} from '@angular/router';
import {Subject,TimeoutError,of} from 'rxjs';
import {signal} from '@angular/core';
import {BackendReadinessService} from '../../../core/services/backend-readiness.service';
import {LoginComponent} from './login.component';
import {AuthService} from '../../../core/services/auth.service';

describe('Login loading recovery',()=>{
 let pending:Subject<any>,auth:any;
 beforeEach(()=>{pending=new Subject();auth={login:jasmine.createSpy().and.callFake(()=>pending)};TestBed.configureTestingModule({providers:[provideRouter([]),{provide:BackendReadinessService,useValue:{ready:()=>of(void 0),connecting:signal(false)}},{provide:ActivatedRoute,useValue:{snapshot:{queryParams:{}}}},{provide:AuthService,useValue:auth}]});});
 function setup(){const f=TestBed.createComponent(LoginComponent);f.componentInstance.loginForm.patchValue({email:'traveller@example.com',password:'password'});f.detectChanges();return f;}
 it('waits for startup before sending credentials, and cancels without a late login',()=>{
  const ready=new Subject<void>();const readiness=TestBed.inject(BackendReadinessService);spyOn(readiness,'ready').and.returnValue(ready);
  const f=setup(),c=f.componentInstance;c.onSubmit();expect(auth.login).not.toHaveBeenCalled();c.cancelLogin();ready.next();expect(auth.login).not.toHaveBeenCalled();f.destroy();
 });
 it('sends credentials once when readiness succeeds',()=>{
  const ready=new Subject<void>();spyOn(TestBed.inject(BackendReadinessService),'ready').and.returnValue(ready);
  const f=setup();f.componentInstance.onSubmit();expect(auth.login).not.toHaveBeenCalled();ready.next();ready.complete();expect(auth.login).toHaveBeenCalledTimes(1);f.destroy();
 });
 it('prevents duplicate submits and lets a slow request be cancelled and retried',fakeAsync(()=>{
  const f=setup(),c=f.componentInstance;c.onSubmit();c.onSubmit();expect(auth.login).toHaveBeenCalledTimes(1);tick(8000);f.detectChanges();expect(f.nativeElement.textContent).toContain('Cancel sign-in');
  c.cancelLogin();expect(c.isLoading).toBeFalse();expect(pending.observed).toBeFalse();expect(c.loginForm.value.email).toBe('traveller@example.com');c.onSubmit();expect(auth.login).toHaveBeenCalledTimes(2);f.destroy();
 }));
 it('stops the spinner and explains a timeout',fakeAsync(()=>{
  const f=setup(),c=f.componentInstance;c.onSubmit();pending.error(new TimeoutError());tick(8000);expect(c.isLoading).toBeFalse();expect(c.slowLogin).toBeFalse();expect(c.errorMessage).toContain('timed out');f.destroy();
 }));
 it('resets loading if navigation cannot open the destination',fakeAsync(()=>{
  const f=setup(),c=f.componentInstance;spyOn(TestBed.inject(Router),'navigateByUrl').and.resolveTo(false);c.onSubmit();pending.next({});pending.complete();tick();expect(c.isLoading).toBeFalse();expect(c.errorMessage).toContain('Unable to open');f.destroy();
 }));
 it('cancels a pending request when the login screen is destroyed',()=>{
  const f=setup();f.componentInstance.onSubmit();f.destroy();expect(pending.observed).toBeFalse();
 });
});
