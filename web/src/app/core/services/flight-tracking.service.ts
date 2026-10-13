import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface FlightSetup {
  airlineCode: string; flightNumber: string; departureDate: string;
  origin: string; destination: string; departureZone: string; enabled: boolean;
}
export interface FlightStatus {
  bookingId: number; ident: string; airlineCode: string; flightNumber: string; departureDate: string; origin: string; destination: string;
  departureZone: string; enabled: boolean; subscribed: boolean; available: boolean; stale: boolean;
  lastChecked: string | null; nextPoll: string; message: string | null; source: string;
  snapshot: {
    status: string; scheduledDeparture: string | null; estimatedDeparture: string | null;
    actualDeparture: string | null; scheduledArrival: string | null; estimatedArrival: string | null;
    actualArrival: string | null; departureGate: string | null; arrivalGate: string | null;
    departureTerminal: string | null; arrivalTerminal: string | null;
  } | null;
}
@Injectable({ providedIn: 'root' })
export class FlightTrackingService {
  private http = inject(HttpClient);
  private url(tripId: number) { return `${environment.apiUrl}/trips/${tripId}/flights`; }
  list(tripId: number) { return this.http.get<{ available: boolean; flights: FlightStatus[] }>(this.url(tripId)); }
  configure(tripId: number, bookingId: number, setup: FlightSetup) {
    return this.http.put<FlightStatus>(`${this.url(tripId)}/${bookingId}`, setup);
  }
  subscribe(tripId: number, bookingId: number, enabled: boolean) {
    return this.http.put<FlightStatus>(`${this.url(tripId)}/${bookingId}/subscription`, { enabled });
  }
}
