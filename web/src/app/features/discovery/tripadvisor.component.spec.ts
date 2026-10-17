import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TripadvisorComponent } from './tripadvisor.component';
import { environment } from '../../../environments/environment';
import { routes } from '../../app.routes';

describe('Tripadvisor-only Explore', () => {
  let fixture: ComponentFixture<TripadvisorComponent>;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/discovery/tripadvisor`;
  const photo = {url:'https://media-cdn.tripadvisor.com/photo.jpg',caption:'Garden',author:'Photographer',sourceUrl:'https://www.tripadvisor.com/photo'};
  beforeEach(async () => {
    await TestBed.configureTestingModule({imports:[TripadvisorComponent],providers:[provideHttpClient(),provideHttpClientTesting()]}).compileComponents();
    fixture=TestBed.createComponent(TripadvisorComponent); http=TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('query','Ooty'); fixture.detectChanges();
    http.expectOne(`${base}/status`).flush({available:true}); fixture.detectChanges();
  });
  afterEach(() => { fixture.destroy(); http.verify(); });
  function searchResults(count=1): void {
    fixture.componentInstance.search();
    http.expectOne(r=>r.url===`${base}/search` && r.params.get('query')==='Ooty' && r.params.get('category')==='attractions')
      .flush(Array.from({length:count},(_,i)=>({id:String(i+1),name:'Place '+(i+1),address:'Ooty'})));
  }
  it('routes Explore directly to Tripadvisor and redirects the former source catalogue', async () => {
    const page = await routes.find(r=>r.path==='explore')!.loadComponent!();
    expect(page).toBe(TripadvisorComponent);
    expect(routes.find(r=>r.path==='explore/india')?.redirectTo).toBe('/explore');
  });
  it('renders a page without a modal, catalogue or automatic paid search', () => {
    expect(fixture.componentInstance.available).toBeTrue(); http.expectNone(`${base}/search`);
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-india-catalogue')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Suttru’s place checkboxes');
  });
  it('loads credited photos automatically and requests ratings only on opening details', () => {
    searchResults(); http.expectOne(`${base}/locations/1/photos`).flush([photo]); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.place-photo').getAttribute('src')).toBe(photo.url);
    expect(fixture.nativeElement.textContent).toContain('Photographer / Tripadvisor');
    fixture.componentInstance.open('1'); http.expectOne(`${base}/locations/1`).flush({id:'1',name:'Garden',address:'Ooty',description:'A garden',webUrl:'https://www.tripadvisor.com/place',ratingImageUrl:'https://static.tacdn.com/rating.png',reviewCount:'20'});
    fixture.detectChanges(); expect(fixture.nativeElement.querySelector('.bubbles').getAttribute('src')).toContain('tacdn.com');
  });
  it('bounds photo loading to visible pages, keeps API order and avoids duplicate loads', () => {
    searchResults(6); const first=http.expectOne(`${base}/locations/1/photos`); const second=http.expectOne(`${base}/locations/2/photos`);
    http.expectNone(`${base}/locations/3/photos`); first.flush([photo]); http.expectOne(`${base}/locations/3/photos`).flush([]);
    http.expectOne(`${base}/locations/4/photos`).flush([]); second.flush([]);
    expect(fixture.componentInstance.visiblePlaces.map(p=>p.id)).toEqual(['1','2','3','4']);
    fixture.componentInstance.setPage(1); http.expectOne(`${base}/locations/5/photos`).flush([]); http.expectOne(`${base}/locations/6/photos`).flush([]);
    fixture.componentInstance.setPage(0); http.expectNone(`${base}/locations/1/photos`);
  });
  it('clears data and cancels photos when changing city', () => {
    searchResults(); const request=http.expectOne(`${base}/locations/1/photos`); fixture.componentInstance.clear();
    expect(request.cancelled).toBeTrue(); expect(fixture.componentInstance.results).toEqual([]);expect(fixture.componentInstance.photoStates).toEqual({});
  });
  it('shows an actionable key/domain error without falling back to Suttru data', () => {
    fixture.componentInstance.search();http.expectOne(r=>r.url===`${base}/search`).flush({code:'ACCESS_DENIED',message:'do not render raw upstream text'}, {status:502,statusText:'Denied'});
    fixture.detectChanges();expect(fixture.nativeElement.textContent).toContain('allowed domain/IP');
    expect(fixture.nativeElement.textContent).not.toContain('do not render raw');expect(fixture.componentInstance.results).toEqual([]);
    http.expectNone(r=>!r.url.startsWith(base));
  });
  it('keeps place names visible if photo quota fails and permits a manual retry', () => {
    searchResults();http.expectOne(`${base}/locations/1/photos`).flush({}, {status:429,statusText:'Limit'});
    fixture.detectChanges();expect(fixture.nativeElement.textContent).toContain('usage limit');expect(fixture.nativeElement.textContent).toContain('Place 1');
    fixture.componentInstance.retryPhoto('1');http.expectOne(`${base}/locations/1/photos`).flush([photo]);expect(fixture.componentInstance.photoFailure).toBe('');
  });
  it('recovers from a search limit without retaining stale data', () => {
    fixture.componentInstance.search();http.expectOne(r=>r.url===`${base}/search`).flush({}, {status:429,statusText:'Limit'});
    expect(fixture.componentInstance.error).toContain('usage limit');searchResults();http.expectOne(`${base}/locations/1/photos`).flush([]);
    expect(fixture.componentInstance.error).toBe('');
  });
  it('cancels details and photos and discards content on navigation', () => {
    searchResults();const photos=http.expectOne(`${base}/locations/1/photos`);fixture.componentInstance.open('1');const details=http.expectOne(`${base}/locations/1`);
    fixture.componentInstance.ngOnDestroy();expect(photos.cancelled).toBeTrue();expect(details.cancelled).toBeTrue();
    expect(fixture.componentInstance.results).toEqual([]);expect(fixture.componentInstance.detail).toBeNull();
  });
});
