import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
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
    discovery=jasmine.createSpyObj('DiscoveryService',['discoverPlaces','getSuggestions','getTopPlaces']);discovery.discoverPlaces.and.returnValue(of(response as any));
    places=jasmine.createSpyObj('PlaceService',['getPlaces','createPlace']);places.getPlaces.and.returnValue(of([]));places.createPlace.and.returnValue(of({id:500,name:'Garden',latitude:11.4,longitude:76.7} as any));
    itinerary=jasmine.createSpyObj('ItineraryService',['getItinerary','createDay','createItem']);itinerary.getItinerary.and.returnValue(of({days:[]} as any));itinerary.createDay.and.returnValue(of({id:100,items:[]} as any));itinerary.createItem.and.returnValue(of({id:501} as any));
    TestBed.configureTestingModule({imports:[CombinedPlacesComponent],providers:[provideHttpClient(),provideRouter([]),{provide:DiscoveryService,useValue:discovery},{provide:PlaceService,useValue:places},{provide:ItineraryService,useValue:itinerary},{provide:TripService,useValue:{getMyTrips:()=>of([trip,{...trip,id:20,userRole:'VIEWER'}])}}]});
  });
  it('shows a compact single result grid with sources and unknown prices', () => {
    const fixture=TestBed.createComponent(CombinedPlacesComponent);fixture.detectChanges();const c=fixture.componentInstance;
    expect(fixture.nativeElement.textContent).toContain('100 km');
    expect(discovery.discoverPlaces).not.toHaveBeenCalled();c.searchDestination='Ooty';c.discover();fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.cards').length).toBe(1);expect(fixture.nativeElement.querySelector('app-india-catalogue')).toBeNull();
    const open=spyOn(window,'open');
    const mapButton=[...fixture.nativeElement.querySelectorAll('button')].find((button:any)=>button.textContent.includes('View map')) as HTMLButtonElement;
    mapButton.click();expect(open).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Geoapify + OpenTripMap');expect(fixture.nativeElement.textContent).toContain('Price not verified');
    c.filterText='Garden';c.discover();expect(discovery.discoverPlaces.calls.mostRecent().args[3]?.name).toBe('Garden');fixture.destroy();
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
});
