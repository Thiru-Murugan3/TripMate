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
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import {
  CreatePlaceRequest,
  Place,
  PlaceCategory,
  UpdatePlaceRequest
} from '../../../core/models/place.model';
import { PlaceService } from '../../../core/services/place.service';

@Component({
  selector: 'app-place-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <section class="places-page">
      <div class="places-toolbar">
        <div>
          <span class="eyebrow">PLACES</span>
          <h2>Saved Places</h2>
          <p>Save attractions, restaurants, hotels and other stops for this trip.</p>
        </div>

        <button *ngIf="canEdit" type="button" class="btn primary" (click)="openCreatePlace()">
          <span class="material-symbols-outlined">add_location_alt</span>
          Add Place
        </button>
      </div>

      <div class="places-controls">
        <label class="search-box">
          <span class="material-symbols-outlined">search</span>
          <input
            [(ngModel)]="searchTerm"
            [ngModelOptions]="{ standalone: true }"
            placeholder="Search saved places..."
            aria-label="Search saved places"
          />
        </label>

        <select
          class="category-filter"
          [(ngModel)]="categoryFilter"
          [ngModelOptions]="{ standalone: true }"
          aria-label="Filter by place category"
        >
          <option value="ALL">All Categories</option>
          <option *ngFor="let category of categories" [value]="category">
            {{ formatCategory(category) }}
          </option>
        </select>

        <button
          *ngIf="searchTerm || categoryFilter !== 'ALL'"
          type="button"
          class="clear-filter"
          (click)="clearFilters()"
        >
          Clear
        </button>
      </div>

      <div *ngIf="isLoading" class="state-card">
        <div class="spinner"></div>
        <span>Loading places...</span>
      </div>

      <div *ngIf="!isLoading && loadError" class="state-card error">
        <span class="material-symbols-outlined">error</span>
        <div>
          <strong>Unable to load places</strong>
          <p>{{ loadError }}</p>
        </div>
        <button type="button" class="btn secondary" (click)="loadPlaces()">Retry</button>
      </div>

      <ng-container *ngIf="!isLoading && !loadError">
        <div class="places-summary">
          <article>
            <span>Saved Places</span>
            <strong>{{ places.length }}</strong>
          </article>
          <article>
            <span>Showing</span>
            <strong>{{ filteredPlaces.length }}</strong>
          </article>
          <article>
            <span>Estimated Cost</span>
            <strong>{{ formatCurrency(totalEstimatedCost) }}</strong>
          </article>
        </div>

        <div *ngIf="places.length === 0" class="empty-state">
          <span class="material-symbols-outlined">add_location_alt</span>
          <h3>No saved places yet</h3>
          <p>Add places now so they can be selected directly while creating itinerary activities.</p>
          <button *ngIf="canEdit" type="button" class="btn primary" (click)="openCreatePlace()">
            Add First Place
          </button>
        </div>

        <div *ngIf="places.length > 0 && filteredPlaces.length === 0" class="empty-state">
          <span class="material-symbols-outlined">search_off</span>
          <h3>No places match your filters</h3>
          <p>Try a different place name or category.</p>
          <button type="button" class="btn secondary" (click)="clearFilters()">Reset Filters</button>
        </div>

        <div *ngIf="filteredPlaces.length > 0" class="places-grid">
          <article *ngFor="let place of filteredPlaces" class="place-card">
            <div class="place-card-top">
              <div class="place-icon" [attr.data-category]="place.category">
                <span class="material-symbols-outlined">{{ categoryIcon(place.category) }}</span>
              </div>

              <div class="place-heading">
                <h3>{{ place.name }}</h3>
                <span class="category-pill">{{ formatCategory(place.category) }}</span>
              </div>

              <div *ngIf="canEdit" class="place-actions">
                <button type="button" class="icon-btn" title="Edit place" (click)="openEditPlace(place)">
                  <span class="material-symbols-outlined">edit</span>
                </button>
                <button
                  type="button"
                  class="icon-btn danger"
                  title="Delete place"
                  [disabled]="deletingPlaceId === place.id"
                  (click)="deletePlace(place)"
                >
                  <span class="material-symbols-outlined">delete</span>
                </button>
              </div>
            </div>

            <div class="place-details">
              <div class="detail-row">
                <span>Estimated Cost</span>
                <strong>{{ formatCurrency(place.estimatedCost || 0) }}</strong>
              </div>

              <div *ngIf="hasCoordinates(place)" class="coordinates">
                <span>
                  <span class="material-symbols-outlined">my_location</span>
                  {{ place.latitude }}, {{ place.longitude }}
                </span>
              </div>

              <p *ngIf="place.notes" class="place-notes">{{ place.notes }}</p>
              <p *ngIf="!place.notes" class="place-notes muted">No notes added.</p>
            </div>
          </article>
        </div>
      </ng-container>

      <div *ngIf="showPlaceModal" class="modal-backdrop">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3>{{ editingPlace ? 'Edit Place' : 'Add Place' }}</h3>
              <p>
                {{
                  editingPlace
                    ? 'Update this saved place.'
                    : 'Save a place and reuse it while planning itinerary activities.'
                }}
              </p>
            </div>
            <button type="button" class="close-btn" (click)="closePlaceModal()" aria-label="Close">
              &times;
            </button>
          </div>

          <div *ngIf="formError" class="form-error">{{ formError }}</div>

          <form [formGroup]="placeForm" (ngSubmit)="savePlace()">
            <label class="field">
              <span>Place Name *</span>
              <input formControlName="name" maxlength="180" placeholder="Ooty Lake" />
            </label>

            <label class="field">
              <span>Category *</span>
              <select formControlName="category">
                <option *ngFor="let category of categories" [value]="category">
                  {{ formatCategory(category) }}
                </option>
              </select>
            </label>

            <div class="form-grid two">
              <label class="field">
                <span>Estimated Cost (₹)</span>
                <input type="number" min="0" step="1" formControlName="estimatedCost" />
              </label>

              <div class="coordinate-hint">
                <span class="material-symbols-outlined">info</span>
                <span>Latitude and longitude are optional.</span>
              </div>
            </div>

            <div class="form-grid two">
              <label class="field">
                <span>Latitude</span>
                <input
                  type="number"
                  min="-90"
                  max="90"
                  step="0.000001"
                  formControlName="latitude"
                  placeholder="11.4064"
                />
              </label>

              <label class="field">
                <span>Longitude</span>
                <input
                  type="number"
                  min="-180"
                  max="180"
                  step="0.000001"
                  formControlName="longitude"
                  placeholder="76.6932"
                />
              </label>
            </div>

            <label class="field">
              <span>Notes</span>
              <textarea
                formControlName="notes"
                rows="4"
                placeholder="Boating, sightseeing, parking details, opening hours, etc."
              ></textarea>
            </label>

            <div class="itinerary-note">
              <span class="material-symbols-outlined">route</span>
              Once saved, this place will be available in Itinerary → Add Activity → Saved Place.
            </div>

            <div class="modal-actions">
              <button type="button" class="btn secondary" (click)="closePlaceModal()">Cancel</button>
              <button
                type="submit"
                class="btn primary"
                [disabled]="placeForm.invalid || isSavingPlace"
              >
                {{ isSavingPlace ? 'Saving...' : (editingPlace ? 'Save Changes' : 'Save Place') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  `,
  styles: [`
    :host { display:block; }
    .places-page { color:#0f172a; }
    .places-toolbar { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; margin-bottom:1rem; }
    .places-toolbar h2 { margin:.15rem 0 .25rem; font-size:1.15rem; }
    .places-toolbar p { margin:0; color:#64748b; font-size:.82rem; }
    .eyebrow { color:#2563eb; font-size:.66rem; font-weight:850; letter-spacing:.08em; }
    .btn { display:inline-flex; align-items:center; justify-content:center; gap:.35rem; padding:.62rem .9rem; border:0; border-radius:9px; font-weight:800; cursor:pointer; }
    .btn.primary { color:#fff; background:#2563eb; }
    .btn.secondary { color:#334155; background:#e2e8f0; }
    .btn:disabled { opacity:.55; cursor:not-allowed; }

    .places-controls { display:flex; align-items:center; gap:.65rem; margin-bottom:1rem; }
    .search-box { display:flex; align-items:center; gap:.45rem; flex:1; min-width:0; padding:.58rem .7rem; border:1px solid #cbd5e1; border-radius:10px; background:#fff; }
    .search-box .material-symbols-outlined { color:#94a3b8; font-size:1rem; }
    .search-box input { width:100%; min-width:0; border:0; outline:0; color:#0f172a; font:inherit; }
    .category-filter { min-width:190px; padding:.62rem .7rem; border:1px solid #cbd5e1; border-radius:10px; color:#334155; background:#fff; }
    .clear-filter { border:0; color:#2563eb; background:transparent; font-weight:800; cursor:pointer; }

    .places-summary { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.75rem; margin-bottom:1rem; }
    .places-summary article { padding:.85rem 1rem; border:1px solid #e2e8f0; border-radius:12px; background:#fff; }
    .places-summary span { display:block; color:#64748b; font-size:.66rem; font-weight:850; letter-spacing:.03em; text-transform:uppercase; }
    .places-summary strong { display:block; margin-top:.32rem; font-size:1.02rem; }

    .places-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.85rem; }
    .place-card { padding:1rem; border:1px solid #e2e8f0; border-radius:14px; background:#fff; box-shadow:0 5px 18px rgba(15,23,42,.035); }
    .place-card-top { display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:.75rem; align-items:flex-start; }
    .place-icon { display:grid; place-items:center; width:42px; height:42px; border-radius:11px; color:#2563eb; background:#eff6ff; }
    .place-icon[data-category='RESTAURANT'] { color:#dc2626; background:#fef2f2; }
    .place-icon[data-category='HOTEL'] { color:#7c3aed; background:#f5f3ff; }
    .place-icon[data-category='SHOPPING'] { color:#db2777; background:#fdf2f8; }
    .place-icon[data-category='FUEL'] { color:#d97706; background:#fffbeb; }
    .place-icon[data-category='ACTIVITY'] { color:#059669; background:#ecfdf5; }
    .place-heading h3 { margin:0 0 .28rem; font-size:.92rem; }
    .category-pill { display:inline-flex; padding:.22rem .45rem; border-radius:999px; color:#475569; background:#f1f5f9; font-size:.62rem; font-weight:850; }
    .place-actions { display:flex; gap:.25rem; }
    .icon-btn { display:grid; place-items:center; width:31px; height:31px; border:0; border-radius:8px; color:#475569; background:#f8fafc; cursor:pointer; }
    .icon-btn:hover { background:#e2e8f0; }
    .icon-btn.danger { color:#dc2626; }
    .icon-btn:disabled { opacity:.4; cursor:not-allowed; }
    .icon-btn .material-symbols-outlined { font-size:1rem; }
    .place-details { margin-top:.8rem; padding-top:.75rem; border-top:1px solid #f1f5f9; }
    .detail-row { display:flex; align-items:center; justify-content:space-between; gap:1rem; font-size:.76rem; }
    .detail-row span { color:#64748b; }
    .coordinates { margin-top:.55rem; }
    .coordinates span { display:inline-flex; align-items:center; gap:.25rem; color:#64748b; font-size:.7rem; }
    .coordinates .material-symbols-outlined { color:#2563eb; font-size:.85rem; }
    .place-notes { margin:.65rem 0 0; color:#475569; font-size:.75rem; line-height:1.45; }
    .place-notes.muted { color:#94a3b8; font-style:italic; }

    .state-card,.empty-state { display:flex; align-items:center; justify-content:center; gap:.75rem; min-height:200px; padding:1.2rem; border:1px solid #e2e8f0; border-radius:14px; background:#fff; text-align:center; }
    .state-card.error { color:#b91c1c; }
    .state-card.error p { margin:.2rem 0 0; color:#64748b; }
    .empty-state { flex-direction:column; }
    .empty-state > .material-symbols-outlined { color:#93c5fd; font-size:2.7rem; }
    .empty-state h3 { margin:0; }
    .empty-state p { max-width:520px; margin:0 0 .4rem; color:#64748b; font-size:.8rem; }
    .spinner { width:28px; height:28px; border:3px solid #dbeafe; border-top-color:#2563eb; border-radius:50%; animation:spin .75s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }

    .modal-backdrop { position:fixed; inset:0; z-index:3000; display:flex; align-items:center; justify-content:center; padding:1rem; background:rgba(15,23,42,.62); backdrop-filter:blur(5px); }
    .modal { width:min(100%,620px); max-height:92vh; overflow:auto; padding:1.35rem; border-radius:16px; background:#fff; box-shadow:0 22px 50px rgba(15,23,42,.22); }
    .modal-header { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; margin-bottom:1rem; }
    .modal-header h3 { margin:0; }
    .modal-header p { margin:.2rem 0 0; color:#64748b; font-size:.78rem; }
    .close-btn { border:0; color:#64748b; background:transparent; font-size:1.7rem; cursor:pointer; }
    .form-error { margin-bottom:.8rem; padding:.7rem .8rem; border-radius:8px; color:#b91c1c; background:#fee2e2; font-size:.78rem; }
    .field { display:flex; flex-direction:column; gap:.3rem; margin-bottom:.8rem; color:#334155; font-size:.75rem; font-weight:750; }
    .field input,.field select,.field textarea { width:100%; box-sizing:border-box; padding:.65rem .72rem; border:1px solid #cbd5e1; border-radius:8px; color:#0f172a; background:#fff; font:inherit; font-weight:500; }
    .field input:focus,.field select:focus,.field textarea:focus { outline:2px solid #bfdbfe; border-color:#2563eb; }
    .form-grid.two { display:grid; grid-template-columns:1fr 1fr; gap:.75rem; }
    .coordinate-hint { display:flex; align-items:center; gap:.35rem; align-self:end; min-height:39px; margin-bottom:.8rem; color:#64748b; font-size:.7rem; }
    .coordinate-hint .material-symbols-outlined { color:#2563eb; font-size:.9rem; }
    .itinerary-note { display:flex; align-items:flex-start; gap:.45rem; padding:.7rem .8rem; color:#475569; background:#f8fafc; border-radius:9px; font-size:.73rem; }
    .itinerary-note .material-symbols-outlined { color:#2563eb; font-size:1rem; }
    .modal-actions { display:flex; justify-content:flex-end; gap:.6rem; margin-top:1rem; }

    @media(max-width:760px){
      .places-toolbar { align-items:stretch; flex-direction:column; }
      .places-toolbar .btn { width:100%; }
      .places-controls { align-items:stretch; flex-direction:column; }
      .category-filter { width:100%; min-width:0; }
      .places-summary { grid-template-columns:1fr; }
      .places-grid { grid-template-columns:1fr; }
      .form-grid.two { grid-template-columns:1fr; gap:0; }
    }
  `]
})
export class PlaceManagerComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly placeService = inject(PlaceService);

  @Input({ required: true }) tripId = 0;
  @Input() canEdit = false;
  @Output() placesChanged = new EventEmitter<void>();

  places: Place[] = [];
  searchTerm = '';
  categoryFilter: 'ALL' | PlaceCategory = 'ALL';

  isLoading = true;
  loadError = '';
  showPlaceModal = false;
  editingPlace: Place | null = null;
  isSavingPlace = false;
  deletingPlaceId: number | null = null;
  formError = '';

  readonly categories: PlaceCategory[] = [
    'ATTRACTION',
    'RESTAURANT',
    'HOTEL',
    'ACTIVITY',
    'SHOPPING',
    'FUEL',
    'REST_STOP',
    'OTHER'
  ];

  placeForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(180)]],
    category: ['ATTRACTION' as PlaceCategory, Validators.required],
    estimatedCost: [0, Validators.min(0)],
    latitude: [null as number | null, [Validators.min(-90), Validators.max(90)]],
    longitude: [null as number | null, [Validators.min(-180), Validators.max(180)]],
    notes: ['']
  });

  ngOnInit(): void {
    this.loadPlaces();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tripId'] && !changes['tripId'].firstChange && this.tripId > 0) {
      this.loadPlaces();
    }
  }

  get filteredPlaces(): Place[] {
    const query = this.searchTerm.trim().toLowerCase();

    return this.places.filter((place) => {
      const matchesCategory =
        this.categoryFilter === 'ALL' || place.category === this.categoryFilter;

      const matchesSearch =
        !query ||
        place.name.toLowerCase().includes(query) ||
        (place.notes || '').toLowerCase().includes(query) ||
        this.formatCategory(place.category).toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }

  get totalEstimatedCost(): number {
    return this.places.reduce(
      (total, place) => total + Number(place.estimatedCost || 0),
      0
    );
  }

  loadPlaces(): void {
    if (!this.tripId) return;

    this.isLoading = true;
    this.loadError = '';

    this.placeService.getPlaces(this.tripId).subscribe({
      next: (places) => {
        this.places = places ?? [];
        this.isLoading = false;
      },
      error: (err) => {
        this.places = [];
        this.loadError = err?.error?.message || 'Please try again.';
        this.isLoading = false;
      }
    });
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.categoryFilter = 'ALL';
  }

  openCreatePlace(): void {
    if (!this.canEdit) return;

    this.editingPlace = null;
    this.formError = '';
    this.placeForm.reset({
      name: '',
      category: 'ATTRACTION',
      estimatedCost: 0,
      latitude: null,
      longitude: null,
      notes: ''
    });
    this.showPlaceModal = true;
  }

  openEditPlace(place: Place): void {
    if (!this.canEdit) return;

    this.editingPlace = place;
    this.formError = '';
    this.placeForm.reset({
      name: place.name,
      category: place.category,
      estimatedCost: place.estimatedCost ?? 0,
      latitude: place.latitude ?? null,
      longitude: place.longitude ?? null,
      notes: place.notes ?? ''
    });
    this.showPlaceModal = true;
  }

  closePlaceModal(): void {
    if (this.isSavingPlace) return;
    this.showPlaceModal = false;
    this.editingPlace = null;
    this.formError = '';
  }

  savePlace(): void {
    if (!this.canEdit || this.placeForm.invalid) return;

    const value = this.placeForm.getRawValue();
    const request: CreatePlaceRequest | UpdatePlaceRequest = {
      name: value.name!.trim(),
      category: value.category as PlaceCategory,
      estimatedCost: Number(value.estimatedCost ?? 0),
      latitude: this.optionalNumber(value.latitude),
      longitude: this.optionalNumber(value.longitude),
      notes: value.notes?.trim() || undefined
    };

    this.isSavingPlace = true;
    this.formError = '';

    const operation = this.editingPlace
      ? this.placeService.updatePlace(
          this.tripId,
          this.editingPlace.id,
          request as UpdatePlaceRequest
        )
      : this.placeService.createPlace(
          this.tripId,
          request as CreatePlaceRequest
        );

    operation.subscribe({
      next: () => {
        this.isSavingPlace = false;
        this.showPlaceModal = false;
        this.editingPlace = null;
        this.reloadAfterChange();
      },
      error: (err) => {
        this.isSavingPlace = false;
        this.formError = err?.error?.message || 'Unable to save place.';
      }
    });
  }

  deletePlace(place: Place): void {
    if (!this.canEdit || this.deletingPlaceId !== null) return;

    if (!window.confirm(`Delete "${place.name}" from saved places?`)) {
      return;
    }

    this.deletingPlaceId = place.id;
    this.loadError = '';

    this.placeService.deletePlace(this.tripId, place.id).subscribe({
      next: () => {
        this.deletingPlaceId = null;
        this.reloadAfterChange();
      },
      error: (err) => {
        this.deletingPlaceId = null;
        this.loadError = err?.error?.message || 'Unable to delete place.';
      }
    });
  }

  hasCoordinates(place: Place): boolean {
    return place.latitude !== undefined && place.latitude !== null
      && place.longitude !== undefined && place.longitude !== null;
  }

  categoryIcon(category: PlaceCategory): string {
    switch (category) {
      case 'ATTRACTION': return 'attractions';
      case 'RESTAURANT': return 'restaurant';
      case 'HOTEL': return 'hotel';
      case 'ACTIVITY': return 'hiking';
      case 'SHOPPING': return 'shopping_bag';
      case 'FUEL': return 'local_gas_station';
      case 'REST_STOP': return 'local_cafe';
      default: return 'place';
    }
  }

  formatCategory(category: PlaceCategory): string {
    return category
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value ?? 0);
  }

  private optionalNumber(value: number | null | undefined): number | undefined {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return undefined;
    }
    return Number(value);
  }

  private reloadAfterChange(): void {
    this.placeService.getPlaces(this.tripId).subscribe({
      next: (places) => {
        this.places = places ?? [];
        this.placesChanged.emit();
      },
      error: () => {
        this.loadPlaces();
        this.placesChanged.emit();
      }
    });
  }
}
