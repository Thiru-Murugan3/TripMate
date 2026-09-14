import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CreateItineraryDayRequest,
  CreateItineraryItemRequest,
  ItineraryDay,
  ItineraryItem,
  ReorderItineraryRequest,
  TripItinerary,
  UpdateItineraryDayRequest,
  UpdateItineraryItemRequest
} from '../models/itinerary.model';

@Injectable({
  providedIn: 'root'
})
export class ItineraryService {
  private readonly baseUrl = `${environment.apiUrl}/trips`;

  constructor(private http: HttpClient) {}

  getItinerary(tripId: number): Observable<TripItinerary> {
    return this.http.get<TripItinerary>(
      `${this.baseUrl}/${tripId}/itinerary`
    );
  }

  createDay(
    tripId: number,
    request: CreateItineraryDayRequest
  ): Observable<ItineraryDay> {
    return this.http.post<ItineraryDay>(
      `${this.baseUrl}/${tripId}/itinerary/days`,
      request
    );
  }

  updateDay(
    tripId: number,
    dayId: number,
    request: UpdateItineraryDayRequest
  ): Observable<ItineraryDay> {
    return this.http.put<ItineraryDay>(
      `${this.baseUrl}/${tripId}/itinerary/days/${dayId}`,
      request
    );
  }

  deleteDay(tripId: number, dayId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.baseUrl}/${tripId}/itinerary/days/${dayId}`
    );
  }

  createItem(
    tripId: number,
    dayId: number,
    request: CreateItineraryItemRequest
  ): Observable<ItineraryItem> {
    return this.http.post<ItineraryItem>(
      `${this.baseUrl}/${tripId}/itinerary/days/${dayId}/items`,
      request
    );
  }

  updateItem(
    tripId: number,
    itemId: number,
    request: UpdateItineraryItemRequest
  ): Observable<ItineraryItem> {
    return this.http.put<ItineraryItem>(
      `${this.baseUrl}/${tripId}/itinerary/items/${itemId}`,
      request
    );
  }

  deleteItem(tripId: number, itemId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.baseUrl}/${tripId}/itinerary/items/${itemId}`
    );
  }

  reorder(
    tripId: number,
    request: ReorderItineraryRequest
  ): Observable<TripItinerary> {
    return this.http.put<TripItinerary>(
      `${this.baseUrl}/${tripId}/itinerary/reorder`,
      request
    );
  }
}
