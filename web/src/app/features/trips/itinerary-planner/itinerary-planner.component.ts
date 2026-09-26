import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  inject
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Trip } from '../../../core/models/trip.model';
import {
  CreateItineraryItemRequest,
  ItineraryDay,
  ItineraryItem,
  TripItinerary,
  UpdateItineraryItemRequest
} from '../../../core/models/itinerary.model';
import { Place } from '../../../core/models/place.model';
import { ItineraryService } from '../../../core/services/itinerary.service';
import { PlaceService } from '../../../core/services/place.service';

interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

interface RouteStop extends RouteCoordinate {
  id: string;
  name: string;
  item?: ItineraryItem;
  isStay?: boolean;
}

interface RouteLeg {
  from: RouteStop;
  to: RouteStop;
  distanceKm: number;
  estimatedMinutes: number;
}

interface RoutePlotPoint extends RouteStop {
  x: number;
  y: number;
  stopNumber: number;
}

interface DayRoutePlan {
  day: ItineraryDay;
  stops: RouteStop[];
  legs: RouteLeg[];
  plotPoints: RoutePlotPoint[];
  polylinePoints: string;
  totalDistanceKm: number;
  totalTravelMinutes: number;
  googleMapsUrl: string;
}

@Component({
  selector: 'app-itinerary-planner',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="planner">
      <div class="planner-toolbar">
        <div>
          <span class="eyebrow">ITINERARY PLANNER</span>
          <h2>Plan the trip day by day</h2>
          <p>Add activities, timing, places, estimated cost and notes.</p>
        </div>

        <button
          *ngIf="canEdit"
          type="button"
          class="btn primary"
          (click)="openCreateDay()"
        >
          <span class="material-symbols-outlined">add</span>
          Add Day
        </button>
      </div>

      <div *ngIf="isLoading" class="state-card">
        <div class="spinner"></div>
        <span>Loading itinerary...</span>
      </div>

      <div *ngIf="!isLoading && loadError" class="state-card error">
        <span class="material-symbols-outlined">error</span>
        <div>
          <strong>Unable to load itinerary</strong>
          <p>{{ loadError }}</p>
        </div>
        <button type="button" class="btn secondary" (click)="loadAll()">Retry</button>
      </div>

      <ng-container *ngIf="!isLoading && !loadError">
        <div class="summary-grid">
          <article>
            <span>Days</span>
            <strong>{{ itinerary?.totalDays || 0 }}</strong>
          </article>
          <article>
            <span>Activities</span>
            <strong>{{ itinerary?.totalActivities || 0 }}</strong>
          </article>
          <article>
            <span>Estimated Cost</span>
            <strong>{{ formatCurrency(itinerary?.totalEstimatedCost || 0) }}</strong>
          </article>
        </div>

        <section *ngIf="itinerary?.days?.length && itineraryHasMappedPlaces" class="route-planner-card">
          <div class="route-planner-heading">
            <div>
              <span class="eyebrow">SMART ROUTE MAP</span>
              <h3>Nearest place first, planned day by day</h3>
              <p>Each day starts from your stay and visits the nearest next place to reduce unnecessary travel.</p>
            </div>
            <button
              *ngIf="canEdit"
              type="button"
              class="btn optimize-btn"
              [disabled]="isOptimizing || !routeStart"
              (click)="optimizeAllDayRoutes()"
            >
              <span class="material-symbols-outlined">route</span>
              {{ isOptimizing ? 'Optimizing...' : 'Optimize all days' }}
            </button>
          </div>

          <div class="route-controls">
            <label class="route-start-field">
              <span>Starting / staying location</span>
              <select [value]="routeStartPlaceId" (change)="selectRouteStart($event)">
                <option value="">Select saved stay or place</option>
                <option *ngFor="let place of mappedPlaces" [value]="place.id">
                  {{ place.name }} · {{ formatCategory(place.category) }}
                </option>
                <option *ngIf="currentLocation" value="CURRENT_LOCATION">My current location</option>
              </select>
            </label>
            <button type="button" class="location-btn" (click)="useCurrentLocation()" [disabled]="isLocating">
              <span class="material-symbols-outlined">my_location</span>
              {{ isLocating ? 'Finding location...' : 'Use my current location' }}
            </button>
          </div>

          <div *ngIf="routeMessage" class="route-message" [class.error]="routeMessageIsError">
            {{ routeMessage }}
          </div>

          <div *ngIf="!routeStart" class="route-start-prompt">
            <span class="material-symbols-outlined">hotel</span>
            Select your hotel, homestay, or current location to prepare the nearest-first route.
          </div>

          <div *ngIf="routeStart" class="day-routes">
            <article *ngFor="let plan of dayRoutePlans" class="day-route-card">
              <header>
                <div>
                  <span>DAY {{ plan.day.dayNumber }}</span>
                  <h4>{{ plan.day.title || ('Day ' + plan.day.dayNumber + ' route') }}</h4>
                </div>
                <div class="route-totals">
                  <strong>{{ plan.totalDistanceKm | number:'1.0-1' }} km</strong>
                  <span>~{{ formatTravelTime(plan.totalTravelMinutes) }}</span>
                </div>
              </header>

              <div *ngIf="plan.stops.length > 1" class="route-map" role="img" [attr.aria-label]="'Route map for Day ' + plan.day.dayNumber">
                <svg viewBox="0 0 800 280" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                  <defs>
                    <linearGradient [attr.id]="'route-bg-' + plan.day.id" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stop-color="#eff6ff"></stop>
                      <stop offset="52%" stop-color="#ecfdf5"></stop>
                      <stop offset="100%" stop-color="#fefce8"></stop>
                    </linearGradient>
                    <filter [attr.id]="'route-shadow-' + plan.day.id" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#0f172a" flood-opacity=".18"></feDropShadow>
                    </filter>
                  </defs>
                  <rect width="800" height="280" rx="18" [attr.fill]="'url(#route-bg-' + plan.day.id + ')'" />
                  <path d="M0 210 C130 150 210 250 345 195 S590 120 800 185" fill="none" stroke="#bbf7d0" stroke-width="46" opacity=".6" />
                  <path d="M40 50 C180 95 250 15 390 65 S650 110 780 45" fill="none" stroke="#bfdbfe" stroke-width="16" opacity=".48" />
                  <polyline [attr.points]="plan.polylinePoints" fill="none" stroke="#2563eb" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="12 8" />
                  <g *ngFor="let point of plan.plotPoints" [attr.transform]="'translate(' + point.x + ' ' + point.y + ')'">
                    <circle r="19" [attr.fill]="point.isStay ? '#dc2626' : '#2563eb'" stroke="#fff" stroke-width="5" [attr.filter]="'url(#route-shadow-' + plan.day.id + ')'" />
                    <text x="0" y="6" text-anchor="middle" fill="#fff" font-size="16" font-weight="800">{{ point.isStay ? 'H' : point.stopNumber }}</text>
                  </g>
                </svg>
                <span class="map-note">Visual route overview · open Google Maps for live roads and traffic</span>
              </div>

              <div *ngIf="plan.stops.length <= 1" class="day-route-empty">
                Add mapped places to Day {{ plan.day.dayNumber }} to generate its route.
              </div>

              <div *ngIf="plan.legs.length" class="route-sequence">
                <div class="route-stop start-stop">
                  <span class="stop-number"><span class="material-symbols-outlined">hotel</span></span>
                  <div><small>START</small><strong>{{ plan.stops[0].name }}</strong></div>
                </div>
                <ng-container *ngFor="let leg of plan.legs; let legIndex = index">
                  <div class="route-leg">
                    <span>{{ leg.distanceKm | number:'1.0-1' }} km</span>
                    <span>~{{ leg.estimatedMinutes }} min</span>
                    <span class="material-symbols-outlined">arrow_forward</span>
                  </div>
                  <div class="route-stop">
                    <span class="stop-number" [class.return-stay]="leg.to.isStay">
                      <span *ngIf="leg.to.isStay" class="material-symbols-outlined">hotel</span>
                      <ng-container *ngIf="!leg.to.isStay">{{ legIndex + 1 }}</ng-container>
                    </span>
                    <div><small>{{ leg.to.isStay ? 'RETURN' : ('STOP ' + (legIndex + 1)) }}</small><strong>{{ leg.to.name }}</strong></div>
                  </div>
                </ng-container>
              </div>

              <a *ngIf="plan.legs.length" class="google-route-link" [href]="plan.googleMapsUrl" target="_blank" rel="noopener noreferrer">
                <span class="material-symbols-outlined">map</span>
                Open complete Day {{ plan.day.dayNumber }} route in Google Maps
                <span class="material-symbols-outlined">open_in_new</span>
              </a>
            </article>
          </div>
        </section>

        <div *ngIf="!itinerary?.days?.length" class="empty-card">
          <span class="material-symbols-outlined">route</span>
          <h3>No itinerary days yet</h3>
          <p>Create Day 1 and start adding activities for this trip.</p>
          <button *ngIf="canEdit" type="button" class="btn primary" (click)="openCreateDay()">
            Create Day 1
          </button>
        </div>

        <div *ngIf="itinerary?.days?.length" class="days-list">
          <article *ngFor="let day of itinerary?.days" class="day-card">
            <header class="day-header">
              <div class="day-title">
                <div class="day-number">Day {{ day.dayNumber }}</div>
                <div>
                  <h3>{{ day.title || ('Day ' + day.dayNumber) }}</h3>
                  <p>
                    {{ day.dayDate ? formatDate(day.dayDate) : 'Date not set' }}
                    <ng-container *ngIf="day.notes"> · {{ day.notes }}</ng-container>
                  </p>
                </div>
              </div>

              <div *ngIf="canEdit" class="day-actions">
                <button type="button" class="icon-btn" title="Edit day" (click)="openEditDay(day)">
                  <span class="material-symbols-outlined">edit</span>
                </button>
                <button type="button" class="icon-btn danger" title="Delete day" (click)="deleteDay(day)">
                  <span class="material-symbols-outlined">delete</span>
                </button>
                <button type="button" class="btn small primary" (click)="openAddActivity(day)">
                  <span class="material-symbols-outlined">add</span>
                  Add Activity
                </button>
              </div>
            </header>

            <div *ngIf="!sortedItems(day).length" class="day-empty">
              <span>No activities added for this day.</span>
              <button *ngIf="canEdit" type="button" (click)="openAddActivity(day)">
                + Add first activity
              </button>
            </div>

            <div *ngIf="sortedItems(day).length" class="activity-list">
              <div
                *ngFor="let item of sortedItems(day); let i = index"
                class="activity-row"
              >
                <div class="activity-time">
                  <strong>{{ formatTime(item.startTime) }}</strong>
                  <span *ngIf="item.endTime">to {{ formatTime(item.endTime) }}</span>
                </div>

                <div class="timeline">
                  <span class="dot"></span>
                  <span class="line"></span>
                </div>

                <div class="activity-main">
                  <div class="activity-title-row">
                    <div>
                      <h4>{{ item.title }}</h4>
                      <p>
                        <span class="material-symbols-outlined">location_on</span>
                        {{ item.placeName || item.location || 'Location not set' }}
                      </p>
                    </div>

                    <div *ngIf="canEdit" class="activity-actions">
                      <button
                        type="button"
                        class="move-btn"
                        [disabled]="i === 0 || isReordering"
                        title="Move up"
                        (click)="moveActivity(day, i, -1)"
                      >
                        <span class="material-symbols-outlined">arrow_upward</span>
                      </button>
                      <button
                        type="button"
                        class="move-btn"
                        [disabled]="i === sortedItems(day).length - 1 || isReordering"
                        title="Move down"
                        (click)="moveActivity(day, i, 1)"
                      >
                        <span class="material-symbols-outlined">arrow_downward</span>
                      </button>
                      <button type="button" class="icon-btn" title="Edit activity" (click)="openEditActivity(item)">
                        <span class="material-symbols-outlined">edit</span>
                      </button>
                      <button type="button" class="icon-btn danger" title="Delete activity" (click)="deleteActivity(item)">
                        <span class="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                  </div>

                  <p *ngIf="item.description" class="description">{{ item.description }}</p>

                  <div class="activity-meta">
                    <span *ngIf="item.estimatedCost !== undefined && item.estimatedCost !== null">
                      <span class="material-symbols-outlined">currency_rupee</span>
                      {{ formatCurrency(item.estimatedCost) }}
                    </span>
                    <span *ngIf="item.placeName">
                      <span class="material-symbols-outlined">bookmark</span>
                      Saved place
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>
      </ng-container>

      <div *ngIf="showDayModal" class="modal-backdrop">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3>{{ editingDay ? 'Edit Day' : 'Add Itinerary Day' }}</h3>
              <p>Set the day number, date and optional notes.</p>
            </div>
            <button type="button" class="close-btn" (click)="closeDayModal()">&times;</button>
          </div>

          <div *ngIf="dayError" class="form-error">{{ dayError }}</div>

          <form [formGroup]="dayForm" (ngSubmit)="saveDay()">
            <div class="form-grid two">
              <label class="field">
                <span>Day Number *</span>
                <input
                  type="number"
                  min="1"
                  [max]="tripDurationDays"
                  formControlName="dayNumber"
                />
              </label>

              <label class="field">
                <span>Date *</span>
                <input
                  type="date"
                  [min]="trip.startDate"
                  [max]="trip.endDate"
                  formControlName="dayDate"
                />
              </label>
            </div>

            <label class="field">
              <span>Title</span>
              <input formControlName="title" maxlength="180" placeholder="Ooty sightseeing" />
            </label>

            <label class="field">
              <span>Notes</span>
              <textarea formControlName="notes" rows="3" placeholder="Optional day notes"></textarea>
            </label>

            <div class="modal-actions">
              <button type="button" class="btn secondary" (click)="closeDayModal()">Cancel</button>
              <button type="submit" class="btn primary" [disabled]="dayForm.invalid || isSavingDay">
                {{ isSavingDay ? 'Saving...' : (editingDay ? 'Save Day' : 'Add Day') }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div *ngIf="showActivityModal" class="modal-backdrop">
        <div class="modal activity-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3>{{ editingItem ? 'Edit Activity' : 'Add Activity' }}</h3>
              <p>Plan time, place, cost and activity details.</p>
            </div>
            <button type="button" class="close-btn" (click)="closeActivityModal()">&times;</button>
          </div>

          <div *ngIf="activityError" class="form-error">{{ activityError }}</div>

          <form [formGroup]="activityForm" (ngSubmit)="saveActivity()">
            <label class="field">
              <span>Day *</span>
              <select formControlName="dayId" [disabled]="!!editingItem">
                <option *ngFor="let day of itinerary?.days" [value]="day.id">
                  Day {{ day.dayNumber }}{{ day.dayDate ? ' · ' + formatDate(day.dayDate) : '' }}
                </option>
              </select>
            </label>

            <label class="field">
              <span>Activity Name *</span>
              <input formControlName="title" maxlength="180" placeholder="Ooty Lake boating" />
            </label>

            <div class="form-grid two time-fields">
              <div class="field">
                <span>Start Time</span>
                <div class="time-picker">
                  <select formControlName="startHour" aria-label="Start hour">
                    <option value="">Hour</option>
                    <option *ngFor="let hour of hourOptions" [value]="hour">{{ hour }}</option>
                  </select>
                  <span class="time-separator">:</span>
                  <select formControlName="startMinute" aria-label="Start minute">
                    <option *ngFor="let minute of minuteOptions" [value]="minute">{{ minute }}</option>
                  </select>
                  <select formControlName="startPeriod" aria-label="Start AM or PM">
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>

              <div class="field">
                <span>End Time</span>
                <div class="time-picker">
                  <select formControlName="endHour" aria-label="End hour">
                    <option value="">Hour</option>
                    <option *ngFor="let hour of hourOptions" [value]="hour">{{ hour }}</option>
                  </select>
                  <span class="time-separator">:</span>
                  <select formControlName="endMinute" aria-label="End minute">
                    <option *ngFor="let minute of minuteOptions" [value]="minute">{{ minute }}</option>
                  </select>
                  <select formControlName="endPeriod" aria-label="End AM or PM">
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="form-grid two">
              <label class="field">
                <span>Saved Place</span>
                <select formControlName="placeId">
                  <option value="">No saved place</option>
                  <option *ngFor="let place of places" [value]="place.id">
                    {{ place.name }} · {{ formatCategory(place.category) }}
                  </option>
                </select>
              </label>

              <label class="field">
                <span>Location</span>
                <input formControlName="location" maxlength="255" placeholder="Custom location / address" />
              </label>
            </div>

            <label class="field">
              <span>Estimated Cost (₹)</span>
              <input type="number" min="0" step="1" formControlName="estimatedCost" />
            </label>

            <label class="field">
              <span>Description / Notes</span>
              <textarea formControlName="description" rows="3" placeholder="Optional activity notes"></textarea>
            </label>

            <div class="modal-actions">
              <button type="button" class="btn secondary" (click)="closeActivityModal()">Cancel</button>
              <button
                type="submit"
                class="btn primary"
                [disabled]="activityForm.invalid || isSavingActivity"
              >
                {{ isSavingActivity ? 'Saving...' : (editingItem ? 'Save Activity' : 'Add Activity') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  `,
  styles: [`
    :host { display:block; }
    .planner { color:#0f172a; }
    .planner-toolbar { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; margin-bottom:1rem; }
    .planner-toolbar h2 { margin:.15rem 0 .25rem; font-size:1.15rem; }
    .planner-toolbar p { margin:0; color:#64748b; font-size:.82rem; }
    .eyebrow { color:#2563eb; font-size:.66rem; font-weight:850; letter-spacing:.08em; }
    .btn { display:inline-flex; align-items:center; justify-content:center; gap:.35rem; padding:.62rem .9rem; border:0; border-radius:9px; font-weight:800; cursor:pointer; }
    .btn.primary { color:#fff; background:#2563eb; }
    .btn.secondary { color:#334155; background:#e2e8f0; }
    .btn.small { padding:.48rem .68rem; font-size:.75rem; }
    .btn:disabled { opacity:.55; cursor:not-allowed; }
    .summary-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.75rem; margin-bottom:1rem; }
    .summary-grid article { padding:.9rem 1rem; border:1px solid #e2e8f0; border-radius:12px; background:#fff; }
    .summary-grid span { display:block; color:#64748b; font-size:.68rem; font-weight:800; text-transform:uppercase; }
    .summary-grid strong { display:block; margin-top:.35rem; font-size:1.05rem; }
    .route-planner-card { margin-bottom:1rem; padding:1rem; border:1px solid #bfdbfe; border-radius:16px; background:linear-gradient(145deg,#fff,#f8fbff); box-shadow:0 10px 28px rgba(37,99,235,.08); }
    .route-planner-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; }
    .route-planner-heading h3 { margin:.15rem 0 .25rem; font-size:1rem; }
    .route-planner-heading p { margin:0; max-width:680px; color:#64748b; font-size:.76rem; line-height:1.5; }
    .optimize-btn { flex:0 0 auto; color:#fff; background:linear-gradient(135deg,#2563eb,#4f46e5); box-shadow:0 6px 14px rgba(37,99,235,.22); }
    .route-controls { display:flex; align-items:flex-end; gap:.65rem; margin-top:.9rem; padding:.75rem; border-radius:11px; background:#eff6ff; }
    .route-start-field { display:flex; flex:1; flex-direction:column; gap:.3rem; color:#334155; font-size:.69rem; font-weight:800; }
    .route-start-field select { width:100%; min-height:40px; padding:.55rem .65rem; border:1px solid #93c5fd; border-radius:8px; color:#0f172a; background:#fff; font:inherit; font-weight:650; }
    .location-btn { display:inline-flex; align-items:center; justify-content:center; gap:.35rem; min-height:40px; padding:.55rem .7rem; border:1px solid #93c5fd; border-radius:8px; color:#1d4ed8; background:#fff; font-size:.68rem; font-weight:800; cursor:pointer; }
    .location-btn:disabled { opacity:.55; cursor:not-allowed; }
    .location-btn .material-symbols-outlined { font-size:1rem; }
    .route-message,.route-start-prompt { margin-top:.7rem; padding:.65rem .75rem; border-radius:9px; color:#166534; background:#f0fdf4; font-size:.72rem; }
    .route-message.error { color:#991b1b; background:#fef2f2; }
    .route-start-prompt { display:flex; align-items:center; gap:.4rem; color:#854d0e; background:#fffbeb; }
    .route-start-prompt .material-symbols-outlined { font-size:1rem; }
    .day-routes { display:flex; flex-direction:column; gap:.8rem; margin-top:.8rem; }
    .day-route-card { overflow:hidden; border:1px solid #dbeafe; border-radius:14px; background:#fff; }
    .day-route-card > header { display:flex; align-items:center; justify-content:space-between; gap:.75rem; padding:.75rem .85rem; color:#fff; background:linear-gradient(115deg,#0f3d91,#2563eb); }
    .day-route-card > header span { font-size:.6rem; font-weight:900; letter-spacing:.09em; }
    .day-route-card > header h4 { margin:.15rem 0 0; font-size:.86rem; }
    .route-totals { display:flex; flex-direction:column; align-items:flex-end; white-space:nowrap; }
    .route-totals strong { font-size:.82rem; }
    .route-totals span { opacity:.85; font-size:.62rem !important; letter-spacing:0 !important; }
    .route-map { position:relative; padding:.65rem .65rem 0; }
    .route-map svg { display:block; width:100%; max-height:260px; border-radius:12px; }
    .map-note { display:block; padding:.35rem .15rem .15rem; color:#64748b; font-size:.58rem; text-align:right; }
    .day-route-empty { margin:.75rem; padding:1rem; border:1px dashed #cbd5e1; border-radius:10px; color:#64748b; background:#f8fafc; font-size:.72rem; text-align:center; }
    .route-sequence { display:flex; align-items:center; gap:.5rem; overflow-x:auto; padding:.75rem; scrollbar-width:thin; }
    .route-stop { display:flex; flex:0 0 auto; align-items:center; gap:.4rem; max-width:180px; }
    .stop-number { display:grid; flex:0 0 auto; place-items:center; width:30px; height:30px; border-radius:50%; color:#fff; background:#2563eb; font-size:.68rem; font-weight:900; }
    .start-stop .stop-number { background:#dc2626; }
    .stop-number.return-stay { background:#16a34a; }
    .stop-number .material-symbols-outlined { font-size:.95rem; }
    .route-stop div { display:flex; min-width:0; flex-direction:column; }
    .route-stop small { color:#64748b; font-size:.52rem; font-weight:900; letter-spacing:.06em; }
    .route-stop strong { overflow:hidden; max-width:135px; font-size:.67rem; text-overflow:ellipsis; white-space:nowrap; }
    .route-leg { position:relative; display:grid; flex:0 0 68px; grid-template-columns:1fr 1fr; color:#64748b; font-size:.52rem; text-align:center; }
    .route-leg::before { position:absolute; top:22px; right:5px; left:5px; height:2px; content:''; background:#93c5fd; }
    .route-leg .material-symbols-outlined { z-index:1; grid-column:1/-1; justify-self:end; margin-top:.15rem; color:#2563eb; background:#fff; font-size:.85rem; }
    .google-route-link { display:flex; align-items:center; justify-content:center; gap:.35rem; margin:.1rem .75rem .75rem; padding:.58rem .7rem; border:1px solid #bbf7d0; border-radius:9px; color:#166534; background:#f0fdf4; font-size:.68rem; font-weight:850; text-decoration:none; }
    .google-route-link:hover { border-color:#4ade80; background:#dcfce7; }
    .google-route-link .material-symbols-outlined { font-size:.95rem; }
    .state-card,.empty-card { display:flex; align-items:center; justify-content:center; gap:.75rem; min-height:180px; padding:1.2rem; border:1px solid #e2e8f0; border-radius:14px; background:#fff; text-align:center; }
    .state-card.error { color:#b91c1c; }
    .state-card.error p { margin:.2rem 0 0; color:#64748b; }
    .empty-card { flex-direction:column; }
    .empty-card .material-symbols-outlined { color:#93c5fd; font-size:2.7rem; }
    .empty-card h3 { margin:0; }
    .empty-card p { margin:0 0 .5rem; color:#64748b; }
    .spinner { width:28px; height:28px; border:3px solid #dbeafe; border-top-color:#2563eb; border-radius:50%; animation:spin .75s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .days-list { display:flex; flex-direction:column; gap:.9rem; }
    .day-card { overflow:hidden; border:1px solid #e2e8f0; border-radius:14px; background:#fff; box-shadow:0 5px 18px rgba(15,23,42,.035); }
    .day-header { display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1rem 1.1rem; border-bottom:1px solid #eef2f7; background:#f8fafc; }
    .day-title { display:flex; align-items:center; gap:.8rem; }
    .day-number { padding:.42rem .58rem; color:#1d4ed8; background:#dbeafe; border-radius:8px; font-size:.72rem; font-weight:850; white-space:nowrap; }
    .day-title h3 { margin:0; font-size:.95rem; }
    .day-title p { margin:.2rem 0 0; color:#64748b; font-size:.72rem; }
    .day-actions,.activity-actions { display:flex; align-items:center; gap:.35rem; }
    .icon-btn,.move-btn { display:grid; place-items:center; width:32px; height:32px; border:0; border-radius:8px; color:#475569; background:#fff; cursor:pointer; }
    .icon-btn:hover,.move-btn:hover { background:#e2e8f0; }
    .icon-btn.danger { color:#dc2626; }
    .move-btn:disabled { opacity:.35; cursor:not-allowed; }
    .icon-btn .material-symbols-outlined,.move-btn .material-symbols-outlined { font-size:1rem; }
    .day-empty { display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1.1rem; color:#64748b; font-size:.8rem; }
    .day-empty button { border:0; color:#2563eb; background:transparent; font-weight:800; cursor:pointer; }
    .activity-list { padding:.3rem 1.1rem .7rem; }
    .activity-row { display:grid; grid-template-columns:82px 22px minmax(0,1fr); gap:.65rem; padding-top:.85rem; }
    .activity-time { display:flex; flex-direction:column; align-items:flex-end; gap:.15rem; color:#64748b; font-size:.68rem; }
    .activity-time strong { color:#334155; font-size:.72rem; }
    .timeline { position:relative; display:flex; justify-content:center; }
    .dot { position:relative; z-index:2; width:8px; height:8px; margin-top:.25rem; border-radius:50%; background:#2563eb; }
    .line { position:absolute; top:.75rem; bottom:-.85rem; width:1px; background:#dbeafe; }
    .activity-row:last-child .line { display:none; }
    .activity-main { padding-bottom:.9rem; }
    .activity-title-row { display:flex; align-items:flex-start; justify-content:space-between; gap:.8rem; }
    .activity-title-row h4 { margin:0; font-size:.86rem; }
    .activity-title-row p { display:flex; align-items:center; gap:.2rem; margin:.25rem 0 0; color:#64748b; font-size:.7rem; }
    .activity-title-row p .material-symbols-outlined { font-size:.85rem; }
    .description { margin:.45rem 0 0; color:#475569; font-size:.75rem; line-height:1.45; }
    .activity-meta { display:flex; flex-wrap:wrap; gap:.55rem; margin-top:.5rem; }
    .activity-meta span { display:inline-flex; align-items:center; gap:.15rem; color:#64748b; font-size:.66rem; }
    .activity-meta .material-symbols-outlined { font-size:.8rem; color:#2563eb; }
    .modal-backdrop { position:fixed; inset:0; z-index:3000; display:flex; align-items:center; justify-content:center; padding:1rem; background:rgba(15,23,42,.62); backdrop-filter:blur(5px); }
    .modal { width:min(100%,560px); max-height:92vh; overflow:auto; padding:1.35rem; border-radius:16px; background:#fff; box-shadow:0 22px 50px rgba(15,23,42,.22); }
    .activity-modal { width:min(100%,680px); }
    .modal-header { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; margin-bottom:1rem; }
    .modal-header h3 { margin:0; }
    .modal-header p { margin:.2rem 0 0; color:#64748b; font-size:.78rem; }
    .close-btn { border:0; color:#64748b; background:transparent; font-size:1.7rem; cursor:pointer; }
    .form-error { margin-bottom:.8rem; padding:.7rem .8rem; border-radius:8px; color:#b91c1c; background:#fee2e2; font-size:.78rem; }
    .field { display:flex; flex-direction:column; gap:.3rem; margin-bottom:.8rem; color:#334155; font-size:.75rem; font-weight:750; }
    .field input,.field select,.field textarea { width:100%; box-sizing:border-box; padding:.65rem .72rem; border:1px solid #cbd5e1; border-radius:8px; color:#0f172a; background:#fff; font:inherit; font-weight:500; }
    .field input:focus,.field select:focus,.field textarea:focus { outline:2px solid #bfdbfe; border-color:#2563eb; }
    .form-grid.two { display:grid; grid-template-columns:1fr 1fr; gap:.75rem; }
    .time-picker { display:grid; grid-template-columns:minmax(70px,1fr) auto minmax(72px,1fr) minmax(76px,1fr); align-items:center; gap:.35rem; }
    .time-picker select { min-width:0; }
    .time-separator { color:#64748b; font-weight:850; text-align:center; }
    .modal-actions { display:flex; justify-content:flex-end; gap:.6rem; margin-top:1rem; }
    @media(max-width:700px){
      .planner-toolbar,.day-header,.activity-title-row { align-items:stretch; flex-direction:column; }
      .summary-grid { grid-template-columns:1fr; }
      .route-planner-heading,.route-controls { align-items:stretch; flex-direction:column; }
      .optimize-btn,.location-btn { width:100%; }
      .day-route-card > header { align-items:flex-start; }
      .route-map svg { min-height:180px; }
      .day-actions { flex-wrap:wrap; }
      .activity-row { grid-template-columns:62px 18px minmax(0,1fr); }
      .form-grid.two { grid-template-columns:1fr; gap:0; }
      .activity-actions { justify-content:flex-end; }
    }
  `]
})
export class ItineraryPlannerComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly itineraryService = inject(ItineraryService);
  private readonly placeService = inject(PlaceService);

  @Input({ required: true }) tripId = 0;
  @Input({ required: true }) trip!: Trip;
  @Input() canEdit = false;
  @Output() itineraryChanged = new EventEmitter<void>();

  itinerary: TripItinerary | null = null;
  places: Place[] = [];

  isLoading = true;
  loadError = '';
  isSavingDay = false;
  isSavingActivity = false;
  isReordering = false;
  isOptimizing = false;
  isLocating = false;

  routeStartPlaceId = '';
  currentLocation: (RouteCoordinate & { name: string }) | null = null;
  routeMessage = '';
  routeMessageIsError = false;

  showDayModal = false;
  showActivityModal = false;
  editingDay: ItineraryDay | null = null;
  editingItem: ItineraryItem | null = null;
  dayError = '';
  activityError = '';

  dayForm = this.fb.group({
    dayNumber: [1, [Validators.required, Validators.min(1)]],
    dayDate: ['', Validators.required],
    title: ['', Validators.maxLength(180)],
    notes: ['']
  });

  activityForm = this.fb.group({
    dayId: [0, [Validators.required, Validators.min(1)]],
    title: ['', [Validators.required, Validators.maxLength(180)]],
    startHour: [''],
    startMinute: ['00'],
    startPeriod: ['AM'],
    endHour: [''],
    endMinute: ['00'],
    endPeriod: ['AM'],
    placeId: [''],
    location: ['', Validators.maxLength(255)],
    estimatedCost: [0, Validators.min(0)],
    description: ['']
  });

  readonly hourOptions = Array.from({ length: 12 }, (_, index) => index + 1);
  readonly minuteOptions = Array.from({ length: 60 }, (_, index) =>
    String(index).padStart(2, '0')
  );

  ngOnInit(): void {
    this.loadAll();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tripId'] && !changes['tripId'].firstChange && this.tripId > 0) {
      this.loadAll();
    }
  }

  get tripDurationDays(): number {
    if (!this.trip) return 1;
    const start = new Date(`${this.trip.startDate}T00:00:00`);
    const end = new Date(`${this.trip.endDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
    return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
  }

  get mappedPlaces(): Place[] {
    return this.places.filter((place) => this.hasCoordinates(place));
  }

  get itineraryHasMappedPlaces(): boolean {
    return (this.itinerary?.days ?? []).some((day) =>
      (day.items ?? []).some((item) => this.placeForItem(item) !== undefined)
    );
  }

  get routeStart(): RouteStop | null {
    if (this.routeStartPlaceId === 'CURRENT_LOCATION' && this.currentLocation) {
      return {
        id: 'current-location',
        name: this.currentLocation.name,
        latitude: this.currentLocation.latitude,
        longitude: this.currentLocation.longitude,
        isStay: true
      };
    }

    const placeId = Number(this.routeStartPlaceId);
    const place = this.mappedPlaces.find((entry) => entry.id === placeId);
    if (!place) return null;

    return {
      id: `place-${place.id}`,
      name: place.name,
      latitude: Number(place.latitude),
      longitude: Number(place.longitude),
      isStay: true
    };
  }

  get dayRoutePlans(): DayRoutePlan[] {
    const start = this.routeStart;
    if (!start) return [];
    return [...(this.itinerary?.days ?? [])]
      .sort((left, right) => left.dayNumber - right.dayNumber)
      .map((day) => this.buildDayRoutePlan(day, start));
  }

  loadAll(): void {
    if (!this.tripId) return;

    this.isLoading = true;
    this.loadError = '';

    this.itineraryService.getItinerary(this.tripId).subscribe({
      next: (itinerary) => {
        this.itinerary = itinerary;
        this.isLoading = false;
      },
      error: (err) => {
        this.itinerary = null;
        this.loadError = err?.error?.message || 'Please try again.';
        this.isLoading = false;
      }
    });

    this.placeService.getPlaces(this.tripId).subscribe({
      next: (places) => {
        this.places = places ?? [];
        this.restoreRouteStart();
      },
      error: () => {
        this.places = [];
      }
    });
  }

  sortedItems(day: ItineraryDay): ItineraryItem[] {
    return [...(day.items ?? [])].sort((a, b) => {
      const orderCompare = (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
      if (orderCompare !== 0) return orderCompare;
      return (a.startTime || '99:99').localeCompare(b.startTime || '99:99');
    });
  }

  openCreateDay(): void {
    if (!this.canEdit) return;

    const used = new Set((this.itinerary?.days ?? []).map((day) => day.dayNumber));
    let dayNumber = 1;
    while (used.has(dayNumber) && dayNumber < this.tripDurationDays) {
      dayNumber++;
    }

    this.editingDay = null;
    this.dayError = '';
    this.dayForm.reset({
      dayNumber,
      dayDate: this.dateForDay(dayNumber),
      title: '',
      notes: ''
    });
    this.showDayModal = true;
  }

  openEditDay(day: ItineraryDay): void {
    if (!this.canEdit) return;

    this.editingDay = day;
    this.dayError = '';
    this.dayForm.reset({
      dayNumber: day.dayNumber,
      dayDate: day.dayDate || this.dateForDay(day.dayNumber),
      title: day.title || '',
      notes: day.notes || ''
    });
    this.showDayModal = true;
  }

  closeDayModal(): void {
    if (this.isSavingDay) return;
    this.showDayModal = false;
    this.editingDay = null;
    this.dayError = '';
  }

  saveDay(): void {
    if (!this.canEdit || this.dayForm.invalid) return;

    const value = this.dayForm.getRawValue();
    const dayNumber = Number(value.dayNumber);

    if (dayNumber > this.tripDurationDays) {
      this.dayError = `Day number cannot exceed this trip's ${this.tripDurationDays} days.`;
      return;
    }

    if (!value.dayDate || value.dayDate < this.trip.startDate || value.dayDate > this.trip.endDate) {
      this.dayError = 'Day date must be within the trip dates.';
      return;
    }

    const request = {
      dayNumber,
      dayDate: value.dayDate,
      title: value.title?.trim() || undefined,
      notes: value.notes?.trim() || undefined
    };

    this.isSavingDay = true;
    this.dayError = '';

    const operation = this.editingDay
      ? this.itineraryService.updateDay(this.tripId, this.editingDay.id, request)
      : this.itineraryService.createDay(this.tripId, request);

    operation.subscribe({
      next: () => {
        this.isSavingDay = false;
        this.closeDayModal();
        this.reloadAfterChange();
      },
      error: (err) => {
        this.isSavingDay = false;
        this.dayError = err?.error?.message || 'Unable to save itinerary day.';
      }
    });
  }

  deleteDay(day: ItineraryDay): void {
    if (!this.canEdit) return;

    const activityCount = day.items?.length ?? 0;
    const message = activityCount > 0
      ? `Delete Day ${day.dayNumber} and its ${activityCount} activit${activityCount === 1 ? 'y' : 'ies'}?`
      : `Delete Day ${day.dayNumber}?`;

    if (!window.confirm(message)) return;

    this.itineraryService.deleteDay(this.tripId, day.id).subscribe({
      next: () => this.reloadAfterChange(),
      error: (err) => {
        this.loadError = err?.error?.message || 'Unable to delete itinerary day.';
      }
    });
  }

  openAddActivity(day?: ItineraryDay): void {
    if (!this.canEdit) return;

    const targetDay = day ?? this.itinerary?.days?.[0];
    if (!targetDay) {
      this.openCreateDay();
      return;
    }

    this.editingItem = null;
    this.activityError = '';
    this.activityForm.reset({
      dayId: targetDay.id,
      title: '',
      startHour: '',
      startMinute: '00',
      startPeriod: 'AM',
      endHour: '',
      endMinute: '00',
      endPeriod: 'AM',
      placeId: '',
      location: '',
      estimatedCost: 0,
      description: ''
    });
    this.showActivityModal = true;
  }

  openEditActivity(item: ItineraryItem): void {
    if (!this.canEdit) return;

    this.editingItem = item;
    this.activityError = '';

    const start = this.to12HourParts(item.startTime);
    const end = this.to12HourParts(item.endTime);

    this.activityForm.reset({
      dayId: item.dayId,
      title: item.title,
      startHour: start.hour,
      startMinute: start.minute,
      startPeriod: start.period,
      endHour: end.hour,
      endMinute: end.minute,
      endPeriod: end.period,
      placeId: item.placeId ? String(item.placeId) : '',
      location: item.location || '',
      estimatedCost: item.estimatedCost ?? 0,
      description: item.description || ''
    });
    this.showActivityModal = true;
  }

  closeActivityModal(): void {
    if (this.isSavingActivity) return;
    this.showActivityModal = false;
    this.editingItem = null;
    this.activityError = '';
  }

  saveActivity(): void {
    if (!this.canEdit || this.activityForm.invalid) return;

    const value = this.activityForm.getRawValue();
    const startTime = this.to24HourTime(
      value.startHour,
      value.startMinute,
      value.startPeriod
    );
    const endTime = this.to24HourTime(
      value.endHour,
      value.endMinute,
      value.endPeriod
    );

    if (endTime && !startTime) {
      this.activityError = 'Please select a start time before setting the end time.';
      return;
    }

    if (startTime && endTime && this.timeToMinutes(endTime) < this.timeToMinutes(startTime)) {
      this.activityError = 'End time cannot be before start time.';
      return;
    }

    const request: CreateItineraryItemRequest | UpdateItineraryItemRequest = {
      placeId: value.placeId ? Number(value.placeId) : undefined,
      title: value.title!.trim(),
      description: value.description?.trim() || undefined,
      startTime,
      endTime,
      location: value.location?.trim() || undefined,
      estimatedCost: Number(value.estimatedCost ?? 0),
      displayOrder: this.editingItem?.displayOrder ?? this.nextDisplayOrder(Number(value.dayId))
    };

    this.isSavingActivity = true;
    this.activityError = '';

    const operation = this.editingItem
      ? this.itineraryService.updateItem(this.tripId, this.editingItem.id, request)
      : this.itineraryService.createItem(this.tripId, Number(value.dayId), request);

    operation.subscribe({
      next: () => {
        this.isSavingActivity = false;
        this.closeActivityModal();
        this.reloadAfterChange();
      },
      error: (err) => {
        this.isSavingActivity = false;
        this.activityError = err?.error?.message || 'Unable to save activity.';
      }
    });
  }

  deleteActivity(item: ItineraryItem): void {
    if (!this.canEdit) return;
    if (!window.confirm(`Delete "${item.title}" from the itinerary?`)) return;

    this.itineraryService.deleteItem(this.tripId, item.id).subscribe({
      next: () => this.reloadAfterChange(),
      error: (err) => {
        this.loadError = err?.error?.message || 'Unable to delete activity.';
      }
    });
  }

  moveActivity(day: ItineraryDay, index: number, direction: -1 | 1): void {
    if (!this.canEdit || this.isReordering) return;

    const items = this.sortedItems(day);
    const target = index + direction;
    if (target < 0 || target >= items.length) return;

    [items[index], items[target]] = [items[target], items[index]];

    this.isReordering = true;
    this.itineraryService.reorder(this.tripId, {
      items: items.map((item, itemIndex) => ({
        itemId: item.id,
        displayOrder: itemIndex + 1
      }))
    }).subscribe({
      next: (itinerary) => {
        this.itinerary = itinerary;
        this.isReordering = false;
        this.itineraryChanged.emit();
      },
      error: (err) => {
        this.isReordering = false;
        this.loadError = err?.error?.message || 'Unable to reorder activities.';
      }
    });
  }

  selectRouteStart(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.routeStartPlaceId = select.value;
    this.routeMessage = '';
    this.routeMessageIsError = false;

    try {
      localStorage.setItem(this.routeStartStorageKey, this.routeStartPlaceId);
    } catch {
      // The route still works when browser storage is unavailable.
    }

    if (this.canEdit && this.routeStart) {
      this.optimizeAllDayRoutes();
    }
  }

  useCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.routeMessage = 'Location access is not supported by this browser.';
      this.routeMessageIsError = true;
      return;
    }

    this.isLocating = true;
    this.routeMessage = '';
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.currentLocation = {
          name: 'My current location',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        this.routeStartPlaceId = 'CURRENT_LOCATION';
        this.isLocating = false;
        try {
          localStorage.setItem(this.routeStartStorageKey, this.routeStartPlaceId);
        } catch {
          // Ignore storage restrictions.
        }
        if (this.canEdit) {
          this.optimizeAllDayRoutes();
        }
      },
      (error) => {
        this.isLocating = false;
        this.routeMessageIsError = true;
        this.routeMessage = error.code === error.PERMISSION_DENIED
          ? 'Location permission was denied. Select your saved hotel or stay instead.'
          : 'Unable to find your current location. Please try again.';
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }

  optimizeAllDayRoutes(): void {
    if (!this.canEdit || this.isOptimizing) return;
    const start = this.routeStart;
    if (!start) {
      this.routeMessage = 'Select your staying location before optimizing the route.';
      this.routeMessageIsError = true;
      return;
    }

    const orders = (this.itinerary?.days ?? []).flatMap((day) =>
      this.optimizedItemsForDay(day, start).map((item, index) => ({
        itemId: item.id,
        displayOrder: index + 1
      }))
    );

    if (!orders.length) return;

    this.isOptimizing = true;
    this.routeMessage = '';
    this.routeMessageIsError = false;
    this.itineraryService.reorder(this.tripId, { items: orders }).subscribe({
      next: (itinerary) => {
        this.itinerary = itinerary;
        this.isOptimizing = false;
        this.routeMessage = 'Routes optimized successfully. Every day now starts from the selected stay and visits the nearest next place.';
        this.itineraryChanged.emit();
      },
      error: (err) => {
        this.isOptimizing = false;
        this.routeMessageIsError = true;
        this.routeMessage = err?.error?.message || 'Unable to optimize the routes.';
      }
    });
  }

  formatTravelTime(totalMinutes: number): string {
    const minutes = Math.max(0, Math.round(totalMinutes));
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (!hours) return `${remainder} min`;
    if (!remainder) return `${hours} hr`;
    return `${hours} hr ${remainder} min`;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value ?? 0);
  }

  formatDate(value: string): string {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  formatTime(value?: string): string {
    if (!value) return 'Time not set';
    const [hours, minutes] = value.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatCategory(value: string): string {
    return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private to24HourTime(
    hourValue: string | number | null | undefined,
    minuteValue: string | null | undefined,
    periodValue: string | null | undefined
  ): string | undefined {
    if (hourValue === null || hourValue === undefined || hourValue === '') {
      return undefined;
    }

    let hour = Number(hourValue);
    const minute = Number(minuteValue ?? '00');
    const period = periodValue === 'PM' ? 'PM' : 'AM';

    if (!Number.isInteger(hour) || hour < 1 || hour > 12) {
      return undefined;
    }

    if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
      return undefined;
    }

    if (period === 'AM') {
      hour = hour === 12 ? 0 : hour;
    } else {
      hour = hour === 12 ? 12 : hour + 12;
    }

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  private to12HourParts(value?: string): {
    hour: string;
    minute: string;
    period: 'AM' | 'PM';
  } {
    if (!value) {
      return { hour: '', minute: '00', period: 'AM' };
    }

    const [hourValue, minuteValue] = value.split(':').map(Number);
    if (!Number.isFinite(hourValue) || !Number.isFinite(minuteValue)) {
      return { hour: '', minute: '00', period: 'AM' };
    }

    const period: 'AM' | 'PM' = hourValue >= 12 ? 'PM' : 'AM';
    const hour = hourValue % 12 || 12;

    return {
      hour: String(hour),
      minute: String(minuteValue).padStart(2, '0'),
      period
    };
  }

  private timeToMinutes(value: string): number {
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
  }

  private dateForDay(dayNumber: number): string {
    const start = new Date(`${this.trip.startDate}T00:00:00`);
    start.setDate(start.getDate() + Math.max(0, dayNumber - 1));
    return this.toDateInput(start);
  }

  private toDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private nextDisplayOrder(dayId: number): number {
    const day = this.itinerary?.days?.find((entry) => entry.id === dayId);
    const items = day?.items ?? [];
    if (!items.length) return 1;
    return Math.max(...items.map((item) => item.displayOrder ?? 0)) + 1;
  }

  private get routeStartStorageKey(): string {
    return `tripmate-route-start-${this.tripId}`;
  }

  private restoreRouteStart(): void {
    let stored = '';
    try {
      stored = localStorage.getItem(this.routeStartStorageKey) || '';
    } catch {
      stored = '';
    }

    if (stored && stored !== 'CURRENT_LOCATION' && this.mappedPlaces.some((place) => String(place.id) === stored)) {
      this.routeStartPlaceId = stored;
      return;
    }

    const stay = this.mappedPlaces.find((place) => place.category === 'HOTEL');
    this.routeStartPlaceId = stay ? String(stay.id) : '';
  }

  private hasCoordinates(place: Place): boolean {
    const latitude = Number(place.latitude);
    const longitude = Number(place.longitude);
    return Number.isFinite(latitude) && Number.isFinite(longitude)
      && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
      && (Math.abs(latitude) > 0.0001 || Math.abs(longitude) > 0.0001);
  }

  private placeForItem(item: ItineraryItem): Place | undefined {
    if (!item.placeId) return undefined;
    return this.mappedPlaces.find((place) => place.id === item.placeId);
  }

  private stopForItem(item: ItineraryItem): RouteStop | null {
    const place = this.placeForItem(item);
    if (!place) return null;
    return {
      id: `item-${item.id}`,
      name: place.name || item.title,
      latitude: Number(place.latitude),
      longitude: Number(place.longitude),
      item
    };
  }

  private optimizedItemsForDay(day: ItineraryDay, start: RouteCoordinate): ItineraryItem[] {
    const remaining = this.sortedItems(day)
      .map((item) => ({ item, stop: this.stopForItem(item) }))
      .filter((entry): entry is { item: ItineraryItem; stop: RouteStop } => entry.stop !== null);
    const unmapped = this.sortedItems(day).filter((item) => !this.stopForItem(item));
    const ordered: ItineraryItem[] = [];
    let current = start;

    while (remaining.length) {
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      remaining.forEach((entry, index) => {
        const distance = this.haversineKm(current, entry.stop);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });
      const [nearest] = remaining.splice(nearestIndex, 1);
      ordered.push(nearest.item);
      current = nearest.stop;
    }

    return [...ordered, ...unmapped];
  }

  private buildDayRoutePlan(day: ItineraryDay, start: RouteStop): DayRoutePlan {
    const orderedStops = this.optimizedItemsForDay(day, start)
      .map((item) => this.stopForItem(item))
      .filter((stop): stop is RouteStop => stop !== null);
    const stops = orderedStops.length ? [start, ...orderedStops, { ...start, id: `${start.id}-return` }] : [start];
    const legs: RouteLeg[] = [];

    for (let index = 1; index < stops.length; index++) {
      const directDistance = this.haversineKm(stops[index - 1], stops[index]);
      const distanceKm = Math.round(directDistance * 1.25 * 10) / 10;
      legs.push({
        from: stops[index - 1],
        to: stops[index],
        distanceKm,
        estimatedMinutes: Math.max(3, Math.round((distanceKm / 30) * 60))
      });
    }

    const plotPoints = this.routePlotPoints(stops);
    return {
      day,
      stops,
      legs,
      plotPoints,
      polylinePoints: plotPoints.map((point) => `${point.x},${point.y}`).join(' '),
      totalDistanceKm: legs.reduce((total, leg) => total + leg.distanceKm, 0),
      totalTravelMinutes: legs.reduce((total, leg) => total + leg.estimatedMinutes, 0),
      googleMapsUrl: this.googleMapsDayUrl(start, orderedStops)
    };
  }

  private routePlotPoints(stops: RouteStop[]): RoutePlotPoint[] {
    if (!stops.length) return [];
    const latitudes = stops.map((stop) => stop.latitude);
    const longitudes = stops.map((stop) => stop.longitude);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);
    const latRange = maxLat - minLat;
    const lngRange = maxLng - minLng;

    return stops.map((stop, index) => ({
      ...stop,
      x: lngRange < 0.00001 ? 70 + (index * 660) / Math.max(1, stops.length - 1) : 65 + ((stop.longitude - minLng) / lngRange) * 670,
      y: latRange < 0.00001 ? 140 : 225 - ((stop.latitude - minLat) / latRange) * 170,
      stopNumber: stop.isStay ? 0 : index
    }));
  }

  private googleMapsDayUrl(start: RouteStop, visitStops: RouteStop[]): string {
    if (!visitStops.length) return '';
    const coordinate = (stop: RouteCoordinate) => `${stop.latitude},${stop.longitude}`;
    const params = new URLSearchParams({
      api: '1',
      origin: coordinate(start),
      destination: coordinate(start),
      travelmode: 'driving'
    });
    params.set('waypoints', visitStops.map(coordinate).join('|'));
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }

  private haversineKm(from: RouteCoordinate, to: RouteCoordinate): number {
    const earthRadiusKm = 6371;
    const toRadians = (value: number) => value * Math.PI / 180;
    const latitudeDelta = toRadians(to.latitude - from.latitude);
    const longitudeDelta = toRadians(to.longitude - from.longitude);
    const fromLatitude = toRadians(from.latitude);
    const toLatitude = toRadians(to.latitude);
    const calculation = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(calculation), Math.sqrt(1 - calculation));
  }

  private reloadAfterChange(): void {
    this.itineraryService.getItinerary(this.tripId).subscribe({
      next: (itinerary) => {
        this.itinerary = itinerary;
        this.itineraryChanged.emit();
      },
      error: () => {
        this.loadAll();
        this.itineraryChanged.emit();
      }
    });
  }
}
