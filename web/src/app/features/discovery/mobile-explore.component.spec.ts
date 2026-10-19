import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DiscoveryService } from '../../core/services/discovery.service';
import { PlaceService } from '../../core/services/place.service';
import { TripService } from '../../core/services/trip.service';
import { CombinedPlacesComponent } from './combined-places.component';
import { TopPlacesComponent } from './top-places.component';

// An iframe gives media queries a real phone-sized viewport without resizing Karma.
function atViewport(element:HTMLElement,width:number,check:(root:HTMLElement)=>void):void {
  const frame=document.createElement('iframe');
  frame.style.cssText=`width:${width}px;height:1800px;border:0;position:absolute;left:-10000px`;
  document.body.appendChild(frame);
  try {
    const doc=frame.contentDocument!;
    for(const style of document.querySelectorAll('style'))doc.head.appendChild(style.cloneNode(true));
    doc.body.style.margin='0';
    const root=element.cloneNode(true) as HTMLElement;
    doc.body.appendChild(root);
    check(root);
    expect(doc.documentElement.scrollWidth).withContext(`horizontal overflow at ${width}px`).toBeLessThanOrEqual(width);
  } finally {frame.remove();}
}
const place:any={externalId:'wikidata:Q1',name:'Government Botanical Garden and Conservatory with an exceptionally long attraction name',category:'PARK',saveCategory:'ATTRACTION',latitude:11.4,longitude:76.7,distanceKm:2,sourceName:'OpenStreetMap',sourceUrl:'https://www.openstreetmap.org/node/1',priceStatus:'UNKNOWN',imageGallery:[]};
const result:any={query:'Ooty',resolvedDestination:'Ooty and the surrounding Nilgiris district',places:[place],provider:'OpenStreetMap',attribution:'OpenStreetMap contributors',resultCount:1,page:0,totalPages:2,radiusKm:25};
describe('Mobile Explore layout',()=>{
  beforeEach(()=>TestBed.configureTestingModule({imports:[TopPlacesComponent,CombinedPlacesComponent],providers:[provideHttpClient(),provideRouter([]),
    {provide:PlaceService,useValue:{getPlaces:()=>of([])}},
    {provide:TripService,useValue:{getMyTrips:()=>of([])}},
    {provide:DiscoveryService,useValue:{discoverPlaces:()=>of(result),getTopPlaces:()=>of(result)}}]}));
  it('keeps Top 10 selection and day controls inside phone viewports with touch-sized targets',async()=>{
    const f=TestBed.createComponent(TopPlacesComponent);
    for(const [key,value] of Object.entries({tripId:10,destination:'Ooty',startDate:'2026-11-01',endDate:'2026-11-03'}))f.componentRef.setInput(key,value);
    f.detectChanges();f.componentInstance.result=result;await f.componentInstance.toggleSelection(place);f.detectChanges();
    try {
      for(const width of [320,390,560])atViewport(f.nativeElement,width,root=>{
        for(const control of root.querySelectorAll<HTMLElement>('button,select,.place-option,a')){
          const rect=control.getBoundingClientRect();
          expect(rect.height).withContext(control.textContent || control.tagName).toBeGreaterThanOrEqual(44);
          expect(rect.left).toBeGreaterThanOrEqual(0);expect(rect.right).toBeLessThanOrEqual(width);
        }
        const actions=root.querySelector('.selection-actions')!,button=actions.querySelector('button')!;
        expect(button.getBoundingClientRect().width).toBeGreaterThan(width/2);
      });
    } finally {f.destroy();}
  });
  it('uses compact phone cards and search fields while retaining the desktop card grid',()=>{
    const f=TestBed.createComponent(CombinedPlacesComponent);
    for(const [key,value] of Object.entries({tripId:10,destination:'Ooty'}))f.componentRef.setInput(key,value);
    f.detectChanges();f.componentInstance.result={...result,places:[place,{...place,externalId:'wikidata:Q2'}]};f.detectChanges();
    try {
      for(const width of [320,390,560,1280])atViewport(f.nativeElement,width,root=>{
        const cards=root.querySelectorAll<HTMLElement>('.card');
        const first=cards[0].getBoundingClientRect(),second=cards[1].getBoundingClientRect();
        if(width<=560){
          if(width<360) {expect(second.top).toBeGreaterThan(first.bottom);expect(second.left).toBe(first.left);}
          else {expect(second.top).toBe(first.top);expect(second.left).toBeGreaterThan(first.right);}
          for(const control of root.querySelectorAll<HTMLElement>('.search-form input,.search-form select,.search-form button,.pagination button')){
            const rect=control.getBoundingClientRect();expect(rect.height).toBeGreaterThanOrEqual(44);expect(rect.right).toBeLessThanOrEqual(width);
          }
        }else{expect(second.top).toBe(first.top);expect(second.left).toBeGreaterThan(first.right);}
      });
    } finally {f.destroy();}
  });
});
