import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TripService } from '../../core/services/trip.service';
import { AuthService } from '../../core/services/auth.service';
import { Trip, TripType, CreateTripRequest } from '../../core/models/trip.model';

interface DisplayTrip {
  id?: number;
  name: string;
  destination: string;
  tag: string;
  status: string;
  statusClass: string;
  dates: string;
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
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  template: `
    <div class="home-page">
      <!-- Hero Section -->
      <section class="hero-section">
        <div class="hero-bg" style="background-image: url('assets/images/hero.jpg');"></div>
        <div class="hero-overlay"></div>
        
        <div class="hero-content">
          <!-- User Request: Change 'Welcome back' to 'Welcome Traveller' and remove the name -->
          <div class="greeting-badge">
            <span class="welcome-text">👋 Welcome Traveller</span>
          </div>

          <div class="eyebrow-pill">EXPLORE. PLAN. TRAVEL.</div>
          
          <h1 class="hero-title">
            Your Journey, <span class="highlight-teal">Perfectly Planned.</span>
          </h1>

          <p class="hero-subtitle">
            Create your trip, build your itinerary, control your budget and keep everything you need in one place.
          </p>

          <div class="hero-actions">
            <button (click)="openCreateModal()" class="btn-hero btn-hero-primary">
              Plan New Trip
            </button>
            <button (click)="scrollToUpcoming()" class="btn-hero btn-hero-outline">
              View My Trips
            </button>
          </div>
        </div>
      </section>

      <!-- Floating Quick Search & Plan Bar -->
      <div class="search-bar-container">
        <div class="search-bar-card">
          <div class="search-col">
            <label class="search-label">DESTINATION</label>
            <div class="search-input-group">
              <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <input 
                type="text" 
                class="search-input" 
                [(ngModel)]="quickDestination" 
                placeholder="Kodaikanal, Tamil Nadu"
              />
            </div>
          </div>

          <div class="search-divider"></div>

          <div class="search-col">
            <label class="search-label">TRIP TYPE</label>
            <div class="search-input-group">
              <select class="search-select" [(ngModel)]="quickTripType">
                <option value="FAMILY">Family</option>
                <option value="COUPLE">Couple</option>
                <option value="FRIENDS">Friends</option>
                <option value="SOLO">Solo</option>
                <option value="ADVENTURE">Adventure</option>
              </select>
            </div>
          </div>

          <div class="search-divider"></div>

          <div class="search-col">
            <label class="search-label">DATES</label>
            <div class="search-input-group">
              <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <input 
                type="text" 
                class="search-input" 
                [(ngModel)]="quickDates" 
                placeholder="15 Sep – 18 Sep 2026"
              />
            </div>
          </div>

          <div class="search-divider"></div>

          <div class="search-col">
            <label class="search-label">TRAVELERS & BUDGET</label>
            <div class="search-input-group">
              <input 
                type="text" 
                class="search-input" 
                [(ngModel)]="quickTravelersBudget" 
                placeholder="4 Travelers • ₹25,000"
              />
            </div>
          </div>

          <div class="search-btn-col">
            <button (click)="openCreateModalFromQuick()" class="btn-create-trip">
              Create Trip
            </button>
          </div>
        </div>
      </div>

      <!-- Main Content Area -->
      <main class="content-wrapper">
        <!-- Upcoming Trips Section -->
        <section class="section-block" id="upcoming-trips-section">
          <div class="section-header">
            <div>
              <h2 class="section-title">Upcoming Trips</h2>
              <p class="section-subtitle">Everything you're planning, all in one place.</p>
            </div>
          </div>

          <div class="trips-grid">
            <div *ngFor="let trip of upcomingTrips" class="trip-card">
              <div class="trip-card-image" [style.background-image]="'url(' + trip.image + ')'">
                <div class="card-badges">
                  <span class="badge-tag">{{ trip.tag }}</span>
                  <span class="badge-status" [ngClass]="trip.statusClass">{{ trip.status }}</span>
                </div>
              </div>

              <div class="trip-card-content">
                <h3 class="trip-name">{{ trip.name }}</h3>
                <p class="trip-date">{{ trip.dates }}</p>

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
              <h2 class="section-title">Explore Popular Destinations</h2>
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
      height: 480px;
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
      background: linear-gradient(
        180deg,
        rgba(15, 23, 42, 0.65) 0%,
        rgba(15, 23, 42, 0.85) 100%
      );
      z-index: 2;
    }

    .hero-content {
      position: relative;
      z-index: 3;
      max-width: 900px;
      text-align: center;
      padding: 0 1.5rem;
      margin-bottom: 30px;
    }

    .greeting-badge {
      display: inline-block;
      margin-bottom: 0.75rem;
    }

    .welcome-text {
      display: inline-block;
      padding: 0.35rem 1rem;
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: 20px;
      font-size: 0.875rem;
      font-weight: 600;
      color: #ffffff;
    }

    .eyebrow-pill {
      display: inline-block;
      padding: 0.25rem 0.85rem;
      background: rgba(0, 0, 0, 0.4);
      border-radius: 6px;
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.15em;
      color: #e2e8f0;
      margin-bottom: 1.25rem;
    }

    .hero-title {
      font-size: 3.2rem;
      font-weight: 800;
      color: #ffffff;
      line-height: 1.15;
      letter-spacing: -0.03em;
      margin-bottom: 1.25rem;
    }

    .highlight-teal {
      color: #00e5ff;
      background: linear-gradient(135deg, #00e5ff 0%, #38bdf8 100%);
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
      padding: 0.75rem 1.75rem;
      font-size: 0.95rem;
      font-weight: 700;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-hero-primary {
      background-color: #2563eb;
      color: #ffffff;
      border: none;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
    }

    .btn-hero-primary:hover {
      background-color: #1d4ed8;
      transform: translateY(-1px);
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
      color: #2563eb;
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
      background-color: #2563eb;
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
      background-color: #1d4ed8;
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
      margin-bottom: 1.5rem;
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
    .trips-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1.25rem;
    }

    .trip-card {
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
      display: flex;
      flex-direction: column;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .trip-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 25px rgba(0, 0, 0, 0.08);
    }

    .trip-card-image {
      height: 140px;
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
      background: #e0f2fe;
      color: #0284c7;
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
      margin-bottom: 1rem;
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
      color: #2563eb;
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
      background: #2563eb;
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
      padding: 0.55rem;
      background-color: #eff6ff;
      color: #2563eb;
      font-size: 0.85rem;
      font-weight: 700;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.2s ease;
    }

    .btn-view-trip:hover {
      background-color: #dbeafe;
    }

    /* Destinations Grid */
    .destinations-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1.25rem;
    }

    .dest-card {
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
      display: flex;
      flex-direction: column;
      transition: transform 0.2s ease;
    }

    .dest-card:hover {
      transform: translateY(-4px);
    }

    .dest-card-image {
      height: 140px;
      background-size: cover;
      background-position: center;
    }

    .dest-card-content {
      padding: 1.1rem;
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .dest-name {
      font-size: 1.05rem;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 0.2rem;
    }

    .dest-duration {
      font-size: 0.75rem;
      color: #64748b;
      margin-bottom: 0.75rem;
    }

    .dest-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      margin-bottom: 1.25rem;
      flex: 1;
    }

    .dest-tag-chip {
      font-size: 0.675rem;
      color: #64748b;
      background-color: #f1f5f9;
      padding: 0.2rem 0.55rem;
      border-radius: 4px;
    }

    .btn-plan-dest {
      width: 100%;
      padding: 0.55rem;
      background: #ffffff;
      color: #2563eb;
      border: 1px solid #2563eb;
      font-size: 0.85rem;
      font-weight: 700;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-plan-dest:hover {
      background-color: #2563eb;
      color: #ffffff;
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
    .form-control:focus { border-color: #2563eb; }

    .form-row { display: flex; gap: 1rem; }
    .half { flex: 1; }

    .modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; }
    .btn-cancel { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 700; cursor: pointer; }
    .btn-submit { background: #2563eb; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 700; cursor: pointer; }

    @media (max-width: 1024px) {
      .trips-grid, .destinations-grid {
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
      .trips-grid, .destinations-grid {
        grid-template-columns: 1fr;
      }
      .hero-title {
        font-size: 2.2rem;
      }
    }
  `]
})
export class DashboardComponent implements OnInit {
  authService = inject(AuthService);
  private tripService = inject(TripService);
  private fb = inject(FormBuilder);

  quickDestination = 'Kodaikanal, Tamil Nadu';
  quickTripType: TripType = 'FAMILY';
  quickDates = '15 Sep – 18 Sep 2026';
  quickTravelersBudget = '4 Travelers • ₹25,000';

  showCreateModal = false;
  isSubmitting = false;
  modalError = '';

  upcomingTrips: DisplayTrip[] = [
    {
      name: 'Kodaikanal Family Trip',
      destination: 'Kodaikanal, Tamil Nadu',
      tag: 'Family Trip',
      status: 'UPCOMING',
      statusClass: 'status-upcoming',
      dates: '15 Sep – 18 Sep 2026 (4 Days)',
      spent: '₹18,450',
      limit: '₹25,000',
      progress: 74,
      image: 'assets/images/kodaikanal.jpg'
    },
    {
      name: 'Coorg Misty Trails',
      destination: 'Coorg, Karnataka',
      tag: 'Couple Getaway',
      status: 'PLANNING',
      statusClass: 'status-planning',
      dates: '02 Oct – 05 Oct 2026 (4 Days)',
      spent: '₹6,000',
      limit: '₹30,000',
      progress: 20,
      image: 'assets/images/coorg.jpg'
    },
    {
      name: 'Goa Beach Escapade',
      destination: 'Goa',
      tag: 'Friends Reunion',
      status: 'CONFIRMED',
      statusClass: 'status-confirmed',
      dates: '12 Nov – 16 Nov 2026 (5 Days)',
      spent: '₹18,000',
      limit: '₹40,000',
      progress: 45,
      image: 'assets/images/goa.jpg'
    },
    {
      name: 'Munnar Tea Trails',
      destination: 'Munnar, Kerala',
      tag: 'Nature Tour',
      status: 'PLANNING',
      statusClass: 'status-planning',
      dates: '24 Dec – 28 Dec 2026 (5 Days)',
      spent: '₹0',
      limit: '₹20,000',
      progress: 0,
      image: 'assets/images/munnar.jpg'
    }
  ];

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
  }

  loadUserTrips(): void {
    this.tripService.getMyTrips().subscribe({
      next: (apiTrips) => {
        if (apiTrips && apiTrips.length > 0) {
          const mappedTrips: DisplayTrip[] = apiTrips.map((t) => ({
            id: t.id,
            name: t.name,
            destination: t.destination,
            tag: `${t.tripType} Trip`,
            status: t.status,
            statusClass: t.status === 'UPCOMING' ? 'status-upcoming' : t.status === 'PLANNING' ? 'status-planning' : 'status-confirmed',
            dates: `${t.startDate} - ${t.endDate}`,
            spent: '₹0',
            limit: `₹${t.budget.toLocaleString()}`,
            progress: 0,
            image: t.destination.toLowerCase().includes('goa') ? 'assets/images/goa.jpg' :
                   t.destination.toLowerCase().includes('coorg') ? 'assets/images/coorg.jpg' :
                   t.destination.toLowerCase().includes('munnar') ? 'assets/images/munnar.jpg' :
                   'assets/images/kodaikanal.jpg'
          }));
          this.upcomingTrips = [...mappedTrips, ...this.upcomingTrips];
        }
      },
      error: () => {}
    });
  }

  scrollToUpcoming(): void {
    const el = document.getElementById('upcoming-trips-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
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
      // Navigate to trip details if real API trip
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
        this.upcomingTrips.unshift({
          id: newTrip.id,
          name: newTrip.name,
          destination: newTrip.destination,
          tag: `${newTrip.tripType} Trip`,
          status: 'PLANNING',
          statusClass: 'status-planning',
          dates: `${newTrip.startDate} – ${newTrip.endDate}`,
          spent: '₹0',
          limit: `₹${newTrip.budget.toLocaleString()}`,
          progress: 0,
          image: newTrip.destination.toLowerCase().includes('goa') ? 'assets/images/goa.jpg' :
                 newTrip.destination.toLowerCase().includes('coorg') ? 'assets/images/coorg.jpg' :
                 newTrip.destination.toLowerCase().includes('munnar') ? 'assets/images/munnar.jpg' :
                 'assets/images/kodaikanal.jpg'
        });
        this.closeCreateModal();
      },
      error: (err) => {
        this.isSubmitting = false;
        if (err.error && err.error.message) {
          this.modalError = err.error.message;
        } else {
          // Fallback UI insertion if backend offline
          this.upcomingTrips.unshift({
            name: request.name,
            destination: request.destination,
            tag: `${request.tripType} Trip`,
            status: 'PLANNING',
            statusClass: 'status-planning',
            dates: `${request.startDate} – ${request.endDate}`,
            spent: '₹0',
            limit: `₹${request.budget.toLocaleString()}`,
            progress: 0,
            image: request.destination.toLowerCase().includes('goa') ? 'assets/images/goa.jpg' :
                   request.destination.toLowerCase().includes('coorg') ? 'assets/images/coorg.jpg' :
                   request.destination.toLowerCase().includes('munnar') ? 'assets/images/munnar.jpg' :
                   'assets/images/kodaikanal.jpg'
          });
          this.closeCreateModal();
        }
      }
    });
  }
}
