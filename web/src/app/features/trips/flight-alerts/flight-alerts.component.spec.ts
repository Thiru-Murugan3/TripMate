import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { FlightAlertsComponent } from './flight-alerts.component';
import { FlightStatus, FlightTrackingService } from '../../../core/services/flight-tracking.service';
import { Booking } from '../../../core/models/booking.model';

describe('Flight alerts', () => {
  let component: FlightAlertsComponent;
  let api: jasmine.SpyObj<FlightTrackingService>;
  const flight: FlightStatus = { bookingId: 1, ident: '6E123', airlineCode: '6E', flightNumber: '123', departureDate: '2026-10-14', origin: 'DEL', destination: 'BOM', departureZone: 'Asia/Kolkata', enabled: true, subscribed: false, available: true, stale: false, lastChecked: '2026-10-14T03:00:00Z', nextPoll: '', message: null, source: 'FlightAware', snapshot: null };
  beforeEach(() => {
    api = jasmine.createSpyObj('FlightTrackingService',['list','configure','subscribe']);
    TestBed.configureTestingModule({ providers: [{ provide: FlightTrackingService, useValue: api }] });
    component = TestBed.runInInjectionContext(() => new FlightAlertsComponent());
    component.tripId = 10; component.canManage = true;
    component.bookings = [{ id: 1, transportType: 'FLIGHT', status: 'CONFIRMED', bookingSource: 'EXTERNAL_MANUAL' },
      { id: 2, transportType: 'FLIGHT', status: 'CONFIRMED', bookingSource: 'TRIPMATE_SANDBOX' },
      { id: 3, transportType: 'FLIGHT', status: 'CANCELLED' }] as Booking[];
  });
  afterEach(() => component.ngOnDestroy());
  it('excludes cancelled and demo flights', () => {
    expect(component.eligibleBookings.map(b => b.id)).toEqual([1]);
  });
  it('preserves saved details and exposes failure without claiming fresh data', () => {
    component.flights = [flight]; api.list.and.returnValue(throwError(() => new Error('offline')));
    component.load(); expect(component.flights).toEqual([flight]); expect(component.error).toContain('stale');
  });
  it('round trips an airline code containing digits', () => {
    component.flights = [flight]; component.edit(1);
    expect(component.form.airlineCode).toBe('6E'); expect(component.form.flightNumber).toBe('123');
  });
  it('prevents non-editors configuring flights but allows personal alert preferences', () => {
    component.canManage = false; component.edit(1); component.save(); expect(api.configure).not.toHaveBeenCalled();
    api.subscribe.and.returnValue(of({ ...flight, subscribed: true })); component.flights = [flight];
    component.subscribe(flight,true); expect(api.subscribe).toHaveBeenCalledWith(10,1,true); expect(component.flights[0].subscribed).toBeTrue();
  });
  it('keeps the setup form available to retry on save failure', () => {
    component.edit(1); api.configure.and.returnValue(throwError(() => ({ error: { message: 'Invalid time zone' } })));
    component.save(); expect(component.selectedBooking).toBe(1); expect(component.formError).toBe('Invalid time zone');
    expect(component.saving).toBeFalse();
  });
  it('renders timestamps in the stated departure zone', () => {
    expect(component.time('2026-10-13T20:00:00Z','Asia/Kolkata')).toContain('14');
    expect(component.time(null,'Asia/Kolkata')).toBe('Unavailable');
  });
});
