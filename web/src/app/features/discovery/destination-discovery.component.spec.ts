import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { IndiaCatalogueService } from '../india-catalogue/india-catalogue.service';
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
        provideRouter([]),
        { provide: IndiaCatalogueService, useValue: {
          index: () => of({ snapshot: '2026-10-14', total: 1, states: [{name:'Goa',file:'goa.json',count:1}] }),
          state: () => of([{place_id:'goa-one',name:'Baga Beach',state_ut:'Goa',district:null,
            tourism_destination:'Goa',latitude:null,longitude:null,source_provider:'Tourism source',
            source_url:'https://example.com',source_checked_at:'2026-10-14',fees:[],photo:null}])
        } },
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

  it('automatically saves selected casual-search places after an editable trip is chosen', async () => {
    const { placeService } = configure();

    const fixture = TestBed.createComponent(DestinationDiscoveryComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.result = discoveryResponse;
    component.toggleSelection(discoveredPlace);
    await component.selectTrip(plannedTrip.id);

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
    expect(component.successMessage).toContain('saved and added to the itinerary');
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
  it('saves selections from multiple pages and keeps them across sorting', async () => {
    const { discoveryService, placeService } = configure();
    const fixture = TestBed.createComponent(DestinationDiscoveryComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.searchDestination = 'Chennai';
    component.discover();
    await component.toggleSelection(discoveredPlace);
    const second = { ...discoveredPlace, externalId: 'osm:node:456', name: 'Second place' };
    discoveryService.discoverPlaces.and.returnValue(of({ ...discoveryResponse, page: 1, places: [second] }));
    component.discover(1);
    await component.toggleSelection(second);
    component.sortOrder = 'PRICE_LOW';
    component.discover(0);
    expect(component.selectedCount).toBe(2);
    component.activeTripId = plannedTrip.id;
    await component.saveSelected(false);
    expect(placeService.createPlace.calls.allArgs().map(args => args[1].name))
      .toEqual([discoveredPlace.name, second.name]);
    expect(component.selectedCount).toBe(0);
  });

  it('removes deselected entries and resets the basket for a different city', async () => {
    configure();
    const fixture = TestBed.createComponent(DestinationDiscoveryComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.searchDestination = 'Chennai';
    component.discover();
    await component.toggleSelection(discoveredPlace);
    await component.toggleSelection(discoveredPlace);
    expect(component.selectedCount).toBe(0);
    await component.toggleSelection(discoveredPlace);
    component.searchDestination = 'Jaipur';
    component.discover();
    expect(component.selectedCount).toBe(0);
  });

  it('renders linked credits for each displayed image and rejects uncredited images', () => {
    configure();
    const fixture = TestBed.createComponent(DestinationDiscoveryComponent);
    fixture.detectChanges();
    const image = { url: 'https://images.example/fort.jpg', sourcePage: 'https://commons.example/fort',
      sourceName: 'Wikimedia Commons', author: 'Photographer', license: 'CC BY-SA 4.0',
      attribution: 'Photographer', exact: true, primary: true };
    const place = { ...discoveredPlace, imageGallery: [image, { ...image, url: 'https://images.example/uncredited.jpg', license: '' }] };
    fixture.componentInstance.result = { ...discoveryResponse, places: [place] };
    fixture.componentInstance.selectedDetail = place;
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.image-credit a')?.getAttribute('href')).toBe(image.sourcePage);
    expect(element.querySelector('figcaption')?.textContent).toContain('CC BY-SA 4.0');
    expect(element.querySelectorAll('.detail-gallery figure').length).toBe(1);
    expect(fixture.componentInstance.getPlaceImage(place)).toBe(image.url);
  });

  it('formats the actual price currency instead of always showing rupees', () => {
    configure();
    const fixture = TestBed.createComponent(DestinationDiscoveryComponent);
    expect(fixture.componentInstance.formatPlacePrice({ ...discoveredPlace,
      estimatedCostPerPerson: 50, priceStatus: 'VERIFIED', priceType: 'PER_PERSON', currency: 'USD'
    })).toContain('$50');
  });

  it('shows catalogue places inside trip Explore even when the live provider fails', () => {
    const { discoveryService } = configure();
    discoveryService.discoverPlaces.and.returnValue(throwError(() => new Error('provider unavailable')));
    const fixture = TestBed.createComponent(DestinationDiscoveryComponent);
    fixture.componentInstance.tripId = plannedTrip.id;
    fixture.componentInstance.destination = 'Goa';
    fixture.detectChanges();
    expect(fixture.componentInstance.catalogueDestination).toBe('Goa');
    expect(fixture.nativeElement.textContent).toContain('Baga Beach');
    expect(fixture.nativeElement.textContent).toContain('Entry fee not verified');
    expect(fixture.nativeElement.querySelector('.results-container')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/explore/india"]')).not.toBeNull();
  });

  it('shows only actionable discovery cards when nearby results are available', () => {
    configure();
    const fixture = TestBed.createComponent(DestinationDiscoveryComponent);
    fixture.componentInstance.tripId = plannedTrip.id;
    fixture.componentInstance.destination = 'Goa';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-india-catalogue')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.results-container').length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('.place-card').length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Sample View Point');
  });

  it('uses one catalogue section when discovery succeeds without results', () => {
    const { discoveryService } = configure();
    discoveryService.discoverPlaces.and.returnValue(of({...discoveryResponse,places:[],resultCount:0}));
    const fixture = TestBed.createComponent(DestinationDiscoveryComponent);
    fixture.componentInstance.tripId = plannedTrip.id;
    fixture.componentInstance.destination = 'Goa';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('app-india-catalogue').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.results-container')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Baga Beach');
  });

  it('hides previous cards and the fallback while the next search loads', () => {
    const { discoveryService } = configure();
    const fixture = TestBed.createComponent(DestinationDiscoveryComponent);
    fixture.componentInstance.tripId = plannedTrip.id;
    fixture.componentInstance.destination = 'Goa';
    fixture.detectChanges();
    const pending = new Subject<DestinationDiscoveryResponse>();
    discoveryService.discoverPlaces.and.returnValue(pending);
    fixture.componentInstance.discover(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.results-container')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-india-catalogue')).toBeNull();
    pending.next({...discoveryResponse,places:[],resultCount:0}); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('app-india-catalogue').length).toBe(1);
    discoveryService.discoverPlaces.and.returnValue(of(discoveryResponse));
    fixture.componentInstance.discover(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-india-catalogue')).toBeNull();
    expect(fixture.nativeElement.querySelector('.results-container')).not.toBeNull();
  });

});
