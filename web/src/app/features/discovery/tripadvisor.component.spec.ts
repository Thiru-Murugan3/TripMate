import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TripadvisorComponent } from './tripadvisor.component';
import { environment } from '../../../environments/environment';
import { provideRouter } from '@angular/router';
import { routes } from '../../app.routes';

describe('Tripadvisor-only Explore', () => {
  let fixture: ComponentFixture<TripadvisorComponent>;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/discovery/tripadvisor`;
  const photo = {url:'https://media-cdn.tripadvisor.com/photo.jpg',caption:'Garden',author:'Photographer',sourceUrl:'https://www.tripadvisor.com/photo'};
  beforeEach(async () => {
    await TestBed.configureTestingModule({imports:[TripadvisorComponent],providers:[provideHttpClient(),provideHttpClientTesting(),provideRouter([])]}).compileComponents();
    fixture=TestBed.createComponent(TripadvisorComponent); http=TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('query','Ooty'); fixture.detectChanges();
    http.expectOne(`${base}/status`).flush({available:true}); fixture.detectChanges();
  });
  afterEach(() => { fixture.destroy(); http.verify(); });
  function searchResults(count=1): void {
    fixture.componentInstance.search();
    http.expectOne(r=>r.url===`${base}/search-page` && r.params.get('query')==='Ooty' && r.params.get('category')==='attractions')
      .flush({places:Array.from({length:count},(_,i)=>({id:String(i+1),name:'Place '+(i+1),address:'Ooty'})),page:1,size:4,totalElements:count,totalPages:1,hasNext:false});
  }
  it('routes Explore directly to Tripadvisor and redirects the former source catalogue', async () => {
    const page = await routes.find(r=>r.path==='explore')!.loadComponent!();
    expect(page).toBe(TripadvisorComponent);
    expect(routes.find(r=>r.path==='explore/india')?.redirectTo).toBe('/explore');
  });
  it('renders a page without a modal, catalogue or automatic paid search', () => {
    expect(fixture.componentInstance.available).toBeTrue(); http.expectNone(`${base}/search-page`);
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
  it('requests provider pages beyond ten matches and loads only current page photos', () => {
    fixture.componentInstance.search();
    http.expectOne(r=>r.url===`${base}/search-page` && r.params.get('page')==='1' && r.params.get('size')==='4')
      .flush({places:[{id:'1',name:'First',address:'Ooty'}],page:1,size:4,totalElements:14,totalPages:4,hasNext:true});
    http.expectOne(`${base}/locations/1/photos`).flush([]);
    fixture.detectChanges();expect(fixture.nativeElement.textContent).toContain('of 14 available matches');
    for (let page=2;page<=4;page++) {
      fixture.componentInstance.setPage(page);
      http.expectOne(r=>r.url===`${base}/search-page` && r.params.get('page')===String(page))
        .flush({places:[{id:String(page*4),name:'Later place',address:'Ooty'}],page,size:4,totalElements:14,totalPages:4,hasNext:page<4});
      http.expectOne(`${base}/locations/${page*4}/photos`).flush([]);
    }
    expect(fixture.componentInstance.page).toBe(4);expect(fixture.componentInstance.hasNext).toBeFalse();
    fixture.componentInstance.setPage(5);http.expectNone(r=>r.url===`${base}/search-page`);
    fixture.componentInstance.setPage(3);
    http.expectOne(r=>r.url===`${base}/search-page` && r.params.get('page')==='3')
      .flush({places:[],page:3,size:4,totalElements:14,totalPages:4,hasNext:true});
  });
  it('retains the current page after a page request fails and allows retry', () => {
    fixture.componentInstance.search();http.expectOne(r=>r.url===`${base}/search-page`)
      .flush({places:[{id:'1',name:'First',address:'Ooty'}],page:1,size:4,totalElements:null,totalPages:null,hasNext:true});
    http.expectOne(`${base}/locations/1/photos`).flush([photo]);
    fixture.componentInstance.setPage(2);http.expectOne(r=>r.url===`${base}/search-page`).flush({}, {status:502,statusText:'Unavailable'});
    expect(fixture.componentInstance.page).toBe(1);expect(fixture.componentInstance.results[0].id).toBe('1');
    expect(fixture.componentInstance.visiblePhoto(fixture.componentInstance.results[0])).toEqual(photo);
    fixture.componentInstance.setPage(2);const request=http.expectOne(r=>r.url===`${base}/search-page` && r.params.get('page')==='2');
    fixture.componentInstance.clear();expect(request.cancelled).toBeTrue();expect(fixture.componentInstance.hasNext).toBeFalse();
    expect(fixture.componentInstance.totalElements).toBeNull();
  });
  it('clears data and cancels photos when changing city', () => {
    searchResults(); const request=http.expectOne(`${base}/locations/1/photos`); fixture.componentInstance.clear();
    expect(request.cancelled).toBeTrue(); expect(fixture.componentInstance.results).toEqual([]);expect(fixture.componentInstance.photoStates).toEqual({});
  });
  it('shows an actionable key/domain error without falling back to Suttru data', () => {
    fixture.componentInstance.search();http.expectOne(r=>r.url===`${base}/search-page`).flush({code:'ACCESS_DENIED',message:'do not render raw upstream text'}, {status:502,statusText:'Denied'});
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
    fixture.componentInstance.search();http.expectOne(r=>r.url===`${base}/search-page`).flush({}, {status:429,statusText:'Limit'});
    expect(fixture.componentInstance.error).toContain('usage limit');searchResults();http.expectOne(`${base}/locations/1/photos`).flush([]);
    expect(fixture.componentInstance.error).toBe('');
  });
  it('cancels details and photos and discards content on navigation', () => {
    searchResults();const photos=http.expectOne(`${base}/locations/1/photos`);fixture.componentInstance.open('1');const details=http.expectOne(`${base}/locations/1`);
    fixture.componentInstance.ngOnDestroy();expect(photos.cancelled).toBeTrue();expect(details.cancelled).toBeTrue();
    expect(fixture.componentInstance.results).toEqual([]);expect(fixture.componentInstance.detail).toBeNull();
  });
  it('links Terra names and photos to the provider property page when photos have no page URL', () => {
    fixture.componentInstance.search();http.expectOne(r=>r.url===`${base}/search-page`).flush({places:[{id:'1',name:'Garden',address:'Ooty',webUrl:'https://www.tripadvisor.com/Attraction_Review-d123'}],page:1,size:4,totalElements:1,totalPages:1,hasNext:false});
    http.expectOne(`${base}/locations/1/photos`).flush([{...photo,sourceUrl:null}]);fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('figure a').getAttribute('href')).toBe('https://www.tripadvisor.com/Attraction_Review-d123');
    expect(fixture.nativeElement.querySelector('h3 a').getAttribute('href')).toContain('tripadvisor.com');
  });
  it('keeps Terra unavailable until its account allowance and entity budget are configured', () => {
    fixture.componentInstance.checkAvailability();http.expectOne(`${base}/status`).flush({available:false,apiMode:'TERRA',setupCode:'TERRA_SETUP_REQUIRED'});
    expect(fixture.componentInstance.available).toBeFalse();expect(fixture.componentInstance.error).toContain('confirmed account allowance');
    fixture.componentInstance.search();http.expectNone(r=>r.url===`${base}/search-page`);
  });
  it('explains Terra endpoint access and entity budget failures without suggesting blind retry', () => {
    fixture.componentInstance.search();http.expectOne(r=>r.url===`${base}/search-page`).flush({code:'TERRA_ACCESS_DENIED'}, {status:502,statusText:'Denied'});
    expect(fixture.componentInstance.error).toContain('package and API permissions');
    fixture.componentInstance.search();http.expectOne(r=>r.url===`${base}/search-page`).flush({code:'TERRA_ENTITY_LIMIT'}, {status:429,statusText:'Budget'});
    expect(fixture.componentInstance.error).toContain('entity budget is exhausted');
  });

  const trip = {id:10,name:'Ooty break',destination:'Ooty',startDate:'2026-11-01',endDate:'2026-11-03',userRole:'OWNER'};
  it('searches a particular place by name without changing city search defaults', () => {
    fixture.componentInstance.searchType='NAME';fixture.componentInstance.query='Botanical Garden';fixture.componentInstance.search();
    http.expectOne(r=>r.url===`${base}/search-page` && r.params.get('searchType')==='NAME' && r.params.get('query')==='Botanical Garden')
      .flush({places:[],page:1,size:4,totalElements:0,totalPages:0,hasNext:false});
  });
  it('selects a place and saves only its identifier and the travellers own plan', () => {
    searchResults();http.expectOne(`${base}/locations/1/photos`).flush([]);
    fixture.componentInstance.selectPlace(fixture.componentInstance.results[0]);
    http.expectOne(`${environment.apiUrl}/trips`).flush([trip,{...trip,id:20,userRole:'VIEWER'}]);
    expect(fixture.componentInstance.availableTrips.length).toBe(1);
    fixture.componentInstance.activityTitle='Morning outing';fixture.componentInstance.selectedDay=2;
    let changed=0;fixture.componentInstance.itineraryChanged.subscribe(()=>changed++);
    fixture.componentInstance.addSelectedPlace();fixture.componentInstance.addSelectedPlace();
    const request=http.expectOne(`${environment.apiUrl}/trips/10/itinerary/tripadvisor-places`);
    expect(request.request.body).toEqual({locationId:'1',dayNumber:2,title:'Morning outing'});
    request.flush({id:500,tripadvisorLocationId:'1'});fixture.detectChanges();
    expect(changed).toBe(1);expect(fixture.componentInstance.selectedPlace).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Place added to your itinerary');
  });
  it('retains selection on save failure, prevents invalid days, and permits retry', () => {
    fixture.componentRef.setInput('trip',trip);fixture.componentRef.setInput('canEdit',true);fixture.detectChanges();
    searchResults();http.expectOne(`${base}/locations/1/photos`).flush([]);
    fixture.componentInstance.selectPlace(fixture.componentInstance.results[0]);http.expectNone(`${environment.apiUrl}/trips`);
    fixture.componentInstance.selectedDay=4;fixture.componentInstance.addSelectedPlace();
    http.expectNone(`${environment.apiUrl}/trips/10/itinerary/tripadvisor-places`);
    fixture.componentInstance.selectedDay=1;fixture.componentInstance.addSelectedPlace();
    http.expectOne(`${environment.apiUrl}/trips/10/itinerary/tripadvisor-places`).flush({}, {status:500,statusText:'Unavailable'});
    expect(fixture.componentInstance.selectedPlace?.id).toBe('1');expect(fixture.componentInstance.saving).toBeFalse();
    fixture.componentInstance.addSelectedPlace();http.expectOne(`${environment.apiUrl}/trips/10/itinerary/tripadvisor-places`).flush({id:500});
  });
  it('blocks selection in a read-only trip and cancels stale trip loading on city change', () => {
    fixture.componentRef.setInput('trip',trip);fixture.detectChanges();
    const place={id:'1',name:'Garden',address:'Ooty'};fixture.componentInstance.selectPlace(place);
    expect(fixture.componentInstance.selectedPlace).toBeNull();http.expectNone(`${environment.apiUrl}/trips`);
    fixture.componentRef.setInput('trip',null);fixture.detectChanges();fixture.componentInstance.selectPlace(place);
    const request=http.expectOne(`${environment.apiUrl}/trips`);fixture.componentInstance.clear();
    expect(request.cancelled).toBeTrue();expect(fixture.componentInstance.selectedPlace).toBeNull();
  });

});
