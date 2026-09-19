import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  DestinationDiscoveryResponse,
  DiscoveryCategory,
  DiscoverySearchFilters
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
    if (filters.minPrice != null) params = params.set('minPrice', filters.minPrice);
    if (filters.maxPrice != null) params = params.set('maxPrice', filters.maxPrice);
    if (filters.priceStatus && filters.priceStatus !== 'ALL') params = params.set('priceStatus', filters.priceStatus);
    if (filters.sort) params = params.set('sort', filters.sort);
    params = params.set('page', filters.page ?? 0).set('size', filters.size ?? 100);

    return this.http.get<DestinationDiscoveryResponse>(this.apiUrl, { params });
  }
}
