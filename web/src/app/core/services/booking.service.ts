import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Booking,
  BookingSearchRequest,
  BookingSearchResponse,
  BookNowRequest,
  BookNowResponse,
  CancelBookingResponse,
  CreateBookingRequest,
  UpdateBookingRequest
} from '../models/booking.model';

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getBookings(tripId: number): Observable<Booking[]> {
    return this.http.get<Booking[]>(`${this.baseUrl}/trips/${tripId}/bookings`);
  }

  getBookingById(tripId: number, bookingId: number): Observable<Booking> {
    return this.http.get<Booking>(`${this.baseUrl}/trips/${tripId}/bookings/${bookingId}`);
  }

  createBooking(tripId: number, request: CreateBookingRequest): Observable<Booking> {
    return this.http.post<Booking>(`${this.baseUrl}/trips/${tripId}/bookings`, request);
  }

  searchBookingOffers(
    tripId: number,
    request: BookingSearchRequest
  ): Observable<BookingSearchResponse> {
    return this.http.post<BookingSearchResponse>(
      `${this.baseUrl}/trips/${tripId}/bookings/search`,
      request
    );
  }

  bookNow(tripId: number, request: BookNowRequest): Observable<BookNowResponse> {
    return this.http.post<BookNowResponse>(
      `${this.baseUrl}/trips/${tripId}/bookings/book-now`,
      request
    );
  }

  cancelBooking(
    tripId: number,
    bookingId: number,
    reason?: string
  ): Observable<CancelBookingResponse> {
    return this.http.patch<CancelBookingResponse>(
      `${this.baseUrl}/trips/${tripId}/bookings/${bookingId}/cancel`,
      { reason: reason || undefined }
    );
  }

  updateBooking(tripId: number, bookingId: number, request: UpdateBookingRequest): Observable<Booking> {
    return this.http.put<Booking>(`${this.baseUrl}/trips/${tripId}/bookings/${bookingId}`, request);
  }

  deleteBooking(tripId: number, bookingId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/trips/${tripId}/bookings/${bookingId}`);
  }
}
