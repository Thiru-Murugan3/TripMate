import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Trip, CreateTripRequest, UpdateTripRequest } from '../models/trip.model';

@Injectable({
  providedIn: 'root'
})
export class TripService {
  private readonly apiUrl = `${environment.apiUrl}/trips`;

  constructor(private http: HttpClient) {}

  getMyTrips(): Observable<Trip[]> {
    return this.http.get<Trip[]>(this.apiUrl);
  }

  getTripById(id: number): Observable<Trip> {
    return this.http.get<Trip>(`${this.apiUrl}/${id}`);
  }

  createTrip(request: CreateTripRequest): Observable<Trip> {
    return this.http.post<Trip>(this.apiUrl, request);
  }

  updateTrip(id: number, request: UpdateTripRequest): Observable<Trip> {
    return this.http.put<Trip>(`${this.apiUrl}/${id}`, request);
  }

  deleteTrip(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}
