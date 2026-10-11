import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TripTimeline } from '../models/timeline.model';

@Injectable({
  providedIn: 'root'
})
export class TimelineService {
  private readonly baseUrl = `${environment.apiUrl}/trips`;

  constructor(private http: HttpClient) {}

  getTimeline(tripId: number): Observable<TripTimeline> {
    return this.http.get<TripTimeline>(`${this.baseUrl}/${tripId}/timeline`);
  }
}
