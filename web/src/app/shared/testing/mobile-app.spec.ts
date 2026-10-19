import { Type, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LoginComponent } from '../../features/auth/login/login.component';
import { RegisterComponent } from '../../features/auth/register/register.component';
import { MyTripsComponent } from '../../features/trips/my-trips/my-trips.component';
import { TripDetailsComponent } from '../../features/trips/trip-details/trip-details.component';
import { ItineraryPlannerComponent } from '../../features/trips/itinerary-planner/itinerary-planner.component';
import { TripTimelineComponent } from '../../features/trips/trip-timeline/trip-timeline.component';
import { ExpenseManagerComponent } from '../../features/trips/expense-manager/expense-manager.component';
import { DocumentManagerComponent } from '../../features/trips/document-manager/document-manager.component';
import { PlaceManagerComponent } from '../../features/trips/place-manager/place-manager.component';
import { BookingMarketplaceComponent } from '../../features/bookings/booking-marketplace.component';

const longName = 'GovernmentBotanicalGardenAndConservatoryWithAnExceptionallyLongName';
const trip: any = { id: 10, name: longName, destination: longName, tripType: 'FRIENDS', status: 'UPCOMING',
  startDate: '2027-11-13', endDate: '2027-11-16', budget: 30000, travelerCount: 4, ownerId: 1, ownerName: longName, userRole: 'OWNER' };
const day: any = { id: 1, tripId: 10, dayNumber: 1, dayDate: trip.startDate, title: longName,
  items: [{ id: 1, dayId: 1, tripId: 10, title: longName, location: longName, startTime: '09:00', endTime: '10:00', estimatedCost: 500 }] };

function phone(element: HTMLElement, width: number, height = 740): void {
  const frame = document.createElement('iframe');
  frame.style.cssText = `width:${width}px;height:${height}px;border:0;position:absolute;left:-10000px`;
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument!;
    for (const style of document.querySelectorAll('style')) doc.head.appendChild(style.cloneNode(true));
    const reset = doc.createElement('style');
    reset.textContent = '*{box-sizing:border-box}body{margin:0;overflow:visible}';
    doc.head.appendChild(reset);
    doc.body.appendChild(element.cloneNode(true));
    expect(doc.documentElement.scrollWidth).withContext(`${element.tagName} page width ${width}`).toBeLessThanOrEqual(width);
    const scrollAreas = '.dashboard-tabs,.details-tabs,.photo-route,.route-summary,.day-jump-scroll';
    for (const control of doc.querySelectorAll<HTMLElement>('button,input,select,textarea,.modal,.modal-card,.modal-content,.bookings-grid,.timeline-card-wrapper,.trip-card,.document-card,.expense-card')) {
      if (control.closest(scrollAreas)) continue; // These strips intentionally scroll inside a bounded panel.
      const r = control.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const context = `${element.tagName} ${control.className || control.tagName} at ${width}px`;
      expect(r.left).withContext(context).toBeGreaterThanOrEqual(-1);
      expect(r.right).withContext(context).toBeLessThanOrEqual(width + 1);
    }
    for (const modal of doc.querySelectorAll<HTMLElement>('.modal,.modal-card,.modal-content')) {
      expect(modal.getBoundingClientRect().height).withContext('dialog fits visible height').toBeLessThanOrEqual(height);
      expect(modal.scrollWidth).withContext('dialog content fits width').toBeLessThanOrEqual(modal.clientWidth);
    }
  } finally { frame.remove(); }
}

describe('App-wide mobile layouts', () => {
  const fixtures: ComponentFixture<any>[] = [];
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
    { provide: AuthService, useValue: { currentUser: signal({ id: 1, name: longName, systemRole: 'USER' }), isAuthenticated: signal(true) } }
  ] }));
  afterEach(() => { for (const f of fixtures.splice(0)) f.destroy(); });

  function mount<T>(type: Type<T>, state: Record<string, any>, inputs: Record<string, any> = {}): ComponentFixture<T> {
    if (type.prototype.ngOnInit) spyOn(type.prototype, 'ngOnInit').and.stub();
    const f = TestBed.createComponent(type); fixtures.push(f);
    for (const [key, value] of Object.entries(inputs)) f.componentRef.setInput(key, value);
    f.detectChanges(); Object.assign(f.componentInstance as any, state); f.detectChanges();
    return f;
  }
  function widths(f: ComponentFixture<any>): void { for (const width of [320, 360, 390, 454, 760]) phone(f.nativeElement, width); }

  it('fits login, registration and populated My Trips', () => {
    widths(mount(LoginComponent, {})); widths(mount(RegisterComponent, {}));
    const f = mount(MyTripsComponent, {});
    f.componentInstance.trips.set([trip]); f.componentInstance.loading.set(false); f.detectChanges(); widths(f);
  });

  it('fits populated bookings and member permissions, including trip editing', () => {
    const f = mount(TripDetailsComponent, { trip, tripId: 10, isLoadingTrip: false, isLoadingBookings: false, activeTab: 'BOOKINGS', bookings: [
      { id: 1, tripId: 10, providerName: longName, bookingType: 'TRANSPORT', transportType: 'FLIGHT', departure: longName, arrival: longName,
        startDatetime: '2027-11-13T09:00:00', endDatetime: '2027-11-13T11:00:00', amount: 30000, status: 'CONFIRMED', currency: 'INR' }
    ] }); widths(f);
    f.componentInstance.activeTab = 'MEMBERS';
    f.componentInstance.members = [{ id: 1, tripId: 10, userId: 2, userName: longName, userEmail: longName + '@example.com', role: 'EDITOR', memberStatus: 'ACTIVE' }];
    f.detectChanges(); widths(f);
    f.componentInstance.openEditTripModal(); f.detectChanges(); widths(f);
  });

  it('fits the itinerary and time selectors in the add-activity dialog, including a short landscape screen', () => {
    const f = mount(ItineraryPlannerComponent, { isLoading: false, itinerary: { tripId: 10, totalDays: 1, totalActivities: 1, totalEstimatedCost: 500, days: [day] } }, { trip, tripId: 10, canEdit: true });
    widths(f); f.componentInstance.openAddActivity(day); f.detectChanges(); widths(f); phone(f.nativeElement, 640, 360);
  });

  it('fits a timeline with long booking details and status badges', () => {
    const f = mount(TripTimelineComponent, { isLoading: false, timeline: { tripId: 10, tripName: longName, destination: longName,
      transportCount: 1, stayCount: 0, activityCount: 0, mealCount: 0, conflictCount: 0, totalEvents: 1, days: [{ ...day, date: trip.startDate,
        formattedDate: 'Sat, 13 Nov 2027', hasConflict: false, items: [{ id: 'booking:1', sourceType: 'BOOKING', sourceId: 1,
          itemType: 'TRANSPORT_DEPARTURE', category: 'TRANSPORT', title: longName, subtitle: longName, location: longName,
          timeFormatted: '09:00 AM', endTimeFormatted: '11:00 AM', status: 'CONFIRMED', icon: 'flight', badgeColor: 'blue', conflict: false }] }] }
    }, { tripId: 10 }); widths(f);
  });

  it('fits expense currency entry, place entry, document upload and booking search', () => {
    const expense = mount(ExpenseManagerComponent, { isLoading: false }, { trip, tripId: 10, canEdit: true });
    expense.componentInstance.openCreateExpense(); expense.detectChanges(); widths(expense);
    const place = mount(PlaceManagerComponent, { isLoading: false, showPlaceModal: true }, { tripId: 10, canEdit: true }); widths(place);
    const documents = mount(DocumentManagerComponent, { isLoading: false, showUploadModal: true, selectedFile: new File(['test'], longName + '.pdf', { type: 'application/pdf' }) }, { tripId: 10, canEdit: true }); widths(documents);
    widths(mount(BookingMarketplaceComponent, { trip }));
  });
});
