import {TestBed,fakeAsync,tick} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting,HttpTestingController} from '@angular/common/http/testing';
import {BackendReadinessService,BACKEND_WAKE_TIMEOUT_MS} from './backend-readiness.service';
import {environment} from '../../../environments/environment';

describe('Foreground backend readiness',()=>{
 let service:BackendReadinessService,http:HttpTestingController;
 const url=`${environment.apiUrl}/health`;
 beforeEach(()=>{TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting()]});service=TestBed.inject(BackendReadinessService);http=TestBed.inject(HttpTestingController);});
 afterEach(()=>http.verify());
 it('shares wake requests and briefly reuses successful readiness',()=>{
  let ready=0;service.ready().subscribe(()=>ready++);service.ready().subscribe(()=>ready++);
  const req=http.expectOne(url);expect(req.request.headers.has('Authorization')).toBeFalse();req.flush({status:'UP'});
  service.ready().subscribe(()=>ready++);http.expectNone(url);expect(ready).toBe(3);expect(service.connecting()).toBeFalse();
 });
 it('survives a cold start longer than the login timeout',fakeAsync(()=>{
  let ready=false;service.ready().subscribe(()=>ready=true);
  for(let i=0;i<6;i++){http.expectOne(url);tick(8000);tick(2000);}
  expect(ready).toBeFalse();http.expectOne(url).flush({status:'UP'});expect(ready).toBeTrue();
 }));
 it('cancels network work when the last foreground subscriber leaves',fakeAsync(()=>{
  const sub=service.ready().subscribe();const req=http.expectOne(url);sub.unsubscribe();expect(req.cancelled).toBeTrue();tick(20000);http.expectNone(url);expect(service.connecting()).toBeFalse();
 }));
 it('has a total deadline and allows a new attempt after failure',fakeAsync(()=>{
  let failed=false;service.ready().subscribe({error:()=>failed=true});tick(BACKEND_WAKE_TIMEOUT_MS);http.match(url);expect(failed).toBeTrue();expect(service.connecting()).toBeFalse();
  const sub=service.ready().subscribe();http.expectOne(url);sub.unsubscribe();
 }));
});
