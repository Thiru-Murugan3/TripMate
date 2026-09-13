import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TripService } from '../../../core/services/trip.service';
import { BookingService } from '../../../core/services/booking.service';
import { Trip } from '../../../core/models/trip.model';
import { Booking, BookingType, TransportType, BookingStatus, CreateBookingRequest } from '../../../core/models/booking.model';

@Component({
  selector: 'app-trip-details',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="trip-details-container" *ngIf="trip">
      <!-- Hero Banner -->
      <div class="hero-banner card glass-panel">
        <div class="hero-content">
          <div class="header-badges">
            <span class="badge status" [ngClass]="trip.status.toLowerCase()">{{ trip.status }}</span>
            <span class="badge type">{{ trip.tripType }}</span>
          </div>

          <h1 class="trip-title">{{ trip.name }}</h1>
          
          <div class="hero-meta">
            <span class="meta-item">
              <span class="material-symbols-outlined">location_on</span>
              {{ trip.destination }}
            </span>
            <span class="meta-item">
              <span class="material-symbols-outlined">calendar_month</span>
              {{ trip.startDate }} to {{ trip.endDate }}
            </span>
            <span class="meta-item">
              <span class="material-symbols-outlined">group</span>
              {{ trip.travelerCount }} Travelers
            </span>
            <span class="meta-item">
              <span class="material-symbols-outlined">account_balance_wallet</span>
              \${{ trip.budget | number:'1.0-0' }} Budget
            </span>
          </div>

          <p class="description" *ngIf="trip.description">{{ trip.description }}</p>
        </div>

        <div class="hero-actions">
          <button (click)="openBookingModal()" class="btn btn-primary">
            <span class="material-symbols-outlined">confirmation_number</span>
            Add Booking
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="details-tabs">
        <button (click)="activeTab = 'BOOKINGS'" [class.active]="activeTab === 'BOOKINGS'" class="tab-btn">
          <span class="material-symbols-outlined">airplane_ticket</span>
          Bookings ({{ bookings.length }})
        </button>
      </div>

      <!-- Bookings Content Tab -->
      <div *ngIf="activeTab === 'BOOKINGS'" class="tab-content">
        <div *ngIf="isLoadingBookings" class="loading-state card">
          Loading bookings...
        </div>

        <div *ngIf="!isLoadingBookings && bookings.length === 0" class="empty-state card">
          <span class="material-symbols-outlined empty-icon">airplane_ticket</span>
          <h3>No bookings added yet</h3>
          <p>Add flight, hotel, train, or activity bookings to track your travel itinerary.</p>
          <button (click)="openBookingModal()" class="btn btn-primary mt-3">
            <span class="material-symbols-outlined">add</span> Add First Booking
          </button>
        </div>

        <div *ngIf="!isLoadingBookings && bookings.length > 0" class="bookings-grid">
          <div *ngFor="let booking of bookings" class="booking-card card card-hover">
            <div class="booking-header">
              <div class="type-icon" [ngClass]="booking.bookingType.toLowerCase()">
                <span class="material-symbols-outlined">{{ getBookingIcon(booking) }}</span>
              </div>
              <div class="booking-titles">
                <span class="provider-name">{{ booking.providerName }}</span>
                <span class="booking-type">{{ booking.bookingType }} <ng-container *ngIf="booking.transportType">({{ booking.transportType }})</ng-container></span>
              </div>
              <div class="booking-amount">\${{ booking.amount | number:'1.2-2' }}</div>
            </div>

            <div class="booking-body">
              <div class="route" *ngIf="booking.departure || booking.arrival">
                <span class="loc">{{ booking.departure || 'N/A' }}</span>
                <span class="material-symbols-outlined route-arrow">arrow_forward</span>
                <span class="loc">{{ booking.arrival || 'N/A' }}</span>
              </div>

              <div class="ref" *ngIf="booking.bookingReference">
                <strong>Ref:</strong> {{ booking.bookingReference }}
              </div>

              <div class="times" *ngIf="booking.startDatetime || booking.endDatetime">
                <span class="material-symbols-outlined icon">schedule</span>
                {{ formatDatetime(booking.startDatetime) }} - {{ formatDatetime(booking.endDatetime) }}
              </div>

              <p class="notes" *ngIf="booking.notes">{{ booking.notes }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Add Booking Modal -->
      <div *ngIf="showBookingModal" class="modal-backdrop" (click)="closeBookingModal()">
        <div class="modal-content card glass-panel" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Add New Booking</h3>
            <button (click)="closeBookingModal()" class="close-btn">&times;</button>
          </div>

          <div *ngIf="bookingModalError" class="alert alert-danger">
            {{ bookingModalError }}
          </div>

          <form [formGroup]="bookingForm" (ngSubmit)="onBookingSubmit()">
            <div class="form-row">
              <div class="form-group half">
                <label class="form-label">Booking Type</label>
                <select class="form-control" formControlName="bookingType">
                  <option value="TRANSPORT">Transport</option>
                  <option value="HOTEL">Hotel</option>
                  <option value="ACTIVITY">Activity</option>
                </select>
              </div>

              <div class="form-group half" *ngIf="bookingForm.get('bookingType')?.value === 'TRANSPORT'">
                <label class="form-label">Transport Type</label>
                <select class="form-control" formControlName="transportType">
                  <option value="FLIGHT">Flight</option>
                  <option value="TRAIN">Train</option>
                  <option value="BUS">Bus</option>
                  <option value="CAB">Cab</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Provider Name</label>
              <input type="text" class="form-control" formControlName="providerName" placeholder="IndiGo Airlines / Marriott Hotel" />
            </div>

            <div class="form-group">
              <label class="form-label">Booking Reference / PNR</label>
              <input type="text" class="form-control" formControlName="bookingReference" placeholder="IND-98765" />
            </div>

            <div class="form-row" *ngIf="bookingForm.get('bookingType')?.value === 'TRANSPORT'">
              <div class="form-group half">
                <label class="form-label">Departure</label>
                <input type="text" class="form-control" formControlName="departure" placeholder="Mumbai" />
              </div>
              <div class="form-group half">
                <label class="form-label">Arrival</label>
                <input type="text" class="form-control" formControlName="arrival" placeholder="Goa" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group half">
                <label class="form-label">Start Date/Time</label>
                <input type="datetime-local" class="form-control" formControlName="startDatetime" />
              </div>

              <div class="form-group half">
                <label class="form-label">End Date/Time</label>
                <input type="datetime-local" class="form-control" formControlName="endDatetime" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Amount ($)</label>
              <input type="number" class="form-control" formControlName="amount" min="0" placeholder="250.00" />
            </div>

            <div class="form-group">
              <label class="form-label">Notes (Optional)</label>
              <textarea class="form-control" formControlName="notes" rows="2" placeholder="Terminal 2, seat 14A..."></textarea>
            </div>

            <div class="modal-actions">
              <button type="button" (click)="closeBookingModal()" class="btn btn-secondary">Cancel</button>
              <button type="submit" class="btn btn-primary" [disabled]="bookingForm.invalid || isSubmittingBooking">
                {{ isSubmittingBooking ? 'Saving...' : 'Add Booking' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .trip-details-container { max-width: 1280px; margin: 0 auto; padding: 2rem 1.5rem; }
    .hero-banner {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding: 2.5rem 2rem; background: var(--brand-gradient); color: white; margin-bottom: 2rem;
    }
    .hero-content { flex: 1; }
    .header-badges { display: flex; gap: 0.5rem; margin-bottom: 0.8rem; }
    .badge { padding: 0.3rem 0.75rem; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; background: rgba(0,0,0,0.3); color: white; }
    .trip-title { font-size: 2.2rem; color: white; margin-bottom: 1rem; }
    .hero-meta { display: flex; flex-wrap: wrap; gap: 1.25rem; font-size: 0.95rem; color: rgba(255,255,255,0.9); }
    .meta-item { display: flex; align-items: center; gap: 0.4rem; font-weight: 600; }
    .description { margin-top: 1rem; color: rgba(255,255,255,0.85); font-size: 0.95rem; }
    
    .details-tabs { display: flex; gap: 1rem; border-bottom: 2px solid var(--border); margin-bottom: 1.5rem; }
    .tab-btn { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.25rem; background: none; border: none; font-size: 1rem; font-weight: 700; color: var(--text-muted); cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -2px; }
    .tab-btn.active { color: var(--primary); border-color: var(--primary); }

    .bookings-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 1.25rem; }
    .booking-card { padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
    .booking-header { display: flex; align-items: center; gap: 1rem; }
    .type-icon { width: 44px; height: 44px; border-radius: var(--radius-md); background: var(--primary-light); color: var(--primary); display: flex; align-items: center; justify-content: center; }
    .booking-titles { display: flex; flex-direction: column; flex: 1; }
    .provider-name { font-weight: 700; font-size: 1.05rem; }
    .booking-type { font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; }
    .booking-amount { font-size: 1.2rem; font-weight: 800; color: var(--success); }

    .booking-body { display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.9rem; color: var(--text-secondary); border-top: 1px solid var(--border); padding-top: 0.75rem; }
    .route { display: flex; align-items: center; gap: 0.5rem; font-weight: 600; }
    .times { display: flex; align-items: center; gap: 0.4rem; color: var(--text-muted); font-size: 0.85rem; }
    
    .empty-state { text-align: center; padding: 4rem 2rem; color: var(--text-muted); }
    .empty-icon { font-size: 3.5rem; color: var(--primary); margin-bottom: 1rem; }

    .modal-backdrop { position: fixed; top:0; left:0; width:100vw; height:100vh; background: rgba(15,23,42,0.6); backdrop-filter: blur(6px); z-index:2000; display:flex; align-items:center; justify-content:center; padding:1rem; }
    .modal-content { width:100%; max-width: 520px; max-height:90vh; overflow-y:auto; padding: 2rem; }
    .modal-header { display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem; }
    .close-btn { background:none; border:none; font-size:1.8rem; cursor:pointer; color: var(--text-muted); }
    .form-row { display:flex; gap:1rem; }
    .half { flex:1; }
    .modal-actions { display:flex; justify-content: flex-end; gap:1rem; margin-top: 1.5rem; }
  `]
})
export class TripDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private tripService = inject(TripService);
  private bookingService = inject(BookingService);
  private fb = inject(FormBuilder);

  tripId!: number;
  trip: Trip | null = null;
  bookings: Booking[] = [];
  isLoadingBookings = true;
  activeTab = 'BOOKINGS';
  showBookingModal = false;
  isSubmittingBooking = false;
  bookingModalError = '';

  bookingForm = this.fb.group({
    bookingType: ['TRANSPORT' as BookingType, Validators.required],
    transportType: ['FLIGHT' as TransportType],
    providerName: ['', Validators.required],
    bookingReference: [''],
    departure: [''],
    arrival: [''],
    startDatetime: [''],
    endDatetime: [''],
    amount: [250, [Validators.required, Validators.min(0)]],
    notes: ['']
  });

  ngOnInit(): void {
    this.tripId = Number(this.route.snapshot.paramMap.get('id'));
    if (this.tripId) {
      this.loadTripDetails();
      this.loadBookings();
    }
  }

  loadTripDetails(): void {
    this.tripService.getTripById(this.tripId).subscribe({
      next: (data) => (this.trip = data),
      error: (err) => console.error(err)
    });
  }

  loadBookings(): void {
    this.isLoadingBookings = true;
    this.bookingService.getBookings(this.tripId).subscribe({
      next: (data) => {
        this.bookings = data;
        this.isLoadingBookings = false;
      },
      error: () => (this.isLoadingBookings = false)
    });
  }

  getBookingIcon(booking: Booking): string {
    if (booking.bookingType === 'TRANSPORT') {
      if (booking.transportType === 'FLIGHT') return 'flight';
      if (booking.transportType === 'TRAIN') return 'train';
      if (booking.transportType === 'BUS') return 'directions_bus';
      return 'directions_car';
    }
    if (booking.bookingType === 'HOTEL') return 'hotel';
    return 'attractions';
  }

  formatDatetime(dt?: string): string {
    if (!dt) return 'N/A';
    return new Date(dt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  openBookingModal(): void {
    this.showBookingModal = true;
    this.bookingModalError = '';
  }

  closeBookingModal(): void {
    this.showBookingModal = false;
    this.bookingForm.reset({
      bookingType: 'TRANSPORT',
      transportType: 'FLIGHT',
      amount: 250
    });
  }

  onBookingSubmit(): void {
    if (this.bookingForm.invalid) return;

    this.isSubmittingBooking = true;
    this.bookingModalError = '';

    const val = this.bookingForm.value;

    const request: CreateBookingRequest = {
      bookingType: val.bookingType as BookingType,
      transportType: val.bookingType === 'TRANSPORT' ? (val.transportType as TransportType) : undefined,
      providerName: val.providerName!,
      bookingReference: val.bookingReference || undefined,
      departure: val.bookingType === 'TRANSPORT' ? val.departure || undefined : undefined,
      arrival: val.bookingType === 'TRANSPORT' ? val.arrival || undefined : undefined,
      startDatetime: val.startDatetime || undefined,
      endDatetime: val.endDatetime || undefined,
      amount: val.amount!,
      status: 'CONFIRMED',
      notes: val.notes || undefined
    };

    this.bookingService.createBooking(this.tripId, request).subscribe({
      next: (newBooking) => {
        this.isSubmittingBooking = false;
        this.bookings.unshift(newBooking);
        this.closeBookingModal();
      },
      error: (err) => {
        this.isSubmittingBooking = false;
        if (err.error && err.error.message) {
          this.bookingModalError = err.error.message;
        } else {
          this.bookingModalError = 'Failed to create booking.';
        }
      }
    });
  }
}
