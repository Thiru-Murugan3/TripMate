import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TripadvisorReferenceComponent } from './tripadvisor-reference.component';
import { environment } from '../../../environments/environment';

describe('Itinerary Tripadvisor reference', () => {
  beforeEach(() => TestBed.configureTestingModule({imports:[TripadvisorReferenceComponent],providers:[provideHttpClient(),provideHttpClientTesting()]}));
  it('loads fresh place content, links to Tripadvisor and discards it on destruction', () => {
    const fixture=TestBed.createComponent(TripadvisorReferenceComponent),http=TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('locationId','123');fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/discovery/tripadvisor/locations/123`).flush({name:'Garden',webUrl:'https://www.tripadvisor.com/Attraction_Review-d123'});
    fixture.detectChanges();expect(fixture.nativeElement.querySelector('a').textContent).toContain('Garden / Tripadvisor');
    fixture.destroy();expect(fixture.componentInstance.name).toBe('');http.verify();
  });
  it('cancels stale place content and allows retry after API failure', () => {
    const fixture=TestBed.createComponent(TripadvisorReferenceComponent),http=TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('locationId','123');fixture.detectChanges();const old=http.expectOne(`${environment.apiUrl}/discovery/tripadvisor/locations/123`);
    fixture.componentRef.setInput('locationId','456');fixture.detectChanges();expect(old.cancelled).toBeTrue();
    http.expectOne(`${environment.apiUrl}/discovery/tripadvisor/locations/456`).flush({}, {status:429,statusText:'Limit'});
    fixture.detectChanges();expect(fixture.nativeElement.textContent).toContain('Tripadvisor place #456');
    fixture.componentInstance.load();http.expectOne(`${environment.apiUrl}/discovery/tripadvisor/locations/456`).flush({name:'Lake',webUrl:'https://www.tripadvisor.com/Attraction_Review-d456'});
    fixture.destroy();http.verify();
  });
});
