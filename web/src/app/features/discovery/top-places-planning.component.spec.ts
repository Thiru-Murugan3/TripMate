import { PlacePhotosService } from '../../core/services/place-photos.service';
import { fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { PlaceService } from '../../core/services/place.service';
import { ItineraryService } from '../../core/services/itinerary.service';
import { TopPlacesComponent } from './top-places.component';
import { DiscoveredPlace, DestinationDiscoveryResponse } from '../../core/models/discovery.model';
const place:DiscoveredPlace={externalId:'wikidata:Q1',name:'Ooty Lake',category:'LAKE',saveCategory:'ATTRACTION',latitude:11.4,longitude:76.7,suggestedVisitMinutes:60,distanceKm:2,sourceUrl:'https://www.wikidata.org/wiki/Q1'};
const response:DestinationDiscoveryResponse={latitude:11.4,longitude:76.7,category:'ALL',provider:'Wikidata',query:'Ooty',resolvedDestination:'Ooty',places:[place],resultCount:1,radiusKm:25,attribution:'CC0'};
describe('Top 10 itinerary selection',()=>{
  let places:jasmine.SpyObj<PlaceService>,itinerary:jasmine.SpyObj<ItineraryService>;
  const saved:any={id:500,name:place.name,category:'ATTRACTION',latitude:11.4,longitude:76.7};
  const empty:any={tripId:10,days:[]};
  beforeEach(()=>{
    places=jasmine.createSpyObj('PlaceService',['getPlaces','createPlace']);
    places.getPlaces.and.returnValue(of([]));places.createPlace.and.returnValue(of(saved));
    itinerary=jasmine.createSpyObj('ItineraryService',['getItinerary','createDay','createItem','reorder']);
    itinerary.getItinerary.and.returnValue(of(empty));
    itinerary.createDay.and.returnValue(of({id:20,dayNumber:2,tripId:10,items:[]}));
    itinerary.createItem.and.returnValue(of({id:30,dayId:20,tripId:10,title:place.name}));itinerary.reorder.and.returnValue(of(empty));
    TestBed.configureTestingModule({imports:[TopPlacesComponent],providers:[{provide:PlacePhotosService,useValue:{get:()=>of({images:[],message:"",retryable:false})}},provideHttpClient(),provideRouter([]),{provide:PlaceService,useValue:places},{provide:ItineraryService,useValue:itinerary}]});
  });
  function embedded(canEdit=true){
    const f=TestBed.createComponent(TopPlacesComponent);
    for(const [key,value] of Object.entries({destination:'Ooty',tripId:10,startDate:'2026-11-01',endDate:'2026-11-03',canEdit}))f.componentRef.setInput(key,value);
    f.detectChanges();f.componentInstance.result=response;f.detectChanges();return f;
  }
  it('selects without writing, then adds to the chosen day and refreshes the trip',fakeAsync(()=>{
    const f=embedded(),c=f.componentInstance,changed=spyOn(c.itineraryChanged,'emit'),savedEvent=spyOn(c.placesChanged,'emit');
    f.nativeElement.querySelector('input[type=checkbox]').click();flushMicrotasks();f.detectChanges();
    expect(places.createPlace).not.toHaveBeenCalled();expect(c.selectedCount).toBe(1);
    const day=f.nativeElement.querySelector('li select') as HTMLSelectElement;
    day.value=day.options[1].value;day.dispatchEvent(new Event('change'));f.detectChanges();
    const add=Array.from(f.nativeElement.querySelectorAll('button')).find((b:any)=>b.textContent.includes('Add selected')) as HTMLButtonElement;
    add.click();flushMicrotasks();f.detectChanges();
    expect(places.createPlace).toHaveBeenCalledWith(10,jasmine.objectContaining({name:place.name}));
    expect(itinerary.createDay).toHaveBeenCalledWith(10,jasmine.objectContaining({dayNumber:2,dayDate:'2026-11-02'}));
    expect(itinerary.createItem).toHaveBeenCalledWith(10,20,jasmine.objectContaining({placeId:500}));
    expect(changed).toHaveBeenCalled();expect(savedEvent).toHaveBeenCalled();expect(c.selectedCount).toBe(0);f.destroy();
  }));
  it('reuses saved places and skips existing itinerary items',fakeAsync(()=>{
    const f=embedded(),c=f.componentInstance;places.getPlaces.and.returnValue(of([saved]));
    itinerary.getItinerary.and.returnValue(of({...empty,days:[{id:20,dayNumber:2,items:[{id:30,placeId:500}]}]}));
    c.toggleSelection(place);c.setDayAssignment(place,2);c.saveSelected(true);flushMicrotasks();
    expect(places.createPlace).not.toHaveBeenCalled();expect(itinerary.createDay).not.toHaveBeenCalled();expect(itinerary.createItem).not.toHaveBeenCalled();expect(c.selectedCount).toBe(0);f.destroy();
  }));
  it('retains failed selections and retries without recreating saved places',fakeAsync(()=>{
    const f=embedded(),c=f.componentInstance;c.toggleSelection(place);c.setDayAssignment(place,2);
    itinerary.getItinerary.and.returnValue(throwError(()=>({error:{message:'Please retry'}})));
    c.saveSelected(true);flushMicrotasks();expect(c.error).toBe('Please retry');expect(c.selectedCount).toBe(1);expect(c.dayAssignments[place.externalId]).toBe(2);
    places.getPlaces.and.returnValue(of([saved]));itinerary.getItinerary.and.returnValue(of(empty));
    c.saveSelected(true);flushMicrotasks();expect(places.createPlace).toHaveBeenCalledTimes(1);expect(itinerary.createItem).toHaveBeenCalledTimes(1);expect(c.selectedCount).toBe(0);f.destroy();
  }));
  it('blocks writes when the saved-place check fails',fakeAsync(()=>{
    const f=embedded(),c=f.componentInstance;c.toggleSelection(place);
    places.getPlaces.and.returnValue(throwError(()=>new Error('offline')));c.saveSelected(true);flushMicrotasks();
    expect(c.error).toContain('Please retry');expect(c.selectedCount).toBe(1);expect(places.createPlace).not.toHaveBeenCalled();expect(itinerary.getItinerary).not.toHaveBeenCalled();f.destroy();
  }));
  it('blocks read-only guest selection',fakeAsync(()=>{
    const f=embedded(false),c=f.componentInstance;expect(f.nativeElement.querySelector('input').disabled).toBeTrue();
    c.toggleSelection(place);c.saveSelected(true);flushMicrotasks();expect(c.selectedCount).toBe(0);expect(places.getPlaces).not.toHaveBeenCalled();f.destroy();
  }));
  it('prevents repeat writes and finishes saving to the original trip before switching',fakeAsync(()=>{
    const f=embedded(),c=f.componentInstance,pending=new Subject<any[]>(),busy=spyOn(c.savingChanged,'emit');
    places.getPlaces.and.returnValue(pending);c.toggleSelection(place);c.saveSelected(true);c.saveSelected(true);expect(places.getPlaces).toHaveBeenCalledTimes(1);
    f.componentRef.setInput('tripId',11);f.detectChanges();expect(c.activeTripId).toBe(10);
    pending.next([]);pending.complete();flushMicrotasks();
    expect(places.createPlace).toHaveBeenCalledWith(10,jasmine.anything());expect(itinerary.createItem).toHaveBeenCalledWith(10,20,jasmine.anything());
    expect(c.activeTripId).toBe(11);expect(c.result).toBeNull();expect(busy.calls.allArgs()).toEqual([[true],[false]]);f.destroy();
  }));
});
