import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TopPlacesComponent } from './top-places.component';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { ExploreComponent } from './explore.component';
import { routes } from '../../app.routes';
import { CombinedPlacesComponent } from './combined-places.component';
import { DiscoveryService } from '../../core/services/discovery.service';
import { TripService } from '../../core/services/trip.service';
import { PlaceService } from '../../core/services/place.service';
import { ItineraryService } from '../../core/services/itinerary.service';

describe('Combined compact Explore', () => {
  const trip={id:10,name:'Ooty trip',destination:'Ooty',startDate:'2026-11-01',endDate:'2026-11-03',userRole:'OWNER'};
  const place={externalId:'opentripmap:Q123',name:'Garden',category:'PARK',latitude:11.4,longitude:76.7,distanceKm:1,saveCategory:'ATTRACTION',priceStatus:'UNKNOWN',imageGallery:[]};
  const response={query:'Ooty',resolvedDestination:'Ooty, India',places:[place],provider:'Geoapify + OpenTripMap',providersUsed:['Geoapify','OpenTripMap'],attribution:'ODbL',resultCount:25,page:0,size:24,totalPages:2,radiusKm:25};
  let discovery:jasmine.SpyObj<DiscoveryService>, places:jasmine.SpyObj<PlaceService>, itinerary:jasmine.SpyObj<ItineraryService>;
  beforeEach(() => {
    discovery=jasmine.createSpyObj('DiscoveryService',['discoverPlaces','getSuggestions','getTopPlaces']);discovery.discoverPlaces.and.returnValue(of(response as any));discovery.getTopPlaces.and.returnValue(of(response as any));
    places=jasmine.createSpyObj('PlaceService',['getPlaces','createPlace']);places.getPlaces.and.returnValue(of([]));places.createPlace.and.returnValue(of({id:500,name:'Garden',latitude:11.4,longitude:76.7} as any));
    itinerary=jasmine.createSpyObj('ItineraryService',['getItinerary','createDay','createItem']);itinerary.getItinerary.and.returnValue(of({days:[]} as any));itinerary.createDay.and.returnValue(of({id:100,items:[]} as any));itinerary.createItem.and.returnValue(of({id:501} as any));
    TestBed.configureTestingModule({imports:[CombinedPlacesComponent],providers:[provideHttpClient(),provideRouter([]),{provide:DiscoveryService,useValue:discovery},{provide:PlaceService,useValue:places},{provide:ItineraryService,useValue:itinerary},{provide:TripService,useValue:{getMyTrips:()=>of([trip,{...trip,id:20,userRole:'VIEWER'}])}}]});
  });
  it('shows a compact single result grid without provider explanations and preserves unknown prices', () => {
    const fixture=TestBed.createComponent(CombinedPlacesComponent);fixture.detectChanges();const c=fixture.componentInstance;
    expect(fixture.nativeElement.textContent).toContain('100 km');
    expect(discovery.discoverPlaces).not.toHaveBeenCalled();c.searchDestination='Ooty';c.discover();fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.cards').length).toBe(1);expect(fixture.nativeElement.querySelector('app-india-catalogue')).toBeNull();
    const open=spyOn(window,'open');
    const mapButton=[...fixture.nativeElement.querySelectorAll('button')].find((button:any)=>button.textContent.includes('View map')) as HTMLButtonElement;
    mapButton.click();expect(open).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).not.toContain('Geoapify + OpenTripMap');expect(fixture.nativeElement.querySelector('.source-notes')).toBeNull();expect(fixture.nativeElement.textContent).toContain('Price not verified');
    c.filterText='Garden';c.discover();expect(discovery.discoverPlaces.calls.mostRecent().args[3]?.name).toBe('Garden');fixture.destroy();
  });
  it('sends experience and practical filters without dropping a selection', async () => {
    const fixture=TestBed.createComponent(CombinedPlacesComponent);fixture.detectChanges();const c=fixture.componentInstance;
    c.searchDestination='Ooty';c.discover();await c.toggleSelection(place as any);
    c.priceStatusFilter='FREE';c.maxDurationFilter=180;c.category='NATURE';c.selectItemType('ACTIVITY');
    expect(discovery.discoverPlaces.calls.mostRecent().args).toEqual(['Ooty',25,'NATURE',jasmine.objectContaining({itemType:'ACTIVITY',priceStatus:'FREE',maxDuration:180,page:0})]);
    expect(c.isSelected(place as any)).toBeTrue();fixture.detectChanges();expect(fixture.nativeElement.querySelector('app-top-places')).toBeNull();
    c.selectItemType('TOUR_SERVICE');expect(discovery.discoverPlaces.calls.mostRecent().args[3]?.itemType).toBe('TOUR_SERVICE');fixture.destroy();
  });
  it('keeps visitor details collapsed and booking separate from planning', () => {
    const fixture=TestBed.createComponent(CombinedPlacesComponent);fixture.detectChanges();const c=fixture.componentInstance;
    discovery.discoverPlaces.and.returnValue(of({...response,places:[{...place,suggestedVisitMinutes:90,description:'Garden visitor details',bookingUrl:'https://example.com/tickets'}]} as any));
    c.searchDestination='Ooty';c.discover();fixture.detectChanges();
    const details=fixture.nativeElement.querySelector('.place-details');expect(details.open).toBeFalse();expect(details.textContent).toContain('Garden visitor details');
    expect(fixture.nativeElement.textContent).toContain('Suggested visit: 1h 30m');expect(fixture.nativeElement.querySelector('.booking-link').textContent).toContain('Book with provider');
    expect(fixture.nativeElement.querySelector('.place-select input')).not.toBeNull();expect(c.safeBookingUrl('javascript:alert(1)')).toBeNull();expect(c.safeBookingUrl('invalid')).toBeNull();fixture.destroy();
  });
  it('separates destination from an interest and clears incompatible experience tabs', () => {
    const fixture=TestBed.createComponent(CombinedPlacesComponent);fixture.detectChanges();const c=fixture.componentInstance;
    c.searchDestination='Rishikesh adventure';c.itemTypeFilter='PLACE';c.discover();
    expect(discovery.discoverPlaces.calls.mostRecent().args[0]).toBe('Rishikesh');
    expect(discovery.discoverPlaces.calls.mostRecent().args[2]).toBe('ADVENTURE');
    expect(discovery.discoverPlaces.calls.mostRecent().args[3]?.itemType).toBe('ALL');
    c.itemTypeFilter='TOUR_SERVICE';c.category='FAMILY';c.categoryChanged();c.discover();
    expect(discovery.discoverPlaces.calls.mostRecent().args[3]?.itemType).toBe('ALL');
    c.searchDestination='Adventure Island';c.discover();expect(discovery.discoverPlaces.calls.mostRecent().args[0]).toBe('Adventure Island');fixture.destroy();
  });
  it('shows source failures for empty results instead of claiming the location does not exist', () => {
    const fixture=TestBed.createComponent(CombinedPlacesComponent);fixture.detectChanges();const c=fixture.componentInstance;
    discovery.discoverPlaces.and.returnValue(of({...response,places:[],warnings:['OpenStreetMap discovery is temporarily unavailable.']} as any));
    c.searchDestination='Rishikesh';c.discover();fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No matching places could be loaded');
    expect(fixture.nativeElement.textContent).toContain('Coverage and source status');expect(fixture.nativeElement.textContent).toContain('OpenStreetMap discovery is temporarily unavailable.');fixture.destroy();
  });
  it('keeps partial-result coverage visible without expanding details or losing selectable places', () => {
    const fixture=TestBed.createComponent(CombinedPlacesComponent);fixture.detectChanges();const c=fixture.componentInstance;
    discovery.discoverPlaces.and.returnValue(of({...response,warnings:['OpenStreetMap was unavailable; partial results are shown.','Prices and opening hours may change.']} as any));
    c.searchDestination='Rishikesh';c.discover();fixture.detectChanges();
    const status=fixture.nativeElement.querySelector('.coverage-status');expect(status).not.toBeNull();expect(status.open).toBeFalse();
    expect(status.textContent).toContain('OpenStreetMap was unavailable');expect(status.textContent).not.toContain('Prices and opening');
    expect(fixture.nativeElement.querySelector('.place-select input')).not.toBeNull();expect(fixture.nativeElement.querySelectorAll('.coverage-status').length).toBe(1);fixture.destroy();
  });
  it('labels suggested times, missing hours and expired free-entry claims honestly', () => {
    const fixture=TestBed.createComponent(CombinedPlacesComponent);fixture.detectChanges();const c=fixture.componentInstance;
    expect(c.visitTime({...place,suggestedVisitMinutes:90} as any)).toBe('Suggested visit: 1h 30m');
    expect(c.visitTime({...place,suggestedVisitMinutes:NaN} as any)).toBe('Visit duration not listed');
    expect(c.openingSchedule(undefined)).toContain('Not listed');expect(c.openingSchedule('Mo-Fr 09:00-17:00')).toBe('Mon–Fri 09:00–17:00');
    expect(c.formatPlacePrice({...place,priceStatus:'FREE',verificationExpiresAt:'2020-01-01'} as any)).toContain('Previously free');
    expect(c.sourceDate('invalid')).toBeNull();
    discovery.discoverPlaces.and.returnValue(of({...response,places:[{...place,openingHours:'24/7',priceOptions:[{label:'Adult',amount:100,currency:'INR',priceType:'PER_PERSON',sourceUrl:'https://venue.example/fees',lastVerifiedAt:'2026-10-01'}]}]} as any));
    c.searchDestination='Ooty';c.discover();fixture.detectChanges();
    const details=fixture.nativeElement.querySelector('.place-details');expect(details.open).toBeFalse();expect(details.textContent).toContain('24 hours daily');
    expect(details.textContent).toContain('Price checked:');expect(details.querySelector('a').href).toBe('https://venue.example/fees');fixture.destroy();
  });
  it('keeps selections across pages and saves only after trip/day confirmation', async () => {
    const fixture=TestBed.createComponent(CombinedPlacesComponent);fixture.detectChanges();const c=fixture.componentInstance;
    c.searchDestination='Ooty';c.discover();await c.toggleSelection(place as any);
    expect(places.createPlace).not.toHaveBeenCalled();await c.selectTrip(10);expect(places.createPlace).not.toHaveBeenCalled();
    c.setDayAssignment(place as any,2);c.discover(1);expect(c.selectedCount).toBe(1);
    await c.saveSelected(true);
    expect(itinerary.createDay.calls.mostRecent().args[1].dayDate).toBe('2026-11-02');
    expect(itinerary.createItem.calls.mostRecent().args[2].title).toBe('Garden');expect(c.selectedCount).toBe(0);fixture.destroy();
  });
  it('cancels an old city request and clears selection before another city', async () => {
    const fixture=TestBed.createComponent(CombinedPlacesComponent);fixture.detectChanges();const c=fixture.componentInstance;
    const pending=new Subject<any>();discovery.discoverPlaces.and.returnValue(pending.asObservable());c.searchDestination='Ooty';c.discover();
    await c.toggleSelection(place as any);c.searchDestination='Chennai';c.cityChanged();pending.next(response);
    expect(c.result).toBeNull();expect(c.selectedCount).toBe(0);expect(c.isLoading).toBeFalse();fixture.destroy();
  });
  it('passes trip context into Top 10 and forwards successful itinerary changes', async () => {
    const fixture=TestBed.createComponent(CombinedPlacesComponent);
    for(const [key,value] of Object.entries({tripId:10,destination:'Ooty',startDate:trip.startDate,endDate:trip.endDate,canEdit:true}))fixture.componentRef.setInput(key,value);
    fixture.detectChanges();
    const c=fixture.componentInstance,changed=spyOn(c.itineraryChanged,'emit');
    const top=fixture.debugElement.query(By.directive(TopPlacesComponent)).componentInstance as TopPlacesComponent;
    expect(top.activeTripId).toBe(10);expect(top.canEdit).toBeTrue();expect(top.availableDayNumbers).toEqual([1,2,3]);
    top.load();await top.toggleSelection(place as any);top.setDayAssignment(place as any,2);await top.saveSelected(true);
    expect(itinerary.createItem).toHaveBeenCalledWith(10,100,jasmine.objectContaining({placeId:500}));expect(changed).toHaveBeenCalled();expect(c.isSaving).toBeFalse();fixture.destroy();
  });

  it('offers one Explore view, forwards trip changes and retains the existing route', async () => {
    const fixture=TestBed.createComponent(ExploreComponent);
    fixture.componentRef.setInput('trip',trip);fixture.componentRef.setInput('canEdit',true);fixture.detectChanges();
    const child=fixture.debugElement.query(By.directive(CombinedPlacesComponent)).componentInstance as CombinedPlacesComponent;
    expect(child.activeTripId).toBe(10);expect(child.destination).toBe('Ooty');expect(child.canEdit).toBeTrue();
    expect(fixture.nativeElement.querySelectorAll('app-combined-places').length).toBe(1);
    expect(fixture.nativeElement.querySelector('nav.sources')).toBeNull();expect(fixture.nativeElement.textContent).not.toContain('Tripadvisor');
    const itineraryChanged=spyOn(fixture.componentInstance.itineraryChanged,'emit'),placesChanged=spyOn(fixture.componentInstance.placesChanged,'emit');
    child.itineraryChanged.emit();child.placesChanged.emit();expect(itineraryChanged).toHaveBeenCalled();expect(placesChanged).toHaveBeenCalled();
    expect(await routes.find(r=>r.path==='explore')!.loadComponent!()).toBe(ExploreComponent);
    expect(routes.find(r=>r.path==='explore/india')?.redirectTo).toBe('/explore');fixture.destroy();
  });

});
