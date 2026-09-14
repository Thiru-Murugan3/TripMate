import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';

import { TripNotification } from '../../core/models/notification.model';
import { NotificationService } from '../../core/services/notification.service';

type NotificationFilter = 'all' | 'unread';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="notifications-page">
      <div class="page-shell">
        <header class="page-header">
          <div>
            <p class="eyebrow">TRIPMATE UPDATES</p>
            <h1>Notifications</h1>
            <p class="subtitle">
              Keep track of trip reminders, member activity, expenses,
              itinerary changes, bookings and documents.
            </p>
          </div>

          <button
            class="mark-all-btn"
            type="button"
            (click)="markAllAsRead()"
            [disabled]="loading || unreadCount === 0"
          >
            Mark all as read
          </button>
        </header>

        <div class="toolbar">
          <div class="filter-tabs" role="tablist" aria-label="Notification filters">
            <button
              type="button"
              class="filter-tab"
              [class.active]="filter === 'all'"
              (click)="setFilter('all')"
            >
              All
            </button>
            <button
              type="button"
              class="filter-tab"
              [class.active]="filter === 'unread'"
              (click)="setFilter('unread')"
            >
              Unread
              <span class="count-pill" *ngIf="unreadCount > 0">
                {{ unreadCount > 99 ? '99+' : unreadCount }}
              </span>
            </button>
          </div>

          <button class="refresh-btn" type="button" (click)="loadNotifications()" [disabled]="loading">
            Refresh
          </button>
        </div>

        <div class="state-card" *ngIf="loading">
          <div class="spinner"></div>
          <p>Loading notifications...</p>
        </div>

        <div class="state-card error" *ngIf="!loading && errorMessage">
          <strong>Could not load notifications.</strong>
          <p>{{ errorMessage }}</p>
          <button type="button" (click)="loadNotifications()">Try again</button>
        </div>

        <div class="state-card" *ngIf="!loading && !errorMessage && notifications.length === 0">
          <div class="empty-icon">✓</div>
          <h2>{{ filter === 'unread' ? 'You are all caught up' : 'No notifications yet' }}</h2>
          <p>
            {{
              filter === 'unread'
                ? 'There are no unread notifications right now.'
                : 'Trip updates will appear here when they are created.'
            }}
          </p>
        </div>

        <div class="notification-list" *ngIf="!loading && !errorMessage && notifications.length > 0">
          <article
            class="notification-card"
            *ngFor="let notification of notifications; trackBy: trackByNotificationId"
            [class.unread]="!notification.read"
          >
            <button
              class="notification-main"
              type="button"
              (click)="openNotification(notification)"
            >
              <div class="notification-icon" [attr.data-type]="notification.type">
                {{ getNotificationIcon(notification.type) }}
              </div>

              <div class="notification-content">
                <div class="notification-title-row">
                  <h2>{{ notification.title }}</h2>
                  <span class="unread-dot" *ngIf="!notification.read" aria-label="Unread"></span>
                </div>

                <p *ngIf="notification.message">{{ notification.message }}</p>

                <div class="notification-meta">
                  <span>{{ getTypeLabel(notification.type) }}</span>
                  <span aria-hidden="true">•</span>
                  <time [attr.datetime]="notification.createdAt">
                    {{ notification.createdAt | date:'medium' }}
                  </time>
                  <span *ngIf="notification.tripId" aria-hidden="true">•</span>
                  <span *ngIf="notification.tripId">Open trip</span>
                </div>
              </div>
            </button>

            <div class="notification-actions">
              <button
                type="button"
                class="text-action"
                *ngIf="!notification.read"
                (click)="markAsRead(notification); $event.stopPropagation()"
              >
                Mark read
              </button>
              <button
                type="button"
                class="delete-action"
                (click)="deleteNotification(notification); $event.stopPropagation()"
                aria-label="Delete notification"
              >
                Delete
              </button>
            </div>
          </article>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .notifications-page {
      min-height: calc(100vh - 140px);
      padding: 2.25rem 1.25rem 4rem;
      background: #f8fafc;
    }
    .page-shell {
      width: min(960px, 100%);
      margin: 0 auto;
    }
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 2rem;
      margin-bottom: 1.5rem;
    }
    .eyebrow {
      margin: 0 0 0.35rem;
      color: #2563eb;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.12em;
    }
    h1 {
      margin: 0;
      color: #0f172a;
      font-size: clamp(1.8rem, 4vw, 2.4rem);
      letter-spacing: -0.03em;
    }
    .subtitle {
      max-width: 660px;
      margin: 0.65rem 0 0;
      color: #64748b;
      line-height: 1.6;
    }
    .mark-all-btn,
    .refresh-btn,
    .filter-tab,
    .text-action,
    .delete-action,
    .state-card button {
      font: inherit;
      cursor: pointer;
    }
    .mark-all-btn {
      flex-shrink: 0;
      border: 0;
      border-radius: 10px;
      padding: 0.7rem 1rem;
      background: #2563eb;
      color: #fff;
      font-weight: 700;
    }
    .mark-all-btn:disabled,
    .refresh-btn:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .filter-tabs {
      display: inline-flex;
      padding: 0.25rem;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      background: #fff;
    }
    .filter-tab {
      border: 0;
      border-radius: 9px;
      padding: 0.55rem 0.85rem;
      background: transparent;
      color: #64748b;
      font-weight: 700;
    }
    .filter-tab.active {
      background: #eff6ff;
      color: #2563eb;
    }
    .count-pill {
      display: inline-flex;
      min-width: 20px;
      height: 20px;
      align-items: center;
      justify-content: center;
      margin-left: 0.35rem;
      padding: 0 0.35rem;
      border-radius: 999px;
      background: #ef4444;
      color: white;
      font-size: 0.7rem;
    }
    .refresh-btn {
      border: 1px solid #cbd5e1;
      border-radius: 9px;
      padding: 0.55rem 0.85rem;
      background: #fff;
      color: #334155;
      font-weight: 700;
    }
    .notification-list {
      display: grid;
      gap: 0.75rem;
    }
    .notification-card {
      display: flex;
      align-items: stretch;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      background: #fff;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(15, 23, 42, 0.035);
    }
    .notification-card.unread {
      border-color: #bfdbfe;
      background: #f8fbff;
    }
    .notification-main {
      flex: 1;
      min-width: 0;
      display: flex;
      gap: 0.9rem;
      align-items: flex-start;
      padding: 1rem;
      border: 0;
      background: transparent;
      text-align: left;
      cursor: pointer;
    }
    .notification-icon {
      width: 42px;
      height: 42px;
      flex: 0 0 42px;
      display: grid;
      place-items: center;
      border-radius: 12px;
      background: #eff6ff;
      color: #2563eb;
      font-size: 1.15rem;
    }
    .notification-content {
      min-width: 0;
      flex: 1;
    }
    .notification-title-row {
      display: flex;
      align-items: center;
      gap: 0.55rem;
    }
    .notification-title-row h2 {
      margin: 0;
      color: #0f172a;
      font-size: 0.98rem;
      font-weight: 750;
    }
    .unread-dot {
      width: 8px;
      height: 8px;
      flex: 0 0 8px;
      border-radius: 50%;
      background: #2563eb;
    }
    .notification-content p {
      margin: 0.4rem 0 0;
      color: #475569;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }
    .notification-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      margin-top: 0.65rem;
      color: #94a3b8;
      font-size: 0.75rem;
    }
    .notification-actions {
      flex: 0 0 auto;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-end;
      gap: 0.45rem;
      padding: 0.85rem 1rem 0.85rem 0.5rem;
    }
    .text-action,
    .delete-action {
      border: 0;
      background: transparent;
      font-size: 0.78rem;
      font-weight: 700;
    }
    .text-action {
      color: #2563eb;
    }
    .delete-action {
      color: #dc2626;
    }
    .state-card {
      display: grid;
      place-items: center;
      min-height: 240px;
      padding: 2rem;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      background: #fff;
      color: #64748b;
      text-align: center;
    }
    .state-card h2,
    .state-card strong {
      color: #0f172a;
    }
    .state-card p {
      margin: 0.35rem 0 0;
    }
    .state-card.error {
      color: #991b1b;
      background: #fffafa;
      border-color: #fecaca;
    }
    .state-card button {
      margin-top: 1rem;
      padding: 0.55rem 0.9rem;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #fff;
    }
    .empty-icon {
      width: 48px;
      height: 48px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: #ecfdf5;
      color: #059669;
      font-size: 1.4rem;
      font-weight: 800;
    }
    .spinner {
      width: 30px;
      height: 30px;
      border: 3px solid #dbeafe;
      border-top-color: #2563eb;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @media (max-width: 700px) {
      .page-header {
        flex-direction: column;
      }
      .mark-all-btn {
        width: 100%;
      }
      .notification-card {
        flex-direction: column;
      }
      .notification-actions {
        flex-direction: row;
        justify-content: flex-end;
        padding: 0 1rem 0.9rem;
      }
    }
  `]
})
export class NotificationsComponent implements OnInit {
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);

  notifications: TripNotification[] = [];
  filter: NotificationFilter = 'all';
  loading = false;
  unreadCount = 0;
  errorMessage = '';

  ngOnInit(): void {
    this.loadNotifications();
  }

  setFilter(filter: NotificationFilter): void {
    if (this.filter === filter) {
      return;
    }

    this.filter = filter;
    this.loadNotifications();
  }

  loadNotifications(): void {
    this.loading = true;
    this.errorMessage = '';

    const request$ = this.filter === 'unread'
      ? this.notificationService.getUnreadNotifications()
      : this.notificationService.getNotifications();

    request$.subscribe({
      next: (notifications) => {
        this.notifications = notifications;
        this.loading = false;
        this.refreshUnreadCount();
      },
      error: (error) => {
        this.notifications = [];
        this.loading = false;
        this.errorMessage = error?.error?.message || 'Please try again in a moment.';
      }
    });
  }

  markAsRead(notification: TripNotification): void {
    if (notification.read) {
      return;
    }

    this.notificationService.markAsRead(notification.id).subscribe({
      next: (updated) => {
        if (this.filter === 'unread') {
          this.notifications = this.notifications.filter((item) => item.id !== notification.id);
        } else {
          this.notifications = this.notifications.map((item) =>
            item.id === notification.id ? updated : item
          );
        }
        this.refreshUnreadCount();
      },
      error: () => {
        this.errorMessage = 'Could not mark the notification as read.';
      }
    });
  }

  markAllAsRead(): void {
    if (this.unreadCount === 0) {
      return;
    }

    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        this.notifications = this.filter === 'unread'
          ? []
          : this.notifications.map((notification) => ({ ...notification, read: true }));
        this.unreadCount = 0;
      },
      error: () => {
        this.errorMessage = 'Could not mark all notifications as read.';
      }
    });
  }

  deleteNotification(notification: TripNotification): void {
    const confirmed = window.confirm('Delete this notification?');
    if (!confirmed) {
      return;
    }

    this.notificationService.deleteNotification(notification.id).subscribe({
      next: () => {
        this.notifications = this.notifications.filter((item) => item.id !== notification.id);
        this.refreshUnreadCount();
      },
      error: () => {
        this.errorMessage = 'Could not delete the notification.';
      }
    });
  }

  openNotification(notification: TripNotification): void {
    const navigate = () => {
      if (notification.tripId) {
        this.router.navigate(['/trips', notification.tripId]);
      }
    };

    if (notification.read) {
      navigate();
      return;
    }

    this.notificationService.markAsRead(notification.id).subscribe({
      next: () => {
        this.refreshUnreadCount();
        navigate();
      },
      error: () => navigate()
    });
  }

  trackByNotificationId(_: number, notification: TripNotification): number {
    return notification.id;
  }

  getTypeLabel(type: TripNotification['type']): string {
    return type
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  getNotificationIcon(type: TripNotification['type']): string {
    const icons: Record<TripNotification['type'], string> = {
      TRIP_REMINDER: '✈',
      MEMBER_ADDED: '+',
      MEMBER_REMOVED: '−',
      EXPENSE_ADDED: '₹',
      ITINERARY_UPDATED: '☰',
      BOOKING_REMINDER: '◷',
      DOCUMENT_ADDED: '▤',
      GENERAL: '•'
    };

    return icons[type] || '•';
  }

  private refreshUnreadCount(): void {
    this.notificationService.refreshUnreadCount().subscribe({
      next: ({ count }) => {
        this.unreadCount = count;
      },
      error: () => {
        // The notification list can still be used if only the badge count refresh fails.
      }
    });
  }
}
