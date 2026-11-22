import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { TripDetailsComponent } from './trip-details.component';
import { Trip, TripDashboard, TripMember } from '../../../core/models/trip.model';

describe('TripDetailsComponent overview (TRIP-201)', () => {
  let fixture: ComponentFixture<TripDetailsComponent>;
  let http: HttpTestingController;

  const trip: Trip = {
    id: 42,
    name: 'Goa Tour',
    destination: 'Goa',
    tripType: 'FRIENDS',
    startDate: '2026-12-10',
    endDate: '2026-12-14',
    travelerCount: 5,
    budget: 20000,
    status: 'UPCOMING',
    ownerId: 1,
    ownerName: 'Thiru',
    userRole: 'OWNER',
    createdAt: '2026-11-01T10:00:00',
    updatedAt: '2026-11-01T10:00:00'
  };

  const dashboard: TripDashboard = {
    tripId: 42,
    tripName: 'Goa Tour',
    destination: 'Goa',
    startDate: '2026-12-10',
    endDate: '2026-12-14',
    tripType: 'FRIENDS',
    travelerCount: 5,
    budget: 20000,
    totalExpenses: 0,
    remainingBudget: 20000,
    budgetUtilizationPercentage: 0,
    upcomingActivities: [],
    bookings: [],
    documentCount: 1,
    memberCount: 1
  };

  const members: TripMember[] = [
    {
      id: 1,
      tripId: 42,
      userId: 1,
      userName: 'Thiru',
      userEmail: 'thiru@example.com',
      role: 'OWNER',
      memberStatus: 'ACTIVE'
    }
  ];

  function respondToPendingRequests(): void {
    for (const request of http.match(() => true)) {
      const url = request.request.url;
      if (url.endsWith('/dashboard')) {
        request.flush(dashboard);
      } else if (url.includes('/weather')) {
        request.flush({
          destination: 'Goa',
          resolvedLocation: 'Goa',
          generatedAt: '2026-11-21T10:00:00Z',
          available: false,
          message: 'Weather becomes available 16 days before your trip starts.',
          days: []
        });
      } else if (url.endsWith('/members')) {
        request.flush(members);
      } else if (/\/trips\/42$/.test(url)) {
        request.flush(trip);
      } else {
        request.flush([]);
      }
    }
  }

  async function createComponent(queryParams: Record<string, string> = {}): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [TripDetailsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: '42' }),
              queryParamMap: convertToParamMap(queryParams)
            },
            queryParamMap: of(convertToParamMap(queryParams))
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TripDetailsComponent);
    http = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
    respondToPendingRequests();
    fixture.detectChanges();
    respondToPendingRequests();
    fixture.detectChanges();
  }

  describe('default view', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('opens on the Overview tab', () => {
      expect(fixture.componentInstance.activeTab).toBe('OVERVIEW');
    });

    it('renders the overview summary', () => {
      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('Total Budget');
      expect(text).toContain('Remaining');
    });

    it('does not render the Quick Actions card', () => {
      const element: HTMLElement = fixture.nativeElement;
      expect(element.querySelector('.quick-actions-card')).toBeNull();
      expect(element.querySelector('.quick-action-row')).toBeNull();
      expect(element.textContent).not.toContain('Quick Actions');
    });

    it('keeps the Trip Members card in the sidebar', () => {
      const element: HTMLElement = fixture.nativeElement;
      const membersCard = element.querySelector('.dashboard-sidebar .sidebar-members-card');
      expect(membersCard).not.toBeNull();
      expect(membersCard?.textContent).toContain('Trip Members');
    });

    it('does not render a Timeline tab or timeline view', () => {
      const element: HTMLElement = fixture.nativeElement;
      const tabLabels = Array.from(element.querySelectorAll('.details-tabs .tab-btn')).map(tab => tab.textContent?.trim());
      expect(tabLabels).not.toContain('Timeline');
      expect(element.querySelector('app-trip-timeline')).toBeNull();
    });

    it('does not render the Upcoming Itinerary card', () => {
      const element: HTMLElement = fixture.nativeElement;
      expect(element.querySelector('.itinerary-board')).toBeNull();
      expect(element.textContent).not.toContain('Upcoming Itinerary');
      expect(element.textContent).not.toContain("Today's Itinerary");
    });

    it('renders the journey hero with the destination', () => {
      const hero: HTMLElement | null = fixture.nativeElement.querySelector('.ov-hero');
      expect(hero).not.toBeNull();
      expect(hero?.querySelector('.ov-hero-title')?.textContent).toContain('Goa');
      expect(hero?.querySelector('.ov-journey-track')).not.toBeNull();
    });

    it('shows budget usage for the trip', () => {
      const budget: HTMLElement | null = fixture.nativeElement.querySelector('.ov-budget');
      expect(budget?.querySelector('.ov-pill')?.textContent?.trim()).toBe('0% used');
      expect(budget?.textContent).toContain('Per traveler');
    });

    it('opens the related tab from a stat tile', () => {
      const tiles = fixture.nativeElement.querySelectorAll('button.ov-stat') as NodeListOf<HTMLButtonElement>;
      const bookingsTile = Array.from(tiles).find(tile => tile.textContent?.includes('Bookings'));
      bookingsTile?.click();
      expect(fixture.componentInstance.activeTab).toBe('BOOKINGS');
    });

    it('shows offline travel and flight alerts in the Overview tab', () => {
      const overview: HTMLElement | null = fixture.nativeElement.querySelector('.dashboard-overview');
      expect(overview?.querySelector('app-offline-trip')).not.toBeNull();
      expect(overview?.querySelector('app-flight-alerts')).not.toBeNull();
    });
  });

  describe('journey and budget status', () => {
    const isoDay = (offset: number): string => {
      const date = new Date();
      date.setDate(date.getDate() + offset);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    };

    beforeEach(async () => {
      await createComponent();
    });

    it('counts down to an upcoming trip', () => {
      const component = fixture.componentInstance;
      component.trip = { ...trip, startDate: isoDay(5), endDate: isoDay(8) };
      expect(component.tripPhase).toBe('upcoming');
      expect(component.countdownValue).toBe('5');
      expect(component.countdownCaption).toBe('days to go');
      expect(component.tripProgressPercent).toBe(0);
    });

    it('shows the current day of an ongoing trip', () => {
      const component = fixture.componentInstance;
      component.trip = { ...trip, startDate: isoDay(-1), endDate: isoDay(1) };
      expect(component.tripPhase).toBe('ongoing');
      expect(component.countdownValue).toBe('Day 2');
      expect(component.countdownCaption).toBe('of 3 days');
      expect(component.tripProgressPercent).toBe(67);
    });

    it('marks past and cancelled trips', () => {
      const component = fixture.componentInstance;
      component.trip = { ...trip, startDate: isoDay(-6), endDate: isoDay(-3) };
      expect(component.tripPhase).toBe('completed');
      expect(component.tripProgressPercent).toBe(100);

      component.trip = { ...trip, status: 'CANCELLED' };
      expect(component.tripPhase).toBe('cancelled');
    });

    it('flags budgets that are close to or over the limit', () => {
      const component = fixture.componentInstance;
      component.dashboard = { ...dashboard, budget: 10000, totalExpenses: 8500 };
      expect(component.budgetTone).toBe('watch');
      expect(component.budgetUsedLabel).toBe('85% used');

      component.dashboard = { ...dashboard, budget: 10000, totalExpenses: 12500 };
      expect(component.budgetTone).toBe('over');
      expect(component.budgetUsedLabel).toBe('25% over budget');
      expect(component.budgetMeterWidth).toBe(100);

      component.dashboard = { ...dashboard, budget: 0, totalExpenses: 0 };
      expect(component.budgetUsedLabel).toBe('No budget set');
    });
  });

  describe('legacy timeline link', () => {
    beforeEach(async () => {
      await createComponent({ tab: 'TIMELINE' });
    });

    it('opens the Overview tab for ?tab=TIMELINE', () => {
      expect(fixture.componentInstance.activeTab).toBe('OVERVIEW');
      expect(fixture.nativeElement.querySelector('.dashboard-overview')).not.toBeNull();
    });
  });

  describe('bookings tab', () => {
    beforeEach(async () => {
      await createComponent({ tab: 'BOOKINGS' });
    });

    it('deletes a booking only after confirmation', () => {
      const component = fixture.componentInstance;
      component.bookings = [{
        id: 7, tripId: 42, bookingType: 'TRANSPORT', transportType: 'TRAIN', providerName: 'Rail Express Sandbox',
        amount: 1040, status: 'CANCELLED', departure: 'chennai', arrival: 'Ooty'
      } as any];
      fixture.detectChanges();
      const card = (): HTMLElement | null => fixture.nativeElement.querySelector('.booking-card');
      (card()!.querySelector('.delete-booking-btn') as HTMLButtonElement).click();
      fixture.detectChanges();
      http.expectNone(r => r.method === 'DELETE');
      expect(card()!.textContent).toContain('Delete this booking permanently?');
      const confirm = Array.from(card()!.querySelectorAll('.delete-confirm button')).find(b => b.textContent!.includes('Yes, delete')) as HTMLButtonElement;
      confirm.click();
      http.expectOne(r => r.method === 'DELETE' && r.url.endsWith('/trips/42/bookings/7')).flush({ message: 'Booking deleted successfully' });
      respondToPendingRequests();
      fixture.detectChanges();
      expect(card()).toBeNull();
      expect(component.bookings.length).toBe(0);
    });
  });
});
