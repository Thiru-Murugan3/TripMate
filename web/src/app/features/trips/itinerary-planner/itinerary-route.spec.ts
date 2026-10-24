import {TestBed} from '@angular/core/testing';
import {of,Subject} from 'rxjs';
import {ItineraryPlannerComponent} from './itinerary-planner.component';
import {ItineraryService} from '../../../core/services/itinerary.service';
import {PlaceService} from '../../../core/services/place.service';

describe('Hotel-based daily sightseeing routes',()=>{
 const item=(id:number,placeId?:number)=>({id,placeId,title:'Stop '+id,dayId:1,tripId:10,startTime:'10:00',displayOrder:id});
 const day={id:1,tripId:10,dayNumber:1,items:[item(1,1),item(2,2),item(3,3),item(4,4),item(5)]};
 const places:any[]=[{id:9,name:'Stay',category:'HOTEL',latitude:11,longitude:77},{id:1,name:'Far',category:'ATTRACTION',latitude:11.1,longitude:77},{id:2,name:'Near',category:'ATTRACTION',latitude:11.01,longitude:77},{id:3,name:'Invalid',latitude:null,longitude:77},{id:4,name:'Same position',latitude:11.01,longitude:77}];
 let api:any,placeApi:any;
 beforeEach(()=>{
  localStorage.removeItem('tripmate-route-start-10');localStorage.removeItem('tripmate-route-start-10:map');
  api={getItinerary:()=>of({totalActivities:5,days:[day]}),reorder:jasmine.createSpy().and.returnValue(of({days:[day]}))};
  placeApi={getPlaces:()=>of(places)};
  TestBed.configureTestingModule({providers:[{provide:ItineraryService,useValue:api},{provide:PlaceService,useValue:placeApi}]});
 });
 afterEach(()=>{localStorage.removeItem('tripmate-route-start-10');localStorage.removeItem('tripmate-route-start-10:map');});
 function setup(){const f=TestBed.createComponent(ItineraryPlannerComponent),c=f.componentInstance;c.tripId=10;c.canEdit=true;c.loadAll();return {f,c};}
 it('requests ordered road legs explicitly and discards estimates when stops change',()=>{
  const {f,c}=setup();const result=new Subject<any>();api.estimateDrive=jasmine.createSpy().and.returnValue(result);
  expect(api.estimateDrive).not.toHaveBeenCalled();const plan=c.dayRoutePlans[0];c.estimateDayDrive(plan);
  expect(api.estimateDrive.calls.mostRecent().args[0].length).toBe(plan.stops.length);
  result.next({available:true,distanceKm:20,durationMinutes:45,legs:[],path:[],message:'estimate'});
  expect(c.roadEstimate(plan)?.durationMinutes).toBe(45);
  c.currentLocation={name:'Changed stay',latitude:12,longitude:78};c.routeStartPlaceId='CURRENT_LOCATION';
  expect(c.roadEstimate(c.dayRoutePlans[0])).toBeNull();f.destroy();
 });
 it('focuses a selected day without changing the saved itinerary',()=>{
  const {f,c}=setup();c.itinerary={...c.itinerary!,days:[day,{...day,id:2,dayNumber:2}]};c.selectedPlanningDayId=2;
  expect(c.planningDays.length).toBe(1);expect(c.dayRoutePlans[0].day.id).toBe(2);expect(c.itinerary.days.length).toBe(2);f.destroy();
 });
 it('starts at a saved hotel, numbers the nearest next stop and returns to the stay without dropping unmapped activities',()=>{
  const {f,c}=setup(),plan=c.dayRoutePlans[0];
  expect(c.routeStart?.name).toBe('Stay');expect(plan.visitStops.map(p=>p.name)).toEqual(['Near','Same position','Far']);
  expect(plan.stops.map(p=>p.name)).toEqual(['Stay','Near','Same position','Far','Stay']);
  expect(plan.unmappedItems.map(p=>p.id)).toEqual([3,5]);expect(plan.legs[0].distanceKm).toBeCloseTo(1.1,1);
  expect(plan.legs[1].distanceKm).toBe(0);expect(api.reorder).not.toHaveBeenCalled();f.destroy();
 });
 it('recalculates for a changed origin and applies order only on explicit save without rewriting times',()=>{
  const {f,c}=setup();c.selectRouteStart({target:{value:'1'}} as any);
  expect(c.dayRoutePlans[0].stops[0].name).toBe('Far');expect(api.reorder).not.toHaveBeenCalled();
  c.optimizeAllDayRoutes();expect(api.reorder.calls.mostRecent().args[1]).toEqual({items:[1,2,4,3,5].map((id,i)=>({itemId:id,displayOrder:i+1}))});
  expect(day.items[0].startTime).toBe('10:00');f.destroy();
 });
 it('retains all route legs for more stops than a single mobile Maps URL supports',()=>{
  const {f,c}=setup();
  c.places=[places[0],...Array.from({length:10},(_,i)=>({...places[1],id:i+1,latitude:11+(i+1)/100}))];
  c.places[0]={...places[0],id:99};c.routeStartPlaceId='99';
  c.itinerary={days:[{...day,items:Array.from({length:10},(_,i)=>item(i+1,i+1))}]} as any;
  const plan=c.dayRoutePlans[0];expect(plan.visitStops.length).toBe(10);expect(plan.legs.length).toBe(11);
  const leg=plan.legs[0],url=new URL(c.legMapsUrl(leg));expect(url.searchParams.get('origin')).toBe('11,77');expect(url.searchParams.get('destination')).toBe('11.01,77');f.destroy();
 });
 it('ignores late itinerary and place responses from another trip',()=>{
  const lateItinerary=new Subject<any>(),latePlaces=new Subject<any>();api.getItinerary=()=>lateItinerary;placeApi.getPlaces=()=>latePlaces;
  const {f,c}=setup();c.tripId=20;lateItinerary.next({days:[day]});latePlaces.next(places);
  expect(c.itinerary).toBeNull();expect(c.places).toEqual([]);f.destroy();
 });
});
