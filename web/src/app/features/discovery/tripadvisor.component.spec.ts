import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TripadvisorComponent } from './tripadvisor.component';
import { environment } from '../../../environments/environment';
describe('Tripadvisor live lookup', () => {
  let fixture: ComponentFixture<TripadvisorComponent>;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/discovery/tripadvisor`;
  beforeEach(async () => {
    await TestBed.configureTestingModule({imports:[TripadvisorComponent],providers:[provideHttpClient(),provideHttpClientTesting()]}).compileComponents();
    fixture=TestBed.createComponent(TripadvisorComponent); http=TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('query','Ooty'); fixture.detectChanges();
    http.expectOne(`${base}/status`).flush({available:true}); fixture.detectChanges();
  });
  afterEach(() => { fixture.destroy(); http.verify(); });
  it('does not consume search/details/photos calls until explicitly requested', () => {
    expect(fixture.componentInstance.available).toBeTrue(); http.expectNone(`${base}/search`);
    expect(fixture.nativeElement.querySelector('dialog').open).toBeTrue();
  });
  it('loads details and photos separately, uses provider rating images and retains photo credit', () => {
    const c=fixture.componentInstance; c.search();
    http.expectOne(r=>r.url===`${base}/search` && r.params.get('query')==='Ooty' && r.params.get('category')==='attractions').flush([{id:'123',name:'Garden',address:'Ooty'}]);
    c.open('123'); http.expectOne(`${base}/locations/123`).flush({id:'123',name:'Garden',address:'Ooty',description:'A garden',webUrl:'https://www.tripadvisor.com/place',ratingImageUrl:'https://static.tacdn.com/rating.png',reviewCount:'20'});
    fixture.detectChanges(); expect(fixture.nativeElement.querySelector('.bubbles').getAttribute('src')).toContain('tacdn.com');
    http.expectNone(`${base}/locations/123/photos`); c.loadPhotos('123');
    http.expectOne(`${base}/locations/123/photos`).flush([{url:'https://media-cdn.tripadvisor.com/photo.jpg',caption:'Garden',author:'Photographer',sourceUrl:'https://www.tripadvisor.com/photo'}]);
    fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('Photographer / Tripadvisor');
    c.loadPhotos('123'); http.expectNone(`${base}/locations/123/photos`);
  });
  it('clears stale selections and cancels requests when the query changes', () => {
    const c=fixture.componentInstance;c.search();const request=http.expectOne(r=>r.url===`${base}/search`); c.clear();
    expect(request.cancelled).toBeTrue(); expect(c.results).toEqual([]);expect(c.detail).toBeNull();expect(c.busy).toBeFalse();
  });
  it('handles exhausted allowance and lets the traveller retry', () => {
    const c=fixture.componentInstance;c.search(); http.expectOne(r=>r.url===`${base}/search`).flush({}, {status:429,statusText:'Limit'});
    expect(c.error).toContain('usage limit');expect(c.busy).toBeFalse(); c.search(); http.expectOne(r=>r.url===`${base}/search`).flush([]);
    expect(c.error).toBe(''); expect(c.searched).toBeTrue();
  });
  it('destroys pending requests and does not keep detail data', () => {
    const c=fixture.componentInstance;c.open('123');const request=http.expectOne(`${base}/locations/123`);
    c.ngOnDestroy();expect(request.cancelled).toBeTrue();expect(c.detail).toBeNull();
  });
});
