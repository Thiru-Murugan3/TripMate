import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import {
  DiscoveredPlace,
  DestinationDiscoveryResponse,
  DiscoveryCategory
} from '../../core/models/discovery.model';
import { Place } from '../../core/models/place.model';
import { Trip } from '../../core/models/trip.model';
import { DiscoveryService } from '../../core/services/discovery.service';
import { ItineraryService } from '../../core/services/itinerary.service';
import { PlaceService } from '../../core/services/place.service';
import { TripService } from '../../core/services/trip.service';

@Component({
  selector: 'app-destination-discovery',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="discover-page">
      <div class="discover-hero">
        <div>
          <span class="eyebrow">DESTINATION DISCOVERY</span>
          <h2>Explore {{ searchDestination || 'your destination' }}</h2>
          <p>
            Find tourist places from OpenStreetMap, save the ones you like, and add them directly
            to your trip itinerary.
          </p>
        </div>
        <div class="hero-icon">
          <span class="material-symbols-outlined">travel_explore</span>
        </div>
      </div>

      <div class="search-panel">
        <label *ngIf="!embeddedMode" class="field trip-field">
          <span>Trip</span>
          <select [ngModel]="activeTripId" (ngModelChange)="selectTrip($event)">
            <option [ngValue]="0">Browse without selecting a trip</option>
            <option *ngFor="let trip of availableTrips" [ngValue]="trip.id">
              {{ trip.name }} · {{ trip.destination }}
            </option>
          </select>
        </label>

        <label class="field destination-field">
          <span>Destination</span>
          <input
            [(ngModel)]="searchDestination"
            [ngModelOptions]="{ standalone: true }"
            maxlength="180"
            placeholder="Ooty, Tamil Nadu"
            (keyup.enter)="discover()"
          />
        </label>

        <label class="field">
          <span>Radius</span>
          <select [(ngModel)]="radiusKm" [ngModelOptions]="{ standalone: true }">
            <option [ngValue]="5">Within 5 km</option>
            <option [ngValue]="10">Within 10 km</option>
            <option [ngValue]="25">Within 25 km</option>
            <option [ngValue]="50">Within 50 km</option>
          </select>
        </label>

        <label class="field">
          <span>Category</span>
          <select [(ngModel)]="category" [ngModelOptions]="{ standalone: true }">
            <option *ngFor="let item of categories" [value]="item">
              {{ formatCategory(item) }}
            </option>
          </select>
        </label>

        <button
          type="button"
          class="btn primary search-btn"
          [disabled]="isLoading || searchDestination.trim().length < 2"
          (click)="discover()"
        >
          <span class="material-symbols-outlined">search</span>
          {{ isLoading ? 'Searching...' : 'Find Tourist Places' }}
        </button>
      </div>

      <div *ngIf="errorMessage" class="message error">
        <span class="material-symbols-outlined">error</span>
        <div>
          <strong>Unable to discover places</strong>
          <span>{{ errorMessage }}</span>
        </div>
      </div>

      <div *ngIf="successMessage" class="message success">
        <span class="material-symbols-outlined">check_circle</span>
        <span>{{ successMessage }}</span>
      </div>

      <div *ngIf="isLoading" class="loading-card">
        <div class="spinner"></div>
        <div>
          <strong>Searching around {{ searchDestination }}</strong>
          <p>Collecting tourist places from the map provider...</p>
        </div>
      </div>

      <ng-container *ngIf="!isLoading && result as discovery">
        <div class="result-toolbar">
          <div>
            <h3>{{ discovery.resultCount }} places found</h3>
            <p>
              {{ discovery.resolvedDestination }} · {{ discovery.radiusKm }} km radius ·
              {{ discovery.attribution }}
            </p>
          </div>

          <label class="local-filter">
            <span class="material-symbols-outlined">filter_alt</span>
            <input
              [(ngModel)]="filterText"
              [ngModelOptions]="{ standalone: true }"
              placeholder="Filter these results..."
            />
          </label>
        </div>

        <div *ngIf="filteredPlaces.length === 0" class="empty-state">
          <span class="material-symbols-outlined">location_off</span>
          <h3>No matching tourist places</h3>
          <p>Try a larger radius, another category, or a more specific destination name.</p>
        </div>

        <div *ngIf="filteredPlaces.length > 0" class="places-grid">
          <article
            *ngFor="let place of filteredPlaces; trackBy: trackPlace"
            class="place-card"
            [class.selected]="isSelected(place)"
            [class.saved]="isAlreadySaved(place)"
          >
            <div class="media">
              <img
                *ngIf="place.imageUrl; else iconFallback"
                [src]="place.imageUrl"
                [alt]="place.name"
                loading="lazy"
                referrerpolicy="no-referrer"
              />
              <ng-template #iconFallback>
                <div class="image-fallback">
                  <span class="material-symbols-outlined">{{ categoryIcon(place.category) }}</span>
                </div>
              </ng-template>

              <span class="category-badge">{{ formatCategory(place.category) }}</span>
              <label *ngIf="canEdit && activeTripId > 0" class="select-box" title="Select place">
                <input
                  type="checkbox"
                  [checked]="isSelected(place)"
                  [disabled]="isSaving || isAlreadySaved(place)"
                  (change)="toggleSelection(place)"
                />
              </label>
            </div>

            <div class="place-body">
              <div class="title-row">
                <h3>{{ place.name }}</h3>
                <span *ngIf="isAlreadySaved(place)" class="saved-pill">
                  <span class="material-symbols-outlined">bookmark_added</span>
                  Saved
                </span>
              </div>

              <div class="meta-row">
                <span>
                  <span class="material-symbols-outlined">near_me</span>
                  {{ place.distanceKm | number:'1.0-1' }} km
                </span>
                <span>
                  <span class="material-symbols-outlined">schedule</span>
                  ~{{ formatDuration(place.suggestedVisitMinutes) }}
                </span>
              </div>

              <p class="description">{{ place.description || 'Tourist place near this destination.' }}</p>

              <p *ngIf="place.openingHours" class="opening-hours">
                <span class="material-symbols-outlined">schedule</span>
                {{ place.openingHours }}
              </p>

              <div class="card-actions">
                <a
                  class="text-action"
                  [href]="openStreetMapUrl(place)"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span class="material-symbols-outlined">map</span>
                  Map
                </a>
                <a
                  *ngIf="place.website"
                  class="text-action"
                  [href]="place.website"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span class="material-symbols-outlined">language</span>
                  Website
                </a>

                <button
                  *ngIf="canEdit && activeTripId > 0 && !isAlreadySaved(place)"
                  type="button"
                  class="mini-add"
                  [disabled]="isSaving"
                  (click)="saveSingle(place)"
                >
                  + Add to Trip
                </button>
              </div>

              <label
                *ngIf="canEdit && activeTripId > 0 && isSelected(place)"
                class="day-picker"
              >
                <span>Add to itinerary</span>
                <select
                  [ngModel]="dayAssignments[place.externalId] || 1"
                  (ngModelChange)="setDayAssignment(place, $event)"
                  [ngModelOptions]="{ standalone: true }"
                >
                  <option *ngFor="let day of availableDayNumbers" [ngValue]="day">
                    Day {{ day }}
                  </option>
                </select>
              </label>
            </div>
          </article>
        </div>

        <div
          *ngIf="canEdit && activeTripId > 0 && selectedCount > 0"
          class="selection-bar"
        >
          <div>
            <strong>{{ selectedCount }} place{{ selectedCount === 1 ? '' : 's' }} selected</strong>
            <span>Choose a quick plan or set each place's day manually.</span>
          </div>

          <div class="plan-buttons">
            <span>Suggested:</span>
            <button type="button" (click)="applySuggestedPlan(1)">1 Day</button>
            <button type="button" (click)="applySuggestedPlan(2)">2 Days</button>
            <button type="button" (click)="applySuggestedPlan(3)">3 Days</button>
          </div>

          <div class="bulk-actions">
            <button type="button" class="btn secondary" [disabled]="isSaving" (click)="saveSelected(false)">
              Save to Places
            </button>
            <button type="button" class="btn primary" [disabled]="isSaving" (click)="saveSelected(true)">
              {{ isSaving ? 'Saving...' : 'Save & Add to Itinerary' }}
            </button>
          </div>
        </div>
      </ng-container>
    </section>
  `,
  styles: [`
    :host { display:block; }
    .discover-page { color:#0f172a; }
    .discover-hero { display:flex; justify-content:space-between; gap:1rem; padding:1.2rem; margin-bottom:1rem; border:1px solid #dbeafe; border-radius:16px; background:linear-gradient(135deg,#eff6ff,#f8fafc); }
    .discover-hero h2 { margin:.2rem 0 .35rem; font-size:1.3rem; }
    .discover-hero p { max-width:720px; margin:0; color:#64748b; font-size:.82rem; line-height:1.55; }
    .eyebrow { color:#2563eb; font-size:.66rem; font-weight:900; letter-spacing:.09em; }
    .hero-icon { display:grid; place-items:center; min-width:64px; height:64px; border-radius:16px; color:#fff; background:#2563eb; box-shadow:0 12px 26px rgba(37,99,235,.25); }
    .hero-icon .material-symbols-outlined { font-size:2rem; }

    .search-panel { display:grid; grid-template-columns:minmax(180px,1.5fr) minmax(130px,.7fr) minmax(160px,.8fr) auto; gap:.7rem; align-items:end; padding:1rem; margin-bottom:1rem; border:1px solid #e2e8f0; border-radius:14px; background:#fff; }
    .search-panel:has(.trip-field) { grid-template-columns:minmax(180px,1fr) minmax(200px,1.4fr) minmax(120px,.6fr) minmax(150px,.7fr) auto; }
    .field { display:flex; flex-direction:column; gap:.3rem; color:#475569; font-size:.7rem; font-weight:800; }
    .field input,.field select { min-width:0; padding:.68rem .72rem; border:1px solid #cbd5e1; border-radius:9px; color:#0f172a; background:#fff; font:inherit; font-weight:600; }
    .field input:focus,.field select:focus { outline:2px solid #bfdbfe; border-color:#2563eb; }
    .btn { display:inline-flex; align-items:center; justify-content:center; gap:.35rem; padding:.68rem .85rem; border:0; border-radius:9px; font-weight:850; cursor:pointer; }
    .btn.primary { color:#fff; background:#2563eb; }
    .btn.secondary { color:#334155; background:#e2e8f0; }
    .btn:disabled { opacity:.55; cursor:not-allowed; }
    .search-btn { min-height:41px; white-space:nowrap; }

    .message { display:flex; gap:.55rem; align-items:center; padding:.75rem .9rem; margin-bottom:1rem; border-radius:10px; font-size:.78rem; }
    .message div { display:flex; flex-direction:column; gap:.1rem; }
    .message.error { color:#991b1b; background:#fef2f2; border:1px solid #fecaca; }
    .message.success { color:#166534; background:#f0fdf4; border:1px solid #bbf7d0; }

    .loading-card,.empty-state { display:flex; align-items:center; justify-content:center; gap:.8rem; min-height:190px; padding:1.2rem; border:1px solid #e2e8f0; border-radius:14px; background:#fff; text-align:center; }
    .loading-card p { margin:.2rem 0 0; color:#64748b; font-size:.76rem; }
    .spinner { width:30px; height:30px; border:3px solid #dbeafe; border-top-color:#2563eb; border-radius:50%; animation:spin .75s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .empty-state { flex-direction:column; }
    .empty-state .material-symbols-outlined { color:#93c5fd; font-size:2.7rem; }
    .empty-state h3,.empty-state p { margin:0; }
    .empty-state p { color:#64748b; font-size:.8rem; }

    .result-toolbar { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:.85rem; }
    .result-toolbar h3 { margin:0; font-size:1rem; }
    .result-toolbar p { margin:.2rem 0 0; color:#64748b; font-size:.7rem; }
    .local-filter { display:flex; align-items:center; gap:.4rem; min-width:260px; padding:.55rem .65rem; border:1px solid #cbd5e1; border-radius:9px; background:#fff; }
    .local-filter .material-symbols-outlined { color:#94a3b8; font-size:1rem; }
    .local-filter input { width:100%; border:0; outline:0; font:inherit; }

    .places-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.85rem; padding-bottom:90px; }
    .place-card { overflow:hidden; border:1px solid #e2e8f0; border-radius:14px; background:#fff; box-shadow:0 6px 18px rgba(15,23,42,.04); transition:.18s ease; }
    .place-card:hover { transform:translateY(-2px); box-shadow:0 10px 24px rgba(15,23,42,.08); }
    .place-card.selected { border-color:#60a5fa; box-shadow:0 0 0 2px #dbeafe; }
    .place-card.saved { border-color:#bbf7d0; }
    .media { position:relative; height:145px; overflow:hidden; background:#f1f5f9; }
    .media img { width:100%; height:100%; object-fit:cover; }
    .image-fallback { display:grid; place-items:center; width:100%; height:100%; color:#2563eb; background:linear-gradient(135deg,#dbeafe,#eff6ff); }
    .image-fallback .material-symbols-outlined { font-size:2.4rem; }
    .category-badge { position:absolute; left:.65rem; bottom:.6rem; padding:.25rem .48rem; border-radius:999px; color:#fff; background:rgba(15,23,42,.78); backdrop-filter:blur(5px); font-size:.6rem; font-weight:850; }
    .select-box { position:absolute; top:.6rem; right:.6rem; display:grid; place-items:center; width:30px; height:30px; border-radius:8px; background:rgba(255,255,255,.92); box-shadow:0 2px 8px rgba(15,23,42,.15); cursor:pointer; }
    .select-box input { width:17px; height:17px; accent-color:#2563eb; }
    .place-body { padding:.9rem; }
    .title-row { display:flex; align-items:flex-start; justify-content:space-between; gap:.5rem; }
    .title-row h3 { margin:0; font-size:.91rem; line-height:1.35; }
    .saved-pill { display:inline-flex; align-items:center; gap:.2rem; flex-shrink:0; padding:.22rem .4rem; border-radius:999px; color:#166534; background:#dcfce7; font-size:.58rem; font-weight:850; }
    .saved-pill .material-symbols-outlined { font-size:.8rem; }
    .meta-row { display:flex; flex-wrap:wrap; gap:.7rem; margin:.6rem 0; color:#64748b; font-size:.67rem; }
    .meta-row span { display:inline-flex; align-items:center; gap:.2rem; }
    .meta-row .material-symbols-outlined { color:#2563eb; font-size:.85rem; }
    .description { min-height:42px; margin:.45rem 0; color:#475569; font-size:.72rem; line-height:1.45; }
    .opening-hours { display:flex; gap:.3rem; align-items:flex-start; color:#64748b; font-size:.66rem; }
    .opening-hours .material-symbols-outlined { font-size:.8rem; color:#2563eb; }
    .card-actions { display:flex; align-items:center; gap:.55rem; margin-top:.7rem; padding-top:.65rem; border-top:1px solid #f1f5f9; }
    .text-action { display:inline-flex; align-items:center; gap:.2rem; color:#2563eb; text-decoration:none; font-size:.67rem; font-weight:800; }
    .text-action .material-symbols-outlined { font-size:.85rem; }
    .mini-add { margin-left:auto; border:0; color:#fff; background:#2563eb; padding:.4rem .55rem; border-radius:7px; font-size:.65rem; font-weight:850; cursor:pointer; }
    .mini-add:disabled { opacity:.5; }
    .day-picker { display:flex; align-items:center; justify-content:space-between; gap:.6rem; margin-top:.65rem; padding:.5rem .6rem; border-radius:8px; color:#475569; background:#f8fafc; font-size:.67rem; font-weight:800; }
    .day-picker select { padding:.32rem .42rem; border:1px solid #cbd5e1; border-radius:6px; background:#fff; }

    .selection-bar { position:sticky; bottom:14px; z-index:20; display:flex; align-items:center; gap:1rem; padding:.8rem 1rem; margin-top:-70px; border:1px solid #bfdbfe; border-radius:14px; background:rgba(255,255,255,.96); box-shadow:0 14px 35px rgba(15,23,42,.16); backdrop-filter:blur(10px); }
    .selection-bar > div:first-child { min-width:180px; }
    .selection-bar strong { display:block; font-size:.78rem; }
    .selection-bar span { color:#64748b; font-size:.65rem; }
    .plan-buttons { display:flex; align-items:center; gap:.35rem; margin-left:auto; }
    .plan-buttons button { border:1px solid #cbd5e1; border-radius:7px; padding:.38rem .52rem; color:#334155; background:#fff; font-size:.64rem; font-weight:800; cursor:pointer; }
    .plan-buttons button:hover { border-color:#93c5fd; color:#2563eb; }
    .bulk-actions { display:flex; gap:.45rem; }

    @media(max-width:1080px){
      .places-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .search-panel,.search-panel:has(.trip-field) { grid-template-columns:1fr 1fr; }
      .search-btn { grid-column:1/-1; }
      .selection-bar { flex-wrap:wrap; }
      .plan-buttons { margin-left:0; }
    }
    @media(max-width:700px){
      .discover-hero { align-items:flex-start; }
      .hero-icon { display:none; }
      .search-panel,.search-panel:has(.trip-field) { grid-template-columns:1fr; }
      .places-grid { grid-template-columns:1fr; }
      .result-toolbar { align-items:stretch; flex-direction:column; }
      .local-filter { min-width:0; }
      .selection-bar { position:static; margin-top:0; }
      .selection-bar,.plan-buttons,.bulk-actions { align-items:stretch; flex-direction:column; }
      .bulk-actions .btn { width:100%; }
    }
  `]
})
export class DestinationDiscoveryComponent implements OnInit {
  private readonly discoveryService = inject(DiscoveryService);
  private readonly placeService = inject(PlaceService);
  private readonly itineraryService = inject(ItineraryService);
  private readonly tripService = inject(TripService);

  @Input() tripId = 0;
  @Input() destination = '';
  @Input() startDate = '';
  @Input() canEdit = true;

  @Output() placesChanged = new EventEmitter<void>();
  @Output() itineraryChanged = new EventEmitter<void>();

  activeTripId = 0;
  searchDestination = '';
  activeStartDate = '';
  availableTrips: Trip[] = [];

  radiusKm = 25;
  category: DiscoveryCategory = 'ALL';
  filterText = '';

  result: DestinationDiscoveryResponse | null = null;
  savedPlaces: Place[] = [];
  selectedIds = new Set<string>();
  dayAssignments: Record<string, number> = {};

  isLoading = false;
  isSaving = false;
  errorMessage = '';
  successMessage = '';

  readonly categories: DiscoveryCategory[] = [
    'ALL',
    'ATTRACTION',
    'NATURE',
    'WATERFALL',
    'LAKE',
    'VIEWPOINT',
    'TEMPLE',
    'CHURCH',
    'MUSEUM',
    'PARK',
    'ADVENTURE',
    'SHOPPING',
    'FOOD',
    'HISTORICAL'
  ];

  get embeddedMode(): boolean {
    return this.tripId > 0;
  }

  get filteredPlaces(): DiscoveredPlace[] {
    const term = this.filterText.trim().toLowerCase();
    if (!term) return this.result?.places ?? [];
    return (this.result?.places ?? []).filter((place) =>
      place.name.toLowerCase().includes(term)
      || place.category.toLowerCase().includes(term)
      || (place.description ?? '').toLowerCase().includes(term)
    );
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  get availableDayNumbers(): number[] {
    const trip = this.availableTrips.find((item) => item.id === this.activeTripId);
    const start = this.activeStartDate || trip?.startDate;
    const end = trip?.endDate;

    if (start && end) {
      const startTime = new Date(`${start}T00:00:00`).getTime();
      const endTime = new Date(`${end}T00:00:00`).getTime();
      const days = Math.max(1, Math.floor((endTime - startTime) / 86400000) + 1);
      return Array.from({ length: Math.min(days, 30) }, (_, index) => index + 1);
    }

    return [1, 2, 3];
  }

  ngOnInit(): void {
    if (this.embeddedMode) {
      this.activeTripId = this.tripId;
      this.searchDestination = this.destination;
      this.activeStartDate = this.startDate;
      void this.loadSavedPlaces();
      if (this.searchDestination.trim().length >= 2) {
        this.discover();
      }
      return;
    }

    this.loadTrips();
  }

  loadTrips(): void {
    this.tripService.getMyTrips().subscribe({
      next: (trips) => {
        this.availableTrips = trips ?? [];
        if (this.availableTrips.length > 0) {
          this.selectTrip(this.availableTrips[0].id);
        }
      },
      error: () => {
        this.availableTrips = [];
      }
    });
  }

  selectTrip(value: number | string): void {
    const tripId = Number(value);
    this.activeTripId = Number.isFinite(tripId) ? tripId : 0;
    const trip = this.availableTrips.find((item) => item.id === this.activeTripId);

    if (trip) {
      this.searchDestination = trip.destination;
      this.activeStartDate = trip.startDate;
      void this.loadSavedPlaces();
      this.discover();
    } else {
      this.savedPlaces = [];
    }
  }

  discover(): void {
    const destination = this.searchDestination.trim();
    if (destination.length < 2) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.selectedIds.clear();
    this.dayAssignments = {};

    this.discoveryService.discoverPlaces(destination, this.radiusKm, this.category).subscribe({
      next: (response) => {
        this.result = response;
        this.isLoading = false;
      },
      error: (err) => {
        this.result = null;
        this.isLoading = false;
        this.errorMessage = err?.error?.message || err?.error?.detail || 'Please try again.';
      }
    });
  }

  async loadSavedPlaces(): Promise<void> {
    if (this.activeTripId <= 0) {
      this.savedPlaces = [];
      return;
    }

    try {
      this.savedPlaces = await firstValueFrom(this.placeService.getPlaces(this.activeTripId));
    } catch {
      this.savedPlaces = [];
    }
  }

  toggleSelection(place: DiscoveredPlace): void {
    if (this.isAlreadySaved(place)) return;

    if (this.selectedIds.has(place.externalId)) {
      this.selectedIds.delete(place.externalId);
      delete this.dayAssignments[place.externalId];
      return;
    }

    this.selectedIds.add(place.externalId);
    this.dayAssignments[place.externalId] = this.dayAssignments[place.externalId] || 1;
  }

  isSelected(place: DiscoveredPlace): boolean {
    return this.selectedIds.has(place.externalId);
  }

  setDayAssignment(place: DiscoveredPlace, day: number | string): void {
    const dayNumber = Math.max(1, Number(day) || 1);
    this.dayAssignments[place.externalId] = dayNumber;
  }

  applySuggestedPlan(days: number): void {
    const candidates = [...(this.result?.places ?? [])]
      .filter((place) => !this.isAlreadySaved(place))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, Math.min((this.result?.places.length ?? 0), days * 4));

    if (this.selectedIds.size === 0) {
      for (const place of candidates) {
        this.selectedIds.add(place.externalId);
      }
    }

    const selected = this.selectedPlaces().sort((a, b) => a.distanceKm - b.distanceKm);
    selected.forEach((place, index) => {
      this.dayAssignments[place.externalId] = (index % days) + 1;
    });

    this.successMessage = `Suggested ${days}-day plan prepared. Review the day assignments, then save it.`;
  }

  async saveSingle(place: DiscoveredPlace): Promise<void> {
    if (this.isAlreadySaved(place)) return;
    this.selectedIds = new Set([place.externalId]);
    this.dayAssignments = { [place.externalId]: 1 };
    await this.saveSelected(false);
  }

  async saveSelected(addToItinerary: boolean): Promise<void> {
    if (!this.canEdit || this.activeTripId <= 0 || this.selectedIds.size === 0 || this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const selected = this.selectedPlaces();
      const savedMap = new Map<string, Place>();

      for (const place of selected) {
        const existing = this.findSavedPlace(place);
        if (existing) {
          savedMap.set(place.externalId, existing);
          continue;
        }

        const created = await firstValueFrom(
          this.placeService.createPlace(this.activeTripId, {
            name: place.name,
            category: place.saveCategory,
            latitude: place.latitude,
            longitude: place.longitude,
            estimatedCost: 0,
            notes: this.discoveryNotes(place)
          })
        );

        this.savedPlaces = [...this.savedPlaces, created];
        savedMap.set(place.externalId, created);
      }

      this.placesChanged.emit();

      if (addToItinerary) {
        await this.addSelectedToItinerary(selected, savedMap);
        this.itineraryChanged.emit();
        this.successMessage = `${selected.length} place(s) saved and added to the itinerary.`;
      } else {
        this.successMessage = `${selected.length} place(s) saved to this trip.`;
      }

      this.selectedIds.clear();
      this.dayAssignments = {};
    } catch (err: any) {
      this.errorMessage = err?.error?.message || 'Unable to save the selected places.';
    } finally {
      this.isSaving = false;
    }
  }

  private async addSelectedToItinerary(
    selected: DiscoveredPlace[],
    savedMap: Map<string, Place>
  ): Promise<void> {
    const itinerary = await firstValueFrom(this.itineraryService.getItinerary(this.activeTripId));
    const dayMap = new Map<number, { id: number; items: Array<{ placeId?: number }> }>();

    for (const day of itinerary.days ?? []) {
      dayMap.set(day.dayNumber, { id: day.id, items: day.items ?? [] });
    }

    for (const place of selected) {
      const saved = savedMap.get(place.externalId);
      if (!saved) continue;

      const dayNumber = this.dayAssignments[place.externalId] || 1;
      let day = dayMap.get(dayNumber);

      if (!day) {
        const createdDay = await firstValueFrom(
          this.itineraryService.createDay(this.activeTripId, {
            dayNumber,
            dayDate: this.dateForDay(dayNumber),
            title: `Day ${dayNumber} · Explore ${this.searchDestination.trim()}`,
            notes: 'Created from Destination Discovery'
          })
        );
        day = { id: createdDay.id, items: createdDay.items ?? [] };
        dayMap.set(dayNumber, day);
      }

      const alreadyPlanned = day.items.some((item) => item.placeId === saved.id);
      if (alreadyPlanned) continue;

      await firstValueFrom(
        this.itineraryService.createItem(this.activeTripId, day.id, {
          placeId: saved.id,
          title: place.name,
          description: place.description,
          location: place.name,
          estimatedCost: 0,
          displayOrder: day.items.length + 1
        })
      );

      day.items.push({ placeId: saved.id });
    }
  }

  private dateForDay(dayNumber: number): string {
    const base = this.activeStartDate || new Date().toISOString().slice(0, 10);
    const date = new Date(`${base}T00:00:00`);
    date.setDate(date.getDate() + dayNumber - 1);
    return date.toISOString().slice(0, 10);
  }

  private selectedPlaces(): DiscoveredPlace[] {
    return (this.result?.places ?? []).filter((place) => this.selectedIds.has(place.externalId));
  }

  isAlreadySaved(place: DiscoveredPlace): boolean {
    return this.findSavedPlace(place) !== undefined;
  }

  private findSavedPlace(place: DiscoveredPlace): Place | undefined {
    return this.savedPlaces.find((saved) => {
      if (saved.name.trim().toLowerCase() !== place.name.trim().toLowerCase()) return false;
      if (saved.latitude == null || saved.longitude == null) return true;

      return Math.abs(Number(saved.latitude) - Number(place.latitude)) < 0.001
        && Math.abs(Number(saved.longitude) - Number(place.longitude)) < 0.001;
    });
  }

  private discoveryNotes(place: DiscoveredPlace): string {
    const parts = [
      `Discovered via OpenStreetMap (${place.category})`,
      `${place.distanceKm.toFixed(1)} km from ${this.searchDestination.trim()}`
    ];
    if (place.openingHours) parts.push(`Opening hours: ${place.openingHours}`);
    return parts.join(' · ');
  }

  openStreetMapUrl(place: DiscoveredPlace): string {
    return `https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=16/${place.latitude}/${place.longitude}`;
  }

  formatCategory(category: DiscoveryCategory): string {
    if (category === 'ALL') return 'All Tourist Places';
    return category
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
  }

  categoryIcon(category: DiscoveredPlace['category']): string {
    switch (category) {
      case 'WATERFALL': return 'water';
      case 'LAKE': return 'waves';
      case 'VIEWPOINT': return 'landscape';
      case 'TEMPLE': return 'temple_hindu';
      case 'CHURCH': return 'church';
      case 'MUSEUM': return 'museum';
      case 'PARK': return 'park';
      case 'NATURE': return 'forest';
      case 'ADVENTURE': return 'hiking';
      case 'SHOPPING': return 'shopping_bag';
      case 'FOOD': return 'restaurant';
      case 'HISTORICAL': return 'castle';
      default: return 'attractions';
    }
  }

  trackPlace(_: number, place: DiscoveredPlace): string {
    return place.externalId;
  }
}
