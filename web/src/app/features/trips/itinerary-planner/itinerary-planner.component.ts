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

      <div *ngIf="showDayModal" class="modal-backdrop" (click)="closeDayModal()">
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

      <div *ngIf="showActivityModal" class="modal-backdrop" (click)="closeActivityModal()">
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

            <div class="form-grid two">
              <label class="field">
                <span>Start Time</span>
                <input type="time" formControlName="startTime" />
              </label>
              <label class="field">
                <span>End Time</span>
                <input type="time" formControlName="endTime" />
              </label>
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
    .modal-actions { display:flex; justify-content:flex-end; gap:.6rem; margin-top:1rem; }
    @media(max-width:700px){
      .planner-toolbar,.day-header,.activity-title-row { align-items:stretch; flex-direction:column; }
      .summary-grid { grid-template-columns:1fr; }
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
    startTime: [''],
    endTime: [''],
    placeId: [''],
    location: ['', Validators.maxLength(255)],
    estimatedCost: [0, Validators.min(0)],
    description: ['']
  });

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
      startTime: '',
      endTime: '',
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
    this.activityForm.reset({
      dayId: item.dayId,
      title: item.title,
      startTime: item.startTime || '',
      endTime: item.endTime || '',
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
    const startTime = value.startTime || undefined;
    const endTime = value.endTime || undefined;

    if (startTime && endTime && endTime < startTime) {
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
