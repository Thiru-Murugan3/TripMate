import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CATALOGUE_ROOT, IndiaCatalogueService } from './india-catalogue.service';

describe('IndiaCatalogueService', () => {
  it('fetches only the requested versioned state and bypasses account interceptors', () => {
    const interceptor = jasmine.createSpy('accountInterceptor');
    TestBed.configureTestingModule({providers:[
      provideHttpClient(withInterceptors([(req,next) => { interceptor(); return next(req); }])),
      provideHttpClientTesting()
    ]});
    const service = TestBed.inject(IndiaCatalogueService);
    const http = TestBed.inject(HttpTestingController);
    service.index().subscribe();
    const index = http.expectOne(CATALOGUE_ROOT+'index.json?schema=3');
    expect(index.request.headers.has('Authorization')).toBeFalse();
    index.flush({snapshot:'2026-10-15',total:42017,states:[]});
    service.state({name:'Tamil Nadu',file:'tamil-nadu.json',count:334}).subscribe();
    const request = http.expectOne(CATALOGUE_ROOT+'tamil-nadu.json');
    expect(request.request.headers.has('Authorization')).toBeFalse();
    expect(interceptor).not.toHaveBeenCalled();
    request.flush([]); http.verify();
  });
});
