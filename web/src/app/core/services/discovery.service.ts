import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  DestinationDiscoveryResponse,
  DiscoveryCategory
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
    category: DiscoveryCategory
  ): Observable<DestinationDiscoveryResponse> {
    const params = new HttpParams()
      .set('destination', destination.trim())
      .set('radiusKm', radiusKm)
      .set('category', category);

    return this.http.get<DestinationDiscoveryResponse>(this.apiUrl, { params });
  }
}
