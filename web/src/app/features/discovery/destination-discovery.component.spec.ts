import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { DestinationDiscoveryComponent } from './destination-discovery.component';
import { DiscoveryService } from '../../core/services/discovery.service';
import { ItineraryService } from '../../core/services/itinerary.service';
import { PlaceService } from '../../core/services/place.service';
import { TripService } from '../../core/services/trip.service';
import { Trip } from '../../core/models/trip.model';

describe('DestinationDiscoveryComponent', () => {
  const plannedTrip: Trip = {
    id: 10,
    name: 'Munnar Holiday',
    destination: 'Munnar, Kerala',
    tripType: 'FAMILY',
    startDate: '2026-10-10',
    endDate: '2026-10-12',
    travelerCount: 2,
    budget: 20000,
    status: 'UPCOMING',
    ownerId: 1,
    ownerName: 'Owner',
    userRole: 'OWNER',
    createdAt: '2026-09-14T00:00:00',
    updatedAt: '2026-09-14T00:00:00'
  };

  function configure(getMyTripsResult = of([plannedTrip])) {
    const discoveryService = jasmine.createSpyObj<DiscoveryService>('DiscoveryService', ['discoverPlaces']);
    const placeService = jasmine.createSpyObj<PlaceService>('PlaceService', ['getPlaces', 'createPlace']);
    const itineraryService = jasmine.createSpyObj<ItineraryService>('ItineraryService', [
      'getItinerary',
      'createDay',
      'createItem'
    ]);
    const tripService = jasmine.createSpyObj<TripService>('TripService', ['getMyTrips']);

    tripService.getMyTrips.and.returnValue(getMyTripsResult);
    placeService.getPlaces.and.returnValue(of([]));
    discoveryService.discoverPlaces.and.returnValue(of({
      query: 'Jaipur, Rajasthan',
      resolvedDestination: 'Jaipur, Rajasthan, India',
      latitude: 26.9124,
      longitude: 75.7873,
      radiusKm: 25,
      category: 'ALL',
      provider: 'OpenStreetMap',
      attribution: '© OpenStreetMap contributors',
      resultCount: 0,
      places: []
    }));

    TestBed.configureTestingModule({
      imports: [DestinationDiscoveryComponent],
      providers: [
        { provide: DiscoveryService, useValue: discoveryService },
        { provide: PlaceService, useValue: placeService },
        { provide: ItineraryService, useValue: itineraryService },
        { provide: TripService, useValue: tripService }
      ]
    });

    return { discoveryService, placeService, tripService };
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('starts global Explore in browse-only mode even when planned trips exist', () => {
    configure();

    const fixture = TestBed.createComponent(DestinationDiscoveryComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.activeTripId).toBe(0);
    expect(component.searchDestination).toBe('');
    expect(component.availableTrips.length).toBe(1);
  });

  it('selecting a trip changes only the save target and does not overwrite casual search', async () => {
    const { discoveryService } = configure();

    const fixture = TestBed.createComponent(DestinationDiscoveryComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.searchDestination = 'Jaipur, Rajasthan';
    component.selectTrip(plannedTrip.id);
    await fixture.whenStable();

    expect(component.activeTripId).toBe(plannedTrip.id);
    expect(component.searchDestination).toBe('Jaipur, Rajasthan');
    expect(discoveryService.discoverPlaces).not.toHaveBeenCalled();
  });

  it('can search any destination without selecting or loading a planned trip', () => {
    const { discoveryService } = configure(
      throwError(() => new Error('Trips unavailable'))
    );

    const fixture = TestBed.createComponent(DestinationDiscoveryComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.searchDestination = 'Jaipur, Rajasthan';
    component.radiusKm = 25;
    component.category = 'ALL';
    component.discover();

    expect(component.activeTripId).toBe(0);
    expect(discoveryService.discoverPlaces).toHaveBeenCalledWith(
      'Jaipur, Rajasthan',
      25,
      'ALL'
    );
  });

  it('uses a trip destination only when the user explicitly asks for it', () => {
    const { discoveryService } = configure();

    const fixture = TestBed.createComponent(DestinationDiscoveryComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.searchDestination = 'Goa';
    component.useTripDestination(plannedTrip);

    expect(component.searchDestination).toBe('Munnar, Kerala');
    expect(discoveryService.discoverPlaces).toHaveBeenCalledWith(
      'Munnar, Kerala',
      25,
      'ALL'
    );
  });
});
