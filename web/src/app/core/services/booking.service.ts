import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Booking, CreateBookingRequest, UpdateBookingRequest } from '../models/booking.model';

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

  updateBooking(tripId: number, bookingId: number, request: UpdateBookingRequest): Observable<Booking> {
    return this.http.put<Booking>(`${this.baseUrl}/trips/${tripId}/bookings/${bookingId}`, request);
  }

  deleteBooking(tripId: number, bookingId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/trips/${tripId}/bookings/${bookingId}`);
  }
}
