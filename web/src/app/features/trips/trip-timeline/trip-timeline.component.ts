import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, inject } from '@angular/core';
import { TimelineDay, TimelineItem, TripTimeline } from '../../../core/models/timeline.model';
import { TimelineService } from '../../../core/services/timeline.service';

import { Subscription } from 'rxjs';

type FilterCategory = 'ALL' | 'TRANSPORT' | 'HOTEL' | 'ACTIVITY' | 'FOOD';

@Component({
  selector: 'app-trip-timeline',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="timeline-container">
      <!-- Loading State -->
      <div *ngIf="isLoading" class="timeline-state card">
        <div class="spinner"></div>
        <p>Building your chronological timeline...</p>
      </div>

      <!-- Error State -->
      <div *ngIf="!isLoading && error" class="timeline-state card error-card">
        <span class="material-symbols-outlined state-icon">error</span>
        <h3>Unable to load timeline</h3>
        <p>{{ error }}</p>
        <button type="button" class="btn btn-outline" (click)="loadTimeline()">Retry</button>
      </div>

      <!-- Content State -->
      <ng-container *ngIf="!isLoading && !error && timeline as data">
        <!-- Top Stats & Controls Header -->
        <header class="timeline-header card">
          <div class="timeline-headline">
            <div class="headline-left">
              <span class="eyebrow">YOUR TRIP, DAY BY DAY</span>
              <h2>Daily trip timeline</h2>
              <p>Bookings and planned activities together. Times are shown as saved; time zones are not converted.</p>
            </div>
            <button type="button" class="btn-refresh" [disabled]="isLoading" (click)="loadTimeline()">
              <span class="material-symbols-outlined">refresh</span>
              Refresh
            </button>
          </div>

          <!-- Quick Metric Badges -->
          <div class="timeline-metrics">
            <div class="metric-pill">
              <span class="material-symbols-outlined icon-transport">flight</span>
              <strong>{{ data.transportCount }}</strong>
              <span>Travel milestones</span>
            </div>
            <div class="metric-pill">
              <span class="material-symbols-outlined icon-hotel">hotel</span>
              <strong>{{ data.stayCount }}</strong>
              <span>Stay milestones</span>
            </div>
            <div class="metric-pill">
              <span class="material-symbols-outlined icon-activity">attractions</span>
              <strong>{{ data.activityCount }}</strong>
              <span>Activities</span>
            </div>
            <div class="metric-pill">
              <span class="material-symbols-outlined icon-meal">restaurant</span>
              <strong>{{ data.mealCount }}</strong>
              <span>Meals</span>
            </div>
            <div *ngIf="data.conflictCount > 0" class="metric-pill alert-pill">
              <span class="material-symbols-outlined">warning</span>
              <strong>{{ data.conflictCount }}</strong>
              <span>Events to review</span>
            </div>
          </div>

          <!-- Day Navigation & Filter Chips -->
          <div class="timeline-toolbar">
            <!-- Day Quick Jump -->
            <div class="day-jump-scroll" *ngIf="data.days.length > 1">
              <button
                *ngFor="let day of data.days"
                type="button"
                class="day-pill"
                (click)="scrollToDay(day.dayNumber)"
              >
                Day {{ day.dayNumber }}
                <span class="dot-conflict" *ngIf="day.hasConflict" title="Has schedule conflict">•</span>
              </button>
            </div>

            <!-- Category Filters -->
            <div class="category-filters">
              <button
                type="button"
                class="filter-chip"
                [class.active]="selectedCategory === 'ALL'"
                (click)="setFilter('ALL')"
              >
                All ({{ data.totalEvents }})
              </button>
              <button
                type="button"
                class="filter-chip"
                [class.active]="selectedCategory === 'TRANSPORT'"
                (click)="setFilter('TRANSPORT')"
              >
                Transit ({{ data.transportCount }})
              </button>
              <button
                type="button"
                class="filter-chip"
                [class.active]="selectedCategory === 'HOTEL'"
                (click)="setFilter('HOTEL')"
              >
                Stays ({{ data.stayCount }})
              </button>
              <button
                type="button"
                class="filter-chip"
                [class.active]="selectedCategory === 'ACTIVITY'"
                (click)="setFilter('ACTIVITY')"
              >
                Places ({{ data.activityCount }})
              </button>
              <button
                type="button"
                class="filter-chip"
                [class.active]="selectedCategory === 'FOOD'"
                (click)="setFilter('FOOD')"
              >
                Dining ({{ data.mealCount }})
              </button>
            </div>
          </div>
        </header>

        <!-- Empty State -->
        <div *ngIf="data.totalEvents === 0" class="timeline-empty card">
          <span class="material-symbols-outlined empty-icon">map</span>
          <h3>Your timeline is waiting to be filled</h3>
          <p>Add flight or train bookings, or schedule activities in the Itinerary tab. Return here or refresh to see your updated plan.</p>
        </div>

        <!-- Vertical Timeline Feed Grouped by Day -->
        <div *ngIf="data.days.length > 0" class="timeline-feed">
          <section
            *ngFor="let day of data.days"
            [id]="'day-section-' + day.dayNumber"
            class="timeline-day-block"
          >
            <!-- Day Header Anchor -->
            <div class="day-banner">
              <div class="day-badge">
                <span class="day-num">DAY {{ day.dayNumber }}</span>
                <span class="day-date">{{ day.formattedDate }}</span>
              </div>
              <div class="day-title-group">
                <h3>{{ day.title }}</h3>
                <span *ngIf="day.notes" class="day-notes">{{ day.notes }}</span>
              </div>
              <div *ngIf="day.hasConflict" class="day-conflict-indicator">
                <span class="material-symbols-outlined">warning</span>
                <span>Overlap Alert</span>
              </div>
            </div>

            <!-- Items Vertical Stream -->
            <div class="day-items-stream">
              <div
                *ngFor="let item of filterItems(day.items)"
                class="timeline-card-wrapper"
                [class.conflict-row]="item.conflict"
              >
                <!-- Time Badge Column -->
                <div class="time-col">
                  <span class="time-main">{{ item.flexible ? "Flexible" : item.timeFormatted }}</span>
                  <span *ngIf="item.endTimeFormatted && !item.flexible && item.itemType !== 'HOTEL_CHECKIN'" class="time-end">until {{ item.endTimeFormatted }}<span *ngIf="item.endDatetime?.slice(0, 10) !== item.startDatetime?.slice(0, 10)"> · {{ item.endDatetime | date:'MMM d' }}</span></span>
                </div>

                <!-- Timeline Spine / Node -->
                <div class="spine-col">
                  <div class="spine-node" [attr.data-color]="item.badgeColor">
                    <span class="material-symbols-outlined">{{ item.icon }}</span>
                  </div>
                  <div class="spine-line"></div>
                </div>

                <!-- Content Card -->
                <article class="timeline-event-card card" [attr.data-color]="item.badgeColor">
                  <!-- Warning Banner if Conflict / Tight Schedule -->
                  <div *ngIf="item.warning" class="warning-banner" [class.hard-conflict]="item.conflict">
                    <span class="material-symbols-outlined">warning</span>
                    <span>{{ item.warning }}</span>
                  </div>

                  <div class="event-main">
                    <div class="event-header-row">
                      <div class="event-title-area">
                        <span class="event-category" [attr.data-color]="item.badgeColor">{{ item.category }}</span>
                        <span class="event-category">{{ item.sourceType === 'BOOKING' ? 'Booking' : 'Planned activity' }}</span>
                        <h4 class="event-title">{{ item.title }}</h4>
                      </div>
                      <span *ngIf="item.status" class="event-status-pill" [attr.data-status]="item.status">
                        {{ item.status }}
                      </span>
                    </div>

                    <p *ngIf="item.subtitle" class="event-subtitle">{{ item.subtitle }}</p>

                    <!-- Details Row: Location, Booking Ref, Price -->
                    <div class="event-meta-row">
                      <span *ngIf="item.location" class="meta-item">
                        <span class="material-symbols-outlined">location_on</span>
                        {{ item.location }}
                      </span>
                      <span *ngIf="item.bookingReference" class="meta-item">
                        <span class="material-symbols-outlined">confirmation_number</span>
                        {{ item.bookingReference }}
                      </span>
                      <span *ngIf="item.amount != null" class="meta-item cost-item">
                        <span class="material-symbols-outlined">payments</span>
                        {{ item.currency || 'INR' }} {{ item.amount }}
                      </span>
                    </div>

                    <p *ngIf="item.notes" class="event-notes">{{ item.notes }}</p>

                    <!-- Action Bar -->
                    <div class="event-actions">
                      <button
                        *ngIf="item.sourceType === 'BOOKING'"
                        type="button"
                        class="action-btn"
                        (click)="onSelectBooking(item.sourceId)"
                      >
                        <span class="material-symbols-outlined">visibility</span>
                        View Booking
                      </button>
                      <button
                        *ngIf="item.sourceType === 'ITINERARY_ITEM'"
                        type="button"
                        class="action-btn"
                        (click)="onSelectActivity(item.sourceId)"
                      >
                        <span class="material-symbols-outlined">edit_calendar</span>
                        View in Itinerary
                      </button>
                    </div>
                  </div>
                </article>
              </div>

              <!-- Empty state for specific filter within a day -->
              <div *ngIf="filterItems(day.items).length === 0" class="no-filter-items">
                <span>{{ selectedCategory === 'ALL' ? 'Nothing planned yet. Add a booking or activity for this day.' : 'No events match this filter on this day.' }}</span>
              </div>
            </div>
          </section>
        </div>
      </ng-container>
    </section>
  `,
  styles: [`
    .timeline-container { display: flex; flex-direction: column; gap: 1.25rem; }
    .card { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    
    .timeline-state { padding: 3rem 1.5rem; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
    .error-card { border-color: #fecaca; background: #fff5f5; color: #991b1b; }
    .state-icon { font-size: 2.5rem; color: #dc2626; }
    
    .timeline-header { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1.2rem; background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%); }
    .timeline-headline { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
    .eyebrow { font-size: 0.65rem; font-weight: 800; letter-spacing: 0.08em; color: #2563eb; text-transform: uppercase; }
    h2 { margin: 0.2rem 0 0.3rem; font-size: 1.4rem; color: #0f172a; font-weight: 800; }
    p { margin: 0; color: #64748b; font-size: 0.85rem; line-height: 1.4; }
    
    .btn-refresh { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.45rem 0.85rem; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; font-size: 0.82rem; font-weight: 700; color: #334155; cursor: pointer; transition: all 0.15s; }
    .btn-refresh:hover { background: #f1f5f9; border-color: #94a3b8; }
    .btn-refresh span { font-size: 1.1rem; }

    .timeline-metrics { display: flex; flex-wrap: wrap; gap: 0.65rem; }
    .metric-pill { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.35rem 0.75rem; border-radius: 9999px; background: #f1f5f9; font-size: 0.78rem; color: #475569; }
    .metric-pill strong { color: #0f172a; font-weight: 800; }
    .icon-transport { color: #0284c7; font-size: 1.1rem; }
    .icon-hotel { color: #9333ea; font-size: 1.1rem; }
    .icon-activity { color: #059669; font-size: 1.1rem; }
    .icon-meal { color: #d97706; font-size: 1.1rem; }
    .alert-pill { background: #fef3c7; color: #b45309; }
    .alert-pill span { font-size: 1.1rem; }

    .timeline-toolbar { display: flex; flex-direction: column; gap: 0.75rem; border-top: 1px solid #f1f5f9; padding-top: 0.85rem; }
    .day-jump-scroll { display: flex; gap: 0.4rem; overflow-x: auto; padding-bottom: 0.25rem; }
    .day-pill { border: 1px solid #e2e8f0; background: #fff; padding: 0.3rem 0.65rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700; color: #475569; cursor: pointer; white-space: nowrap; display: inline-flex; align-items: center; gap: 0.2rem; }
    .day-pill:hover { background: #eff6ff; border-color: #93c5fd; color: #1d4ed8; }
    .dot-conflict { color: #ef4444; font-size: 1rem; line-height: 0.5; }

    .category-filters { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .filter-chip { border: 0; background: #f1f5f9; color: #475569; font-size: 0.75rem; font-weight: 700; padding: 0.35rem 0.75rem; border-radius: 8px; cursor: pointer; transition: all 0.15s; }
    .filter-chip:hover { background: #e2e8f0; }
    .filter-chip.active { background: #2563eb; color: #fff; }

    .timeline-empty { padding: 3rem 1.5rem; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
    .empty-icon { font-size: 3rem; color: #94a3b8; }
    .timeline-empty h3 { margin: 0; color: #1e293b; font-size: 1.15rem; font-weight: 800; }

    /* Day Block & Stream */
    .timeline-day-block { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 2rem; }
    .day-banner { display: flex; align-items: center; gap: 1rem; background: #fff; padding: 0.85rem 1.25rem; border-radius: 12px; border: 1px solid #cbd5e1; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
    .day-badge { display: flex; flex-direction: column; }
    .day-num { font-size: 0.7rem; font-weight: 900; color: #2563eb; letter-spacing: 0.05em; }
    .day-date { font-size: 0.82rem; font-weight: 800; color: #0f172a; white-space: nowrap; }
    .day-title-group { display: flex; flex-direction: column; gap: 0.1rem; flex: 1; min-width: 0; }
    .day-title-group h3 { margin: 0; font-size: 1.05rem; font-weight: 800; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .day-notes { font-size: 0.75rem; color: #64748b; }
    .day-conflict-indicator { display: inline-flex; align-items: center; gap: 0.25rem; background: #fee2e2; color: #dc2626; font-size: 0.72rem; font-weight: 800; padding: 0.25rem 0.55rem; border-radius: 9999px; }
    .day-conflict-indicator span { font-size: 0.95rem; }

    .day-items-stream { display: flex; flex-direction: column; }
    .timeline-card-wrapper { display: grid; grid-template-columns: 85px 44px 1fr; align-items: stretch; gap: 0.5rem; position: relative; }
    
    .time-col { display: flex; flex-direction: column; text-align: right; padding-top: 0.85rem; padding-right: 0.4rem; }
    .time-main { font-size: 0.82rem; font-weight: 800; color: #0f172a; }
    .time-end { font-size: 0.68rem; color: #64748b; font-weight: 600; }

    .spine-col { display: flex; flex-direction: column; align-items: center; position: relative; }
    .spine-node { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; z-index: 2; margin-top: 0.6rem; box-shadow: 0 0 0 4px #fff, 0 1px 3px rgba(0,0,0,0.1); }
    .spine-node span { font-size: 1.15rem; color: #fff; }
    .spine-line { width: 2px; flex: 1; background: #cbd5e1; margin-top: 0.2rem; }
    .timeline-card-wrapper:last-child .spine-line { background: transparent; }

    /* Node Color Codes */
    .spine-node[data-color="blue"] { background: #2563eb; }
    .spine-node[data-color="amber"] { background: #d97706; }
    .spine-node[data-color="rose"] { background: #e11d48; }
    .spine-node[data-color="purple"] { background: #9333ea; }
    .spine-node[data-color="emerald"] { background: #059669; }
    .spine-node[data-color="indigo"] { background: #4f46e5; }

    /* Event Card */
    .timeline-event-card { margin-bottom: 0.85rem; padding: 0.9rem 1.1rem; border-left: 4px solid #cbd5e1; transition: transform 0.15s, box-shadow 0.15s; }
    .timeline-event-card:hover { transform: translateY(-1px); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.06); }
    .timeline-event-card[data-color="blue"] { border-left-color: #2563eb; }
    .timeline-event-card[data-color="amber"] { border-left-color: #d97706; }
    .timeline-event-card[data-color="rose"] { border-left-color: #e11d48; }
    .timeline-event-card[data-color="purple"] { border-left-color: #9333ea; }
    .timeline-event-card[data-color="emerald"] { border-left-color: #059669; }
    .timeline-event-card[data-color="indigo"] { border-left-color: #4f46e5; }

    .warning-banner { display: flex; align-items: center; gap: 0.4rem; padding: 0.45rem 0.65rem; border-radius: 6px; font-size: 0.74rem; font-weight: 700; background: #fef3c7; color: #92400e; margin-bottom: 0.65rem; }
    .warning-banner.hard-conflict { background: #fee2e2; color: #991b1b; }
    .warning-banner span { font-size: 1rem; }

    .event-header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; }
    .event-title-area { display: flex; flex-direction: column; gap: 0.15rem; }
    .event-category { font-size: 0.65rem; font-weight: 900; letter-spacing: 0.05em; text-transform: uppercase; }
    .event-category[data-color="blue"] { color: #2563eb; }
    .event-category[data-color="amber"] { color: #d97706; }
    .event-category[data-color="rose"] { color: #e11d48; }
    .event-category[data-color="purple"] { color: #9333ea; }
    .event-category[data-color="emerald"] { color: #059669; }
    .event-category[data-color="indigo"] { color: #4f46e5; }

    .event-title { margin: 0; font-size: 0.98rem; font-weight: 800; color: #0f172a; line-height: 1.3; }
    .event-subtitle { margin: 0.2rem 0 0.5rem; font-size: 0.8rem; color: #475569; }

    .event-status-pill { font-size: 0.68rem; font-weight: 800; padding: 0.2rem 0.5rem; border-radius: 9999px; background: #dcfce7; color: #166534; white-space: nowrap; }
    .event-status-pill[data-status="CANCELLED"] { background: #fee2e2; color: #991b1b; }
    .event-status-pill[data-status="PENDING"] { background: #fef3c7; color: #92400e; }

    .event-meta-row { display: flex; flex-wrap: wrap; gap: 0.85rem; font-size: 0.76rem; color: #64748b; margin-top: 0.4rem; }
    .meta-item { display: inline-flex; align-items: center; gap: 0.2rem; }
    .meta-item span { font-size: 0.95rem; color: #94a3b8; }
    .cost-item { font-weight: 700; color: #0f172a; }

    .event-notes { margin: 0.4rem 0 0; padding-top: 0.4rem; border-top: 1px dashed #e2e8f0; font-size: 0.75rem; color: #64748b; font-style: italic; }

    .event-actions { display: flex; gap: 0.4rem; margin-top: 0.65rem; }
    .action-btn { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.32rem 0.6rem; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; font-size: 0.72rem; font-weight: 700; color: #334155; cursor: pointer; transition: all 0.15s; }
    .action-btn:hover { background: #eff6ff; border-color: #bfdbfe; color: #1d4ed8; }
    .action-btn span { font-size: 0.95rem; }

    .no-filter-items { padding: 1rem; color: #94a3b8; font-size: 0.8rem; font-style: italic; }

    @media (max-width: 640px) {
      .timeline-card-wrapper { grid-template-columns: 60px 36px 1fr; gap: 0.35rem; }
      .time-main { font-size: 0.72rem; }
      .time-end { font-size: 0.62rem; }
      .spine-node { width: 28px; height: 28px; }
      .spine-node span { font-size: 0.95rem; }
      .timeline-event-card { padding: 0.75rem; }
      .event-title { font-size: 0.88rem; }
      .timeline-headline { flex-direction: column; }
    }
  `]
})
export class TripTimelineComponent implements OnChanges, OnDestroy {
  @Input() tripId!: number;
  @Output() selectBooking = new EventEmitter<number>();
  @Output() selectActivity = new EventEmitter<number>();

  private readonly timelineService = inject(TimelineService);

  timeline: TripTimeline | null = null;
  isLoading = false;
  error = '';
  selectedCategory: FilterCategory = 'ALL';

  private request?: Subscription;

  ngOnChanges(): void {
    this.request?.unsubscribe();
    this.timeline = null;
    this.selectedCategory = 'ALL';
    if (this.tripId) {
      this.loadTimeline();
    }
  }

  ngOnDestroy(): void {
    this.request?.unsubscribe();
  }

  loadTimeline(): void {
    this.request?.unsubscribe();
    this.isLoading = true;
    this.error = '';
    this.request = this.timelineService.getTimeline(this.tripId).subscribe({
      next: (res) => {
        this.timeline = res;
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.error = err?.error?.message || 'Failed to load trip timeline.';
      }
    });
  }

  setFilter(category: FilterCategory): void {
    this.selectedCategory = category;
  }

  filterItems(items: TimelineItem[]): TimelineItem[] {
    if (this.selectedCategory === 'ALL') return items;
    return items.filter((item) => {
      if (this.selectedCategory === 'TRANSPORT') {
        return item.itemType === 'TRANSPORT_DEPARTURE' || item.itemType === 'TRANSPORT_ARRIVAL';
      }
      if (this.selectedCategory === 'HOTEL') {
        return item.itemType === 'HOTEL_CHECKIN' || item.itemType === 'HOTEL_CHECKOUT';
      }
      if (this.selectedCategory === 'FOOD') {
        return item.itemType === 'MEAL';
      }
      if (this.selectedCategory === 'ACTIVITY') {
        return item.itemType === 'ACTIVITY' || item.itemType === 'OTHER';
      }
      return true;
    });
  }

  scrollToDay(dayNumber: number): void {
    const el = document.getElementById(`day-section-${dayNumber}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  onSelectBooking(bookingId: number): void {
    this.selectBooking.emit(bookingId);
  }

  onSelectActivity(activityId: number): void {
    this.selectActivity.emit(activityId);
  }
}
