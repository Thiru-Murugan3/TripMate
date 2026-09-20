import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
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

  function configure(
    getMyTripsResult: Observable<Trip[]> = of([plannedTrip]),
    queryParams: Record<string, string> = {}
  ) {
    const discoveryService = jasmine.createSpyObj<DiscoveryService>('DiscoveryService', [
      'discoverPlaces',
      'getSuggestions',
      'reverseGeocode',
      'getPlace'
    ]);
    discoveryService.getSuggestions.and.returnValue(of([]));
    discoveryService.getPlace.and.returnValue(of(discoveredPlace));
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
    itineraryService.getItinerary.and.returnValue(of({
      tripId: plannedTrip.id,
      totalDays: 0,
      totalActivities: 0,
      totalEstimatedCost: 0,
      days: []
    }));
    itineraryService.createDay.and.returnValue(of({
      id: 700,
      tripId: plannedTrip.id,
      dayNumber: 1,
      dayDate: plannedTrip.startDate,
      items: []
    }));
    itineraryService.createItem.and.returnValue(of({
      id: 701,
      dayId: 700,
      tripId: plannedTrip.id,
      placeId: createdPlace.id,
      title: discoveredPlace.name
    }));

    TestBed.configureTestingModule({
      imports: [DestinationDiscoveryComponent],
      providers: [
        { provide: DiscoveryService, useValue: discoveryService },
        { provide: PlaceService, useValue: placeService },
        { provide: ItineraryService, useValue: itineraryService },
        { provide: TripService, useValue: tripService },
        { provide: ActivatedRoute, useValue: { queryParams: of(queryParams) } }
      ]
    });

    return { discoveryService, placeService, itineraryService, tripService };
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

  it('keeps Viewer-only catalogue access read-only', () => {
    configure(of([viewerTrip]));

    const fixture = TestBed.createComponent(DestinationDiscoveryComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.editableTrips).toEqual([]);
    expect(fixture.componentInstance.canSelectPlaces).toBeFalse();
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
      'ALL',
      jasmine.objectContaining({
        itemType: 'ALL',
        priceStatus: 'ALL',
        sort: 'RELEVANCE'
      })
    );
  });

  it('runs a global-navbar query-parameter search', () => {
    const { discoveryService } = configure(of([plannedTrip]), { search: 'Goa' });

    const fixture = TestBed.createComponent(DestinationDiscoveryComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.searchDestination).toBe('Goa');
    expect(discoveryService.discoverPlaces).toHaveBeenCalledWith(
      'Goa', 25, 'ALL', jasmine.objectContaining({ page: 0, size: 24 })
    );
  });

  it('saves and adds a catalogue result directly to an itinerary day', async () => {
    const { itineraryService } = configure();
    const fixture = TestBed.createComponent(DestinationDiscoveryComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.result = discoveryResponse;
    component.selectTrip(plannedTrip.id);
    await fixture.whenStable();

    await component.addPlaceToItinerary(discoveredPlace);

    expect(itineraryService.createDay).toHaveBeenCalledWith(
      plannedTrip.id,
      jasmine.objectContaining({ dayNumber: 1 })
    );
    expect(itineraryService.createItem).toHaveBeenCalledWith(
      plannedTrip.id,
      700,
      jasmine.objectContaining({ placeId: createdPlace.id, title: discoveredPlace.name })
    );
  });

  it('renders responsive catalogue controls and all item-type tabs', () => {
    configure();
    const fixture = TestBed.createComponent(DestinationDiscoveryComponent);
    fixture.detectChanges();
    fixture.componentInstance.result = discoveryResponse;
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('.mobile-filter-toggle')).not.toBeNull();
    expect(element.querySelectorAll('.type-tabs button').length).toBe(7);
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
      'ALL',
      jasmine.objectContaining({
        itemType: 'ALL',
        priceStatus: 'ALL',
        sort: 'RELEVANCE'
      })
    );
  });

  it('does not label an unknown price as free', () => {
    configure();

    const fixture = TestBed.createComponent(DestinationDiscoveryComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.formatPlacePrice({
      ...discoveredPlace,
      estimatedCostPerPerson: undefined,
      priceStatus: 'UNKNOWN'
    })).toBe('Price not verified — check official website');
  });

  it('labels only source-declared free entry as free', () => {
    configure();

    const fixture = TestBed.createComponent(DestinationDiscoveryComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.formatPlacePrice({
      ...discoveredPlace,
      estimatedCostPerPerson: 0,
      priceStatus: 'FREE'
    })).toBe('Entry: Free');
  });

  it('uses a neutral placeholder when no exact-place image is available', () => {
    configure();

    const fixture = TestBed.createComponent(DestinationDiscoveryComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.getPlaceImage(discoveredPlace)).toBe('/place-placeholder.svg');
    expect(fixture.componentInstance.getPlaceImage({
      ...discoveredPlace,
      imageUrl: 'https://example.com/generic.jpg',
      imageExact: false
    })).toBe('/place-placeholder.svg');
  });
});
