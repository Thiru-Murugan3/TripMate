import {TestBed,fakeAsync,tick} from '@angular/core/testing';
import {HttpClient,provideHttpClient,withInterceptors} from '@angular/common/http';
import {provideHttpClientTesting,HttpTestingController} from '@angular/common/http/testing';
import {apiTimeoutInterceptor} from './api-timeout.interceptor';

describe('API request deadlines',()=>{
 let client:HttpClient,http:HttpTestingController;
 beforeEach(()=>{TestBed.configureTestingModule({providers:[provideHttpClient(withInterceptors([apiTimeoutInterceptor])),provideHttpClientTesting()]});client=TestBed.inject(HttpClient);http=TestBed.inject(HttpTestingController);});
 afterEach(()=>http.verify());
 it('ends a stalled page request instead of waiting indefinitely',fakeAsync(()=>{
  let error:any;client.get('/api/v1/trips').subscribe({error:e=>error=e});const request=http.expectOne('/api/v1/trips');tick(45000);expect(error.name).toBe('TimeoutError');expect(request.cancelled).toBeTrue();
 }));
 it('preserves the longer allowance for discovery and document transfers',fakeAsync(()=>{
  let errors=0;client.get('/api/v1/discovery/places').subscribe({error:()=>errors++});client.get('/api/v1/trips/1/documents').subscribe({error:()=>errors++});
  const discovery=http.expectOne('/api/v1/discovery/places'),documents=http.expectOne('/api/v1/trips/1/documents');tick(45000);expect(errors).toBe(0);discovery.flush({});documents.flush([]);
 }));
});
