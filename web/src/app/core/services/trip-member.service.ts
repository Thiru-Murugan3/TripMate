import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { TripMember, TripRole } from '../models/trip.model';

@Injectable({
  providedIn: 'root'
})
export class TripMemberService {
  private readonly baseUrl = `${environment.apiUrl}/trips`;

  constructor(private http: HttpClient) {}

  getMembers(tripId: number): Observable<TripMember[]> {
    return this.http.get<TripMember[]>(`${this.baseUrl}/${tripId}/members`);
  }

  addMember(tripId: number, email: string, role: TripRole): Observable<TripMember> {
    return this.http.post<TripMember>(
      `${this.baseUrl}/${tripId}/members`,
      { email, role }
    );
  }

  updateMemberRole(
    tripId: number,
    memberId: number,
    role: TripRole
  ): Observable<TripMember> {
    return this.http.patch<TripMember>(
      `${this.baseUrl}/${tripId}/members/${memberId}`,
      { role }
    );
  }

  removeMember(tripId: number, memberId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.baseUrl}/${tripId}/members/${memberId}`
    );
  }
}
