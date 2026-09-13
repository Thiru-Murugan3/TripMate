import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TripService } from '../../core/services/trip.service';
import { AuthService } from '../../core/services/auth.service';
import { Trip, TripType, CreateTripRequest } from '../../core/models/trip.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="dashboard-container">
      <!-- Top Welcome Banner -->
      <div class="welcome-banner card glass-panel">
        <div class="welcome-text">
          <h1>Welcome back, {{ authService.currentUser()?.name }}! 👋</h1>
          <p>Plan, organize, and explore your upcoming adventures with TripMate.</p>
        </div>
        <button (click)="openCreateModal()" class="btn btn-primary">
          <span class="material-symbols-outlined">add_location_alt</span>
          Plan New Trip
        </button>
      </div>

      <!-- Quick Metrics -->
      <div class="metrics-grid">
        <div class="metric-card card">
          <div class="metric-icon bg-indigo">
            <span class="material-symbols-outlined">explore</span>
          </div>
          <div class="metric-data">
            <span class="metric-value">{{ trips.length }}</span>
            <span class="metric-label">Total Trips</span>
          </div>
        </div>

        <div class="metric-card card">
          <div class="metric-icon bg-teal">
            <span class="material-symbols-outlined">flight_takeoff</span>
          </div>
          <div class="metric-data">
            <span class="metric-value">{{ upcomingCount }}</span>
            <span class="metric-label">Upcoming Trips</span>
          </div>
        </div>

        <div class="metric-card card">
          <div class="metric-icon bg-emerald">
            <span class="material-symbols-outlined">wb_sunny</span>
          </div>
          <div class="metric-data">
            <span class="metric-value">{{ ongoingCount }}</span>
            <span class="metric-label">Ongoing Trips</span>
          </div>
        </div>

        <div class="metric-card card">
          <div class="metric-icon bg-amber">
            <span class="material-symbols-outlined">account_balance_wallet</span>
          </div>
          <div class="metric-data">
            <span class="metric-value">\${{ totalBudget | number:'1.0-0' }}</span>
            <span class="metric-label">Total Budget</span>
          </div>
        </div>
      </div>

      <!-- My Trips Section -->
      <div class="section-header">
        <h2>My Trips</h2>
        <div class="filter-pills">
          <button (click)="activeFilter = 'ALL'" [class.active]="activeFilter === 'ALL'" class="pill">All</button>
          <button (click)="activeFilter = 'UPCOMING'" [class.active]="activeFilter === 'UPCOMING'" class="pill">Upcoming</button>
          <button (click)="activeFilter = 'ONGOING'" [class.active]="activeFilter === 'ONGOING'" class="pill">Ongoing</button>
          <button (click)="activeFilter = 'COMPLETED'" [class.active]="activeFilter === 'COMPLETED'" class="pill">Completed</button>
        </div>
      </div>

      <div *ngIf="isLoading" class="loading-state card">
        <span class="material-symbols-outlined spin">sync</span>
        Loading your trips...
      </div>

      <div *ngIf="!isLoading && filteredTrips.length === 0" class="empty-state card">
        <span class="material-symbols-outlined empty-icon">luggage</span>
        <h3>No trips found</h3>
        <p>Start your journey by creating your first trip!</p>
        <button (click)="openCreateModal()" class="btn btn-primary mt-3">
          <span class="material-symbols-outlined">add</span> Create Trip
        </button>
      </div>

      <!-- Trips Grid -->
      <div *ngIf="!isLoading && filteredTrips.length > 0" class="trips-grid">
        <div *ngFor="let trip of filteredTrips" class="trip-card card card-hover">
          <div class="trip-image-header">
            <div class="status-badge" [ngClass]="trip.status.toLowerCase()">
              {{ trip.status }}
            </div>
            <div class="type-badge">{{ trip.tripType }}</div>
          </div>
          
          <div class="trip-body">
            <h3 class="trip-title">{{ trip.name }}</h3>
            <div class="trip-meta">
              <span class="meta-item">
                <span class="material-symbols-outlined">location_on</span>
                {{ trip.destination }}
              </span>
              <span class="meta-item">
                <span class="material-symbols-outlined">calendar_month</span>
                {{ formatDateRange(trip.startDate, trip.endDate) }}
              </span>
            </div>

            <p class="trip-desc" *ngIf="trip.description">{{ trip.description }}</p>

            <div class="trip-footer">
              <div class="budget-tag">
                <span class="material-symbols-outlined">payments</span>
                \${{ trip.budget | number:'1.0-0' }}
              </div>
              <a [routerLink]="['/trips', trip.id]" class="btn btn-secondary btn-sm">
                View Details
                <span class="material-symbols-outlined">arrow_forward</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Create Trip Modal Backdrop -->
      <div *ngIf="showCreateModal" class="modal-backdrop" (click)="closeCreateModal()">
        <div class="modal-content card glass-panel" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Plan a New Trip</h3>
            <button (click)="closeCreateModal()" class="close-btn">&times;</button>
          </div>

          <div *ngIf="modalError" class="alert alert-danger">
            {{ modalError }}
          </div>

          <form [formGroup]="createTripForm" (ngSubmit)="onCreateTripSubmit()">
            <div class="form-group">
              <label class="form-label">Trip Name</label>
              <input type="text" class="form-control" formControlName="name" placeholder="Summer Vacation in Bali" />
            </div>

            <div class="form-group">
              <label class="form-label">Destination</label>
              <input type="text" class="form-control" formControlName="destination" placeholder="Bali, Indonesia" />
            </div>

            <div class="form-row">
              <div class="form-group half">
                <label class="form-label">Trip Type</label>
                <select class="form-control" formControlName="tripType">
                  <option value="SOLO">Solo</option>
                  <option value="COUPLE">Couple</option>
                  <option value="FRIENDS">Friends</option>
                  <option value="FAMILY">Family</option>
                  <option value="ADVENTURE">Adventure</option>
                </select>
              </div>

              <div class="form-group half">
                <label class="form-label">Traveler Count</label>
                <input type="number" class="form-control" formControlName="travelerCount" min="1" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group half">
                <label class="form-label">Start Date</label>
                <input type="date" class="form-control" formControlName="startDate" />
              </div>

              <div class="form-group half">
                <label class="form-label">End Date</label>
                <input type="date" class="form-control" formControlName="endDate" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Budget ($)</label>
              <input type="number" class="form-control" formControlName="budget" min="0" placeholder="1500" />
            </div>

            <div class="form-group">
              <label class="form-label">Description (Optional)</label>
              <textarea class="form-control" formControlName="description" rows="3" placeholder="Trip notes and highlights..."></textarea>
            </div>

            <div class="modal-actions">
              <button type="button" (click)="closeCreateModal()" class="btn btn-secondary">Cancel</button>
              <button type="submit" class="btn btn-primary" [disabled]="createTripForm.invalid || isSubmitting">
                {{ isSubmitting ? 'Creating...' : 'Create Trip' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }
    .welcome-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 2.5rem 2rem;
      margin-bottom: 2rem;
      background: var(--brand-gradient);
      color: white;
      border: none;
    }
    .welcome-text h1 {
      color: white;
      font-size: 1.8rem;
    }
    .welcome-text p {
      color: rgba(255, 255, 255, 0.85);
      margin-top: 0.3rem;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2.5rem;
    }
    .metric-card {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      padding: 1.5rem;
    }
    .metric-icon {
      width: 52px;
      height: 52px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }
    .metric-icon .material-symbols-outlined { font-size: 1.8rem; }
    .bg-indigo { background: #6366F1; }
    .bg-teal { background: #0D9488; }
    .bg-emerald { background: #10B981; }
    .bg-amber { background: #F59E0B; }
    
    .metric-data { display: flex; flex-direction: column; }
    .metric-value { font-size: 1.6rem; font-weight: 800; font-family: var(--font-heading); }
    .metric-label { font-size: 0.875rem; color: var(--text-muted); font-weight: 500; }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    .filter-pills { display: flex; gap: 0.5rem; }
    .pill {
      border: 1px solid var(--border);
      background: var(--surface-card);
      padding: 0.4rem 1rem;
      border-radius: var(--radius-full);
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      color: var(--text-secondary);
      transition: all 0.2s;
    }
    .pill.active, .pill:hover {
      background: var(--primary-light);
      color: var(--primary);
      border-color: var(--primary);
    }

    .trips-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.5rem;
    }
    .trip-card {
      display: flex;
      flex-direction: column;
      padding: 0;
      overflow: hidden;
    }
    .trip-image-header {
      height: 120px;
      background: var(--brand-gradient);
      padding: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .status-badge {
      padding: 0.3rem 0.75rem;
      border-radius: var(--radius-full);
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      color: white;
      background: rgba(0,0,0,0.3);
      backdrop-filter: blur(4px);
    }
    .type-badge {
      background: rgba(255,255,255,0.9);
      color: var(--text-main);
      padding: 0.25rem 0.6rem;
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      font-weight: 700;
    }
    .trip-body { padding: 1.5rem; display: flex; flex-direction: column; flex-grow: 1; }
    .trip-title { font-size: 1.25rem; margin-bottom: 0.6rem; }
    .trip-meta { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 0.8rem; }
    .meta-item { display: flex; align-items: center; gap: 0.4rem; font-size: 0.875rem; color: var(--text-secondary); }
    .meta-item .material-symbols-outlined { font-size: 1.1rem; color: var(--primary); }
    .trip-desc { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem; flex-grow: 1; }
    .trip-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 1rem; }
    .budget-tag { display: flex; align-items: center; gap: 0.3rem; font-weight: 700; color: var(--success); }
    
    .loading-state, .empty-state { text-align: center; padding: 4rem 2rem; color: var(--text-muted); }
    .empty-icon { font-size: 4rem; color: var(--primary); margin-bottom: 1rem; }

    /* Modal Styling */
    .modal-backdrop {
      position: fixed;
      top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(6px);
      z-index: 2000;
      display: flex; align-items: center; justify-content: center;
      padding: 1rem;
    }
    .modal-content {
      width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto;
      padding: 2rem;
    }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .close-btn { background: none; border: none; font-size: 1.8rem; cursor: pointer; color: var(--text-muted); }
    .form-row { display: flex; gap: 1rem; }
    .half { flex: 1; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { 100% { transform: rotate(360deg); } }
  `]
})
export class DashboardComponent implements OnInit {
  authService = inject(AuthService);
  private tripService = inject(TripService);
  private fb = inject(FormBuilder);

  trips: Trip[] = [];
  isLoading = true;
  activeFilter = 'ALL';
  showCreateModal = false;
  isSubmitting = false;
  modalError = '';

  createTripForm = this.fb.group({
    name: ['', Validators.required],
    destination: ['', Validators.required],
    tripType: ['SOLO' as TripType, Validators.required],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    travelerCount: [1, [Validators.required, Validators.min(1)]],
    budget: [1000, [Validators.required, Validators.min(0)]],
    description: ['']
  });

  ngOnInit(): void {
    this.loadTrips();
  }

  loadTrips(): void {
    this.isLoading = true;
    this.tripService.getMyTrips().subscribe({
      next: (data) => {
        this.trips = data;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  get filteredTrips(): Trip[] {
    if (this.activeFilter === 'ALL') return this.trips;
    return this.trips.filter((t) => t.status === this.activeFilter);
  }

  get upcomingCount(): number {
    return this.trips.filter((t) => t.status === 'UPCOMING' || t.status === 'PLANNING').length;
  }

  get ongoingCount(): number {
    return this.trips.filter((t) => t.status === 'ONGOING').length;
  }

  get totalBudget(): number {
    return this.trips.reduce((acc, t) => acc + (t.budget || 0), 0);
  }

  formatDateRange(start: string, end: string): string {
    if (!start || !end) return '';
    const startDate = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endDate = new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startDate} - ${endDate}`;
  }

  openCreateModal(): void {
    this.showCreateModal = true;
    this.modalError = '';
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.createTripForm.reset({
      tripType: 'SOLO',
      travelerCount: 1,
      budget: 1000
    });
  }

  onCreateTripSubmit(): void {
    if (this.createTripForm.invalid) return;

    this.isSubmitting = true;
    this.modalError = '';

    const val = this.createTripForm.value;

    const request: CreateTripRequest = {
      name: val.name!,
      destination: val.destination!,
      tripType: val.tripType as TripType,
      startDate: val.startDate!,
      endDate: val.endDate!,
      travelerCount: val.travelerCount!,
      budget: val.budget!,
      description: val.description || undefined
    };

    this.tripService.createTrip(request).subscribe({
      next: (newTrip) => {
        this.isSubmitting = false;
        this.trips.unshift(newTrip);
        this.closeCreateModal();
      },
      error: (err) => {
        this.isSubmitting = false;
        if (err.error && err.error.message) {
          this.modalError = err.error.message;
        } else {
          this.modalError = 'Failed to create trip. Please check your inputs.';
        }
      }
    });
  }
}
