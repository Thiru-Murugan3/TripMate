import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { IndiaCatalogueComponent } from './india-catalogue.component';
import { CataloguePlace, IndiaCatalogueService } from './india-catalogue.service';

describe('IndiaCatalogueComponent', () => {
  const tn = {name:'Tamil Nadu', file:'tamil-nadu.json', count:30};
  const kerala = {name:'Kerala', file:'kerala.json', count:1};
  const place: CataloguePlace = {
    place_id:'one', name:'Temple', state_ut:'Tamil Nadu', district:null, tourism_destination:'Chennai',
    record_type:'ATTRACTION', latitude:null, longitude:null, coordinate_source:null,
    source_provider:'Tourism source', source_url:'https://example.com', source_checked_at:'2026-10-14',
    possible_duplicate_group:null, publication_status:'REVIEW_REQUIRED', fees:[], photo:null
  };
  let service: jasmine.SpyObj<IndiaCatalogueService>;
  beforeEach(() => {
    service = jasmine.createSpyObj('IndiaCatalogueService', ['index','state']);
    service.index.and.returnValue(of({snapshot:'2026-10-14',total:31,states:[tn,kerala]}));
    service.state.and.returnValue(of([place]));
    TestBed.configureTestingModule({ imports:[IndiaCatalogueComponent], providers:[provideRouter([]), {provide:IndiaCatalogueService,useValue:service}] });
  });
  function setup() {
    const fixture = TestBed.createComponent(IndiaCatalogueComponent);
    fixture.detectChanges(); fixture.componentInstance.selectState(tn.name); fixture.detectChanges();
    return fixture;
  }
  it('labels unknown fees and missing photos without free-price or image substitution', () => {
    const fixture = setup();
    expect(fixture.nativeElement.textContent).toContain('Entry fee not verified');
    expect(fixture.nativeElement.textContent).toContain('No reviewed photograph available');
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
  });
  it('preserves a zero child tariff with its scope instead of calling the whole attraction free', () => {
    service.state.and.returnValue(of([{...place,fees:[{amount_inr:0,visitor_category:'Children under 5',scope:'entry',payment_channel:'online',condition:'Age proof required',source_url:'https://example.com/fees',source_checked_at:'2026-10-14'}]}]));
    const fixture=setup();
    expect(fixture.nativeElement.textContent).toContain('Children under 5');
    expect(fixture.nativeElement.textContent).toContain('Age proof required');
    expect(fixture.nativeElement.textContent).not.toContain('Entry fee not verified');
  });
  it('cancels stale state results and clears pagination and district', () => {
    const old = new Subject<CataloguePlace[]>(); const fresh = new Subject<CataloguePlace[]>();
    service.state.and.returnValues(old, fresh);
    const fixture=setup(); const c=fixture.componentInstance;
    c.page=2; c.district='Chennai'; c.selectState('Kerala');
    fresh.next([{...place,place_id:'new',state_ut:'Kerala'}]); old.next([place]);
    expect(c.places[0].place_id).toBe('new'); expect(c.page).toBe(0); expect(c.district).toBe('');
  });
  it('allows retry after a failed state load', () => {
    service.state.and.returnValues(throwError(() => new Error('offline')), of([place]));
    const fixture=setup(); const c=fixture.componentInstance;
    expect(c.error).toContain('Unable'); c.retry(); expect(c.error).toBe(''); expect(c.places.length).toBe(1);
  });
  it('filters unknown districts explicitly and paginates without losing records', () => {
    service.state.and.returnValue(of(Array.from({length:30},(_,i)=>({...place,place_id:String(i),district:i===0?'Chennai':null}))));
    const fixture=setup(); const c=fixture.componentInstance;
    expect(c.visible.length).toBe(24); c.page=1; expect(c.visible.length).toBe(6);
    c.page=0; c.district='__unknown'; expect(c.filtered.length).toBe(29);
    c.query='no-match'; expect(c.filtered.length).toBe(0);
  });
});
