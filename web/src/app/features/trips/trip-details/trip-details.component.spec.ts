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

  beforeEach(async () => {
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
              queryParamMap: convertToParamMap({ tab: 'OVERVIEW' })
            },
            queryParamMap: of(convertToParamMap({ tab: 'OVERVIEW' }))
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
});
