import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TripService } from '../../core/services/trip.service';
import { TopPlacesComponent } from './top-places.component';
const place={externalId:'wikidata:Q1',name:'Ooty Lake',category:'LAKE',distanceKm:2,sourceName:'Wikidata',sourceUrl:'https://www.wikidata.org/wiki/Q1',priceStatus:'UNKNOWN'};
const response={query:'Ooty',resolvedDestination:'Ooty, India',places:[place],resultCount:1,radiusKm:25,attribution:'Wikidata CC0',warnings:[],totalPages:1};
describe('Free Top 10 places',()=>{
  let http:HttpTestingController;
  beforeEach(()=>{TestBed.configureTestingModule({imports:[TopPlacesComponent],providers:[provideHttpClient(),provideHttpClientTesting(),provideRouter([]),{provide:TripService,useValue:{getMyTrips:()=>of([])}}]});http=TestBed.inject(HttpTestingController);});
  afterEach(()=>http.verify());
  it('loads only on click without Google and displays real source links and the supported count',()=>{
    const f=TestBed.createComponent(TopPlacesComponent);f.componentRef.setInput('destination','Ooty');f.detectChanges();http.expectNone(r=>r.url.includes('top-places'));
    (f.nativeElement.querySelector('button') as HTMLButtonElement).click();
    const req=http.expectOne(r=>r.url.endsWith('/discovery/top-places'));expect(req.request.method).toBe('GET');expect(req.request.params.get('destination')).toBe('Ooty');expect(req.request.params.get('radiusKm')).toBe('25');req.flush(response);f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Ooty Lake');expect(f.nativeElement.textContent).not.toContain('Free, source-based');
    expect(f.nativeElement.querySelector('a').getAttribute('href')).toBe(place.sourceUrl);
    expect(f.nativeElement.querySelectorAll('li').length).toBe(1);expect(f.nativeElement.textContent).not.toContain('AI assistance');f.destroy();
  });
  it('cancels the old destination or radius request and clears prior results',()=>{
    const f=TestBed.createComponent(TopPlacesComponent);f.componentRef.setInput('destination','Ooty');f.detectChanges();f.componentInstance.load();
    const req=http.expectOne(r=>r.url.endsWith('/discovery/top-places'));f.componentRef.setInput('radiusKm',50);f.detectChanges();expect(req.cancelled).toBeTrue();
    f.componentInstance.load();const newer=http.expectOne(r=>r.params.get('radiusKm')==='50');newer.flush({...response,radiusKm:50});
    f.componentRef.setInput('destination','Chennai');f.detectChanges();expect(f.componentInstance.result).toBeNull();f.destroy();
  });
  it('shows a concise empty state without provider diagnostics or fabricated places',()=>{
    const f=TestBed.createComponent(TopPlacesComponent);f.componentRef.setInput('destination','Ooty');f.detectChanges();f.componentInstance.load();
    http.expectOne(r=>r.url.endsWith('/discovery/top-places')).flush({...response,places:[],resultCount:0,warnings:['Source unavailable']});f.detectChanges();
    expect(f.nativeElement.textContent).toContain('No places found');expect(f.nativeElement.textContent).not.toContain('Source unavailable');expect(f.nativeElement.querySelectorAll('li').length).toBe(0);f.destroy();
  });
  it('allows retry after failure while preventing duplicate requests and requests during saving',()=>{
    const f=TestBed.createComponent(TopPlacesComponent);f.componentRef.setInput('destination','Ooty');f.detectChanges();f.componentInstance.load();f.componentInstance.load();
    http.expectOne(r=>r.url.endsWith('/discovery/top-places')).flush({message:'Sources unavailable'},{status:503,statusText:'Unavailable'});expect(f.componentInstance.error).toBe('Sources unavailable');
    f.componentInstance.load();http.expectOne(r=>r.url.endsWith('/discovery/top-places')).flush(response);
    f.componentRef.setInput('disabled',true);f.detectChanges();f.componentInstance.load();http.expectNone(r=>r.url.includes('top-places'));f.destroy();
  });
  it('offers existing Explore name search explicitly without saving an itinerary automatically',()=>{
    const f=TestBed.createComponent(TopPlacesComponent);f.componentRef.setInput('destination','Ooty');f.componentRef.setInput('canFind',true);f.detectChanges();f.componentInstance.load();
    http.expectOne(r=>r.url.endsWith('/discovery/top-places')).flush(response);f.detectChanges();const selected=spyOn(f.componentInstance.placeRequested,'emit');
    const button=Array.from(f.nativeElement.querySelectorAll('button')).find((b:any)=>b.textContent.includes('Find in Explore')) as HTMLButtonElement;button.click();expect(selected).toHaveBeenCalledWith('Ooty Lake');f.destroy();
  });
});
