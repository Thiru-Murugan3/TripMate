import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { DiscoveryService } from './discovery.service';

describe('DiscoveryService', () => {
  let service: DiscoveryService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DiscoveryService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(DiscoveryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('requests destination tourist places with radius and category', () => {
    service.discoverPlaces('Ooty, Tamil Nadu', 25, 'ALL').subscribe((response) => {
      expect(response.resultCount).toBe(1);
      expect(response.places[0].name).toBe('Doddabetta Peak');
    });

    const request = httpMock.expectOne((req) =>
      req.url === `${environment.apiUrl}/discovery/places`
      && req.params.get('destination') === 'Ooty, Tamil Nadu'
      && req.params.get('radiusKm') === '25'
      && req.params.get('category') === 'ALL'
    );

    expect(request.request.method).toBe('GET');

    request.flush({
      query: 'Ooty, Tamil Nadu',
      resolvedDestination: 'Ooty, Tamil Nadu, India',
      latitude: 11.4064,
      longitude: 76.6932,
      radiusKm: 25,
      category: 'ALL',
      provider: 'OpenStreetMap',
      attribution: '© OpenStreetMap contributors',
      resultCount: 1,
      places: [
        {
          externalId: 'osm:node:1',
          name: 'Doddabetta Peak',
          category: 'VIEWPOINT',
          latitude: 11.4008,
          longitude: 76.7358,
          distanceKm: 4.8,
          suggestedVisitMinutes: 60,
          saveCategory: 'ATTRACTION'
        }
      ]
    });
  });

  it('sends catalogue filters, sorting and pagination', () => {
    service.discoverPlaces('Jaipur', 50, 'HISTORICAL', {
      itemType: 'PLACE', subcategory: 'fort', minPrice: 20, maxPrice: 500,
      priceStatus: 'VERIFIED', openNow: true, familyFriendly: true,
      difficulty: 'EASY', maxDuration: 180, minRating: 4,
      sort: 'RECENTLY_VERIFIED', page: 2, size: 24
    }).subscribe();

    const request = httpMock.expectOne((req) => req.url === `${environment.apiUrl}/discovery/places`);
    expect(request.request.params.get('itemType')).toBe('PLACE');
    expect(request.request.params.get('subcategory')).toBe('fort');
    expect(request.request.params.get('minPrice')).toBe('20');
    expect(request.request.params.get('maxPrice')).toBe('500');
    expect(request.request.params.get('priceStatus')).toBe('VERIFIED');
    expect(request.request.params.get('openNow')).toBe('true');
    expect(request.request.params.get('familyFriendly')).toBe('true');
    expect(request.request.params.get('sort')).toBe('RECENTLY_VERIFIED');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('size')).toBe('24');
    request.flush({ places: [], resultCount: 0 });
  });

  it('requests India destination suggestions and reverse geocoding', () => {
    service.getSuggestions('Kodai').subscribe();
    const suggestions = httpMock.expectOne((req) => req.url.endsWith('/discovery/search-suggestions'));
    expect(suggestions.request.params.get('q')).toBe('Kodai');
    expect(suggestions.request.params.get('limit')).toBe('6');
    suggestions.flush([]);

    service.reverseGeocode(13.08, 80.27).subscribe();
    const reverse = httpMock.expectOne((req) => req.url.endsWith('/discovery/reverse-geocode'));
    expect(reverse.request.params.get('latitude')).toBe('13.08');
    expect(reverse.request.params.get('longitude')).toBe('80.27');
    reverse.flush({ label: 'Chennai, Tamil Nadu, India' });
  });

  it('encodes provider identifiers in detail requests', () => {
    service.getPlace('osm:node:123').subscribe();
    const request = httpMock.expectOne(`${environment.apiUrl}/discovery/places/osm%3Anode%3A123`);
    expect(request.request.method).toBe('GET');
    request.flush({ externalId: 'osm:node:123' });
  });
});
