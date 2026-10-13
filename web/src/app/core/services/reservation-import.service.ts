import { Booking, CreateBookingRequest } from '../models/booking.model';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ReservationEmailImport,
  ReservationImportAddress
} from '../models/reservation-import.model';

@Injectable({ providedIn: 'root' })
export class ReservationImportService {
  private readonly baseUrl = `${environment.apiUrl}/reservation-imports`;

  constructor(private readonly http: HttpClient) {}

  getAddress(): Observable<ReservationImportAddress> {
    return this.http.get<ReservationImportAddress>(`${this.baseUrl}/address`);
  }

  getImports(): Observable<ReservationEmailImport[]> {
    return this.http.get<ReservationEmailImport[]>(this.baseUrl);
  }

  complete(importId: number, tripId: number, bookingId: number): Observable<ReservationEmailImport> {
    return this.http.patch<ReservationEmailImport>(`${this.baseUrl}/${importId}/complete`, {
      tripId,
      bookingId
    });
  }

  confirm(importId: number, tripId: number, booking: CreateBookingRequest): Observable<Booking> {
    return this.http.post<Booking>(`${this.baseUrl}/${importId}/confirm`, { tripId, booking });
  }

  retry(importId: number): Observable<ReservationEmailImport> {
    return this.http.post<ReservationEmailImport>(`${this.baseUrl}/${importId}/retry`, {});
  }

  dismiss(importId: number): Observable<ReservationEmailImport> {
    return this.http.delete<ReservationEmailImport>(`${this.baseUrl}/${importId}`);
  }
}
