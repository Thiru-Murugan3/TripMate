import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { DestinationDiscoveryComponent } from './destination-discovery.component';
import { DiscoveryService } from '../../core/services/discovery.service';
import { ItineraryService } from '../../core/services/itinerary.service';
import { PlaceService } from '../../core/services/place.service';
import { TripService } from '../../core/services/trip.service';
import { Trip } from '../../core/models/trip.model';
import { DiscoveredPlace, DestinationDiscoveryResponse } from '../../core/models/discovery.model';
import { Place } from '../../core/models/place.model';

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

  const viewerTrip: Trip = {
    ...plannedTrip,
    id: 11,
    name: 'Shared Read Only',
    destination: 'Coorg, Karnataka',
    userRole: 'VIEWER'
  };

  const discoveredPlace: DiscoveredPlace = {
    externalId: 'osm:node:123',
    name: 'Sample View Point',
    category: 'VIEWPOINT',
    latitude: 11.4,
    longitude: 76.7,
    distanceKm: 3.4,
    suggestedVisitMinutes: 60,
    description: 'Scenic tourist viewpoint',
    saveCategory: 'ATTRACTION'
  };

  const discoveryResponse: DestinationDiscoveryResponse = {
    query: 'Any Destination',
    resolvedDestination: 'Any Destination, India',
    latitude: 11.4,
    longitude: 76.7,
    radiusKm: 25,
    category: 'ALL',
    provider: 'OpenStreetMap',
    attribution: '© OpenStreetMap contributors',
    resultCount: 1,
    places: [discoveredPlace]
  };

  const createdPlace: Place = {
    id: 501,
    tripId: plannedTrip.id,
    name: discoveredPlace.name,
    category: 'ATTRACTION',
    latitude: discoveredPlace.latitude,
    longitude: discoveredPlace.longitude,
    estimatedCost: 0
  };

  function configure(getMyTripsResult: Observable<Trip[]> = of([plannedTrip])) {
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
    placeService.createPlace.and.returnValue(of(createdPlace));
    discoveryService.discoverPlaces.and.returnValue(of(discoveryResponse));

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

  it('offers only Owner and Editor trips as save targets', () => {
    configure(of([plannedTrip, viewerTrip]));

    const fixture = TestBed.createComponent(DestinationDiscoveryComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.editableTrips.map((trip) => trip.id)).toEqual([
      plannedTrip.id
    ]);
  });

  it('lets the user select tourist places before choosing a trip', () => {
    configure();

    const fixture = TestBed.createComponent(DestinationDiscoveryComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.result = discoveryResponse;
    component.toggleSelection(discoveredPlace);

    expect(component.activeTripId).toBe(0);
    expect(component.isSelected(discoveredPlace)).toBeTrue();
    expect(component.selectedCount).toBe(1);
  });

  it('queues Add to Trip when browsing without a selected trip', async () => {
    const { placeService } = configure();

    const fixture = TestBed.createComponent(DestinationDiscoveryComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.result = discoveryResponse;

    await component.addPlace(discoveredPlace);

    expect(component.isSelected(discoveredPlace)).toBeTrue();
    expect(component.successMessage).toContain('Choose a trip');
    expect(placeService.createPlace).not.toHaveBeenCalled();
  });

  it('preserves selected places when the user chooses the save target', async () => {
    configure();

    const fixture = TestBed.createComponent(DestinationDiscoveryComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.result = discoveryResponse;
    component.toggleSelection(discoveredPlace);

    component.selectTrip(plannedTrip.id);
    await fixture.whenStable();

    expect(component.activeTripId).toBe(plannedTrip.id);
    expect(component.isSelected(discoveredPlace)).toBeTrue();
  });

  it('saves selected casual-search places after an editable trip is chosen', async () => {
    const { placeService } = configure();

    const fixture = TestBed.createComponent(DestinationDiscoveryComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.result = discoveryResponse;
    component.toggleSelection(discoveredPlace);
    component.selectTrip(plannedTrip.id);
    await fixture.whenStable();

    await component.saveSelected(false);

    expect(placeService.createPlace).toHaveBeenCalledWith(
      plannedTrip.id,
      jasmine.objectContaining({
        name: discoveredPlace.name,
        category: 'ATTRACTION',
        latitude: discoveredPlace.latitude,
        longitude: discoveredPlace.longitude
      })
    );
    expect(component.selectedCount).toBe(0);
    expect(component.successMessage).toContain('saved to this trip');
  });

  it('adds a single card directly when an editable trip is already selected', async () => {
    const { placeService } = configure();

    const fixture = TestBed.createComponent(DestinationDiscoveryComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.result = discoveryResponse;
    component.selectTrip(plannedTrip.id);
    await fixture.whenStable();

    await component.addPlace(discoveredPlace);

    expect(placeService.createPlace).toHaveBeenCalledTimes(1);
    expect(component.savedPlaces.some((place) => place.id === createdPlace.id)).toBeTrue();
    expect(component.successMessage).toContain('added to');
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
