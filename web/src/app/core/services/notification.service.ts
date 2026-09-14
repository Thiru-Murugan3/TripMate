import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  TripNotification,
  UnreadNotificationCount
} from '../models/notification.model';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly baseUrl = `${environment.apiUrl}/notifications`;
  private readonly unreadCountSubject = new BehaviorSubject<number>(0);

  readonly unreadCount$ = this.unreadCountSubject.asObservable();

  constructor(private http: HttpClient) {}

  getNotifications(): Observable<TripNotification[]> {
    return this.http.get<TripNotification[]>(this.baseUrl);
  }

  getUnreadNotifications(): Observable<TripNotification[]> {
    return this.http.get<TripNotification[]>(`${this.baseUrl}/unread`);
  }

  getUnreadCount(): Observable<UnreadNotificationCount> {
    return this.http.get<UnreadNotificationCount>(
      `${this.baseUrl}/unread/count`
    );
  }

  refreshUnreadCount(): Observable<UnreadNotificationCount> {
    return this.getUnreadCount().pipe(
      tap(({ count }) => this.unreadCountSubject.next(count))
    );
  }

  markAsRead(notificationId: number): Observable<TripNotification> {
    return this.http.patch<TripNotification>(
      `${this.baseUrl}/${notificationId}/read`,
      {}
    );
  }

  markAllAsRead(): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(
      `${this.baseUrl}/read-all`,
      {}
    ).pipe(
      tap(() => this.unreadCountSubject.next(0))
    );
  }

  deleteNotification(notificationId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.baseUrl}/${notificationId}`
    );
  }
}
