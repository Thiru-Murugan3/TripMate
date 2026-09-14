import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CreatePlaceRequest,
  Place,
  UpdatePlaceRequest
} from '../models/place.model';

@Injectable({
  providedIn: 'root'
})
export class PlaceService {
  private readonly baseUrl = `${environment.apiUrl}/trips`;

  constructor(private http: HttpClient) {}

  getPlaces(tripId: number): Observable<Place[]> {
    return this.http.get<Place[]>(`${this.baseUrl}/${tripId}/places`);
  }

  getPlaceById(tripId: number, placeId: number): Observable<Place> {
    return this.http.get<Place>(
      `${this.baseUrl}/${tripId}/places/${placeId}`
    );
  }

  createPlace(tripId: number, request: CreatePlaceRequest): Observable<Place> {
    return this.http.post<Place>(
      `${this.baseUrl}/${tripId}/places`,
      request
    );
  }

  updatePlace(
    tripId: number,
    placeId: number,
    request: UpdatePlaceRequest
  ): Observable<Place> {
    return this.http.put<Place>(
      `${this.baseUrl}/${tripId}/places/${placeId}`,
      request
    );
  }

  deletePlace(tripId: number, placeId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.baseUrl}/${tripId}/places/${placeId}`
    );
  }
}
