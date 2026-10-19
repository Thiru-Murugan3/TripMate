import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { TripService } from '../../core/services/trip.service';
import { AccountComponent } from '../../features/account/account.component';
import { ExpenseTripsComponent } from '../../features/expenses/expense-trips.component';
import { DashboardComponent } from '../../features/dashboard/dashboard.component';
import { MobileNavigationComponent } from '../components/mobile-navigation/mobile-navigation.component';

describe('Mobile navigation and account flows', () => {
  const user = signal<any>({id:1,name:'Traveller One',email:'traveller@example.com',systemRole:'USER'});
  const auth = {currentUser:user,logout:jasmine.createSpy('logout').and.returnValue(of(void 0))};
  beforeEach(()=>TestBed.configureTestingModule({providers:[provideRouter([]),{provide:AuthService,useValue:auth}]}));

  it('provides real navigation destinations and recognises trip expenses',()=>{
    const fixture=TestBed.createComponent(MobileNavigationComponent); fixture.detectChanges();
    const hrefs=Array.from(fixture.nativeElement.querySelectorAll('a')).map((a:any)=>a.getAttribute('href'));
    expect(hrefs).toEqual(['/dashboard','/trips','/dashboard?createTrip=1','/expenses','/account']);
    const router=TestBed.inject(Router);spyOnProperty(router,'url','get').and.returnValue('/trips/10?tab=EXPENSES');
    expect(fixture.componentInstance.active('expenses')).toBeTrue();expect(fixture.componentInstance.active('trips')).toBeFalse();
    fixture.destroy();
  });

  it('shows the signed-in user and signs out through the existing session service',()=>{
    const fixture=TestBed.createComponent(AccountComponent); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('traveller@example.com');
    expect(fixture.nativeElement.textContent).not.toContain('500k');
    const navigate=spyOn(TestBed.inject(Router),'navigate').and.resolveTo(true);
    fixture.componentInstance.logout();fixture.componentInstance.logout();
    expect(auth.logout).toHaveBeenCalledTimes(1);expect(navigate).toHaveBeenCalledWith(['/login']);fixture.destroy();
  });
});

describe('Mobile expense chooser',()=>{
  it('opens the existing trip expense tab and recovers from a failed trip load',()=>{
    const trips:any[]=[{id:10,name:'Ooty trip',destination:'Ooty',budget:30000,travelerCount:4,userRole:'VIEWER'}];
    const service={getMyTrips:jasmine.createSpy().and.returnValues(throwError(()=>new Error('offline')),of(trips))};
    TestBed.configureTestingModule({providers:[provideRouter([]),{provide:TripService,useValue:service}]});
    const fixture=TestBed.createComponent(ExpenseTripsComponent);fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Unable to load trips');
    fixture.componentInstance.load();fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.trip-option').getAttribute('href')).toBe('/trips/10?tab=EXPENSES');
    expect(fixture.nativeElement.textContent).not.toContain('Add Expense');fixture.destroy();
  });
});

describe('Mobile create-trip entry point',()=>{
  it('opens the create form repeatedly when the bottom navigation is used on Home',()=>{
    const query=new Subject<any>();const route={queryParamMap:query,snapshot:{queryParamMap:convertToParamMap({})}};
    TestBed.configureTestingModule({providers:[provideRouter([]),{provide:ActivatedRoute,useValue:route},{provide:TripService,useValue:{getMyTrips:()=>of([])}},{provide:AuthService,useValue:{currentUser:signal(null)}}]});
    const navigate=spyOn(TestBed.inject(Router),'navigate').and.resolveTo(true);
    const fixture=TestBed.createComponent(DashboardComponent);fixture.detectChanges();
    query.next(convertToParamMap({createTrip:'1'}));expect(fixture.componentInstance.showCreateModal).toBeTrue();
    fixture.componentInstance.closeCreateModal();query.next(convertToParamMap({createTrip:'1'}));
    expect(fixture.componentInstance.showCreateModal).toBeTrue();
    expect(navigate).toHaveBeenCalledWith([],jasmine.objectContaining({queryParams:{createTrip:null},replaceUrl:true}));fixture.destroy();
  });
});
