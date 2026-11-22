import { shareNativeFile } from '../../../core/utils/native-files';
import { FlightAlertsComponent } from '../flight-alerts/flight-alerts.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import {
  Trip,
  TripDashboard,
  TripDashboardBooking,
  TripMember,
  TripRole,
  TripType,
  TripWeather,
  UpdateTripRequest
} from '../../../core/models/trip.model';
import {
  Booking,
  BookingImportDraft,
  BookingType,
  CreateBookingRequest,
  TransportType
} from '../../../core/models/booking.model';
import { BookingService } from '../../../core/services/booking.service';
import { TripService } from '../../../core/services/trip.service';
import { TripMemberService } from '../../../core/services/trip-member.service';
import { ItineraryPlannerComponent } from '../itinerary-planner/itinerary-planner.component';
import { ExpenseManagerComponent } from '../expense-manager/expense-manager.component';
import { DocumentManagerComponent } from '../document-manager/document-manager.component';
import { ExploreComponent } from '../../discovery/explore.component';

import { OfflineTripComponent } from '../offline-trip/offline-trip.component';

type TripDetailsTab = 'OVERVIEW' | 'EXPLORE' | 'ITINERARY' | 'EXPENSES' | 'BOOKINGS' | 'DOCUMENTS' | 'MEMBERS';

@Component({
  selector: 'app-trip-details',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    ItineraryPlannerComponent,
    ExploreComponent,
    ExpenseManagerComponent,
    DocumentManagerComponent,
    OfflineTripComponent,
    FlightAlertsComponent
  ],
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
        <div class="mobile-trip-controls"><a routerLink="/trips" class="mobile-trips-back">‹ My trips</a><button type="button" class="mobile-trip-more" (click)="mobileActionsOpen = !mobileActionsOpen" [attr.aria-expanded]="mobileActionsOpen" aria-controls="trip-secondary-actions">{{mobileActionsOpen ? 'Close actions' : 'Trip actions'}} ⋯</button></div>
        <section class="trip-header card" [class.mobile-expanded]="mobileActionsOpen">
          <div class="trip-header-main">
            <div>
              <div class="title-row">
                <h1>{{ currentTrip.name }}</h1>
                <span class="status-chip" [attr.data-status]="currentTrip.status">
                  {{ formatStatus(currentTrip.status) }}
                </span>
              </div>

              <div class="trip-meta-row">
                <span>
                  <span class="material-symbols-outlined">location_on</span>
                  {{ currentTrip.destination }}
                </span>
                <span>
                  <span class="material-symbols-outlined">calendar_month</span>
                  {{ formatDate(currentTrip.startDate) }} – {{ formatDate(currentTrip.endDate) }}
                </span>
                <span>
                  <span class="material-symbols-outlined">groups</span>
                  {{ currentTrip.travelerCount }} traveler{{ currentTrip.travelerCount === 1 ? '' : 's' }}
                </span>
                <span>
                  <span class="material-symbols-outlined">account_balance_wallet</span>
                  {{ formatCurrency(currentTrip.budget) }} budget
                </span>
              </div>

              <p *ngIf="currentTrip.description" class="trip-header-description">
                {{ currentTrip.description }}
              </p>
            </div>

            <div class="trip-header-actions" id="trip-secondary-actions" [class.mobile-expanded]="mobileActionsOpen">
              <button type="button" class="btn btn-outline" [disabled]="isDuplicatingTrip" (click)="duplicateCurrentTrip()">
                <span class="material-symbols-outlined">content_copy</span>
                {{ isDuplicatingTrip ? 'Copying...' : 'Duplicate' }}
              </button>
              <button type="button" class="btn btn-outline" [disabled]="isExportingCalendar" (click)="exportCalendar()">
                <span class="material-symbols-outlined">calendar_add_on</span>
                {{ isExportingCalendar ? 'Preparing...' : 'Add to Calendar' }}
              </button>
              <button type="button" class="btn btn-outline" (click)="openShareTrip()">
                <span class="material-symbols-outlined">group_add</span>
                Share Trip
              </button>

              <button
                *ngIf="canEditTrip"
                type="button"
                class="btn btn-primary"
                (click)="openEditTripModal()"
              >
                <span class="material-symbols-outlined">edit</span>
                Edit Details
              </button>

              <button
                *ngIf="canDeleteTrip"
                type="button"
                class="btn btn-danger-outline"
                (click)="deleteCurrentTrip()"
              >
                <span class="material-symbols-outlined">delete</span>
                Delete Trip
              </button>
            </div>
          </div>
        </section>

        <div *ngIf="tripUpdateMessage" class="success-banner">
          <span class="material-symbols-outlined">check_circle</span>
          {{ tripUpdateMessage }}
        </div>

        <nav class="details-tabs dashboard-tabs" aria-label="Trip dashboard sections">
          <button type="button" class="tab-btn" [class.active]="activeTab === 'OVERVIEW'" (click)="setActiveTab('OVERVIEW')">
            Overview
          </button>
          <button type="button" class="tab-btn" [class.active]="activeTab === 'EXPLORE'" (click)="setActiveTab('EXPLORE')">
            Explore
          </button>
          <button type="button" class="tab-btn" [class.active]="activeTab === 'ITINERARY'" (click)="setActiveTab('ITINERARY')">
            Itinerary
          </button>
          <button type="button" class="tab-btn" [class.active]="activeTab === 'EXPENSES'" (click)="setActiveTab('EXPENSES')">
            Expenses
          </button>
          <button type="button" class="tab-btn" [class.active]="activeTab === 'BOOKINGS'" (click)="setActiveTab('BOOKINGS')">
            Bookings
            <span class="tab-count">{{ bookings.length }}</span>
          </button>
          <button type="button" class="tab-btn" [class.active]="activeTab === 'DOCUMENTS'" (click)="setActiveTab('DOCUMENTS')">
            Documents
            <span class="tab-count" *ngIf="dashboard?.documentCount">{{ dashboard?.documentCount }}</span>
          </button>
          <button type="button" class="tab-btn" [class.active]="activeTab === 'MEMBERS'" (click)="setActiveTab('MEMBERS')">
            Members
            <span class="tab-count">{{ dashboard?.memberCount ?? members.length }}</span>
          </button>
        </nav>

        <section *ngIf="activeTab === 'OVERVIEW'" class="tab-content dashboard-overview">
          <div *ngIf="isLoadingDashboard" class="ov-skeleton" role="status" aria-live="polite">
            <span class="sr-only">Loading trip dashboard...</span>
            <div class="ov-skel ov-skel-hero"></div>
            <div class="ov-skel-row">
              <div class="ov-skel ov-skel-tile"></div>
              <div class="ov-skel ov-skel-tile"></div>
              <div class="ov-skel ov-skel-tile"></div>
              <div class="ov-skel ov-skel-tile"></div>
            </div>
            <div class="ov-skel ov-skel-card"></div>
          </div>

          <div *ngIf="!isLoadingDashboard && dashboardError" class="overview-error card">
            <div>
              <strong>Unable to load the trip dashboard.</strong>
              <p>{{ dashboardError }}</p>
            </div>
            <button type="button" class="btn btn-secondary" (click)="loadDashboard()">Retry</button>
          </div>

          <ng-container *ngIf="!isLoadingDashboard && !dashboardError && dashboard as overview">
            <section class="ov-hero" [attr.data-phase]="tripPhase" aria-label="Trip journey">
              <div class="ov-hero-content">
                <div class="ov-hero-main">
                  <span class="ov-hero-eyebrow">
                    <span class="material-symbols-outlined">{{ tripPhaseIcon }}</span>
                    {{ tripPhaseLabel }}
                  </span>
                  <h2 class="ov-hero-title">{{ currentTrip.destination }}</h2>
                  <p class="ov-hero-dates">
                    {{ formatDate(currentTrip.startDate) }} – {{ formatDate(currentTrip.endDate) }}
                    <span aria-hidden="true">·</span>
                    {{ tripDurationDays }} day{{ tripDurationDays === 1 ? '' : 's' }}
                  </p>
                </div>

                <div class="ov-countdown">
                  <strong>{{ countdownValue }}</strong>
                  <span>{{ countdownCaption }}</span>
                </div>
              </div>

              <div class="ov-journey">
                <div
                  class="ov-journey-track"
                  role="progressbar"
                  aria-label="Trip progress"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  [attr.aria-valuenow]="tripProgressPercent"
                >
                  <span class="ov-journey-fill" [style.width.%]="tripProgressPercent"></span>
                  <span class="ov-journey-marker" [style.left.%]="tripProgressPercent">
                    <span class="material-symbols-outlined">flight</span>
                  </span>
                </div>
                <div class="ov-journey-labels">
                  <span><small>Depart</small>{{ formatDate(currentTrip.startDate) }}</span>
                  <span><small>Return</small>{{ formatDate(currentTrip.endDate) }}</span>
                </div>
              </div>
            </section>

            <div class="ov-stats">
              <div class="ov-stat">
                <span class="ov-stat-icon tone-blue"><span class="material-symbols-outlined">date_range</span></span>
                <div>
                  <span class="ov-label">Duration</span>
                  <strong>{{ tripDurationDays }} Day{{ tripDurationDays === 1 ? '' : 's' }}</strong>
                </div>
              </div>

              <button type="button" class="ov-stat" (click)="setActiveTab('MEMBERS')">
                <span class="ov-stat-icon tone-violet"><span class="material-symbols-outlined">groups</span></span>
                <div>
                  <span class="ov-label">Travelers</span>
                  <strong>{{ overview.travelerCount }}</strong>
                </div>
                <span class="material-symbols-outlined ov-stat-arrow">arrow_forward</span>
              </button>

              <button type="button" class="ov-stat" (click)="setActiveTab('BOOKINGS')">
                <span class="ov-stat-icon tone-amber"><span class="material-symbols-outlined">confirmation_number</span></span>
                <div>
                  <span class="ov-label">Bookings</span>
                  <strong>{{ bookings.length }}</strong>
                </div>
                <span class="material-symbols-outlined ov-stat-arrow">arrow_forward</span>
              </button>

              <button type="button" class="ov-stat" (click)="setActiveTab('DOCUMENTS')">
                <span class="ov-stat-icon tone-teal"><span class="material-symbols-outlined">folder_open</span></span>
                <div>
                  <span class="ov-label">Documents</span>
                  <strong>{{ overview.documentCount }}</strong>
                </div>
                <span class="material-symbols-outlined ov-stat-arrow">arrow_forward</span>
              </button>
            </div>

            <div class="dashboard-main-grid">
              <div class="dashboard-left">
                <article class="ov-card ov-budget">
                  <header class="ov-card-head">
                    <div>
                      <span class="ov-kicker">Budget</span>
                      <h3>Spending overview</h3>
                    </div>
                    <button type="button" class="ov-link" (click)="setActiveTab('EXPENSES')">
                      View expenses
                      <span class="material-symbols-outlined">arrow_forward</span>
                    </button>
                  </header>

                  <div class="ov-budget-headline">
                    <div>
                      <span class="ov-label">Total Budget</span>
                      <strong class="ov-budget-total">{{ formatCurrency(overview.budget) }}</strong>
                    </div>
                    <span class="ov-pill" [attr.data-tone]="budgetTone">{{ budgetUsedLabel }}</span>
                  </div>

                  <div
                    class="ov-meter"
                    [attr.data-tone]="budgetTone"
                    role="progressbar"
                    aria-label="Budget used"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    [attr.aria-valuenow]="budgetMeterWidth"
                  >
                    <span [style.width.%]="budgetMeterWidth"></span>
                  </div>

                  <div class="ov-budget-split">
                    <div>
                      <span class="ov-label"><span class="ov-dot dot-spent"></span>Total Spent</span>
                      <strong>{{ formatCurrency(overview.totalExpenses) }}</strong>
                    </div>
                    <div>
                      <span class="ov-label"><span class="ov-dot dot-remaining"></span>Remaining</span>
                      <strong [class.negative-value]="overview.remainingBudget < 0">
                        {{ formatCurrency(overview.remainingBudget) }}
                      </strong>
                    </div>
                    <div>
                      <span class="ov-label"><span class="ov-dot dot-traveler"></span>Per traveler</span>
                      <strong>{{ formatCurrency(perTravelerBudget) }}</strong>
                    </div>
                  </div>
                </article>

                <article class="ov-card ov-weather">
                  <header class="ov-card-head">
                    <div>
                      <span class="ov-kicker">Forecast</span>
                      <h3>Trip Weather</h3>
                      <p>{{ weather?.resolvedLocation || currentTrip.destination }}</p>
                    </div>
                    <button *ngIf="weatherError" type="button" class="ov-link" (click)="loadWeather()">
                      Retry
                      <span class="material-symbols-outlined">refresh</span>
                    </button>
                  </header>

                  <div *ngIf="isLoadingWeather" class="ov-weather-state">
                    <div class="spinner small"></div>
                    <span>Checking the forecast...</span>
                  </div>
                  <div *ngIf="!isLoadingWeather && weatherError" class="ov-weather-state is-muted">
                    <span class="material-symbols-outlined">cloud_off</span>
                    <span>{{ weatherError }}</span>
                  </div>
                  <ng-container *ngIf="!isLoadingWeather && !weatherError && weather as tripWeather">
                    <div *ngIf="tripWeather.available" class="ov-weather-days">
                      <div *ngFor="let day of tripWeather.days" class="ov-weather-day">
                        <span class="ov-weather-date">{{ formatWeatherDate(day.date) }}</span>
                        <span class="material-symbols-outlined ov-weather-icon">{{ day.icon }}</span>
                        <strong>{{ day.maximumTemperatureCelsius | number:'1.0-0' }}°</strong>
                        <span class="ov-weather-low">{{ day.minimumTemperatureCelsius | number:'1.0-0' }}° low</span>
                        <span class="ov-weather-condition">{{ day.condition }}</span>
                        <span class="ov-weather-rain">
                          <span class="material-symbols-outlined">water_drop</span>{{ day.precipitationProbability }}%
                        </span>
                      </div>
                    </div>
                    <div *ngIf="!tripWeather.available" class="ov-weather-state is-muted">
                      <span class="material-symbols-outlined">calendar_clock</span>
                      <span>{{ tripWeather.message }}</span>
                    </div>
                    <p *ngIf="tripWeather.available" class="ov-weather-note">{{ tripWeather.message }}</p>
                  </ng-container>
                </article>
              </div>

              <aside class="dashboard-sidebar">
                <article class="ov-card sidebar-members-card">
                  <header class="ov-card-head">
                    <div>
                      <span class="ov-kicker">Travel party</span>
                      <h3>Trip Members <span class="ov-count">{{ overview.memberCount }}</span></h3>
                    </div>
                    <button type="button" class="ov-link" (click)="setActiveTab('MEMBERS')">Manage</button>
                  </header>

                  <ul class="ov-member-list">
                    <li *ngFor="let member of members.slice(0, 5); let i = index" class="ov-member">
                      <span class="ov-avatar" [attr.data-tone]="i % 5">
                        {{ (member.userName || '?').charAt(0).toUpperCase() }}
                      </span>
                      <span class="ov-member-text">
                        <strong>{{ member.userName }}</strong>
                        <span>{{ member.userEmail }}</span>
                      </span>
                      <span class="ov-role" [class.is-owner]="member.role === 'OWNER'">
                        {{ member.role === 'OWNER' ? 'Organizer' : formatMemberRole(member.role) }}
                      </span>
                    </li>
                  </ul>

                  <p *ngIf="members.length > 5" class="ov-member-more">
                    +{{ members.length - 5 }} more member{{ members.length - 5 === 1 ? '' : 's' }}
                  </p>

                  <div *ngIf="members.length === 0" class="ov-member-empty">
                    No member details loaded.
                  </div>

                  <button type="button" class="ov-invite" (click)="openShareTrip()">
                    <span class="material-symbols-outlined">{{ canManageMembers ? 'person_add' : 'group' }}</span>
                    {{ canManageMembers ? 'Invite travelers' : 'View all members' }}
                  </button>
                </article>
              </aside>
            </div>
          </ng-container>

          <section class="ov-tools" aria-labelledby="ov-tools-title">
            <header class="ov-section-head">
              <span class="ov-kicker">Travel tools</span>
              <h3 id="ov-tools-title">Stay ready on the road</h3>
              <p>Save this trip for offline use and keep an eye on your flights.</p>
            </header>
            <app-offline-trip [tripId]="tripId"></app-offline-trip>
            <app-flight-alerts [tripId]="tripId" [bookings]="bookings" [canManage]="canEditTrip"></app-flight-alerts>
          </section>
        </section>
 
        <section *ngIf="activeTab === 'EXPLORE'" class="tab-content">
          <app-explore (placesChanged)="onPlacesChanged()" [trip]="currentTrip" [canEdit]="canPlanTrip" (itineraryChanged)="onExploreItineraryAdded()"></app-explore>
        </section>

        <section *ngIf="activeTab === 'ITINERARY'" class="tab-content">
          <app-itinerary-planner
            [tripId]="tripId"
            [trip]="currentTrip"
            [canEdit]="canPlanTrip"
            (itineraryChanged)="onItineraryChanged()"
          ></app-itinerary-planner>
        </section>

        <section *ngIf="activeTab === 'EXPENSES'" class="tab-content">
          <app-expense-manager
            [tripId]="tripId"
            [trip]="currentTrip"
            [members]="members"
            [canEdit]="canManageExpenses"
            [openRequest]="expenseOpenRequest"
            (expensesChanged)="onExpensesChanged()"
          ></app-expense-manager>
        </section>

        <section *ngIf="activeTab === 'DOCUMENTS'" class="tab-content">
          <app-document-manager
            [tripId]="tripId"
            [canEdit]="canEditTrip"
            [openRequest]="documentOpenRequest"
            (documentsChanged)="onDocumentsChanged()"
          ></app-document-manager>
        </section>

        <section *ngIf="activeTab === 'BOOKINGS'" class="tab-content">
          <app-flight-alerts [tripId]="tripId" [bookings]="bookings" [canManage]="canEditTrip"></app-flight-alerts>

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
              <button type="button" (click)="openBookingModal()" class="btn btn-primary">
                <span class="material-symbols-outlined">add</span>
                Add Existing Booking
              </button>
              <button type="button" (click)="openBookingImport()" class="btn btn-secondary">
                <span class="material-symbols-outlined">document_scanner</span>
                Import PDF / Image
              </button>
            </div>
          </div>

          <div
            *ngIf="!isLoadingBookings && !bookingsError && bookings.length > 0 && !hasActiveBookings && canEditTrip"
            class="rebook-banner card"
          >
            <div class="rebook-copy">
              <span class="material-symbols-outlined">event_repeat</span>
              <div>
                <strong>No active bookings</strong>
                <p>Your booking was cancelled. Add an existing booking or import a ticket.</p>
              </div>
            </div>
            <div class="empty-booking-actions">
              <button type="button" (click)="openBookingModal()" class="btn btn-primary">
                <span class="material-symbols-outlined">add</span>
                Add Existing
              </button>
              <button type="button" (click)="openBookingImport()" class="btn btn-secondary">
                <span class="material-symbols-outlined">document_scanner</span>
                Import PDF / Image
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

                <div *ngIf="booking.passengerDetails">
                  <strong>Passengers:</strong> {{ booking.passengerDetails }}
                </div>

                <div *ngIf="booking.pickupPoint">
                  <strong>Pickup:</strong> {{ booking.pickupPoint }}
                </div>

                <div *ngIf="booking.dropPoint">
                  <strong>Drop:</strong> {{ booking.dropPoint }}
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

                <div *ngIf="booking.paymentStatus && booking.paymentStatus !== 'NOT_REQUIRED'" class="payment-state">
                  <strong>Payment:</strong> {{ booking.paymentStatus }}
                </div>

                <div *ngIf="booking.cancellationReason" class="cancellation-info">
                  <strong>Cancellation:</strong> {{ booking.cancellationReason }}
                </div>

                <p class="notes" *ngIf="booking.notes">{{ booking.notes }}</p>

                <div *ngIf="canEditTrip" class="booking-actions">
                  <button
                    *ngIf="canCancelBooking(booking)"
                    type="button"
                    class="btn btn-danger compact"
                    (click)="openCancelBookingModal(booking)"
                  >
                    <span class="material-symbols-outlined">cancel</span>
                    Cancel Booking
                  </button>
                  <ng-container *ngIf="confirmDeleteBookingId !== booking.id; else confirmDelete">
                    <button type="button" class="btn delete-booking-btn compact" [disabled]="deletingBookingId === booking.id" (click)="confirmDeleteBookingId = booking.id; deleteBookingError = ''">
                      <span class="material-symbols-outlined">delete</span>
                      Delete
                    </button>
                  </ng-container>
                  <ng-template #confirmDelete>
                    <div class="delete-confirm" role="group" [attr.aria-label]="'Delete ' + booking.providerName">
                      <span>Delete this booking permanently?</span>
                      <button type="button" class="btn btn-danger compact" [disabled]="deletingBookingId === booking.id" (click)="deleteBooking(booking)">{{ deletingBookingId === booking.id ? 'Deleting…' : 'Yes, delete' }}</button>
                      <button type="button" class="btn btn-secondary compact" [disabled]="deletingBookingId === booking.id" (click)="confirmDeleteBookingId = null">Keep</button>
                    </div>
                  </ng-template>
                </div>
                <div *ngIf="deleteBookingError && confirmDeleteBookingId === booking.id" class="alert-danger" role="alert">{{ deleteBookingError }}</div>
              </div>
            </article>
          </div>
        </section>

        <section *ngIf="activeTab === 'MEMBERS'" class="tab-content">
          <div class="members-toolbar card">
            <div>
              <span class="eyebrow">TRIP ACCESS</span>
              <h2>Trip Members</h2>
              <p>
                Members have access to this trip. Owner can add users and manage Editor/Viewer permissions.
              </p>
            </div>

            <button
              *ngIf="canManageMembers"
              type="button"
              class="btn btn-primary"
              (click)="openAddMemberModal()"
            >
              <span class="material-symbols-outlined">person_add</span>
              Add Member
            </button>
          </div>

          <div *ngIf="isLoadingMembers" class="overview-loading card">
            <div class="spinner small"></div>
            <span>Loading members...</span>
          </div>

          <div *ngIf="!isLoadingMembers && membersError" class="overview-error card">
            <div>
              <strong>Unable to load members.</strong>
              <p>{{ membersError }}</p>
            </div>
            <button type="button" class="btn btn-secondary" (click)="loadMembers()">Retry</button>
          </div>

          <div *ngIf="!isLoadingMembers && !membersError" class="members-grid">
            <article *ngFor="let member of members" class="member-card card" [attr.data-role]="member.role">
              <div class="member-avatar">
                {{ member.userName?.charAt(0)?.toUpperCase() || '?' }}
              </div>

              <div class="member-info">
                <div class="member-name-row">
                  <strong>{{ member.userName }}</strong>
                  <span *ngIf="member.role === 'OWNER'" class="owner-pill">Owner</span>
                </div>
                <span>{{ member.userEmail }}</span>
                <span *ngIf="member.userMobile">{{ member.userMobile }}</span>
              </div>

              <div class="member-role">
                <ng-container *ngIf="canManageMembers && member.role !== 'OWNER'; else roleLabel">
                  <select
                    class="form-control compact-select"
                    [value]="member.role"
                    [disabled]="updatingMemberId === member.id"
                    (change)="changeMemberRole(member, $any($event.target).value)"
                  >
                    <option value="PLANNER">Planner — itinerary and places</option>
                    <option value="EXPENSE_MANAGER">Expense manager — expenses and settlements</option>
                    <option value="EDITOR">Editor</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                </ng-container>
                <ng-template #roleLabel>
                  <span class="role-pill">{{ member.role }}</span>
                </ng-template>
              </div>

              <button
                *ngIf="canManageMembers && member.role !== 'OWNER'"
                type="button"
                class="btn btn-danger compact"
                [disabled]="removingMemberId === member.id"
                (click)="removeMember(member)"
              >
                {{ removingMemberId === member.id ? 'Removing...' : 'Remove' }}
              </button>
            </article>

            <div *ngIf="members.length === 0" class="empty-state card">
              <span class="material-symbols-outlined empty-icon">group_off</span>
              <h3>No members found</h3>
              <p>The trip owner should normally appear here.</p>
            </div>
          </div>
        </section>

        <div *ngIf="showAddMemberModal" class="modal-backdrop">
          <div class="modal-content card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div>
                <h3>Add Trip Member</h3>
                <p>Add a registered Suttru user by email and choose their permission.</p>
              </div>
              <button type="button" class="close-btn" (click)="closeAddMemberModal()" aria-label="Close">
                &times;
              </button>
            </div>

            <div *ngIf="memberModalError" class="alert-danger">{{ memberModalError }}</div>

            <form [formGroup]="addMemberForm" (ngSubmit)="submitAddMember()">
              <div class="form-group">
                <label class="form-label">Registered User Email *</label>
                <input
                  type="email"
                  class="form-control"
                  formControlName="email"
                  placeholder="member@example.com"
                />
              </div>

              <div class="form-group">
                <label class="form-label">Role *</label>
                <select class="form-control" formControlName="role">
                  <option value="PLANNER">Planner — itinerary and places</option>
                    <option value="EXPENSE_MANAGER">Expense manager — expenses and settlements</option>
                    <option value="EDITOR">Editor - can modify trip content</option>
                  <option value="VIEWER">Viewer - read only</option>
                </select>
              </div>

              <div class="edit-note">
                <span class="material-symbols-outlined">info</span>
                The dashboard Members count updates immediately after the member is added.
              </div>

              <div class="modal-actions">
                <button type="button" class="btn btn-secondary" (click)="closeAddMemberModal()">
                  Cancel
                </button>
                <button
                  type="submit"
                  class="btn btn-primary"
                  [disabled]="addMemberForm.invalid || isAddingMember"
                >
                  {{ isAddingMember ? 'Adding...' : 'Add Member' }}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div *ngIf="showCancelBookingModal && bookingToCancel as cancelBooking" class="modal-backdrop">
          <div class="modal-content cancel-booking-modal card" (click)="$event.stopPropagation()">
            <div class="cancel-icon">
              <span class="material-symbols-outlined">cancel</span>
            </div>

            <div class="modal-header cancel-header">
              <div>
                <h3>Cancel Booking?</h3>
                <p>
                  {{ cancelBooking.providerName }}
                  <ng-container *ngIf="cancelBooking.bookingReference">
                    · {{ cancelBooking.bookingReference }}
                  </ng-container>
                </p>
              </div>
              <button type="button" (click)="closeCancelBookingModal()" class="close-btn" aria-label="Close">
                &times;
              </button>
            </div>

            <div class="cancel-summary">
              <div>
                <span>Booking</span>
                <strong>{{ formatBookingType(cancelBooking.bookingType) }}</strong>
              </div>
              <div>
                <span>Amount</span>
                <strong>{{ formatCurrency(cancelBooking.amount) }}</strong>
              </div>
              <div *ngIf="cancelBooking.bookingSource === 'TRIPMATE_SANDBOX'">
                <span>Refund</span>
                <strong>
                  {{ cancelBooking.refundable ? 'Sandbox refund after cancellation' : 'Non-refundable fare' }}
                </strong>
              </div>
            </div>

            <label class="form-group">
              <span class="form-label">Reason for cancellation</span>
              <select class="form-control" [(ngModel)]="cancelReason">
                <option value="">Select a reason</option>
                <option value="Change of plans">Change of plans</option>
                <option value="Travel dates changed">Travel dates changed</option>
                <option value="Booked another option">Booked another option</option>
                <option value="Duplicate booking">Duplicate booking</option>
                <option value="Personal reason">Personal reason</option>
                <option value="Other">Other</option>
              </select>
            </label>

            <div *ngIf="cancelBookingError" class="alert-danger">{{ cancelBookingError }}</div>

            <div class="cancel-warning">
              <span class="material-symbols-outlined">warning</span>
              <span>
                This will mark the booking as CANCELLED. In sandbox mode, refundable paid bookings are refunded automatically.
              </span>
            </div>

            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" (click)="closeCancelBookingModal()">
                Keep Booking
              </button>
              <button
                type="button"
                class="btn btn-danger"
                [disabled]="isCancellingBooking"
                (click)="confirmCancelBooking()"
              >
                {{ isCancellingBooking ? 'Cancelling...' : 'Confirm Cancellation' }}
              </button>
            </div>
          </div>
        </div>

        <div *ngIf="showEditTripModal" class="modal-backdrop">
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
                <button
                  *ngIf="canDeleteTrip"
                  type="button"
                  class="btn btn-danger-outline"
                  style="margin-right: auto;"
                  (click)="closeEditTripModal(); deleteCurrentTrip()"
                >
                  <span class="material-symbols-outlined">delete</span>
                  Delete Trip
                </button>
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

        <div *ngIf="showBookingImportModal" class="modal-backdrop">
          <div class="modal-content card booking-import-modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div>
                <h3>Import Booking with OCR</h3>
                <p>Upload a PDF, PNG or JPG. You can review every detected field before saving.</p>
              </div>
              <button type="button" (click)="closeBookingImport()" class="close-btn" aria-label="Close">&times;</button>
            </div>
            <div class="ocr-privacy-note">
              <span class="material-symbols-outlined">verified_user</span>
              The file is sent to OCR.Space for text recognition. Suttru does not create a booking until you confirm it.
            </div>
            <div *ngIf="bookingImportError" class="alert-danger">{{ bookingImportError }}</div>
            <label class="ocr-file-picker">
              <input type="file" accept="application/pdf,image/png,image/jpeg" (change)="onBookingImportFile($event)" />
              <span class="material-symbols-outlined">upload_file</span>
              <strong>{{ bookingImportFile?.name || 'Choose booking PDF or image' }}</strong>
              <small>PDF, PNG or JPG · maximum 10 MB</small>
            </label>
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" (click)="closeBookingImport()">Cancel</button>
              <button type="button" class="btn btn-primary" [disabled]="!bookingImportFile || isImportingBooking" (click)="importBookingFile()">
                <span class="material-symbols-outlined">document_scanner</span>
                {{ isImportingBooking ? 'Reading booking...' : 'Extract Booking' }}
              </button>
            </div>
          </div>
        </div>

        <div *ngIf="showBookingModal" class="modal-backdrop">
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

            <section *ngIf="bookingImportDraft as draft" class="card" style="padding:1rem;margin-bottom:1rem">
              <h4>Review extracted booking</h4>
              <p>Check provider, reference, dates, passengers and amount before saving. Missing amounts need your confirmation.</p>
              <p *ngIf="draft.currency && draft.currency !== 'INR'" role="alert">Source currency: {{ draft.currency }}. This form saves INR; enter the correct INR amount before saving.</p>
              <ul><li *ngFor="let warning of draft.warnings">{{ warning }}</li></ul>
              <details><summary>Compare with extracted text</summary><pre style="white-space:pre-wrap;max-height:220px;overflow:auto">{{ draft.extractedText }}</pre></details>
              <p *ngIf="importDuplicate" role="alert">Possible duplicate: {{ importDuplicate.providerName }} · {{ importDuplicate.bookingReference }}. Review the booking already in this trip before saving.</p>
            </section>
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
                <div class="form-group">
                  <label class="form-label">Start Date/Time</label>
                  <input type="datetime-local" class="form-control" formControlName="startDatetime" />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Arrival / Check-out Date and Time</label>
                <input type="datetime-local" class="form-control" formControlName="endDatetime" />
              </div>
              <div class="form-group">
                <label class="form-label">Passenger Details</label>
                <textarea
                  class="form-control"
                  rows="2"
                  formControlName="passengerDetails"
                  placeholder="Passenger names, seat numbers and traveller details"
                ></textarea>
              </div>

              <div class="form-row" *ngIf="bookingForm.get('bookingType')?.value === 'TRANSPORT'">
                <div class="form-group half">
                  <label class="form-label">Pickup Point</label>
                  <input type="text" class="form-control" formControlName="pickupPoint" placeholder="Boarding or pickup location" />
                </div>
                <div class="form-group half">
                  <label class="form-label">Drop Point</label>
                  <input type="text" class="form-control" formControlName="dropPoint" placeholder="Drop-off location" />
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
  styleUrls: ['./trip-overview.scss', './trip-bookings.scss', './trip-members.scss'],
  styles: [`
@use '../../../shared/styles/mobile-panels' as mobile;

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

    .btn-danger-outline {
      border: 1px solid #fecaca;
      color: #dc2626;
      background: #ffffff;
      transition: all 150ms ease;

      &:hover {
        background: #fee2e2;
        color: #991b1b;
        border-color: #fca5a5;
      }
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

    .payment-state,
    .cancellation-info {
      color: #475569;
      font-size: 0.78rem;
    }

    .booking-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 0.35rem;
      padding-top: 0.7rem;
      border-top: 1px solid #f1f5f9;
    }

    .cancel-booking-modal {
      width: min(100%, 560px);
    }

    .cancel-icon {
      display: grid;
      place-items: center;
      width: 52px;
      height: 52px;
      margin-bottom: 0.8rem;
      color: #b91c1c;
      background: #fee2e2;
      border-radius: 14px;
    }

    .cancel-icon .material-symbols-outlined {
      font-size: 1.8rem;
    }

    .cancel-header {
      align-items: flex-start;
    }

    .cancel-summary {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.65rem;
      margin-bottom: 1rem;
    }

    .cancel-summary > div {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      padding: 0.75rem;
      background: #f8fafc;
      border-radius: 10px;
    }

    .cancel-summary span {
      color: #64748b;
      font-size: 0.68rem;
      font-weight: 800;
      text-transform: uppercase;
    }

    .cancel-warning {
      display: flex;
      align-items: flex-start;
      gap: 0.45rem;
      margin-top: 0.75rem;
      padding: 0.75rem;
      color: #92400e;
      background: #fffbeb;
      border-radius: 9px;
      font-size: 0.78rem;
    }

    .cancel-warning .material-symbols-outlined {
      font-size: 1rem;
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

    .btn-danger {
      color: #ffffff;
      background: #dc2626;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
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

    .rebook-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 1.15rem;
      margin-bottom: 1rem;
      border-color: #bfdbfe;
      background: #eff6ff;
    }

    .rebook-copy {
      display: flex;
      align-items: flex-start;
      gap: 0.7rem;
    }

    .rebook-copy > .material-symbols-outlined {
      color: #2563eb;
    }

    .rebook-copy strong {
      color: #0f172a;
    }

    .rebook-copy p {
      margin: 0.2rem 0 0;
      color: #475569;
      font-size: 0.82rem;
    }

    .members-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1.2rem;
      margin-bottom: 1rem;
    }

    .members-toolbar h2 {
      margin: 0.15rem 0 0.25rem;
    }

    .members-toolbar p {
      margin: 0;
      color: #64748b;
      font-size: 0.84rem;
    }

    .members-grid {
      display: grid;
      gap: 0.8rem;
    }

    .member-card {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) minmax(120px, auto) auto;
      align-items: center;
      gap: 0.9rem;
      padding: 1rem 1.1rem;
    }

    .member-avatar {
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      color: #1d4ed8;
      background: #dbeafe;
      font-weight: 850;
    }

    .member-info {
      display: flex;
      min-width: 0;
      flex-direction: column;
      gap: 0.16rem;
    }

    .member-info > span {
      overflow: hidden;
      color: #64748b;
      font-size: 0.78rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .member-name-row {
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }

    .owner-pill,
    .role-pill {
      display: inline-flex;
      padding: 0.24rem 0.5rem;
      border-radius: 999px;
      font-size: 0.65rem;
      font-weight: 850;
    }

    .owner-pill {
      color: #7c3aed;
      background: #ede9fe;
    }

    .role-pill {
      color: #1d4ed8;
      background: #dbeafe;
    }

    .compact-select {
      min-width: 125px;
      padding: 0.5rem 0.6rem;
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

    .trip-header {
      padding: 1.4rem 1.6rem;
      margin-bottom: 0;
      border-radius: 16px 16px 0 0;
      border-bottom: 0;
      box-shadow: none;
    }

    .trip-header-main {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1.25rem;
    }

    .title-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.65rem;
    }

    .title-row h1 {
      margin: 0;
      color: #0f172a;
      font-size: 1.55rem;
      letter-spacing: -0.025em;
    }

    .status-chip {
      display: inline-flex;
      padding: 0.22rem 0.48rem;
      border-radius: 999px;
      color: #047857;
      background: #d1fae5;
      font-size: 0.62rem;
      font-weight: 850;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .status-chip[data-status='PLANNED'] {
      color: #b45309;
      background: #fef3c7;
    }

    .status-chip[data-status='ONGOING'] {
      color: #1d4ed8;
      background: #dbeafe;
    }

    .status-chip[data-status='COMPLETED'],
    .status-chip[data-status='CANCELLED'] {
      color: #475569;
      background: #e2e8f0;
    }

    .trip-meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.9rem;
      margin-top: 0.5rem;
      color: #64748b;
      font-size: 0.78rem;
    }

    .trip-meta-row > span {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
    }

    .trip-meta-row .material-symbols-outlined {
      color: #2563eb;
      font-size: 1rem;
    }

    .trip-header-description {
      max-width: 760px;
      margin: 0.7rem 0 0;
      color: #64748b;
      font-size: 0.82rem;
    }

    .trip-header-actions {
      display: flex;
      gap: 0.6rem;
      flex-shrink: 0;
    }

    .btn-outline {
      color: #0f172a;
      background: #fff;
      border: 1px solid #cbd5e1;
    }

    .dashboard-tabs {
      margin-top: 0;
      border-radius: 0 0 16px 16px;
      border-top: 1px solid #eef2f7;
      box-shadow: none;
    }

    .dashboard-tabs .tab-btn {
      position: relative;
      padding: 0.85rem 1rem;
      border-radius: 0;
      color: #64748b;
      background: transparent;
    }

    .dashboard-tabs .tab-btn.active {
      color: #2563eb;
      background: transparent;
    }

    .dashboard-tabs .tab-btn.active::after {
      content: '';
      position: absolute;
      right: 0.9rem;
      bottom: 0;
      left: 0.9rem;
      height: 2px;
      background: #2563eb;
      border-radius: 999px;
    }

    .booking-import-modal { max-width: 560px; }
    .ocr-privacy-note { display:flex; gap:.55rem; padding:.75rem; margin-bottom:1rem; border-radius:10px; color:#1e40af; background:#eff6ff; font-size:.74rem; line-height:1.45; }
    .ocr-privacy-note .material-symbols-outlined { font-size:1.05rem; }
    .ocr-file-picker { display:flex; flex-direction:column; align-items:center; gap:.35rem; padding:1.5rem; border:2px dashed #bfdbfe; border-radius:12px; background:#f8fbff; text-align:center; cursor:pointer; }
    .ocr-file-picker input { position:absolute; width:1px; height:1px; opacity:0; }
    .ocr-file-picker > .material-symbols-outlined { color:#2563eb; font-size:2rem; }
    .ocr-file-picker strong { color:#1e293b; font-size:.82rem; }
    .ocr-file-picker small { color:#64748b; font-size:.68rem; }


    .feature-panel {
      min-height: 360px;
      padding: 1.2rem;
    }

    .feature-panel-heading h2 {
      margin: 0.15rem 0 1rem;
      font-size: 1.05rem;
    }

    .expenses-summary {
      grid-template-columns: repeat(3, minmax(0, 1fr));
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

      .trip-header-main {
        align-items: stretch;
        flex-direction: column;
      }

      .trip-header-actions,
      .trip-header-actions .btn {
        width: 100%;
      }

      .dashboard-tabs {
        overflow-x: auto;
        justify-content: flex-start;
      }

      .dashboard-tabs .tab-btn {
        flex: 0 0 auto;
      }

      .expenses-summary {
        grid-template-columns: 1fr 1fr;
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

      .cancel-summary {
        grid-template-columns: 1fr;
      }

      .rebook-banner {
        align-items: stretch;
        flex-direction: column;
      }

      .rebook-banner .empty-booking-actions,
      .rebook-banner .empty-booking-actions .btn {
        width: 100%;
      }

      .members-toolbar {
        align-items: stretch;
        flex-direction: column;
      }

      .member-card {
        grid-template-columns: auto minmax(0, 1fr);
      }

      .member-role,
      .member-card > .btn {
        grid-column: 2;
      }
    }

@include mobile.panels;
    .mobile-trip-controls,.mobile-trips-back,.mobile-trip-more { display:none; }
    @media(max-width:760px) {
      .trip-details-container { padding:8px 20px 24px; }
      .mobile-trip-controls { display:flex; align-items:center; justify-content:space-between; gap:8px; padding-bottom:8px; }
      .trip-header-main { gap:8px; }
      .trip-meta-row > span:nth-child(n+3),.trip-header-description { display:none; }
      .trip-header.mobile-expanded .trip-meta-row > span:nth-child(n+3) { display:inline-flex; }
      .trip-header.mobile-expanded .trip-header-description { display:block; }
      .mobile-trips-back { display:inline-flex; align-items:center; min-height:44px; color:#2563eb; text-decoration:none; font-size:13px; font-weight:650; }
      .trip-header { padding:14px; border-radius:16px; box-shadow:0 4px 16px #2563eb08; border:0; background:white; }
      .title-row h1 { font-size:20px; line-height:1.3; letter-spacing:-.03em; }
      .trip-meta-row { gap:8px; font-size:11px; }
      .trip-header-description { font-size:12px; }
      .mobile-trip-more { display:inline-flex; align-items:center; min-height:44px; align-self:flex-start; border:1px solid #e2e8f0; background:#fff; color:#64748b; border-radius:10px; padding:8px 12px; cursor:pointer; font:inherit; font-size:12px; }
      .trip-header-actions { display:none; }
      .trip-header-actions.mobile-expanded { display:flex; }
      .dashboard-tabs { padding:4px; gap:4px; box-shadow:none; border-radius:12px; }
      .dashboard-tabs .tab-btn { padding:12px; font-size:12px; border-radius:9px; }
      .summary-card,.compact-summary-card,.budget-card,.overview-panel,.sidebar-card { background:white; border:0; box-shadow:0 4px 16px #2563eb08; border-radius:16px; }
      .compact-summary-grid { gap:10px; }
      .compact-summary-card { padding:12px; }
      .compact-summary-card strong { font-size:18px; }
      .compact-summary-card span { font-size:10px; }
    }


@media(max-width:760px) {
 .bookings-grid { grid-template-columns:minmax(0,1fr); }
 .trip-header-actions { flex-wrap:wrap; }
 .booking-header { flex-wrap:wrap; }
 .booking-amount { width:100%; }
 .member-name-row { flex-wrap:wrap; }
 .member-role, .compact-select { min-width:0; max-width:100%; }
 .member-role select { width:100%; }
 .route, .times { flex-wrap:wrap; }
 .dashboard-tabs, .details-tabs { max-width:100%; min-width:0; }
 .compact-summary-grid, .expenses-summary { grid-template-columns:repeat(2,minmax(0,1fr)); }
 .weather-grid, .weather-forecast { min-width:0; }
}
`]
})
export class TripDetailsComponent implements OnInit {

  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tripService = inject(TripService);
  private readonly bookingService = inject(BookingService);
  private readonly tripMemberService = inject(TripMemberService);
  private readonly fb = inject(FormBuilder);

  tripId = 0;
  trip: Trip | null = null;
  dashboard: TripDashboard | null = null;
  weather: TripWeather | null = null;
  bookings: Booking[] = [];
  members: TripMember[] = [];

  activeTab: TripDetailsTab = 'OVERVIEW';
  mobileActionsOpen = false;
  expenseOpenRequest = 0;
  documentOpenRequest = 0;

  isLoadingTrip = true;
  tripLoadError = '';
  isLoadingDashboard = true;
  dashboardError = '';
  isLoadingWeather = true;
  weatherError = '';
  isExportingCalendar = false;
  isDuplicatingTrip = false;
  isLoadingBookings = true;
  bookingsError = '';
  isLoadingMembers = false;
  membersError = '';

  showBookingModal = false;
  isSubmittingBooking = false;
  bookingModalError = '';
  showBookingImportModal = false;
  bookingImportFile: File | null = null;
  bookingImportError = '';
  isImportingBooking = false;
  bookingImportDraft: BookingImportDraft | null = null;

  showEditTripModal = false;
  isUpdatingTrip = false;
  editTripError = '';
  tripUpdateMessage = '';

  readonly tripTypes: TripType[] = ['ADVENTURE', 'FAMILY', 'COUPLE', 'FRIENDS', 'SOLO'];

  showAddMemberModal = false;
  isAddingMember = false;
  memberModalError = '';
  updatingMemberId: number | null = null;
  removingMemberId: number | null = null;

  showCancelBookingModal = false;
  bookingToCancel: Booking | null = null;
  cancelReason = '';
  cancelBookingError = '';
  confirmDeleteBookingId: number | null = null;
  deletingBookingId: number | null = null;
  deleteBookingError = '';

  deleteBooking(booking: Booking): void {
    if (this.deletingBookingId) return;
    this.deletingBookingId = booking.id;
    this.deleteBookingError = '';
    this.bookingService.deleteBooking(this.tripId, booking.id).subscribe({
      next: () => {
        this.bookings = this.bookings.filter(b => b.id !== booking.id);
        this.deletingBookingId = null;
        this.confirmDeleteBookingId = null;
        this.loadDashboard();
      },
      error: (err) => {
        this.deletingBookingId = null;
        this.deleteBookingError = err?.error?.message || 'Could not delete this booking. Please try again.';
      }
    });
  }
  isCancellingBooking = false;

  addMemberForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    role: ['VIEWER' as TripRole, Validators.required]
  });

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
    passengerDetails: [''],
    pickupPoint: [''],
    dropPoint: [''],
    startDatetime: [''],
    endDatetime: [''],
    amount: [0, [Validators.required, Validators.min(0)]],
    notes: ['']
  });

  get canPlanTrip(): boolean {
    return this.canEditTrip || this.trip?.userRole === 'PLANNER';
  }

  get canManageExpenses(): boolean {
    return this.canEditTrip || this.trip?.userRole === 'EXPENSE_MANAGER';
  }

  get canEditTrip(): boolean {
    return this.trip?.userRole === 'OWNER' || this.trip?.userRole === 'EDITOR';
  }

  get canManageMembers(): boolean {
    return !this.trip?.userRole || this.trip?.userRole === 'OWNER';
  }

  get canDeleteTrip(): boolean {
    return !this.trip?.userRole || this.trip?.userRole === 'OWNER';
  }

  deleteCurrentTrip(): void {
    if (!this.trip || !this.canDeleteTrip) return;

    if (!confirm(`Are you sure you want to delete "${this.trip.name}"? This action cannot be undone and will permanently delete all itinerary items, places, expenses, and bookings.`)) {
      return;
    }

    this.tripService.deleteTrip(this.tripId).subscribe({
      next: () => {
        void this.router.navigate(['/trips']);
      },
      error: (err) => {
        this.tripUpdateMessage = '';
        this.editTripError = err?.error?.message || 'Failed to delete trip. Only the trip owner can delete this trip.';
      }
    });
  }

  get hasActiveBookings(): boolean {
    return this.bookings.some(
      (booking) => booking.status === 'PENDING' || booking.status === 'CONFIRMED'
    );
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

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const requestedTab = params.get('tab');
      const legacyTabs: Record<string, TripDetailsTab> = { PLACES: 'EXPLORE', TIMELINE: 'OVERVIEW' };
      const redirectTab = requestedTab ? legacyTabs[requestedTab] : undefined;
      const tab = redirectTab ?? requestedTab;
      if(tab && ['OVERVIEW','EXPLORE','ITINERARY','EXPENSES','BOOKINGS','DOCUMENTS','MEMBERS'].includes(tab)) this.activeTab = tab as TripDetailsTab;
      if(redirectTab) void this.router.navigate([], {relativeTo:this.route, queryParams:{tab:redirectTab}, queryParamsHandling:'merge', replaceUrl:true});
    });
    this.loadTripDetails();
    this.loadDashboard();
    this.loadWeather();
    this.loadBookings();
    this.loadMembers();
  }

  retryTrip(): void {
    this.loadTripDetails();
    this.loadDashboard();
    this.loadWeather();
    this.loadBookings();
  }

  loadTripDetails(): void {
    this.isLoadingTrip = true;
    this.tripLoadError = '';

    this.tripService.getTripById(this.tripId).subscribe({
      next: (data) => {
        this.trip = data;
        this.isLoadingTrip = false;
        if (this.route.snapshot.queryParamMap.get('reschedule') === '1' && this.canEditTrip) {
          this.openEditTripModal();
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { reschedule: null },
            queryParamsHandling: 'merge',
            replaceUrl: true
          });
        }
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

  loadWeather(): void {
    this.isLoadingWeather = true;
    this.weatherError = '';
    this.tripService.getTripWeather(this.tripId).subscribe({
      next: (data) => {
        this.weather = data;
        this.isLoadingWeather = false;
      },
      error: (err) => {
        this.weather = null;
        this.weatherError = err?.error?.message || 'Weather is temporarily unavailable.';
        this.isLoadingWeather = false;
      }
    });
  }

  exportCalendar(): void {
    if (!this.trip || this.isExportingCalendar) return;
    this.isExportingCalendar = true;
    this.tripService.exportCalendar(this.tripId).subscribe({
      next: async (content) => {
        try {
          if (await shareNativeFile(content, `${this.trip?.name || 'suttru-trip'}.ics`)) {
            this.isExportingCalendar = false;
            return;
          }
        } catch {
          this.tripUpdateMessage = 'Unable to export the calendar on this device. Please try again.';
          this.isExportingCalendar = false;
          return;
        }
        const url = URL.createObjectURL(content);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${this.trip?.name || 'suttru-trip'}.ics`;
        anchor.click();
        URL.revokeObjectURL(url);
        this.isExportingCalendar = false;
      },
      error: () => {
        this.tripUpdateMessage = 'Unable to export the calendar. Please try again.';
        this.isExportingCalendar = false;
      }
    });
  }

  duplicateCurrentTrip(): void {
    if (!this.trip || this.isDuplicatingTrip) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startDate = tomorrow.toISOString().slice(0, 10);
    this.isDuplicatingTrip = true;
    this.tripService.duplicateTrip(this.tripId, `${this.trip.name} (Copy)`, startDate).subscribe({
      next: (copy) => {
        this.isDuplicatingTrip = false;
        void this.router.navigate(['/trips', copy.id], { queryParams: { reschedule: 1 } });
      },
      error: (err) => {
        this.tripUpdateMessage = err?.error?.message || 'Unable to duplicate this trip.';
        this.isDuplicatingTrip = false;
      }
    });
  }

  formatWeatherDate(date: string): string {
    return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric' })
      .format(new Date(`${date}T00:00:00`));
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

  setActiveTab(tab: TripDetailsTab): void {
    this.activeTab = tab;
    void this.router.navigate([], { relativeTo:this.route, queryParams:{tab}, queryParamsHandling:'merge', replaceUrl:true });

    if (tab === 'OVERVIEW') {
      this.loadTripDetails();
      this.loadDashboard();
      this.loadBookings();
      this.loadMembers();
    } else if (tab === 'BOOKINGS') {
      this.loadBookings();
    } else if (tab === 'MEMBERS') {
      this.loadMembers();
      this.loadDashboard();
    } else if (
      tab === 'EXPLORE' ||
      tab === 'ITINERARY' ||
      tab === 'EXPENSES' ||
      tab === 'DOCUMENTS'
    ) {
      this.loadDashboard();
    }
  }

  loadMembers(): void {
    if (!Number.isFinite(this.tripId) || this.tripId <= 0) return;

    this.isLoadingMembers = true;
    this.membersError = '';

    this.tripMemberService.getMembers(this.tripId).subscribe({
      next: (members) => {
        this.members = members ?? [];
        this.isLoadingMembers = false;
      },
      error: (err) => {
        this.members = [];
        this.membersError = err?.error?.message || 'Please try again.';
        this.isLoadingMembers = false;
      }
    });
  }

  openAddMemberModal(): void {
    if (!this.canManageMembers) return;

    this.memberModalError = '';
    this.addMemberForm.reset({
      email: '',
      role: 'VIEWER'
    });
    this.showAddMemberModal = true;
  }

  closeAddMemberModal(): void {
    if (this.isAddingMember) return;
    this.showAddMemberModal = false;
    this.memberModalError = '';
  }

  submitAddMember(): void {
    if (!this.canManageMembers || this.addMemberForm.invalid) return;

    const value = this.addMemberForm.getRawValue();
    this.isAddingMember = true;
    this.memberModalError = '';

    this.tripMemberService.addMember(
      this.tripId,
      value.email!.trim(),
      value.role as TripRole
    ).subscribe({
      next: (member) => {
        this.isAddingMember = false;
        this.showAddMemberModal = false;
        this.members = [
          ...this.members.filter((existing) => existing.id !== member.id),
          member
        ].sort((a, b) => {
          if (a.role === 'OWNER') return -1;
          if (b.role === 'OWNER') return 1;
          return a.userName.localeCompare(b.userName);
        });
        this.tripUpdateMessage = `${member.userName} added to the trip.`;
        this.loadDashboard();
      },
      error: (err) => {
        this.isAddingMember = false;
        this.memberModalError = err?.error?.message || 'Unable to add member.';
      }
    });
  }

  changeMemberRole(member: TripMember, role: string): void {
    if (!this.canManageMembers || member.role === 'OWNER') return;

    const nextRole = role as TripRole;
    if (!['EDITOR', 'VIEWER', 'PLANNER', 'EXPENSE_MANAGER'].includes(nextRole)) return;
    if (member.role === nextRole) return;

    this.updatingMemberId = member.id;
    this.membersError = '';

    this.tripMemberService.updateMemberRole(this.tripId, member.id, nextRole).subscribe({
      next: (updated) => {
        this.updatingMemberId = null;
        this.members = this.members.map((item) =>
          item.id === updated.id ? updated : item
        );
        this.tripUpdateMessage = `${updated.userName} is now ${updated.role.toLowerCase()}.`;
        this.loadDashboard();
      },
      error: (err) => {
        this.updatingMemberId = null;
        this.membersError = err?.error?.message || 'Unable to update member role.';
        this.loadMembers();
      }
    });
  }

  removeMember(member: TripMember): void {
    if (!this.canManageMembers || member.role === 'OWNER') return;

    const confirmed = window.confirm(
      `Remove ${member.userName} from this trip?`
    );
    if (!confirmed) return;

    this.removingMemberId = member.id;
    this.membersError = '';

    this.tripMemberService.removeMember(this.tripId, member.id).subscribe({
      next: () => {
        this.removingMemberId = null;
        this.members = this.members.filter((item) => item.id !== member.id);
        this.tripUpdateMessage = `${member.userName} removed from the trip.`;
        this.loadDashboard();
      },
      error: (err) => {
        this.removingMemberId = null;
        this.membersError = err?.error?.message || 'Unable to remove member.';
      }
    });
  }

  get tripDurationDays(): number {
    if (!this.trip) return 0;
    const start = new Date(`${this.trip.startDate}T00:00:00`);
    const end = new Date(`${this.trip.endDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
  }

  private daysFromToday(value?: string): number | null {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((date.getTime() - today.getTime()) / 86400000);
  }

  get tripPhase(): 'upcoming' | 'ongoing' | 'completed' | 'cancelled' {
    if (this.trip?.status === 'CANCELLED') return 'cancelled';
    const toStart = this.daysFromToday(this.trip?.startDate);
    const toEnd = this.daysFromToday(this.trip?.endDate);
    if (toStart === null || toEnd === null) return 'upcoming';
    if (toStart > 0) return 'upcoming';
    if (toEnd < 0) return 'completed';
    return 'ongoing';
  }

  get tripPhaseLabel(): string {
    switch (this.tripPhase) {
      case 'ongoing': return 'Trip in progress';
      case 'completed': return 'Trip completed';
      case 'cancelled': return 'Trip cancelled';
      default: return 'Upcoming journey';
    }
  }

  get tripPhaseIcon(): string {
    switch (this.tripPhase) {
      case 'ongoing': return 'explore';
      case 'completed': return 'verified';
      case 'cancelled': return 'event_busy';
      default: return 'flight_takeoff';
    }
  }

  get currentTripDay(): number {
    const toStart = this.daysFromToday(this.trip?.startDate) ?? 0;
    return Math.min(Math.max(1 - toStart, 1), this.tripDurationDays || 1);
  }

  get countdownValue(): string {
    switch (this.tripPhase) {
      case 'ongoing': return `Day ${this.currentTripDay}`;
      case 'completed': return String(this.tripDurationDays);
      case 'cancelled': return '—';
      default: return String(Math.max(this.daysFromToday(this.trip?.startDate) ?? 0, 0));
    }
  }

  get countdownCaption(): string {
    switch (this.tripPhase) {
      case 'ongoing': return `of ${this.tripDurationDays} day${this.tripDurationDays === 1 ? '' : 's'}`;
      case 'completed': return `day${this.tripDurationDays === 1 ? '' : 's'} travelled`;
      case 'cancelled': return 'not travelling';
      default: return this.daysFromToday(this.trip?.startDate) === 1 ? 'day to go' : 'days to go';
    }
  }

  get tripProgressPercent(): number {
    switch (this.tripPhase) {
      case 'completed': return 100;
      case 'ongoing': return Math.round((this.currentTripDay / (this.tripDurationDays || 1)) * 100);
      default: return 0;
    }
  }

  get budgetUsedPercent(): number {
    const budget = this.dashboard?.budget ?? 0;
    if (budget <= 0) return 0;
    return Math.round(((this.dashboard?.totalExpenses ?? 0) / budget) * 100);
  }

  get budgetMeterWidth(): number {
    return this.budgetProgressWidth(this.budgetUsedPercent);
  }

  get budgetTone(): 'healthy' | 'watch' | 'over' | 'none' {
    if ((this.dashboard?.budget ?? 0) <= 0) return 'none';
    const used = this.budgetUsedPercent;
    if (used > 100) return 'over';
    if (used >= 80) return 'watch';
    return 'healthy';
  }

  get budgetUsedLabel(): string {
    if (this.budgetTone === 'none') return 'No budget set';
    if (this.budgetTone === 'over') return `${this.budgetUsedPercent - 100}% over budget`;
    return `${this.budgetUsedPercent}% used`;
  }

  get perTravelerBudget(): number {
    const travelers = this.dashboard?.travelerCount || this.trip?.travelerCount || 1;
    return Math.round((this.dashboard?.budget ?? 0) / Math.max(travelers, 1));
  }

  formatMemberRole(role: TripRole): string {
    if (role === 'EDITOR') return 'Contributor';
    if (role === 'PLANNER') return 'Planner';
    if (role === 'EXPENSE_MANAGER') return 'Expense manager';
    if (role === 'VIEWER') return 'Viewer';
    return 'Organizer';
  }

  openShareTrip(): void {
    if (this.canManageMembers) {
      void this.router.navigate(['/trips', this.tripId, 'share']);
      return;
    }

    this.setActiveTab('MEMBERS');
  }

  onExploreItineraryAdded():void {this.setActiveTab('ITINERARY');this.onItineraryChanged();}

  onItineraryChanged(): void {
    this.loadDashboard();
    this.tripUpdateMessage = 'Itinerary updated successfully.';
  }

  onPlacesChanged(): void {
    this.tripUpdateMessage = 'Saved places updated successfully.';
  }

  onDiscoveredPlacesChanged(): void {
    this.tripUpdateMessage = 'Tourist places added to this trip.';
    this.loadDashboard();
  }

  onDiscoveryItineraryChanged(): void {
    this.tripUpdateMessage = 'Tourist places added to the trip itinerary.';
    this.loadDashboard();
  }

  onExpensesChanged(): void {
    this.loadDashboard();
    this.tripUpdateMessage = 'Expenses updated successfully.';
  }

  onDocumentsChanged(): void {
    this.loadDashboard();
    this.tripUpdateMessage = 'Documents updated successfully.';
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

  canCancelBooking(booking: Booking): boolean {
    if (booking.status === 'CANCELLED' || booking.status === 'COMPLETED') {
      return false;
    }

    if (!booking.startDatetime) {
      return true;
    }

    const start = new Date(booking.startDatetime);
    return Number.isNaN(start.getTime()) || start.getTime() > Date.now();
  }

  openCancelBookingModal(booking: Booking): void {
    if (!this.canEditTrip || !this.canCancelBooking(booking)) return;

    this.bookingToCancel = booking;
    this.cancelReason = '';
    this.cancelBookingError = '';
    this.showCancelBookingModal = true;
  }

  closeCancelBookingModal(): void {
    if (this.isCancellingBooking) return;

    this.showCancelBookingModal = false;
    this.bookingToCancel = null;
    this.cancelReason = '';
    this.cancelBookingError = '';
  }

  confirmCancelBooking(): void {
    if (!this.bookingToCancel) return;

    this.isCancellingBooking = true;
    this.cancelBookingError = '';

    this.bookingService.cancelBooking(
      this.tripId,
      this.bookingToCancel.id,
      this.cancelReason || undefined
    ).subscribe({
      next: (response) => {
        this.isCancellingBooking = false;
        this.bookings = this.bookings.map((booking) =>
          booking.id === response.booking.id ? response.booking : booking
        );
        this.showCancelBookingModal = false;
        this.bookingToCancel = null;
        this.cancelReason = '';
        this.tripUpdateMessage = response.message;
        this.loadDashboard();
      },
      error: (err) => {
        this.isCancellingBooking = false;
        this.cancelBookingError = err?.error?.message || 'Unable to cancel the booking.';
      }
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
        this.loadTripDetails();
        this.loadDashboard();
        this.loadBookings();
        this.loadMembers();
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


  openBookingModal(): void {
    this.showBookingModal = true;
    this.bookingModalError = '';
  }

  openBookingImport(): void {
    this.bookingImportFile = null;
    this.bookingImportError = '';
    this.bookingImportDraft = null;
    this.showBookingImportModal = true;
  }

  closeBookingImport(): void {
    if (this.isImportingBooking) return;
    this.showBookingImportModal = false;
    this.bookingImportFile = null;
    this.bookingImportError = '';
  }

  onBookingImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    this.bookingImportError = '';
    if (file && file.size > 10 * 1024 * 1024) {
      this.bookingImportFile = null;
      this.bookingImportError = 'File must be 10 MB or smaller.';
      input.value = '';
      return;
    }
    this.bookingImportFile = file;
  }

  importBookingFile(): void {
    if (!this.bookingImportFile || this.isImportingBooking) return;
    this.isImportingBooking = true;
    this.bookingImportError = '';
    this.bookingService.importBookingFile(this.tripId, this.bookingImportFile).subscribe({
      next: (draft) => {
        this.bookingImportDraft = draft;
        this.isImportingBooking = false;
        this.showBookingImportModal = false;
        this.bookingForm.reset({
          bookingType: draft.bookingType,
          transportType: draft.transportType || 'OTHER',
          providerName: draft.providerName || '',
          bookingReference: draft.bookingReference || '',
          departure: draft.departure || '',
          arrival: draft.arrival || '',
          passengerDetails: draft.passengerDetails || '',
          pickupPoint: draft.pickupPoint || '',
          dropPoint: draft.dropPoint || '',
          startDatetime: this.toDatetimeLocal(draft.startDatetime),
          endDatetime: this.toDatetimeLocal(draft.endDatetime),
          amount: draft.amount ?? null,
          notes: draft.warnings.length
            ? `OCR review: ${draft.warnings.join(' ')}`
            : `Imported with ${Math.round(draft.confidence * 100)}% OCR confidence.`
        });
        this.bookingModalError = draft.warnings.length
          ? `OCR completed. Please review: ${draft.warnings.join(' ')}` : '';
        this.showBookingModal = true;
      },
      error: (err) => {
        this.isImportingBooking = false;
        this.bookingImportError = err?.error?.message || err?.error?.detail || 'Unable to read this booking file.';
      }
    });
  }

  private toDatetimeLocal(value?: string): string {
    return value ? value.slice(0, 16) : '';
  }


  closeBookingModal(): void {
    if (this.isSubmittingBooking) return;
    this.showBookingModal = false;
    this.bookingImportDraft = null;
    this.bookingForm.reset({
      bookingType: 'TRANSPORT',
      transportType: 'FLIGHT',
      amount: 0
    });
  }

  get importDuplicate(): Booking | undefined {
    if (!this.bookingImportDraft) return undefined;
    const value = this.bookingForm.value;
    const normalize = (text?: string | null) => (text || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!normalize(value.bookingReference)) return undefined;
    return this.bookings.find(item => item.status !== 'CANCELLED'
      && item.bookingType === value.bookingType
      && normalize(item.bookingReference) === normalize(value.bookingReference)
      && normalize(item.providerName) === normalize(value.providerName));
  }

  onBookingSubmit(): void {
    if (this.bookingForm.invalid || this.isSubmittingBooking) return;

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
      passengerDetails: value.passengerDetails || undefined,
      pickupPoint:
        value.bookingType === 'TRANSPORT' ? value.pickupPoint || undefined : undefined,
      dropPoint:
        value.bookingType === 'TRANSPORT' ? value.dropPoint || undefined : undefined,
      startDatetime: value.startDatetime || undefined,
      endDatetime: value.endDatetime || undefined,
      amount: value.amount!,
      status: 'CONFIRMED',
      notes: value.notes || undefined
    };

    const save = this.bookingImportDraft
        ? this.bookingService.confirmImport(this.tripId, request)
        : this.bookingService.createBooking(this.tripId, request);
    save.subscribe({
      next: (newBooking) => {
        this.isSubmittingBooking = false;
        this.bookings = [newBooking, ...this.bookings.filter(b => b.id !== newBooking.id)];
        this.closeBookingModal();
        this.loadDashboard();
      },
      error: (err) => {
        this.isSubmittingBooking = false;
        this.bookingModalError = err?.error?.detail || err?.error?.message || 'Could not save. Your reviewed details are preserved; retry when the connection returns.';
      }
    });
  }
}
