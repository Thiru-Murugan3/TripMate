import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  DestinationDiscoveryResponse,
  DiscoveryCategory,
  DiscoverySearchFilters,
  DiscoverySuggestion,
  DiscoveredPlace
} from '../models/discovery.model';

@Injectable({
  providedIn: 'root'
})
export class DiscoveryService {
  private readonly apiUrl = `${environment.apiUrl}/discovery/places`;

  constructor(private http: HttpClient) {}

  discoverPlaces(
    destination: string,
    radiusKm: number,
    category: DiscoveryCategory,
    filters: DiscoverySearchFilters = {}
  ): Observable<DestinationDiscoveryResponse> {
    let params = new HttpParams()
      .set('destination', destination.trim())
      .set('radiusKm', radiusKm)
      .set('category', category);

    if (filters.itemType && filters.itemType !== 'ALL') params = params.set('itemType', filters.itemType);
    if (filters.subcategory) params = params.set('subcategory', filters.subcategory);
    if (filters.minPrice != null) params = params.set('minPrice', filters.minPrice);
    if (filters.maxPrice != null) params = params.set('maxPrice', filters.maxPrice);
    if (filters.priceStatus && filters.priceStatus !== 'ALL') params = params.set('priceStatus', filters.priceStatus);
    if (filters.openNow) params = params.set('openNow', true);
    if (filters.familyFriendly) params = params.set('familyFriendly', true);
    if (filters.difficulty) params = params.set('difficulty', filters.difficulty);
    if (filters.minDuration != null) params = params.set('minDuration', filters.minDuration);
    if (filters.maxDuration != null) params = params.set('maxDuration', filters.maxDuration);
    if (filters.minRating != null) params = params.set('minRating', filters.minRating);
    if (filters.sort) params = params.set('sort', filters.sort);
    params = params.set('page', filters.page ?? 0).set('size', filters.size ?? 100);

    return this.http.get<DestinationDiscoveryResponse>(this.apiUrl, { params });
  }

  getPlace(externalId: string): Observable<DiscoveredPlace> {
    return this.http.get<DiscoveredPlace>(`${this.apiUrl}/${encodeURIComponent(externalId)}`);
  }

  getSuggestions(query: string, limit = 6): Observable<DiscoverySuggestion[]> {
    const params = new HttpParams().set('q', query.trim()).set('limit', limit);
    return this.http.get<DiscoverySuggestion[]>(`${environment.apiUrl}/discovery/search-suggestions`, { params });
  }

  reverseGeocode(latitude: number, longitude: number): Observable<DiscoverySuggestion> {
    const params = new HttpParams().set('latitude', latitude).set('longitude', longitude);
    return this.http.get<DiscoverySuggestion>(`${environment.apiUrl}/discovery/reverse-geocode`, { params });
  }
}
