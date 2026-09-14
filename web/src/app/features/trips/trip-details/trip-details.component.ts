import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import {
  Trip,
  TripDashboard,
  TripDashboardBooking,
  TripType,
  UpdateTripRequest
} from '../../../core/models/trip.model';
import {
  Booking,
  BookingType,
  CreateBookingRequest,
  TransportType
} from '../../../core/models/booking.model';
import { BookingService } from '../../../core/services/booking.service';
import { TripService } from '../../../core/services/trip.service';

type TripDetailsTab = 'OVERVIEW' | 'BOOKINGS';

@Component({
  selector: 'app-trip-details',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <main class="trip-details-page">
      <section *ngIf="isLoadingTrip" class="page-state card">
        <div class="spinner"></div>
        <h2>Loading trip</h2>
        <p>Getting the latest trip details...</p>
      </section>

      <section *ngIf="!isLoadingTrip && tripLoadError" class="page-state card error-state">
        <span class="material-symbols-outlined state-icon">error</span>
        <h2>Unable to load this trip</h2>
        <p>{{ tripLoadError }}</p>
        <button type="button" class="btn btn-primary" (click)="retryTrip()">Try Again</button>
      </section>

      <div *ngIf="!isLoadingTrip && trip as currentTrip" class="trip-details-container">
        <section class="hero-banner card">
          <div class="hero-content">
            <div class="header-badges">
              <span class="badge status" [attr.data-status]="currentTrip.status">
                {{ formatStatus(currentTrip.status) }}
              </span>
              <span class="badge type">{{ formatTripType(currentTrip.tripType) }}</span>
            </div>

            <h1 class="trip-title">{{ currentTrip.name }}</h1>

            <div class="hero-meta">
              <span class="meta-item">
                <span class="material-symbols-outlined">location_on</span>
                {{ currentTrip.destination }}
              </span>
              <span class="meta-item">
                <span class="material-symbols-outlined">calendar_month</span>
                {{ formatDate(currentTrip.startDate) }} – {{ formatDate(currentTrip.endDate) }}
              </span>
              <span class="meta-item">
                <span class="material-symbols-outlined">group</span>
                {{ currentTrip.travelerCount }} traveler{{ currentTrip.travelerCount === 1 ? '' : 's' }}
              </span>
              <span class="meta-item">
                <span class="material-symbols-outlined">account_balance_wallet</span>
                {{ formatCurrency(currentTrip.budget) }} budget
              </span>
            </div>

            <p class="description" *ngIf="currentTrip.description">{{ currentTrip.description }}</p>
          </div>

          <div class="hero-actions" *ngIf="canEditTrip">
            <button type="button" (click)="openEditTripModal()" class="btn btn-light">
              <span class="material-symbols-outlined">edit</span>
              Edit Trip
            </button>
            <button type="button" (click)="openBookNow()" class="btn btn-primary">
              <span class="material-symbols-outlined">travel_explore</span>
              Book Now
            </button>
          </div>
        </section>

        <div *ngIf="tripUpdateMessage" class="success-banner">
          <span class="material-symbols-outlined">check_circle</span>
          {{ tripUpdateMessage }}
        </div>

        <nav class="details-tabs" aria-label="Trip details sections">
          <button
            type="button"
            class="tab-btn"
            [class.active]="activeTab === 'OVERVIEW'"
            (click)="activeTab = 'OVERVIEW'"
          >
            <span class="material-symbols-outlined">dashboard</span>
            Overview
          </button>

          <button
            type="button"
            class="tab-btn"
            [class.active]="activeTab === 'BOOKINGS'"
            (click)="activeTab = 'BOOKINGS'"
          >
            <span class="material-symbols-outlined">airplane_ticket</span>
            Bookings
            <span class="tab-count">{{ bookings.length }}</span>
          </button>
        </nav>

        <section *ngIf="activeTab === 'OVERVIEW'" class="tab-content overview-content">
          <div *ngIf="isLoadingDashboard" class="overview-loading card">
            <div class="spinner small"></div>
            <span>Loading trip overview...</span>
          </div>

          <div *ngIf="!isLoadingDashboard && dashboardError" class="overview-error card">
            <div>
              <strong>Unable to load the trip overview.</strong>
              <p>{{ dashboardError }}</p>
            </div>
            <button type="button" class="btn btn-secondary" (click)="loadDashboard()">Retry</button>
          </div>

          <ng-container *ngIf="!isLoadingDashboard && !dashboardError && dashboard as overview">
            <div class="summary-grid">
              <article class="summary-card">
                <div class="summary-icon">
                  <span class="material-symbols-outlined">account_balance_wallet</span>
                </div>
                <span class="summary-label">Trip Budget</span>
                <strong>{{ formatCurrency(overview.budget) }}</strong>
              </article>

              <article class="summary-card">
                <div class="summary-icon">
                  <span class="material-symbols-outlined">payments</span>
                </div>
                <span class="summary-label">Total Expenses</span>
                <strong>{{ formatCurrency(overview.totalExpenses) }}</strong>
              </article>

              <article class="summary-card">
                <div class="summary-icon">
                  <span class="material-symbols-outlined">savings</span>
                </div>
                <span class="summary-label">Remaining Budget</span>
                <strong [class.negative-value]="overview.remainingBudget < 0">
                  {{ formatCurrency(overview.remainingBudget) }}
                </strong>
              </article>

              <article class="summary-card">
                <div class="summary-icon">
                  <span class="material-symbols-outlined">groups</span>
                </div>
                <span class="summary-label">Travelers</span>
                <strong>{{ overview.travelerCount }}</strong>
              </article>

              <article class="summary-card">
                <div class="summary-icon">
                  <span class="material-symbols-outlined">group</span>
                </div>
                <span class="summary-label">Members</span>
                <strong>{{ overview.memberCount }}</strong>
              </article>

              <article class="summary-card">
                <div class="summary-icon">
                  <span class="material-symbols-outlined">description</span>
                </div>
                <span class="summary-label">Documents</span>
                <strong>{{ overview.documentCount }}</strong>
              </article>
            </div>

            <article class="budget-card card">
              <div class="card-heading">
                <div>
                  <span class="eyebrow">BUDGET TRACKING</span>
                  <h2>Budget Utilization</h2>
                </div>
                <strong class="utilization-value">
                  {{ overview.budgetUtilizationPercentage | number:'1.0-1' }}%
                </strong>
              </div>

              <div class="budget-track" aria-label="Budget utilization">
                <div
                  class="budget-fill"
                  [class.over-budget]="overview.budgetUtilizationPercentage > 100"
                  [style.width.%]="budgetProgressWidth(overview.budgetUtilizationPercentage)"
                ></div>
              </div>

              <div class="budget-breakdown">
                <span>Spent <strong>{{ formatCurrency(overview.totalExpenses) }}</strong></span>
                <span>Remaining <strong>{{ formatCurrency(overview.remainingBudget) }}</strong></span>
                <span>Budget <strong>{{ formatCurrency(overview.budget) }}</strong></span>
              </div>
            </article>

            <div class="overview-columns">
              <article class="overview-panel card">
                <div class="panel-heading">
                  <div>
                    <span class="eyebrow">ITINERARY</span>
                    <h2>Upcoming Activities</h2>
                  </div>
                  <span class="panel-count">{{ overview.upcomingActivities.length }}</span>
                </div>

                <div *ngIf="overview.upcomingActivities.length === 0" class="panel-empty">
                  <span class="material-symbols-outlined">event_available</span>
                  <h3>No upcoming activities</h3>
                  <p>Your future itinerary activities will appear here.</p>
                </div>

                <div *ngIf="overview.upcomingActivities.length > 0" class="activity-list">
                  <div
                    *ngFor="let activity of overview.upcomingActivities.slice(0, 6)"
                    class="activity-row"
                  >
                    <div class="activity-date">
                      <strong>{{ formatActivityDay(activity.date) }}</strong>
                      <span>{{ formatActivityMonth(activity.date) }}</span>
                    </div>
                    <div class="activity-info">
                      <strong>{{ activity.activity }}</strong>
                      <span>
                        <span class="material-symbols-outlined">schedule</span>
                        {{ formatActivityTime(activity.time) }}
                      </span>
                    </div>
                  </div>
                </div>
              </article>

              <article class="overview-panel card">
                <div class="panel-heading">
                  <div>
                    <span class="eyebrow">BOOKINGS</span>
                    <h2>Booking Summary</h2>
                  </div>
                  <button
                    *ngIf="overview.bookings.length > 0"
                    type="button"
                    class="text-button"
                    (click)="activeTab = 'BOOKINGS'"
                  >
                    View all
                  </button>
                </div>

                <div *ngIf="overview.bookings.length === 0" class="panel-empty">
                  <span class="material-symbols-outlined">airplane_ticket</span>
                  <h3>No bookings yet</h3>
                  <p>Add hotel, transport or activity booking details.</p>
                  <div *ngIf="canEditTrip" class="empty-booking-actions">
                    <button type="button" class="btn btn-primary compact" (click)="openBookNow()">
                      Book inside TripMate
                    </button>
                    <button type="button" class="btn btn-secondary compact" (click)="openBookingModal()">
                      Add Existing
                    </button>
                  </div>
                </div>

                <div *ngIf="overview.bookings.length > 0" class="booking-summary-list">
                  <div
                    *ngFor="let booking of overview.bookings.slice(0, 6)"
                    class="booking-summary-row"
                  >
                    <div class="booking-summary-icon">
                      <span class="material-symbols-outlined">
                        {{ getDashboardBookingIcon(booking) }}
                      </span>
                    </div>
                    <div class="booking-summary-info">
                      <strong>{{ booking.providerName }}</strong>
                      <span>{{ formatBookingType(booking.bookingType) }}</span>
                    </div>
                    <span class="booking-status" [attr.data-status]="booking.status">
                      {{ booking.status }}
                    </span>
                  </div>
                </div>
              </article>
            </div>

            <div class="overview-footer-grid">
              <article class="info-card card">
                <span class="material-symbols-outlined">calendar_month</span>
                <div>
                  <span class="summary-label">Trip Dates</span>
                  <strong>{{ formatDate(overview.startDate) }} – {{ formatDate(overview.endDate) }}</strong>
                </div>
              </article>

              <article class="info-card card">
                <span class="material-symbols-outlined">travel_explore</span>
                <div>
                  <span class="summary-label">Trip Type</span>
                  <strong>{{ formatTripType(overview.tripType) }}</strong>
                </div>
              </article>

              <article class="info-card card">
                <span class="material-symbols-outlined">location_on</span>
                <div>
                  <span class="summary-label">Destination</span>
                  <strong>{{ overview.destination }}</strong>
                </div>
              </article>
            </div>
          </ng-container>
        </section>

        <section *ngIf="activeTab === 'BOOKINGS'" class="tab-content">
          <div *ngIf="isLoadingBookings" class="overview-loading card">
            <div class="spinner small"></div>
            <span>Loading bookings...</span>
          </div>

          <div *ngIf="!isLoadingBookings && bookingsError" class="overview-error card">
            <div>
              <strong>Unable to load bookings.</strong>
              <p>{{ bookingsError }}</p>
            </div>
            <button type="button" class="btn btn-secondary" (click)="loadBookings()">Retry</button>
          </div>

          <div *ngIf="!isLoadingBookings && !bookingsError && bookings.length === 0" class="empty-state card">
            <span class="material-symbols-outlined empty-icon">airplane_ticket</span>
            <h3>No bookings added yet</h3>
            <p>Add flight, hotel, train or activity bookings to keep your trip information together.</p>
            <div *ngIf="canEditTrip" class="empty-booking-actions">
              <button type="button" (click)="openBookNow()" class="btn btn-primary">
                <span class="material-symbols-outlined">travel_explore</span>
                Book inside TripMate
              </button>
              <button type="button" (click)="openBookingModal()" class="btn btn-secondary">
                <span class="material-symbols-outlined">add</span>
                Add Existing Booking
              </button>
            </div>
          </div>

          <div *ngIf="!isLoadingBookings && !bookingsError && bookings.length > 0" class="bookings-grid">
            <article *ngFor="let booking of bookings" class="booking-card card">
              <div class="booking-header">
                <div class="type-icon">
                  <span class="material-symbols-outlined">{{ getBookingIcon(booking) }}</span>
                </div>
                <div class="booking-titles">
                  <span class="provider-name">{{ booking.providerName }}</span>
                  <span class="booking-type">
                    {{ formatBookingType(booking.bookingType) }}
                    <ng-container *ngIf="booking.transportType">
                      · {{ booking.transportType }}
                    </ng-container>
                  </span>
                </div>
                <div class="booking-amount">{{ formatCurrency(booking.amount) }}</div>
              </div>

              <div class="booking-body">
                <div class="route" *ngIf="booking.departure || booking.arrival">
                  <span>{{ booking.departure || 'N/A' }}</span>
                  <span class="material-symbols-outlined">arrow_forward</span>
                  <span>{{ booking.arrival || 'N/A' }}</span>
                </div>

                <div *ngIf="booking.bookingReference">
                  <strong>Reference:</strong> {{ booking.bookingReference }}
                </div>

                <div class="times" *ngIf="booking.startDatetime || booking.endDatetime">
                  <span class="material-symbols-outlined">schedule</span>
                  {{ formatDatetime(booking.startDatetime) }}
                  <ng-container *ngIf="booking.endDatetime">
                    – {{ formatDatetime(booking.endDatetime) }}
                  </ng-container>
                </div>

                <span class="booking-status inline-status" [attr.data-status]="booking.status">
                  {{ booking.status }}
                </span>

                <p class="notes" *ngIf="booking.notes">{{ booking.notes }}</p>
              </div>
            </article>
          </div>
        </section>

        <div *ngIf="showEditTripModal" class="modal-backdrop" (click)="closeEditTripModal()">
          <div class="modal-content edit-trip-modal card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div>
                <h3>Edit Trip</h3>
                <p>Update the trip details. Changes are saved for everyone who has access to this trip.</p>
              </div>
              <button type="button" (click)="closeEditTripModal()" class="close-btn" aria-label="Close">
                &times;
              </button>
            </div>

            <div *ngIf="editTripError" class="alert-danger">{{ editTripError }}</div>

            <form [formGroup]="editTripForm" (ngSubmit)="onEditTripSubmit()">
              <div class="form-group">
                <label class="form-label">Trip Name *</label>
                <input class="form-control" formControlName="name" maxlength="160" />
              </div>

              <div class="form-group">
                <label class="form-label">Destination *</label>
                <input class="form-control" formControlName="destination" maxlength="180" />
              </div>

              <div class="form-row">
                <div class="form-group half">
                  <label class="form-label">Trip Type *</label>
                  <select class="form-control" formControlName="tripType">
                    <option *ngFor="let type of tripTypes" [value]="type">
                      {{ formatTripType(type) }}
                    </option>
                  </select>
                </div>

                <div class="form-group half">
                  <label class="form-label">Travelers *</label>
                  <input type="number" class="form-control" formControlName="travelerCount" min="1" />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group half">
                  <label class="form-label">Start Date *</label>
                  <input type="date" class="form-control" formControlName="startDate" />
                </div>
                <div class="form-group half">
                  <label class="form-label">End Date *</label>
                  <input type="date" class="form-control" formControlName="endDate" />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Budget (₹)</label>
                <input type="number" class="form-control" formControlName="budget" min="0" step="1" />
              </div>

              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea class="form-control" formControlName="description" rows="3"></textarea>
              </div>

              <div class="form-group">
                <label class="form-label">Cover Image URL</label>
                <input class="form-control" formControlName="coverImageUrl" maxlength="500" />
              </div>

              <div class="edit-note">
                <span class="material-symbols-outlined">info</span>
                Ongoing and Completed status are calculated automatically from the trip dates.
              </div>

              <div class="modal-actions">
                <button type="button" class="btn btn-secondary" (click)="closeEditTripModal()">
                  Cancel
                </button>
                <button type="submit" class="btn btn-primary" [disabled]="editTripForm.invalid || isUpdatingTrip">
                  {{ isUpdatingTrip ? 'Saving...' : 'Save Changes' }}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div *ngIf="showBookingModal" class="modal-backdrop" (click)="closeBookingModal()">
          <div class="modal-content card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Add Existing Booking</h3>
              <button type="button" (click)="closeBookingModal()" class="close-btn" aria-label="Close">
                &times;
              </button>
            </div>

            <div *ngIf="bookingModalError" class="alert-danger">
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

                <div
                  class="form-group half"
                  *ngIf="bookingForm.get('bookingType')?.value === 'TRANSPORT'"
                >
                  <label class="form-label">Transport Type</label>
                  <select class="form-control" formControlName="transportType">
                    <option value="FLIGHT">Flight</option>
                    <option value="TRAIN">Train</option>
                    <option value="BUS">Bus</option>
                    <option value="TAXI">Taxi / Cab</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Provider Name</label>
                <input
                  type="text"
                  class="form-control"
                  formControlName="providerName"
                  placeholder="IndiGo Airlines / Hotel name"
                />
              </div>

              <div class="form-group">
                <label class="form-label">Booking Reference / PNR</label>
                <input
                  type="text"
                  class="form-control"
                  formControlName="bookingReference"
                  placeholder="Booking ID or PNR"
                />
              </div>

              <div
                class="form-row"
                *ngIf="bookingForm.get('bookingType')?.value === 'TRANSPORT'"
              >
                <div class="form-group half">
                  <label class="form-label">Departure</label>
                  <input
                    type="text"
                    class="form-control"
                    formControlName="departure"
                    placeholder="Chennai"
                  />
                </div>
                <div class="form-group half">
                  <label class="form-label">Arrival</label>
                  <input
                    type="text"
                    class="form-control"
                    formControlName="arrival"
                    placeholder="Goa"
                  />
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
                <label class="form-label">Amount (₹)</label>
                <input
                  type="number"
                  class="form-control"
                  formControlName="amount"
                  min="0"
                  placeholder="2500"
                />
              </div>

              <div class="form-group">
                <label class="form-label">Notes (Optional)</label>
                <textarea
                  class="form-control"
                  formControlName="notes"
                  rows="2"
                  placeholder="Terminal, seat, contact or other notes..."
                ></textarea>
              </div>

              <div class="modal-actions">
                <button type="button" (click)="closeBookingModal()" class="btn btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  class="btn btn-primary"
                  [disabled]="bookingForm.invalid || isSubmittingBooking"
                >
                  {{ isSubmittingBooking ? 'Saving...' : 'Add Booking' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  `,
  styles: [`
    :host {
      display: block;
      background: #f8fafc;
      min-height: 100vh;
      color: #0f172a;
    }

    .trip-details-page {
      min-height: 100vh;
    }

    .trip-details-container,
    .page-state {
      max-width: 1180px;
      margin: 0 auto;
    }

    .trip-details-container {
      padding: 2rem 1.5rem 4rem;
    }

    .page-state {
      margin-top: 3rem;
      padding: 4rem 2rem;
      text-align: center;
    }

    .page-state p,
    .overview-error p {
      color: #64748b;
      margin: 0.4rem 0 1rem;
    }

    .state-icon {
      font-size: 3rem;
      color: #dc2626;
    }

    .hero-banner {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 2rem;
      padding: 2.25rem;
      color: #ffffff;
      border: none;
      background:
        linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 64, 175, 0.88)),
        radial-gradient(circle at top right, rgba(14, 165, 233, 0.4), transparent 45%);
      box-shadow: 0 18px 45px rgba(15, 23, 42, 0.16);
      margin-bottom: 1.5rem;
      border-radius: 20px;
    }

    .hero-content {
      flex: 1;
      min-width: 0;
    }

    .header-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
      margin-bottom: 0.9rem;
    }

    .badge {
      padding: 0.32rem 0.72rem;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      background: rgba(255, 255, 255, 0.14);
      border: 1px solid rgba(255, 255, 255, 0.18);
    }

    .badge.status[data-status='ONGOING'] {
      background: rgba(16, 185, 129, 0.22);
    }

    .badge.status[data-status='COMPLETED'] {
      background: rgba(148, 163, 184, 0.24);
    }

    .badge.status[data-status='CANCELLED'] {
      background: rgba(239, 68, 68, 0.25);
    }

    .trip-title {
      margin: 0 0 1rem;
      color: #ffffff;
      font-size: clamp(2rem, 4vw, 3rem);
      line-height: 1.08;
    }

    .hero-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.85rem 1.3rem;
      color: rgba(255, 255, 255, 0.88);
      font-size: 0.92rem;
    }

    .meta-item {
      display: inline-flex;
      align-items: center;
      gap: 0.38rem;
      font-weight: 600;
    }

    .meta-item .material-symbols-outlined {
      font-size: 1.15rem;
    }

    .description {
      max-width: 780px;
      margin: 1rem 0 0;
      color: rgba(255, 255, 255, 0.78);
      line-height: 1.6;
    }

    .hero-actions {
      display: flex;
      flex-shrink: 0;
      flex-wrap: wrap;
      gap: 0.6rem;
    }

    .success-banner {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.8rem 1rem;
      margin-bottom: 1rem;
      color: #047857;
      background: #d1fae5;
      border: 1px solid #a7f3d0;
      border-radius: 12px;
      font-weight: 700;
    }

    .details-tabs {
      display: flex;
      gap: 0.35rem;
      padding: 0.35rem;
      margin-bottom: 1.5rem;
      overflow-x: auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
    }

    .tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.72rem 1rem;
      color: #64748b;
      background: transparent;
      border: 0;
      border-radius: 10px;
      font-weight: 750;
      cursor: pointer;
      white-space: nowrap;
    }

    .tab-btn.active {
      color: #1d4ed8;
      background: #eff6ff;
    }

    .tab-count,
    .panel-count {
      display: inline-grid;
      place-items: center;
      min-width: 24px;
      height: 24px;
      padding: 0 0.4rem;
      border-radius: 999px;
      background: #e2e8f0;
      color: #475569;
      font-size: 0.74rem;
      font-weight: 800;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .summary-card {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      min-height: 138px;
      padding: 1.15rem;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      box-shadow: 0 5px 18px rgba(15, 23, 42, 0.04);
    }

    .summary-icon {
      display: grid;
      place-items: center;
      width: 38px;
      height: 38px;
      margin-bottom: 0.25rem;
      border-radius: 11px;
      color: #2563eb;
      background: #eff6ff;
    }

    .summary-icon .material-symbols-outlined {
      font-size: 1.25rem;
    }

    .summary-label {
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .summary-card strong {
      margin-top: auto;
      color: #0f172a;
      font-size: 1.2rem;
    }

    .negative-value {
      color: #dc2626 !important;
    }

    .budget-card {
      padding: 1.35rem;
      margin-bottom: 1rem;
    }

    .card-heading,
    .panel-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .card-heading {
      margin-bottom: 1rem;
    }

    .card-heading h2,
    .panel-heading h2 {
      margin: 0.15rem 0 0;
      font-size: 1.08rem;
    }

    .eyebrow {
      color: #64748b;
      font-size: 0.66rem;
      font-weight: 850;
      letter-spacing: 0.08em;
    }

    .utilization-value {
      color: #2563eb;
      font-size: 1.45rem;
    }

    .budget-track {
      height: 10px;
      overflow: hidden;
      background: #e2e8f0;
      border-radius: 999px;
    }

    .budget-fill {
      height: 100%;
      background: linear-gradient(90deg, #2563eb, #06b6d4);
      border-radius: inherit;
      transition: width 0.25s ease;
    }

    .budget-fill.over-budget {
      background: #dc2626;
    }

    .budget-breakdown {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      margin-top: 0.75rem;
      color: #64748b;
      font-size: 0.82rem;
    }

    .budget-breakdown strong {
      color: #0f172a;
    }

    .overview-columns {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .overview-panel {
      min-height: 330px;
      padding: 1.3rem;
    }

    .panel-heading {
      margin-bottom: 1rem;
    }

    .text-button {
      padding: 0;
      color: #2563eb;
      background: none;
      border: 0;
      font-weight: 750;
      cursor: pointer;
    }

    .panel-empty {
      display: grid;
      place-items: center;
      min-height: 230px;
      padding: 1.5rem;
      text-align: center;
      color: #64748b;
    }

    .panel-empty .material-symbols-outlined {
      font-size: 2.5rem;
      color: #93c5fd;
    }

    .panel-empty h3 {
      margin: 0.45rem 0 0.2rem;
      color: #0f172a;
    }

    .panel-empty p {
      margin: 0 0 1rem;
      font-size: 0.88rem;
    }

    .activity-list,
    .booking-summary-list {
      display: flex;
      flex-direction: column;
    }

    .activity-row,
    .booking-summary-row {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 0.8rem 0;
      border-top: 1px solid #f1f5f9;
    }

    .activity-row:first-child,
    .booking-summary-row:first-child {
      border-top: 0;
    }

    .activity-date {
      display: grid;
      place-items: center;
      width: 48px;
      min-width: 48px;
      height: 52px;
      border-radius: 11px;
      color: #1d4ed8;
      background: #eff6ff;
    }

    .activity-date strong {
      line-height: 1;
      font-size: 1.05rem;
    }

    .activity-date span {
      font-size: 0.65rem;
      font-weight: 800;
      text-transform: uppercase;
    }

    .activity-info,
    .booking-summary-info {
      display: flex;
      flex: 1;
      min-width: 0;
      flex-direction: column;
      gap: 0.2rem;
    }

    .activity-info > strong,
    .booking-summary-info > strong {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .activity-info > span,
    .booking-summary-info > span {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: #64748b;
      font-size: 0.78rem;
    }

    .activity-info .material-symbols-outlined {
      font-size: 1rem;
    }

    .booking-summary-icon,
    .type-icon {
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      min-width: 42px;
      border-radius: 11px;
      color: #2563eb;
      background: #eff6ff;
    }

    .booking-status {
      display: inline-flex;
      align-items: center;
      padding: 0.28rem 0.55rem;
      border-radius: 999px;
      color: #0369a1;
      background: #e0f2fe;
      font-size: 0.66rem;
      font-weight: 850;
    }

    .booking-status[data-status='CONFIRMED'] {
      color: #047857;
      background: #d1fae5;
    }

    .booking-status[data-status='CANCELLED'] {
      color: #b91c1c;
      background: #fee2e2;
    }

    .booking-status[data-status='COMPLETED'] {
      color: #475569;
      background: #e2e8f0;
    }

    .overview-footer-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
    }

    .info-card {
      display: flex;
      align-items: center;
      gap: 0.9rem;
      padding: 1rem 1.15rem;
    }

    .info-card > .material-symbols-outlined {
      color: #2563eb;
    }

    .info-card > div {
      display: flex;
      min-width: 0;
      flex-direction: column;
      gap: 0.15rem;
    }

    .info-card strong {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .overview-loading,
    .overview-error {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.9rem;
      min-height: 120px;
      padding: 1.25rem;
      margin-bottom: 1rem;
    }

    .overview-error {
      justify-content: space-between;
    }

    .overview-error p {
      margin-bottom: 0;
    }

    .bookings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
      gap: 1rem;
    }

    .booking-card {
      padding: 1.2rem;
    }

    .booking-header {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }

    .booking-titles {
      display: flex;
      flex: 1;
      min-width: 0;
      flex-direction: column;
      gap: 0.15rem;
    }

    .provider-name {
      overflow: hidden;
      font-weight: 800;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .booking-type {
      color: #64748b;
      font-size: 0.74rem;
      font-weight: 700;
      text-transform: uppercase;
    }

    .booking-amount {
      font-weight: 850;
      color: #0f766e;
    }

    .booking-body {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
      margin-top: 0.95rem;
      padding-top: 0.85rem;
      color: #475569;
      border-top: 1px solid #f1f5f9;
      font-size: 0.85rem;
    }

    .route,
    .times {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .times .material-symbols-outlined,
    .route .material-symbols-outlined {
      font-size: 1rem;
    }

    .inline-status {
      align-self: flex-start;
    }

    .notes {
      margin: 0;
    }

    .empty-state {
      padding: 4rem 2rem;
      text-align: center;
      color: #64748b;
    }

    .empty-state h3 {
      color: #0f172a;
    }

    .empty-icon {
      font-size: 3rem;
      color: #60a5fa;
    }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 2000;
      display: grid;
      place-items: center;
      padding: 1rem;
      background: rgba(15, 23, 42, 0.62);
      backdrop-filter: blur(6px);
    }

    .modal-content {
      width: min(100%, 540px);
      max-height: 90vh;
      overflow-y: auto;
      padding: 1.6rem;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.2rem;
    }

    .modal-header h3 {
      margin: 0;
    }

    .modal-header p {
      margin: 0.25rem 0 0;
      color: #64748b;
      font-size: 0.82rem;
    }

    .edit-trip-modal {
      width: min(100%, 680px);
    }

    .edit-note {
      display: flex;
      align-items: flex-start;
      gap: 0.45rem;
      padding: 0.7rem 0.8rem;
      color: #475569;
      background: #f8fafc;
      border-radius: 9px;
      font-size: 0.78rem;
    }

    .edit-note .material-symbols-outlined {
      font-size: 1rem;
      color: #2563eb;
    }

    .close-btn {
      color: #64748b;
      background: none;
      border: 0;
      font-size: 1.8rem;
      cursor: pointer;
    }

    .alert-danger {
      margin-bottom: 1rem;
      padding: 0.75rem;
      color: #b91c1c;
      background: #fee2e2;
      border-radius: 9px;
      font-size: 0.85rem;
    }

    .form-group {
      margin-bottom: 0.9rem;
    }

    .form-row {
      display: flex;
      gap: 0.9rem;
    }

    .half {
      flex: 1;
    }

    .form-label {
      display: block;
      margin-bottom: 0.3rem;
      color: #334155;
      font-size: 0.8rem;
      font-weight: 750;
    }

    .form-control {
      width: 100%;
      padding: 0.65rem 0.75rem;
      border: 1px solid #cbd5e1;
      border-radius: 9px;
      font: inherit;
      box-sizing: border-box;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.7rem;
      margin-top: 1.2rem;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.38rem;
      padding: 0.62rem 1rem;
      border-radius: 9px;
      border: 0;
      font-weight: 750;
      cursor: pointer;
    }

    .btn-primary {
      color: #ffffff;
      background: #2563eb;
    }

    .btn-light {
      color: #0f172a;
      background: #ffffff;
    }

    .btn-secondary {
      color: #334155;
      background: #e2e8f0;
    }

    .btn.compact {
      padding: 0.48rem 0.75rem;
      font-size: 0.8rem;
    }

    .empty-booking-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.55rem;
    }

    .spinner {
      width: 34px;
      height: 34px;
      margin: 0 auto 1rem;
      border: 3px solid #dbeafe;
      border-top-color: #2563eb;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    .spinner.small {
      width: 24px;
      height: 24px;
      margin: 0;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @media (max-width: 1050px) {
      .summary-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    @media (max-width: 760px) {
      .trip-details-container {
        padding: 1rem 0.85rem 3rem;
      }

      .hero-banner {
        flex-direction: column;
        padding: 1.5rem;
      }

      .hero-actions,
      .hero-actions .btn {
        width: 100%;
      }

      .summary-grid,
      .overview-columns,
      .overview-footer-grid {
        grid-template-columns: 1fr;
      }

      .budget-breakdown {
        flex-direction: column;
        gap: 0.35rem;
      }

      .form-row {
        flex-direction: column;
        gap: 0;
      }

      .overview-error {
        align-items: flex-start;
        flex-direction: column;
      }
    }
  `]
})
export class TripDetailsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tripService = inject(TripService);
  private readonly bookingService = inject(BookingService);
  private readonly fb = inject(FormBuilder);

  tripId = 0;
  trip: Trip | null = null;
  dashboard: TripDashboard | null = null;
  bookings: Booking[] = [];

  activeTab: TripDetailsTab = 'OVERVIEW';

  isLoadingTrip = true;
  tripLoadError = '';
  isLoadingDashboard = true;
  dashboardError = '';
  isLoadingBookings = true;
  bookingsError = '';

  showBookingModal = false;
  isSubmittingBooking = false;
  bookingModalError = '';

  showEditTripModal = false;
  isUpdatingTrip = false;
  editTripError = '';
  tripUpdateMessage = '';

  readonly tripTypes: TripType[] = ['ADVENTURE', 'FAMILY', 'COUPLE', 'FRIENDS', 'SOLO'];

  editTripForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    destination: ['', [Validators.required, Validators.maxLength(180)]],
    tripType: ['FRIENDS' as TripType, Validators.required],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    travelerCount: [1, [Validators.required, Validators.min(1)]],
    budget: [0, [Validators.required, Validators.min(0)]],
    description: [''],
    coverImageUrl: ['', Validators.maxLength(500)]
  });

  bookingForm = this.fb.group({
    bookingType: ['TRANSPORT' as BookingType, Validators.required],
    transportType: ['FLIGHT' as TransportType],
    providerName: ['', Validators.required],
    bookingReference: [''],
    departure: [''],
    arrival: [''],
    startDatetime: [''],
    endDatetime: [''],
    amount: [0, [Validators.required, Validators.min(0)]],
    notes: ['']
  });

  get canEditTrip(): boolean {
    return this.trip?.userRole === 'OWNER' || this.trip?.userRole === 'EDITOR';
  }

  ngOnInit(): void {
    this.tripId = Number(this.route.snapshot.paramMap.get('id'));

    if (!Number.isFinite(this.tripId) || this.tripId <= 0) {
      this.isLoadingTrip = false;
      this.tripLoadError = 'Invalid trip ID.';
      this.isLoadingDashboard = false;
      this.isLoadingBookings = false;
      return;
    }

    this.loadTripDetails();
    this.loadDashboard();
    this.loadBookings();
  }

  retryTrip(): void {
    this.loadTripDetails();
    this.loadDashboard();
    this.loadBookings();
  }

  loadTripDetails(): void {
    this.isLoadingTrip = true;
    this.tripLoadError = '';

    this.tripService.getTripById(this.tripId).subscribe({
      next: (data) => {
        this.trip = data;
        this.isLoadingTrip = false;
      },
      error: (err) => {
        this.trip = null;
        this.tripLoadError = err?.error?.message || 'Please try again.';
        this.isLoadingTrip = false;
      }
    });
  }

  loadDashboard(): void {
    this.isLoadingDashboard = true;
    this.dashboardError = '';

    this.tripService.getTripDashboard(this.tripId).subscribe({
      next: (data) => {
        this.dashboard = data;
        this.isLoadingDashboard = false;
      },
      error: (err) => {
        this.dashboard = null;
        this.dashboardError = err?.error?.message || 'Please try again.';
        this.isLoadingDashboard = false;
      }
    });
  }

  loadBookings(): void {
    this.isLoadingBookings = true;
    this.bookingsError = '';

    this.bookingService.getBookings(this.tripId).subscribe({
      next: (data) => {
        this.bookings = data ?? [];
        this.isLoadingBookings = false;
      },
      error: (err) => {
        this.bookings = [];
        this.bookingsError = err?.error?.message || 'Please try again.';
        this.isLoadingBookings = false;
      }
    });
  }

  budgetProgressWidth(value: number): number {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.min(value, 100);
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
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  formatActivityDay(value: string): string {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleDateString('en-IN', { day: '2-digit' });
  }

  formatActivityMonth(value: string): string {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-IN', { month: 'short' });
  }

  formatActivityTime(value?: string): string {
    if (!value) return 'Time not set';

    const [hour, minute] = value.split(':').map(Number);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;

    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatStatus(status: string): string {
    if (status === 'PLANNED') return 'Planning';
    return status.charAt(0) + status.slice(1).toLowerCase();
  }

  formatTripType(type: string): string {
    return type.charAt(0) + type.slice(1).toLowerCase();
  }

  formatBookingType(type: string): string {
    return type.charAt(0) + type.slice(1).toLowerCase();
  }

  getDashboardBookingIcon(booking: TripDashboardBooking): string {
    if (booking.bookingType === 'HOTEL') return 'hotel';
    if (booking.bookingType === 'ACTIVITY') return 'attractions';
    return 'commute';
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

  formatDatetime(value?: string): string {
    if (!value) return 'N/A';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  openEditTripModal(): void {
    if (!this.trip || !this.canEditTrip) return;

    this.editTripError = '';
    this.tripUpdateMessage = '';
    this.editTripForm.reset({
      name: this.trip.name,
      destination: this.trip.destination,
      tripType: this.trip.tripType,
      startDate: this.trip.startDate,
      endDate: this.trip.endDate,
      travelerCount: this.trip.travelerCount,
      budget: this.trip.budget ?? 0,
      description: this.trip.description ?? '',
      coverImageUrl: this.trip.coverImageUrl ?? ''
    });
    this.showEditTripModal = true;
  }

  closeEditTripModal(): void {
    if (this.isUpdatingTrip) return;
    this.showEditTripModal = false;
    this.editTripError = '';
  }

  onEditTripSubmit(): void {
    if (!this.trip || !this.canEditTrip || this.editTripForm.invalid) return;

    const value = this.editTripForm.getRawValue();
    if (value.endDate! < value.startDate!) {
      this.editTripError = 'End date cannot be before start date.';
      return;
    }

    this.isUpdatingTrip = true;
    this.editTripError = '';

    const request: UpdateTripRequest = {
      name: value.name!.trim(),
      destination: value.destination!.trim(),
      tripType: value.tripType as TripType,
      startDate: value.startDate!,
      endDate: value.endDate!,
      travelerCount: Number(value.travelerCount),
      budget: Number(value.budget ?? 0),
      description: value.description?.trim() || undefined,
      coverImageUrl: value.coverImageUrl?.trim() || undefined,
      status: this.preservedEditableStatus()
    };

    this.tripService.updateTrip(this.tripId, request).subscribe({
      next: (updatedTrip) => {
        this.trip = updatedTrip;
        this.isUpdatingTrip = false;
        this.showEditTripModal = false;
        this.tripUpdateMessage = 'Trip details updated successfully.';
        this.loadDashboard();
      },
      error: (err) => {
        this.isUpdatingTrip = false;
        this.editTripError = err?.error?.message || 'Unable to update the trip.';
      }
    });
  }

  private preservedEditableStatus(): UpdateTripRequest['status'] {
    const status = this.trip?.status;
    if (
      status === 'PLANNED' ||
      status === 'UPCOMING' ||
      status === 'CONFIRMED' ||
      status === 'CANCELLED'
    ) {
      return status;
    }
    return undefined;
  }

  openBookNow(): void {
    void this.router.navigate(['/trips', this.tripId, 'bookings', 'new']);
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
      amount: 0
    });
  }

  onBookingSubmit(): void {
    if (this.bookingForm.invalid) return;

    this.isSubmittingBooking = true;
    this.bookingModalError = '';

    const value = this.bookingForm.value;
    const request: CreateBookingRequest = {
      bookingType: value.bookingType as BookingType,
      transportType:
        value.bookingType === 'TRANSPORT'
          ? (value.transportType as TransportType)
          : undefined,
      providerName: value.providerName!,
      bookingReference: value.bookingReference || undefined,
      departure:
        value.bookingType === 'TRANSPORT' ? value.departure || undefined : undefined,
      arrival:
        value.bookingType === 'TRANSPORT' ? value.arrival || undefined : undefined,
      startDatetime: value.startDatetime || undefined,
      endDatetime: value.endDatetime || undefined,
      amount: value.amount!,
      status: 'CONFIRMED',
      notes: value.notes || undefined
    };

    this.bookingService.createBooking(this.tripId, request).subscribe({
      next: (newBooking) => {
        this.isSubmittingBooking = false;
        this.bookings = [newBooking, ...this.bookings];
        this.closeBookingModal();
        this.loadDashboard();
      },
      error: (err) => {
        this.isSubmittingBooking = false;
        this.bookingModalError = err?.error?.message || 'Failed to create booking.';
      }
    });
  }
}
