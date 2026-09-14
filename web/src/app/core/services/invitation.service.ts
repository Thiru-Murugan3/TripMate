import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CreateInvitationRequest,
  TripInvitation
} from '../models/invitation.model';

@Injectable({
  providedIn: 'root'
})
export class InvitationService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  createInvitation(
    tripId: number,
    request: CreateInvitationRequest
  ): Observable<TripInvitation> {
    return this.http.post<TripInvitation>(
      `${this.apiUrl}/trips/${tripId}/invitations`,
      request
    );
  }

  getTripInvitations(tripId: number): Observable<TripInvitation[]> {
    return this.http.get<TripInvitation[]>(
      `${this.apiUrl}/trips/${tripId}/invitations`
    );
  }

  cancelInvitation(
    tripId: number,
    invitationId: number
  ): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiUrl}/trips/${tripId}/invitations/${invitationId}`
    );
  }

  getMyInvitations(): Observable<TripInvitation[]> {
    return this.http.get<TripInvitation[]>(
      `${this.apiUrl}/invitations/my`
    );
  }

  acceptInvitation(invitationId: number): Observable<TripInvitation> {
    return this.http.post<TripInvitation>(
      `${this.apiUrl}/invitations/${invitationId}/accept`,
      {}
    );
  }

  rejectInvitation(invitationId: number): Observable<TripInvitation> {
    return this.http.post<TripInvitation>(
      `${this.apiUrl}/invitations/${invitationId}/reject`,
      {}
    );
  }

  getInvitationByToken(token: string): Observable<TripInvitation> {
    return this.http.get<TripInvitation>(
      `${this.apiUrl}/invitations/token/${encodeURIComponent(token)}`
    );
  }

  acceptInvitationByToken(token: string): Observable<TripInvitation> {
    return this.http.post<TripInvitation>(
      `${this.apiUrl}/invitations/token/${encodeURIComponent(token)}/accept`,
      {}
    );
  }
}
