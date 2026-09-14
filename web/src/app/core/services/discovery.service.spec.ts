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
});
