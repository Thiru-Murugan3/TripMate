import { provideHttpClient } from '@angular/common/http';
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
    TestBed.configureTestingModule({ imports:[IndiaCatalogueComponent], providers:[provideHttpClient(),provideRouter([]), {provide:IndiaCatalogueService,useValue:service}] });
  });
  function setup() {
    const fixture = TestBed.createComponent(IndiaCatalogueComponent);
    fixture.detectChanges(); fixture.componentInstance.selectState(tn.name); fixture.detectChanges();
    return fixture;
  }
  it('labels unknown fees and missing photos without free-price or image substitution', () => {
    const fixture = setup();
    expect(fixture.nativeElement.textContent).toContain('Entry fee not verified');
    expect(fixture.nativeElement.textContent).toContain('No source photograph available');
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
  });
  it('offers opt-in checkboxes and preserves parent selections across pagination and filters', () => {
    service.state.and.returnValue(of(Array.from({length:30},(_,i)=>({...place,place_id:String(i)}))));
    const fixture=setup(); const c=fixture.componentInstance;
    expect(fixture.nativeElement.querySelector('.place-selection')).toBeNull();
    c.selectable=true; c.selectedIds=new Set(['catalogue:0']); c.dayNumbers=[1,2];
    const change=spyOn(c.selectionChange,'emit'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.place-selection input').checked).toBeTrue();
    c.page=1; fixture.detectChanges(); c.page=0; c.query='Temple'; fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.place-selection input').checked).toBeTrue();
    fixture.nativeElement.querySelector('.place-selection input').click();
    expect(change).toHaveBeenCalledWith({place:{...place,place_id:'0'},selected:false});
    c.saving=true; fixture.detectChanges(); c.togglePlace({...place,place_id:'1'});
    expect(change).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('.place-selection input').disabled).toBeTrue();
  });

  it('groups each source record once and filters interests using actual category metadata', () => {
    service.state.and.returnValue(of([
      {...place,place_id:'nature',categories:['lake','park']},
      {...place,place_id:'history',categories:['temple','monument']},
      {...place,place_id:'museum',categories:['museum']},
      {...place,place_id:'unclassified'}
    ]));
    const fixture=setup(); const c=fixture.componentInstance;
    expect(fixture.nativeElement.querySelectorAll('.cards article').length).toBe(4);
    expect(c.catalogueSections.flatMap(s=>s.places.map(p=>p.place_id)).sort()).toEqual(['history','museum','nature','unclassified']);
    c.page=2; c.chooseInterest('nature'); fixture.detectChanges();
    expect(c.page).toBe(0); expect(c.filtered.map(p=>p.place_id)).toEqual(['nature']);
    c.query='no match'; fixture.detectChanges(); expect(c.filtered.length).toBe(0);
    c.selectState('Kerala'); expect(c.interest).toBe('all');
    c.discoveryCategory='TEMPLE'; expect(c.filtered.map(p=>p.place_id)).toEqual(['history']);
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
  it('selects a destination from an input that arrives before the index', () => {
    const pending = new Subject<any>(); service.index.and.returnValue(pending);
    const fixture = TestBed.createComponent(IndiaCatalogueComponent);
    fixture.componentRef.setInput('destination', 'Tamilnadu, India'); fixture.detectChanges();
    pending.next({snapshot:'2026-10-14',total:30,states:[tn]}); fixture.detectChanges();
    expect(fixture.componentInstance.selectedState).toBe('Tamil Nadu');
    expect(fixture.nativeElement.textContent).toContain('Temple');
  });
  it('matches a known city and clears stale results for an unknown next destination', () => {
    service.index.and.returnValue(of({snapshot:'2026-10-14',total:31,states:[tn,kerala],destinationStates:{chennai:['Tamil Nadu']}}));
    const fixture = TestBed.createComponent(IndiaCatalogueComponent);
    fixture.componentRef.setInput('destination','Chennai, Tamil Nadu, India'); fixture.detectChanges();
    expect(fixture.componentInstance.selectedState).toBe('Tamil Nadu');
    expect(fixture.componentInstance.query).toBe('Chennai');
    fixture.componentRef.setInput('destination','Unmapped city'); fixture.detectChanges();
    expect(fixture.componentInstance.places).toEqual([]);
    expect(fixture.componentInstance.matchMessage).toContain('Choose a state');
  });
  it('does not guess the state of an ambiguous city', () => {
    service.index.and.returnValue(of({snapshot:'2026-10-14',total:31,states:[tn,kerala],destinationStates:{sharedtown:['Tamil Nadu','Kerala']}}));
    const fixture = TestBed.createComponent(IndiaCatalogueComponent);
    fixture.componentRef.setInput('destination','Shared town'); fixture.detectChanges();
    expect(service.state).not.toHaveBeenCalled();
    expect(fixture.componentInstance.selectedState).toBe('');
  });

  it('filters candidate categories and sources, searches source aliases and clears filters on state change', () => {
    service.state.and.returnValue(of([
      {...place, place_id:'candidate', source_kind:'COMMUNITY_STRUCTURED_DATA', publication_status:'CANDIDATE_REVIEW_REQUIRED', categories:['temple'], name_variants:['Local shrine']},
      {...place, place_id:'registry', source_kind:'GOVERNMENT_HERITAGE_REGISTRY', categories:['protected-heritage-site'], district_status:'ASI_PUBLISHED_DISTRICT_CURRENT_BOUNDARY_NOT_VERIFIED', district_as_published:'Old district'}
    ]));
    const fixture=setup(); const c=fixture.componentInstance;
    expect(c.categories).toEqual(['protected-heritage-site','temple']);
    c.category='temple'; c.sourceKind='COMMUNITY_STRUCTURED_DATA'; c.query='local shrine';
    fixture.detectChanges();
    expect(c.filtered.map(p=>p.place_id)).toEqual(['candidate']);
    expect(fixture.nativeElement.textContent).toContain('Community candidate');
    expect(fixture.nativeElement.textContent).toContain('visitor access have not been independently confirmed');
    c.category=''; c.sourceKind=''; c.query=''; fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Current district boundaries have not been verified');
    c.category='temple'; c.sourceKind='COMMUNITY_STRUCTURED_DATA'; c.page=4;
    c.selectState('Kerala');
    expect(c.category).toBe(''); expect(c.sourceKind).toBe(''); expect(c.page).toBe(0);
  });

  it('keeps records without a state browsable without assigning a guessed state', () => {
    service.index.and.returnValue(of({snapshot:'2026-10-15',total:32,states:[tn,kerala],unassigned:{name:'State not assigned',file:'state-unassigned.json',count:1}}));
    service.state.and.returnValue(of([{...place,state_ut:null}]));
    const fixture=setup(); const c=fixture.componentInstance;
    c.selectState('State not assigned'); fixture.detectChanges();
    expect(service.state).toHaveBeenCalledWith({name:'State not assigned',file:'state-unassigned.json',count:1});
    expect(c.places[0].state_ut).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('source records');
  });

});
