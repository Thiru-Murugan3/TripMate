import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import {
  BookingOffer,
  BookingSearchRequest,
  BookingSearchResponse,
  BookingType,
  BookNowResponse,
  TransportType
} from '../../core/models/booking.model';
import { Trip } from '../../core/models/trip.model';
import { BookingService } from '../../core/services/booking.service';
import { TripService } from '../../core/services/trip.service';

type MarketplaceStep = 'SEARCH' | 'RESULTS' | 'TRAVELER' | 'CONFIRMED';

@Component({
  selector: 'app-booking-marketplace',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <main class="marketplace-page">
      <div class="page-shell">
        <button type="button" class="back-button" (click)="backToTrip()">
          <span class="material-symbols-outlined">arrow_back</span>
          Back to Trip
        </button>

        <section class="marketplace-hero">
          <div>
            <span class="eyebrow">TRIPMATE BOOKING</span>
            <h1>Book inside TripMate</h1>
            <p *ngIf="trip">
              Search options for <strong>{{ trip.name }}</strong> without leaving your trip workspace.
            </p>
          </div>
          <span class="mode-pill">SANDBOX MODE</span>
        </section>

        <aside class="sandbox-banner">
          <span class="material-symbols-outlined">science</span>
          <div>
            <strong>Booking workflow is implemented in sandbox mode.</strong>
            <p>
              Search results, payments, PNRs and confirmations are simulated until a licensed travel
              provider API and payment gateway are connected.
            </p>
          </div>
        </aside>

        <section class="steps">
          <span [class.active]="step === 'SEARCH'">1. Search</span>
          <span [class.active]="step === 'RESULTS'">2. Select</span>
          <span [class.active]="step === 'TRAVELER'">3. Traveler & Pay</span>
          <span [class.active]="step === 'CONFIRMED'">4. Confirmed</span>
        </section>

        <section *ngIf="step === 'SEARCH'" class="panel">
          <div class="panel-heading">
            <div>
              <span class="eyebrow">SEARCH</span>
              <h2>What do you want to book?</h2>
            </div>
          </div>

          <form [formGroup]="searchForm" (ngSubmit)="searchOffers()">
            <div class="booking-type-grid">
              <button
                *ngFor="let option of bookingOptions"
                type="button"
                class="type-card"
                [class.selected]="isSelectedOption(option.type, option.transportType)"
                (click)="selectBookingOption(option.type, option.transportType)"
              >
                <span class="material-symbols-outlined">{{ option.icon }}</span>
                <strong>{{ option.label }}</strong>
              </button>
            </div>

            <div class="form-grid">
              <label *ngIf="isTransport" class="field">
                <span>From</span>
                <input formControlName="origin" placeholder="Chennai" />
              </label>

              <label class="field">
                <span>{{ isHotel ? 'City / Destination' : 'To / Destination' }}</span>
                <input formControlName="destination" placeholder="Goa" />
              </label>

              <label class="field">
                <span>{{ isHotel ? 'Check-in' : 'Travel date' }}</span>
                <input type="date" formControlName="startDate" />
              </label>

              <label *ngIf="isHotel" class="field">
                <span>Check-out</span>
                <input type="date" formControlName="endDate" />
              </label>

              <label class="field">
                <span>Travelers</span>
                <input type="number" min="1" max="9" formControlName="travelers" />
              </label>
            </div>

            <div *ngIf="errorMessage" class="error-box">{{ errorMessage }}</div>

            <div class="actions">
              <button class="primary-button" type="submit" [disabled]="searching">
                <span class="material-symbols-outlined">search</span>
                {{ searching ? 'Searching...' : 'Search inside TripMate' }}
              </button>
            </div>
          </form>
        </section>

        <section *ngIf="step === 'RESULTS'" class="panel">
          <div class="panel-heading">
            <div>
              <span class="eyebrow">AVAILABLE OPTIONS</span>
              <h2>{{ offers.length }} option{{ offers.length === 1 ? '' : 's' }} found</h2>
            </div>
            <button type="button" class="secondary-button" (click)="step = 'SEARCH'">Change Search</button>
          </div>

          <p *ngIf="searchResponse" class="provider-note">{{ searchResponse.disclaimer }}</p>

          <div *ngIf="offers.length === 0" class="empty-state">
            <span class="material-symbols-outlined">travel_explore</span>
            <h3>No options found</h3>
            <button type="button" class="primary-button" (click)="step = 'SEARCH'">Search Again</button>
          </div>

          <div class="offer-list">
            <article *ngFor="let offer of offers" class="offer-card">
              <div class="offer-icon">
                <span class="material-symbols-outlined">{{ offerIcon(offer) }}</span>
              </div>

              <div class="offer-main">
                <span class="provider">{{ offer.providerName }}</span>
                <h3>{{ offer.title }}</h3>
                <p *ngIf="offer.departure || offer.arrival">
                  {{ offer.departure || '—' }}
                  <span class="material-symbols-outlined inline-icon">arrow_forward</span>
                  {{ offer.arrival || '—' }}
                </p>
                <p>
                  {{ formatDateTime(offer.startDatetime) }}
                  <ng-container *ngIf="offer.endDatetime">
                    – {{ formatDateTime(offer.endDatetime) }}
                  </ng-container>
                </p>
                <span class="refund-pill" [class.non-refundable]="!offer.refundable">
                  {{ offer.refundable ? 'Refundable' : 'Non-refundable' }}
                </span>
              </div>

              <div class="offer-price">
                <strong>{{ formatCurrency(offer.amount) }}</strong>
                <button type="button" class="primary-button" (click)="chooseOffer(offer)">
                  Select
                </button>
              </div>
            </article>
          </div>
        </section>

        <section *ngIf="step === 'TRAVELER' && selectedOffer" class="checkout-layout">
          <div class="panel">
            <div class="panel-heading">
              <div>
                <span class="eyebrow">TRAVELER DETAILS</span>
                <h2>Complete your booking</h2>
              </div>
            </div>

            <form [formGroup]="travelerForm" (ngSubmit)="confirmBooking()">
              <div class="form-grid one-column">
                <label class="field">
                  <span>Traveler full name</span>
                  <input formControlName="travelerName" placeholder="Full name as per ID" />
                </label>

                <label class="field">
                  <span>Email</span>
                  <input type="email" formControlName="travelerEmail" placeholder="name@example.com" />
                </label>

                <label class="field">
                  <span>Mobile</span>
                  <input formControlName="travelerMobile" placeholder="+91..." />
                </label>

                <label class="field">
                  <span>Payment method</span>
                  <select formControlName="paymentMethod">
                    <option value="UPI">UPI</option>
                    <option value="CARD">Card</option>
                    <option value="NET_BANKING">Net Banking</option>
                  </select>
                </label>
              </div>

              <div *ngIf="errorMessage" class="error-box">{{ errorMessage }}</div>

              <div class="actions">
                <button type="button" class="secondary-button" (click)="step = 'RESULTS'">
                  Back
                </button>
                <button type="submit" class="primary-button" [disabled]="booking">
                  {{ booking ? 'Processing...' : 'Pay & Book' }}
                </button>
              </div>
            </form>
          </div>

          <aside class="panel review-card">
            <span class="eyebrow">BOOKING SUMMARY</span>
            <h2>{{ selectedOffer.title }}</h2>
            <p>{{ selectedOffer.providerName }}</p>

            <div class="review-row" *ngIf="selectedOffer.departure || selectedOffer.arrival">
              <span>Route</span>
              <strong>{{ selectedOffer.departure || '—' }} → {{ selectedOffer.arrival || '—' }}</strong>
            </div>
            <div class="review-row">
              <span>Date</span>
              <strong>{{ formatDateTime(selectedOffer.startDatetime) }}</strong>
            </div>
            <div class="review-row">
              <span>Refund</span>
              <strong>{{ selectedOffer.refundable ? 'Refundable' : 'Non-refundable' }}</strong>
            </div>
            <div class="review-total">
              <span>Total</span>
              <strong>{{ formatCurrency(selectedOffer.amount) }}</strong>
            </div>

            <small>No real money is charged while sandbox mode is active.</small>
          </aside>
        </section>

        <section *ngIf="step === 'CONFIRMED' && confirmation" class="confirmation-card panel">
          <div class="success-icon">
            <span class="material-symbols-outlined">check_circle</span>
          </div>
          <span class="eyebrow">BOOKING CONFIRMED</span>
          <h1>{{ confirmation.booking.providerName }}</h1>
          <p>{{ confirmation.message }}</p>

          <div class="confirmation-grid">
            <div>
              <span>Booking reference</span>
              <strong>{{ confirmation.booking.bookingReference }}</strong>
            </div>
            <div>
              <span>Amount</span>
              <strong>{{ formatCurrency(confirmation.booking.amount) }}</strong>
            </div>
            <div>
              <span>Payment status</span>
              <strong>{{ confirmation.paymentStatus }}</strong>
            </div>
            <div>
              <span>Mode</span>
              <strong>{{ confirmation.providerMode }}</strong>
            </div>
          </div>

          <div class="actions centered">
            <button type="button" class="primary-button" (click)="backToTrip()">
              Return to Trip
            </button>
            <button type="button" class="secondary-button" (click)="bookAnother()">
              Book Another
            </button>
          </div>
        </section>
      </div>
    </main>
  `,
  styles: [`
    :host { display:block; background:#f8fafc; min-height:100vh; color:#0f172a; }
    .marketplace-page { min-height:100vh; padding:2rem 1rem 4rem; }
    .page-shell { max-width:1120px; margin:0 auto; }
    .back-button { display:inline-flex; align-items:center; gap:.4rem; border:0; background:none; color:#475569; font-weight:700; cursor:pointer; margin-bottom:1rem; }
    .back-button .material-symbols-outlined { font-size:1.1rem; }
    .marketplace-hero { display:flex; justify-content:space-between; gap:1rem; align-items:flex-start; padding:2rem; border-radius:20px; color:white; background:linear-gradient(135deg,#0f172a,#1d4ed8); margin-bottom:1rem; }
    .marketplace-hero h1 { margin:.2rem 0 .5rem; font-size:2.3rem; color:white; }
    .marketplace-hero p { margin:0; color:#dbeafe; }
    .eyebrow { font-size:.68rem; letter-spacing:.1em; font-weight:850; color:#64748b; }
    .marketplace-hero .eyebrow { color:#bfdbfe; }
    .mode-pill { background:#fef3c7; color:#92400e; padding:.4rem .7rem; border-radius:999px; font-size:.72rem; font-weight:850; white-space:nowrap; }
    .sandbox-banner { display:flex; gap:.8rem; padding:1rem 1.2rem; border:1px solid #fde68a; border-radius:14px; background:#fffbeb; color:#92400e; margin-bottom:1rem; }
    .sandbox-banner p { margin:.2rem 0 0; color:#a16207; font-size:.86rem; }
    .steps { display:grid; grid-template-columns:repeat(4,1fr); gap:.5rem; margin-bottom:1rem; }
    .steps span { padding:.7rem; text-align:center; border-radius:10px; color:#64748b; background:#e2e8f0; font-size:.8rem; font-weight:750; }
    .steps span.active { color:#1d4ed8; background:#dbeafe; }
    .panel { background:#fff; border:1px solid #e2e8f0; border-radius:18px; padding:1.5rem; box-shadow:0 8px 26px rgba(15,23,42,.05); }
    .panel-heading { display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1.25rem; }
    .panel-heading h2 { margin:.2rem 0 0; }
    .booking-type-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:.75rem; margin-bottom:1.2rem; }
    .type-card { display:flex; flex-direction:column; align-items:center; gap:.4rem; padding:1rem .6rem; border:1px solid #cbd5e1; border-radius:12px; background:#fff; cursor:pointer; color:#475569; }
    .type-card.selected { border-color:#2563eb; background:#eff6ff; color:#1d4ed8; }
    .type-card .material-symbols-outlined { font-size:1.5rem; }
    .form-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:.8rem; }
    .form-grid.one-column { grid-template-columns:1fr; }
    .field { display:flex; flex-direction:column; gap:.32rem; color:#475569; font-size:.78rem; font-weight:750; }
    .field input,.field select { width:100%; box-sizing:border-box; padding:.72rem .75rem; border:1px solid #cbd5e1; border-radius:9px; font:inherit; color:#0f172a; background:#fff; }
    .actions { display:flex; justify-content:flex-end; gap:.7rem; margin-top:1.2rem; }
    .actions.centered { justify-content:center; }
    .primary-button,.secondary-button { display:inline-flex; align-items:center; justify-content:center; gap:.35rem; border:0; border-radius:9px; padding:.65rem 1rem; font-weight:800; cursor:pointer; }
    .primary-button { background:#2563eb; color:white; }
    .primary-button:disabled { opacity:.55; cursor:not-allowed; }
    .secondary-button { background:#e2e8f0; color:#334155; }
    .error-box { margin-top:1rem; padding:.75rem; border-radius:9px; background:#fee2e2; color:#b91c1c; }
    .provider-note { padding:.7rem .85rem; border-radius:9px; background:#f8fafc; color:#64748b; font-size:.8rem; }
    .offer-list { display:flex; flex-direction:column; gap:.8rem; }
    .offer-card { display:flex; align-items:center; gap:1rem; padding:1rem; border:1px solid #e2e8f0; border-radius:14px; }
    .offer-icon { display:grid; place-items:center; width:48px; height:48px; min-width:48px; border-radius:12px; color:#2563eb; background:#eff6ff; }
    .offer-main { flex:1; min-width:0; }
    .offer-main h3 { margin:.15rem 0 .35rem; }
    .offer-main p { display:flex; align-items:center; gap:.25rem; margin:.18rem 0; color:#64748b; font-size:.82rem; }
    .provider { color:#2563eb; font-size:.72rem; font-weight:800; }
    .inline-icon { font-size:1rem; }
    .refund-pill { display:inline-flex; margin-top:.3rem; padding:.22rem .5rem; border-radius:999px; background:#d1fae5; color:#047857; font-size:.67rem; font-weight:800; }
    .refund-pill.non-refundable { background:#fee2e2; color:#b91c1c; }
    .offer-price { display:flex; flex-direction:column; align-items:flex-end; gap:.55rem; }
    .offer-price strong { font-size:1.2rem; }
    .empty-state { display:grid; place-items:center; min-height:220px; color:#64748b; text-align:center; }
    .empty-state .material-symbols-outlined { font-size:3rem; color:#60a5fa; }
    .checkout-layout { display:grid; grid-template-columns:1.5fr .8fr; gap:1rem; }
    .review-card h2 { margin:.25rem 0; }
    .review-card > p { color:#64748b; }
    .review-row,.review-total { display:flex; justify-content:space-between; gap:1rem; padding:.7rem 0; border-top:1px solid #f1f5f9; font-size:.85rem; }
    .review-row span { color:#64748b; }
    .review-total { margin-top:.4rem; font-size:1.05rem; }
    .review-card small { display:block; margin-top:1rem; color:#a16207; }
    .confirmation-card { text-align:center; padding:3rem 2rem; }
    .success-icon .material-symbols-outlined { font-size:4rem; color:#059669; }
    .confirmation-card h1 { margin:.3rem 0; }
    .confirmation-card > p { color:#64748b; max-width:680px; margin:.5rem auto 1.5rem; }
    .confirmation-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:.7rem; max-width:850px; margin:0 auto; }
    .confirmation-grid div { display:flex; flex-direction:column; gap:.25rem; padding:1rem; border-radius:12px; background:#f8fafc; }
    .confirmation-grid span { color:#64748b; font-size:.72rem; text-transform:uppercase; font-weight:800; }
    @media(max-width:850px){ .booking-type-grid{grid-template-columns:repeat(3,1fr)} .form-grid{grid-template-columns:repeat(2,1fr)} .checkout-layout{grid-template-columns:1fr} .confirmation-grid{grid-template-columns:repeat(2,1fr)} }
    @media(max-width:560px){ .marketplace-hero{flex-direction:column} .steps{grid-template-columns:1fr 1fr} .booking-type-grid{grid-template-columns:1fr 1fr} .form-grid{grid-template-columns:1fr} .offer-card{align-items:flex-start; flex-wrap:wrap} .offer-price{width:100%; align-items:stretch} .confirmation-grid{grid-template-columns:1fr} }
  `]
})
export class BookingMarketplaceComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly bookingService = inject(BookingService);
  private readonly tripService = inject(TripService);

  tripId = 0;
  trip: Trip | null = null;
  step: MarketplaceStep = 'SEARCH';
  searching = false;
  booking = false;
  errorMessage = '';
  searchResponse: BookingSearchResponse | null = null;
  offers: BookingOffer[] = [];
  selectedOffer: BookingOffer | null = null;
  confirmation: BookNowResponse | null = null;

  readonly bookingOptions: Array<{
    label: string;
    type: BookingType;
    transportType?: TransportType;
    icon: string;
  }> = [
    { label: 'Flight', type: 'TRANSPORT', transportType: 'FLIGHT', icon: 'flight' },
    { label: 'Train', type: 'TRANSPORT', transportType: 'TRAIN', icon: 'train' },
    { label: 'Bus', type: 'TRANSPORT', transportType: 'BUS', icon: 'directions_bus' },
    { label: 'Hotel', type: 'HOTEL', icon: 'hotel' },
    { label: 'Activity', type: 'ACTIVITY', icon: 'attractions' }
  ];

  searchForm = this.fb.group({
    bookingType: ['TRANSPORT' as BookingType, Validators.required],
    transportType: ['FLIGHT' as TransportType],
    origin: [''],
    destination: ['', Validators.required],
    startDate: ['', Validators.required],
    endDate: [''],
    travelers: [1, [Validators.required, Validators.min(1), Validators.max(9)]]
  });

  travelerForm = this.fb.group({
    travelerName: ['', Validators.required],
    travelerEmail: ['', [Validators.required, Validators.email]],
    travelerMobile: [''],
    paymentMethod: ['UPI', Validators.required]
  });

  ngOnInit(): void {
    this.tripId = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(this.tripId) || this.tripId <= 0) {
      this.errorMessage = 'Invalid trip ID.';
      return;
    }

    this.tripService.getTripById(this.tripId).subscribe({
      next: (trip) => {
        this.trip = trip;
        this.searchForm.patchValue({
          destination: trip.destination,
          startDate: trip.startDate,
          endDate: trip.endDate,
          travelers: trip.travelerCount
        });
      }
    });
  }

  get isTransport(): boolean {
    return this.searchForm.value.bookingType === 'TRANSPORT';
  }

  get isHotel(): boolean {
    return this.searchForm.value.bookingType === 'HOTEL';
  }

  selectBookingOption(type: BookingType, transportType?: TransportType): void {
    this.searchForm.patchValue({
      bookingType: type,
      transportType: transportType ?? null,
      origin: type === 'TRANSPORT' ? this.searchForm.value.origin : ''
    });

    if (type !== 'HOTEL') {
      this.searchForm.patchValue({ endDate: '' });
    }
  }

  isSelectedOption(type: BookingType, transportType?: TransportType): boolean {
    return (
      this.searchForm.value.bookingType === type &&
      (type !== 'TRANSPORT' || this.searchForm.value.transportType === transportType)
    );
  }

  searchOffers(): void {
    if (this.searchForm.invalid) {
      this.errorMessage = 'Please complete the required search fields.';
      return;
    }

    if (this.isTransport && !this.searchForm.value.origin?.trim()) {
      this.errorMessage = 'Please enter the departure city.';
      return;
    }

    if (this.isHotel && !this.searchForm.value.endDate) {
      this.errorMessage = 'Please select a hotel check-out date.';
      return;
    }

    this.searching = true;
    this.errorMessage = '';

    const value = this.searchForm.getRawValue();
    const request: BookingSearchRequest = {
      bookingType: value.bookingType as BookingType,
      transportType:
        value.bookingType === 'TRANSPORT'
          ? (value.transportType as TransportType)
          : undefined,
      origin: value.bookingType === 'TRANSPORT' ? value.origin || undefined : undefined,
      destination: value.destination!,
      startDate: value.startDate!,
      endDate: value.bookingType === 'HOTEL' ? value.endDate || undefined : undefined,
      travelers: value.travelers ?? 1
    };

    this.bookingService.searchBookingOffers(this.tripId, request).subscribe({
      next: (response) => {
        this.searching = false;
        this.searchResponse = response;
        this.offers = response.offers ?? [];
        this.step = 'RESULTS';
      },
      error: (err) => {
        this.searching = false;
        this.errorMessage = err?.error?.message || 'Unable to search booking options.';
      }
    });
  }

  chooseOffer(offer: BookingOffer): void {
    this.selectedOffer = offer;
    this.errorMessage = '';
    this.step = 'TRAVELER';
  }

  confirmBooking(): void {
    if (!this.selectedOffer || this.travelerForm.invalid) {
      this.errorMessage = 'Please complete the traveler details.';
      return;
    }

    this.booking = true;
    this.errorMessage = '';
    const value = this.travelerForm.getRawValue();

    this.bookingService.bookNow(this.tripId, {
      offerId: this.selectedOffer.offerId,
      travelerName: value.travelerName!,
      travelerEmail: value.travelerEmail!,
      travelerMobile: value.travelerMobile || undefined,
      paymentMethod: value.paymentMethod!
    }).subscribe({
      next: (response) => {
        this.booking = false;
        this.confirmation = response;
        this.step = 'CONFIRMED';
      },
      error: (err) => {
        this.booking = false;
        this.errorMessage = err?.error?.message || 'Unable to complete the booking.';
      }
    });
  }

  bookAnother(): void {
    this.confirmation = null;
    this.selectedOffer = null;
    this.offers = [];
    this.searchResponse = null;
    this.travelerForm.reset({
      travelerName: '',
      travelerEmail: '',
      travelerMobile: '',
      paymentMethod: 'UPI'
    });
    this.step = 'SEARCH';
  }

  backToTrip(): void {
    void this.router.navigate(['/trips', this.tripId]);
  }

  offerIcon(offer: BookingOffer): string {
    if (offer.bookingType === 'HOTEL') return 'hotel';
    if (offer.bookingType === 'ACTIVITY') return 'attractions';
    if (offer.transportType === 'FLIGHT') return 'flight';
    if (offer.transportType === 'TRAIN') return 'train';
    if (offer.transportType === 'BUS') return 'directions_bus';
    return 'commute';
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value ?? 0);
  }

  formatDateTime(value?: string): string {
    if (!value) return 'Time not set';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
