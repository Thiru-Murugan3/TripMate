import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TripService } from '../../core/services/trip.service';
import { AuthService } from '../../core/services/auth.service';
import { Trip, TripType, TripDashboard, CreateTripRequest } from '../../core/models/trip.model';
import { findMissedTrip } from '../../core/utils/missed-trip.util';
import { formatDateRange } from '../../core/utils/date-range';
import { MissedTripDialogComponent } from '../../shared/components/missed-trip-dialog/missed-trip-dialog.component';

interface DisplayTrip {
  id?: number;
  name: string;
  destination: string;
  tag: string;
  status: string;
  statusClass: string;
  dates: string;
  startDate: string;
  endDate: string;
  countdown: string;
  countdownClass: string;
  spent: string;
  limit: string;
  progress: number;
  image: string;
}

interface PopularDestination {
  id: string;
  name: string;
  duration: string;
  tags: string[];
  image: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MissedTripDialogComponent],
  template: `
    <div class="home-page">
      <app-missed-trip-dialog
        *ngIf="missedTrip"
        [trip]="missedTrip"
        [busy]="cancellingMissedTrip"
        [errorMessage]="missedTripError"
        (cancelTrip)="cancelMissedTrip()"
        (reschedule)="rescheduleMissedTrip()"
        (dismiss)="dismissMissedTrip()"
      ></app-missed-trip-dialog>
      <section class="mobile-home" aria-label="Your travel home">
        <header class="mobile-welcome"><span>Welcome Traveller</span><h1>Let’s plan your next escape.</h1></header>
        <section class="mobile-hero" [style.background-image]="'linear-gradient(100deg,rgba(11,16,34,.88) 0%,rgba(20,26,51,.55) 55%,rgba(20,26,51,.15) 100%),url('+(upcomingTrips[0]?.image || popularDestinations[0].image)+')'">
          <span class="mobile-hero-eyebrow">Plan together</span><h2>Where are you going next?</h2><button type="button" (click)="openCreateModal()">Plan New Trip</button>
        </section>
        <article class="mobile-next-trip" *ngIf="upcomingTrips[0] as next; else noMobileTrip">
          <div class="mobile-card-heading"><h2>Your next trip</h2><span>{{next.tag}}</span></div>
          <button type="button" class="mobile-trip-link" (click)="openMobileTrip('OVERVIEW')"><img [src]="next.image" alt="" width="60" height="60" /><div><strong>{{next.name}}</strong><span>{{next.startDate | date:'d MMM'}} – {{next.endDate | date:'d MMM yyyy'}}</span><small>{{next.countdown}}</small></div><span aria-hidden="true">›</span></button>
          <div class="mobile-trip-budget" *ngIf="mobileBudget as budget"><div><span>Budget used</span><strong>{{budget.budgetUtilizationPercentage | number:'1.0-0'}}%</strong></div><progress [value]="budget.budgetUtilizationPercentage" max="100" aria-label="Trip budget used"></progress><div><small>Spent: {{budget.totalExpenses | currency:'INR':'symbol':'1.0-0'}}</small><small>Limit: {{budget.budget | currency:'INR':'symbol':'1.0-0'}}</small></div></div>
        </article>
        <ng-template #noMobileTrip><article class="mobile-next-trip"><h2>Your next journey starts here</h2><p>Create a trip, invite your group and plan each day together.</p></article></ng-template>
        <section class="mobile-quick"><h2>Quick actions</h2><div>
          <button (click)="openMobileTrip('EXPENSES')"><span class="qa-ico" style="--icon:url(assets/mobile/expense.svg)"></span>Expenses</button>
          <button (click)="openMobileTrip('BOOKINGS')"><span class="qa-ico" style="--icon:url(assets/mobile/booking.svg)"></span>Bookings</button>
          <button (click)="openMobileTrip('DOCUMENTS')"><span class="qa-ico" style="--icon:url(assets/mobile/document.svg)"></span>Documents</button>
        </div></section>
        <section class="mobile-destinations"><div class="mobile-card-heading"><h2>Find your next destination</h2></div><div class="mobile-destination-scroll"><button *ngFor="let destination of popularDestinations" (click)="planDestination(destination)"><img [src]="destination.image" [alt]="destination.name" loading="lazy" /><strong>{{destination.name}}</strong><span>{{destination.tags}}</span></button></div></section>
      </section>
      <!-- Hero Section -->
      <section class="hero-section">
        <div class="hero-bg" style="background-image: url('assets/images/hero.jpg');"></div>
        <div class="hero-overlay"></div>
        
        <div class="hero-content">
          <!-- User Request: Change 'Welcome back' to 'Welcome Traveller' and remove the name -->
          <div class="hero-pill">
            <span class="welcome-text">👋 Welcome Traveller</span>
            <span class="hero-pill-divider" aria-hidden="true"></span>
            <span class="eyebrow-pill">Explore · Plan · Travel</span>
          </div>

          <h1 class="hero-title">
            Your Journey, <span class="highlight-teal">Perfectly Planned.</span>
          </h1>

          <p class="hero-subtitle">
            Create your trip, build your itinerary, control your budget and keep everything you need in one place.
          </p>

          <div class="hero-actions">
            <button (click)="openCreateModal()" class="btn-hero btn-hero-primary">
              <span class="material-symbols-outlined" aria-hidden="true">add</span>
              Plan New Trip
            </button>
            <button (click)="scrollToUpcoming()" class="btn-hero btn-hero-outline">
              View My Trips
              <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
            </button>
          </div>

          <ul class="hero-trust" aria-label="What Suttru helps with">
            <li><span class="material-symbols-outlined" aria-hidden="true">route</span>Day-by-day itineraries</li>
            <li><span class="material-symbols-outlined" aria-hidden="true">payments</span>Shared budgets</li>
            <li><span class="material-symbols-outlined" aria-hidden="true">groups</span>Group planning</li>
          </ul>
        </div>
      </section>

      <!-- Main Content Area -->
      <main class="content-wrapper">
        <nav class="quick-actions" aria-label="Quick actions">
          <button type="button" class="quick-action" (click)="goTo('/trips')">
            <span class="qa-icon qa-violet"><span class="material-symbols-outlined">luggage</span></span>
            <span class="qa-text"><strong>My trips</strong><small>All your plans</small></span>
            <span class="material-symbols-outlined qa-arrow" aria-hidden="true">arrow_forward</span>
          </button>
          <button type="button" class="quick-action" (click)="goTo('/invitations')">
            <span class="qa-icon qa-amber"><span class="material-symbols-outlined">mail</span></span>
            <span class="qa-text"><strong>Invitations</strong><small>Trips you're invited to</small></span>
            <span class="material-symbols-outlined qa-arrow" aria-hidden="true">arrow_forward</span>
          </button>
          <button type="button" class="quick-action" (click)="goTo('/expenses')">
            <span class="qa-icon qa-teal"><span class="material-symbols-outlined">account_balance_wallet</span></span>
            <span class="qa-text"><strong>Expenses</strong><small>Track &amp; split costs</small></span>
            <span class="material-symbols-outlined qa-arrow" aria-hidden="true">arrow_forward</span>
          </button>
        </nav>

        <!-- Upcoming Trips Section -->
        <section class="section-block" id="upcoming-trips-section">
          <div class="section-header">
            <div>
              <span class="section-kicker">Your journeys</span>
              <h2 class="section-title">Upcoming Trips</h2>
              <p class="section-subtitle">Everything you're planning, all in one place.</p>
            </div>
            <button type="button" class="section-link" (click)="goTo('/trips')">
              View all trips
              <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
            </button>
          </div>

          <div *ngIf="upcomingTrips.length === 0" class="upcoming-empty-state">
            <h3>No active upcoming trips</h3>
            <p>Trips in Planning, Upcoming or Confirmed status will appear here. Use <strong>Plan New Trip</strong> above to start one.</p>
          </div>

          <div *ngIf="upcomingTrips.length > 0" class="trips-grid" [class.is-single]="upcomingTrips.length === 1">
            <div *ngFor="let trip of upcomingTrips; let first = first" class="trip-card" [class.is-featured]="first">
              <div class="trip-card-image" [style.background-image]="'url(' + trip.image + ')'">
                <div class="card-badges">
                  <span class="badge-tag">{{ trip.tag }}</span>
                  <span class="badge-status" [ngClass]="trip.statusClass">{{ trip.status }}</span>
                </div>
              </div>

              <div class="trip-card-content">
                <h3 class="trip-name">{{ trip.name }}</h3>
                <p class="trip-date">{{ trip.dates }}</p>
                <div class="trip-countdown" [ngClass]="trip.countdownClass">
                  <span class="material-symbols-outlined">event_upcoming</span>
                  <span>{{ trip.countdown }}</span>
                </div>

                <div class="budget-progress-block">
                  <div class="progress-header">
                    <span class="progress-label">Budget Progress</span>
                    <span class="progress-percent">{{ trip.progress }}%</span>
                  </div>
                  <div class="progress-bar-track">
                    <div class="progress-bar-fill" [style.width.%]="trip.progress"></div>
                  </div>
                  <div class="budget-meta">
                    <span>Spent: <strong>{{ trip.spent }}</strong></span>
                    <span>Limit: <strong>{{ trip.limit }}</strong></span>
                  </div>
                </div>

                <button (click)="openTripDetails(trip)" class="btn-view-trip">
                  View Trip
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Explore Popular Destinations Section -->
        <section class="section-block">
          <div class="section-header">
            <div>
              <span class="section-kicker">Get inspired</span>
              <h2 class="section-title">Explore Popular Destinations</h2>
              <p class="section-subtitle">Hand-picked getaways to start planning in one click.</p>
            </div>
          </div>

          <div class="destinations-grid">
            <div *ngFor="let dest of popularDestinations" class="dest-card">
              <div class="dest-card-image" [style.background-image]="'url(' + dest.image + ')'"></div>

              <div class="dest-card-content">
                <h3 class="dest-name">{{ dest.name }}</h3>
                <p class="dest-duration">{{ dest.duration }}</p>

                <div class="dest-tags">
                  <span *ngFor="let tag of dest.tags" class="dest-tag-chip">{{ tag }}</span>
                </div>

                <button (click)="planDestination(dest)" class="btn-plan-dest">
                  Plan This Trip
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <!-- Create Trip Modal Backdrop -->
      <div *ngIf="showCreateModal" class="modal-backdrop" (click)="closeCreateModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Plan a New Trip</h3>
            <button (click)="closeCreateModal()" class="close-btn">&times;</button>
          </div>

          <div *ngIf="modalError" class="alert-error">
            {{ modalError }}
          </div>

          <form [formGroup]="createTripForm" (ngSubmit)="onCreateTripSubmit()">
            <div class="form-group">
              <label class="form-label">Trip Name</label>
              <input type="text" class="form-control" formControlName="name" placeholder="Kodaikanal Family Trip" />
            </div>

            <div class="form-group">
              <label class="form-label">Destination</label>
              <input type="text" class="form-control" formControlName="destination" placeholder="Kodaikanal, Tamil Nadu" />
            </div>

            <div class="form-row">
              <div class="form-group half">
                <label class="form-label">Trip Type</label>
                <select class="form-control" formControlName="tripType">
                  <option value="FAMILY">Family</option>
                  <option value="COUPLE">Couple</option>
                  <option value="FRIENDS">Friends</option>
                  <option value="SOLO">Solo</option>
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
              <label class="form-label">Budget (₹)</label>
              <input type="number" class="form-control" formControlName="budget" min="0" placeholder="25000" />
            </div>

            <div class="form-group">
              <label class="form-label">Description (Optional)</label>
              <textarea class="form-control" formControlName="description" rows="3" placeholder="Trip notes..."></textarea>
            </div>

            <div class="modal-actions">
              <button type="button" (click)="closeCreateModal()" class="btn-cancel">Cancel</button>
              <button type="submit" class="btn-submit" [disabled]="createTripForm.invalid || isSubmitting">
                {{ isSubmitting ? 'Creating...' : 'Create Trip' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
@use '../../shared/styles/mobile-panels' as mobile;
@use './dashboard.mobile' as mobileHome;

    :host {
      display: block;
      background-color: #f8fafc;
      font-family: var(--tm-font, 'Plus Jakarta Sans', sans-serif);
      color: #0f172a;
    }

    .home-page {
      min-height: 100vh;
      padding-bottom: 4rem;
    }

    /* Hero Section */
    .hero-section {
      position: relative;
      height: 540px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .hero-bg {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background-size: cover;
      background-position: center 35%;
      z-index: 1;
    }

    .hero-overlay {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background:
        radial-gradient(70% 90% at 50% 40%, rgba(15, 23, 42, 0.35) 0%, rgba(15, 23, 42, 0) 70%),
        linear-gradient(180deg, rgba(11, 18, 32, 0.55) 0%, rgba(11, 18, 32, 0.7) 55%, rgba(11, 18, 32, 0.92) 100%);
      z-index: 2;
    }

    .hero-content {
      position: relative;
      z-index: 3;
      max-width: 1080px;
      text-align: center;
      padding: 0 1.5rem;
      margin-bottom: 64px;
    }

    .hero-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.4rem;
      padding: 0.4rem 0.95rem 0.4rem 0.8rem;
      border: 1px solid rgba(255, 255, 255, 0.22);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }

    .welcome-text {
      font-size: 0.84rem;
      font-weight: 650;
      color: #ffffff;
    }

    .hero-pill-divider {
      width: 1px;
      height: 14px;
      background: rgba(255, 255, 255, 0.3);
    }

    .eyebrow-pill {
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #fbdcb0;
    }

    .hero-trust {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.6rem 1.5rem;
      margin: 2rem 0 0;
      padding: 0;
      list-style: none;
      color: rgba(226, 232, 240, 0.85);
      font-size: 0.82rem;
      font-weight: 600;
    }

    .hero-trust li {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }

    .hero-trust .material-symbols-outlined {
      color: #67e8f9;
      font-size: 1.05rem;
    }

    .hero-title {
      font-size: clamp(2.4rem, 5vw, 3.6rem);
      font-weight: 800;
      color: #ffffff;
      line-height: 1.15;
      letter-spacing: -0.03em;
      margin-bottom: 1.25rem;
    }

    .highlight-teal {
      color: #00e5ff;
      background: linear-gradient(135deg, #00e5ff 0%, #f4a340 100%);
      background-clip: text;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .hero-subtitle {
      font-size: 1.05rem;
      color: #cbd5e1;
      max-width: 640px;
      margin: 0 auto 2rem auto;
      line-height: 1.6;
    }

    .hero-actions {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
    }

    .btn-hero {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.85rem 1.6rem;
      font-family: inherit;
      font-size: 0.95rem;
      font-weight: 750;
      border-radius: 14px;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, filter 0.2s ease;
    }

    .btn-hero .material-symbols-outlined { font-size: 1.15rem; }

    .btn-hero-primary {
      background: var(--tm-gradient-brand);
      color: #ffffff;
      border: none;
      box-shadow: 0 14px 30px -12px rgba(35, 44, 85, 0.9);
    }

    .btn-hero-primary:hover {
      filter: brightness(1.08);
      transform: translateY(-2px);
    }

    .btn-hero-outline {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(8px);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.4);
    }

    .btn-hero-outline:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    /* Search Bar Container */
    .search-bar-container {
      max-width: 1140px;
      margin: -45px auto 3rem auto;
      position: relative;
      z-index: 10;
      padding: 0 1.5rem;
    }

    .search-bar-card {
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 12px 35px rgba(15, 23, 42, 0.1);
      padding: 1rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      border: 1px solid #e2e8f0;
    }

    .search-col {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .search-label {
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: #64748b;
      margin-bottom: 0.25rem;
    }

    .search-input-group {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .search-icon {
      width: 16px;
      height: 16px;
      color: #b45309;
      flex-shrink: 0;
    }

    .search-input, .search-select {
      width: 100%;
      border: none;
      outline: none;
      font-family: inherit;
      font-size: 0.875rem;
      font-weight: 600;
      color: #0f172a;
      background: transparent;
    }

    .search-input::placeholder {
      color: #94a3b8;
      font-weight: 500;
    }

    .search-divider {
      width: 1px;
      height: 36px;
      background-color: #e2e8f0;
    }

    .search-btn-col {
      flex-shrink: 0;
    }

    .btn-create-trip {
      background-color: #b45309;
      color: #ffffff;
      font-size: 0.9rem;
      font-weight: 700;
      padding: 0.75rem 1.5rem;
      border-radius: 10px;
      border: none;
      cursor: pointer;
      transition: background 0.2s ease;
    }

    .btn-create-trip:hover {
      background-color: #92400e;
    }

    /* Content Area */
    .content-wrapper {
      max-width: 1140px;
      margin: 0 auto;
      padding: 0 1.5rem;
    }

    .section-block {
      margin-bottom: 3.5rem;
    }

    .section-header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .section-kicker {
      display: block;
      margin-bottom: 0.35rem;
      color: #b45309;
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .section-link {
      display: inline-flex;
      flex-shrink: 0;
      align-items: center;
      gap: 0.3rem;
      padding: 0.55rem 0.95rem;
      border: 1px solid #dbe5ff;
      border-radius: 999px;
      color: #b45309;
      background: #f5f8ff;
      font-family: inherit;
      font-size: 0.8rem;
      font-weight: 750;
      cursor: pointer;
      transition: background 0.2s ease, border-color 0.2s ease;
    }

    .section-link:hover { background: #eaf0ff; border-color: #bfd0ff; }
    .section-link .material-symbols-outlined { font-size: 1rem; }

    /* Quick actions (overlaps the hero) */
    .quick-actions {
      position: relative;
      z-index: 5;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.9rem;
      margin: -58px 0 3rem;
    }

    .quick-action {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      min-width: 0;
      padding: 1.05rem 1.1rem;
      border: 1px solid #e7ecf3;
      border-radius: 18px;
      color: inherit;
      background: #ffffff;
      box-shadow: 0 2px 4px rgba(15, 23, 42, 0.04), 0 20px 40px -22px rgba(15, 23, 42, 0.35);
      font-family: inherit;
      text-align: left;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
    }

    .quick-action:hover {
      transform: translateY(-3px);
      border-color: #c7d7fe;
      box-shadow: 0 2px 4px rgba(15, 23, 42, 0.05), 0 24px 44px -20px rgba(180, 83, 9, 0.4);
    }

    .qa-icon {
      display: grid;
      flex-shrink: 0;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: 14px;
    }

    .qa-icon .material-symbols-outlined { font-size: 1.35rem; }
    .qa-blue { color: #b45309; background: linear-gradient(135deg, #fff7ed, #ffedd5); }
    .qa-violet { color: #3d4b8a; background: linear-gradient(135deg, #f4f5fa, #eceef7); }
    .qa-amber { color: #d97706; background: linear-gradient(135deg, #fffbeb, #fef3c7); }
    .qa-teal { color: #0d9488; background: linear-gradient(135deg, #f0fdfa, #ccfbf1); }

    .qa-text {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      min-width: 0;
    }

    .qa-text strong {
      color: #0b1220;
      font-size: 0.9rem;
      font-weight: 750;
    }

    .qa-text small {
      overflow: hidden;
      color: #64748b;
      font-size: 0.74rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .qa-arrow {
      margin-left: auto;
      color: #cbd5e1;
      font-size: 1.1rem;
      transition: color 0.2s ease, transform 0.2s ease;
    }

    .quick-action:hover .qa-arrow { color: #b45309; transform: translateX(2px); }

    /* Featured (next) trip spans two columns with a side image */
    .trip-card.is-featured {
      grid-column: span 2;
      flex-direction: row;
    }

    .trip-card.is-featured .trip-card-image {
      flex: 0 0 46%;
      height: auto;
      min-height: 260px;
    }

    .trip-card.is-featured .trip-card-content {
      padding: 1.4rem 1.5rem;
      justify-content: center;
    }

    .trip-card.is-featured .trip-name {
      font-size: 1.35rem;
      font-weight: 800;
      letter-spacing: -0.02em;
    }

    .section-title {
      font-size: 1.6rem;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.02em;
      margin-bottom: 0.2rem;
    }

    .section-subtitle {
      font-size: 0.9rem;
      color: #64748b;
    }

    /* Trips Grid */
    .upcoming-empty-state {
      background: #ffffff;
      border: 1px dashed #cbd5e1;
      border-radius: 16px;
      padding: 2.25rem 1.5rem;
      text-align: center;
      color: #64748b;
    }

    .upcoming-empty-state h3 {
      margin: 0 0 0.4rem;
      color: #0f172a;
      font-size: 1.1rem;
    }

    .upcoming-empty-state p {
      margin: 0 0 1rem;
    }

    .trips-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1.25rem;
    }

    .trip-card {
      background: #ffffff;
      border-radius: 18px;
      overflow: hidden;
      border: 1px solid #e7ecf3;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 12px 32px -20px rgba(15, 23, 42, 0.25);
      display: flex;
      flex-direction: column;
      transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
    }

    .trip-card:hover {
      transform: translateY(-4px);
      border-color: #d6e0f5;
      box-shadow: 0 2px 4px rgba(15, 23, 42, 0.05), 0 22px 40px -20px rgba(180, 83, 9, 0.35);
    }

    .trip-card-image {
      height: 160px;
      background-size: cover;
      background-position: center;
      padding: 0.75rem;
      position: relative;
    }

    .card-badges {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .badge-tag {
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(4px);
      color: #1e293b;
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
    }

    .badge-status {
      font-size: 0.625rem;
      font-weight: 800;
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .status-upcoming {
      background: #f1f5f9;
      color: #475569;
    }

    .status-planning {
      background: #fef3c7;
      color: #d97706;
    }

    .status-confirmed {
      background: #fff1dd;
      color: #b45309;
    }

    .trip-card-content {
      padding: 1.1rem;
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .trip-name {
      font-size: 1.05rem;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 0.25rem;
    }

    .trip-date {
      font-size: 0.775rem;
      color: #64748b;
      margin-bottom: 0.65rem;
    }

    .trip-countdown {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin-bottom: 1rem;
      padding: 0.55rem 0.65rem;
      border: 1px solid #fbdcb0;
      border-radius: 9px;
      color: #92400e;
      background: #fff7ed;
      font-size: 0.72rem;
      font-weight: 800;
    }

    .trip-countdown .material-symbols-outlined {
      font-size: 1rem;
    }

    .trip-countdown.starts-soon {
      border-color: #fde68a;
      color: #b45309;
      background: #fffbeb;
    }

    .trip-countdown.starts-today {
      border-color: #86efac;
      color: #15803d;
      background: #f0fdf4;
    }

    .trip-countdown.in-progress {
      border-color: #f8c98a;
      color: #232c55;
      background: #f4f5fa;
    }

    .budget-progress-block {
      margin-bottom: 1.25rem;
      flex: 1;
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.75rem;
      color: #64748b;
      margin-bottom: 0.35rem;
    }

    .progress-percent {
      font-weight: 700;
      color: #b45309;
    }

    .progress-bar-track {
      height: 6px;
      background-color: #f1f5f9;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 0.4rem;
    }

    .progress-bar-fill {
      height: 100%;
      background: #b45309;
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .budget-meta {
      display: flex;
      justify-content: space-between;
      font-size: 0.725rem;
      color: #64748b;
    }

    .budget-meta strong {
      color: #1e293b;
    }

    .btn-view-trip {
      width: 100%;
      padding: 0.65rem;
      background: var(--tm-gradient-brand);
      color: #ffffff;
      font-size: 0.85rem;
      font-weight: 750;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      box-shadow: 0 10px 20px -12px rgba(180, 83, 9, 0.8);
      transition: filter 0.2s ease, box-shadow 0.2s ease;
    }

    .btn-view-trip:hover {
      filter: brightness(1.06);
      box-shadow: 0 14px 24px -12px rgba(180, 83, 9, 0.9);
    }

    /* Destinations Grid */
    .destinations-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1.25rem;
    }

    .dest-card {
      position: relative;
      background: #ffffff;
      border-radius: 18px;
      overflow: hidden;
      border: 1px solid #e7ecf3;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 12px 32px -20px rgba(15, 23, 42, 0.25);
      display: flex;
      flex-direction: column;
      transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
    }

    .dest-card:hover {
      transform: translateY(-4px);
      border-color: #d6e0f5;
      box-shadow: 0 2px 4px rgba(15, 23, 42, 0.05), 0 22px 40px -20px rgba(180, 83, 9, 0.35);
    }

    .dest-card-image {
      position: relative;
      height: 170px;
      background-size: cover;
      background-position: center;
      transition: transform 0.6s ease;
      transform-origin: center bottom;
    }

    .dest-card-image::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(15, 23, 42, 0) 55%, rgba(15, 23, 42, 0.35) 100%);
    }

    .dest-card:hover .dest-card-image {
      transform: scale(1.06);
    }

    .dest-card-content {
      position: relative;
      z-index: 1;
      padding: 1.1rem 1.15rem 1.15rem;
      display: flex;
      flex-direction: column;
      flex: 1;
      background: #ffffff;
    }

    .dest-name {
      font-size: 1.1rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #0b1220;
      margin: 0 0 0.25rem;
    }

    .dest-duration {
      font-size: 0.76rem;
      color: #64748b;
      margin: 0 0 0.8rem;
    }

    .dest-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      margin-bottom: 1.15rem;
      flex: 1;
      align-content: flex-start;
    }

    .dest-tag-chip {
      font-size: 0.68rem;
      font-weight: 650;
      color: #475569;
      background-color: #f1f5f9;
      padding: 0.25rem 0.6rem;
      border-radius: 999px;
    }

    .btn-plan-dest {
      width: 100%;
      padding: 0.65rem;
      background: #f5f8ff;
      color: #b45309;
      border: 1px solid #dbe5ff;
      font-size: 0.85rem;
      font-weight: 750;
      border-radius: 12px;
      cursor: pointer;
      transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .btn-plan-dest:hover,
    .dest-card:hover .btn-plan-dest {
      background: var(--tm-gradient-brand);
      border-color: transparent;
      color: #ffffff;
      box-shadow: 0 10px 20px -10px rgba(180, 83, 9, 0.7);
    }

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
      background: #ffffff;
      border-radius: 16px;
      padding: 2rem;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    }

    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .modal-header h3 { font-size: 1.3rem; font-weight: 800; color: #0f172a; }
    .close-btn { background: none; border: none; font-size: 1.8rem; cursor: pointer; color: #64748b; }
    .alert-error { background: #fee2e2; color: #dc2626; padding: 0.75rem; border-radius: 8px; font-size: 0.85rem; margin-bottom: 1rem; }

    .form-group { margin-bottom: 1rem; }
    .form-label { display: block; font-size: 0.8rem; font-weight: 700; color: #334155; margin-bottom: 0.35rem; }
    .form-control {
      width: 100%; padding: 0.65rem 0.85rem;
      border: 1px solid #cbd5e1; border-radius: 8px;
      font-family: inherit; font-size: 0.9rem; outline: none;
    }
    .form-control:focus { border-color: #b45309; }

    .form-row { display: flex; gap: 1rem; }
    .half { flex: 1; }

    .modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; }
    .btn-cancel { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 700; cursor: pointer; }
    .btn-submit { background: #b45309; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 700; cursor: pointer; }

    @media (max-width: 1024px) {
      .trips-grid, .destinations-grid, .quick-actions {
        grid-template-columns: repeat(2, 1fr);
      }
      .search-bar-card {
        flex-wrap: wrap;
      }
      .search-divider {
        display: none;
      }
    }

    @media (max-width: 640px) {
      .hero-content { width: 100%; min-width: 0; padding: 0 1rem; }
      .hero-actions { flex-wrap: wrap; gap: 0.75rem; }
      .btn-hero { min-height: 44px; }
      .trips-grid, .destinations-grid { min-width: 0; }
      .trips-grid, .destinations-grid, .quick-actions {
        grid-template-columns: minmax(0, 1fr);
      }
      .trip-card.is-featured { grid-column: auto; flex-direction: column; }
      .trip-card.is-featured .trip-card-image { flex: none; min-height: 180px; }
      .hero-title {
        font-size: 2.2rem;
      }
    }

@include mobile.panels;
@include mobileHome.home;

@media(max-width:760px) {
 .home-page { width:100%; min-width:0; }
 .hero-actions { flex-wrap:wrap; }
 .search-bar-wrapper, .section-container { padding-inline:1rem; }
 .search-bar-card { flex-direction:column; align-items:stretch; padding:1rem; }
 .search-field, .search-item { min-width:0; width:100%; }
 .search-btn { width:100%; }
 .section-header, .trip-meta { flex-wrap:wrap; }
 .trip-card, .trip-body, .destination-card { min-width:0; }
 .trip-name { overflow-wrap:anywhere; }
 .hero-title { font-size:clamp(1.75rem,7vw,2.2rem); }
 .modal-card { padding:1rem; }
}
`]
})
export class DashboardComponent implements OnInit {
  authService = inject(AuthService);
  private tripService = inject(TripService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  private readonly destroyRef = inject(DestroyRef);
  mobileBudget: TripDashboard | null = null;

  openMobileTrip(tab: string): void {
    const trip = this.upcomingTrips[0];
    if (trip?.id) { void this.router.navigate(['/trips', trip.id], {queryParams:{tab}}); }
    else if (tab === 'EXPENSES') { void this.router.navigate(['/expenses']); }
    else { this.openCreateModal(); }
  }

  quickDestination = 'Kodaikanal, Tamil Nadu';
  quickTripType: TripType = 'FAMILY';
  quickDates = '15 Sep – 18 Sep 2026';
  quickTravelersBudget = '4 Travelers • ₹25,000';

  showCreateModal = false;
  isSubmitting = false;
  modalError = '';

  upcomingTrips: DisplayTrip[] = [];
  missedTrip: Trip | null = null;
  missedTripError = '';
  cancellingMissedTrip = false;

  popularDestinations: PopularDestination[] = [
    {
      id: 'kodaikanal',
      name: 'Kodaikanal',
      duration: 'Suggested Duration: 3–4 Days',
      tags: ['Family', 'Nature', 'Relaxing'],
      image: 'assets/images/kodaikanal.jpg'
    },
    {
      id: 'munnar',
      name: 'Munnar',
      duration: 'Suggested Duration: 3–4 Days',
      tags: ['Nature', 'Couple', 'Hiking'],
      image: 'assets/images/munnar.jpg'
    },
    {
      id: 'coorg',
      name: 'Coorg',
      duration: 'Suggested Duration: 3–4 Days',
      tags: ['Couple', 'Adventure', 'Serene'],
      image: 'assets/images/coorg.jpg'
    },
    {
      id: 'goa',
      name: 'Goa',
      duration: 'Suggested Duration: 3–4 Days',
      tags: ['Friends', 'Beach', 'Nightlife'],
      image: 'assets/images/goa.jpg'
    }
  ];

  createTripForm = this.fb.group({
    name: ['', Validators.required],
    destination: ['', Validators.required],
    tripType: ['FAMILY' as TripType, Validators.required],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    travelerCount: [4, [Validators.required, Validators.min(1)]],
    budget: [25000, [Validators.required, Validators.min(0)]],
    description: ['']
  });

  ngOnInit(): void {
    this.loadUserTrips();

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      if(params.get('createTrip') === '1') {
        this.openCreateModal();
        void this.router.navigate([], {relativeTo:this.route, queryParams:{createTrip:null}, queryParamsHandling:'merge', replaceUrl:true});
      }
    });
  }

  loadUserTrips(): void {
    this.tripService.getMyTrips().subscribe({
      next: (apiTrips) => {
        this.missedTrip = findMissedTrip(apiTrips ?? []);
        const activeTrips = (apiTrips ?? [])
          .filter((trip) => this.isActiveUpcomingTrip(trip))
          .sort(
            (a, b) =>
              new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
          );

        this.upcomingTrips = activeTrips.map((trip) => this.toDisplayTrip(trip));
        this.mobileBudget = null;
        const firstId = this.upcomingTrips[0]?.id;
        if (firstId) this.tripService.getTripDashboard(firstId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: budget => { if(this.upcomingTrips[0]?.id === firstId) this.mobileBudget = budget; }, error: () => {}
        });
      },
      error: () => {
        this.upcomingTrips = [];
      }
    });
  }

  dismissMissedTrip(): void {
    this.missedTrip = null;
    this.missedTripError = '';
  }

  rescheduleMissedTrip(): void {
    if (!this.missedTrip) return;
    void this.router.navigate(['/trips', this.missedTrip.id], { queryParams: { reschedule: 1 } });
  }

  cancelMissedTrip(): void {
    const trip = this.missedTrip;
    if (!trip) return;

    this.cancellingMissedTrip = true;
    this.missedTripError = '';
    this.tripService.updateTrip(trip.id, { ...trip, status: 'CANCELLED' }).subscribe({
      next: () => {
        this.cancellingMissedTrip = false;
        this.missedTrip = null;
        this.loadUserTrips();
      },
      error: (err) => {
        this.cancellingMissedTrip = false;
        this.missedTripError = err?.error?.message || 'Unable to cancel the trip. Please try again.';
      }
    });
  }

  private isActiveUpcomingTrip(trip: Trip): boolean {
    const activeStatuses = new Set(['UPCOMING', 'PLANNED', 'CONFIRMED']);
    if (!activeStatuses.has(trip.status)) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tripEndDate = new Date(`${trip.endDate}T00:00:00`);
    return !Number.isNaN(tripEndDate.getTime()) && tripEndDate >= today;
  }

  private toDisplayTrip(trip: Trip): DisplayTrip {
    const displayStatus = trip.status === 'PLANNED' ? 'PLANNING' : trip.status;

    return {
      id: trip.id,
      name: trip.name,
      destination: trip.destination,
      tag: `${trip.tripType.charAt(0)}${trip.tripType.slice(1).toLowerCase()} trip`,
      status: displayStatus,
      statusClass:
        trip.status === 'UPCOMING'
          ? 'status-upcoming'
          : trip.status === 'PLANNED'
            ? 'status-planning'
            : 'status-confirmed',
      dates: formatDateRange(trip.startDate, trip.endDate),
      startDate:trip.startDate, endDate:trip.endDate,
      ...this.tripCountdown(trip.startDate),
      spent: '₹0',
      limit: `₹${trip.budget.toLocaleString()}`,
      progress: 0,
      image: this.getTripImage(trip)
    };
  }

  private tripCountdown(startDate: string): Pick<DisplayTrip, 'countdown' | 'countdownClass'> {
    const parts = startDate.split('-').map(Number);
    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
      return { countdown: 'Start date unavailable', countdownClass: '' };
    }

    const now = new Date();
    const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const startUtc = Date.UTC(parts[0], parts[1] - 1, parts[2]);
    const days = Math.round((startUtc - todayUtc) / 86_400_000);

    if (days < 0) return { countdown: 'Trip is in progress', countdownClass: 'in-progress' };
    if (days === 0) return { countdown: 'Trip starts today', countdownClass: 'starts-today' };
    if (days === 1) return { countdown: 'Trip starts tomorrow', countdownClass: 'starts-soon' };
    return {
      countdown: `Trip starts in ${days} days`,
      countdownClass: days <= 7 ? 'starts-soon' : ''
    };
  }

  private getTripImage(trip: Trip): string {
    if (trip.coverImageUrl) {
      return trip.coverImageUrl;
    }

    const destination = trip.destination.toLowerCase();
    if (destination.includes('goa')) return 'assets/images/goa.jpg';
    if (destination.includes('coorg')) return 'assets/images/coorg.jpg';
    if (destination.includes('munnar')) return 'assets/images/munnar.jpg';
    return 'assets/images/kodaikanal.jpg';
  }

  goTo(path: string): void {
    void this.router.navigate([path]);
  }

  scrollToUpcoming(): void {
    void this.router.navigate(['/trips']);
  }

  openCreateModal(): void {
    this.showCreateModal = true;
    this.modalError = '';
  }

  openCreateModalFromQuick(): void {
    this.createTripForm.patchValue({
      name: `${this.quickDestination} Trip`,
      destination: this.quickDestination,
      tripType: this.quickTripType,
      budget: 25000,
      travelerCount: 4
    });
    this.openCreateModal();
  }

  planDestination(dest: PopularDestination): void {
    this.createTripForm.patchValue({
      name: `${dest.name} Tour`,
      destination: dest.name,
      budget: 20000,
      travelerCount: 2
    });
    this.openCreateModal();
  }

  openTripDetails(trip: DisplayTrip): void {
    if (trip.id) {
      void this.router.navigate(['/trips', trip.id]);
    }
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.createTripForm.reset({
      tripType: 'FAMILY',
      travelerCount: 4,
      budget: 25000
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
      startDate: val.startDate || new Date().toISOString().split('T')[0],
      endDate: val.endDate || new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0],
      travelerCount: val.travelerCount!,
      budget: val.budget!,
      description: val.description || undefined
    };

    this.tripService.createTrip(request).subscribe({
      next: (newTrip) => {
        this.isSubmitting = false;
        if (this.isActiveUpcomingTrip(newTrip)) {
          this.upcomingTrips = [
            this.toDisplayTrip(newTrip),
            ...this.upcomingTrips.filter((trip) => trip.id !== newTrip.id)
          ].sort((a, b) => a.dates.localeCompare(b.dates));
        }
        this.closeCreateModal();
      },
      error: (err) => {
        this.isSubmitting = false;
        if (err.error && err.error.message) {
          this.modalError = err.error.message;
        } else {
          this.modalError = 'Unable to create the trip. Please make sure the backend is running and try again.';
        }
      }
    });
  }
}
