import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  DiscoveredPlace,
  DestinationDiscoveryResponse,
  DiscoveryCategory,
  DiscoveryItemType,
  DiscoveryPriceOption,
  DiscoveryPriceStatus,
  DiscoverySearchFilters,
  DiscoverySuggestion
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
            Search any city, town or destination even when you are only browsing. A trip is optional
            and is needed only when you want to save places or add them to an itinerary.
          </p>
        </div>
        <div class="hero-icon">
          <span class="material-symbols-outlined">travel_explore</span>
        </div>
      </div>

      <div class="search-panel">
        <label *ngIf="!embeddedMode" class="field trip-field">
          <span>Save to Trip <small>(optional)</small></span>
          <select [ngModel]="activeTripId" (ngModelChange)="selectTrip($event)">
            <option [ngValue]="0">Browse only — no trip selected</option>
            <option *ngFor="let trip of editableTrips" [ngValue]="trip.id">
              {{ trip.name }} · {{ trip.destination }}
            </option>
          </select>
          <button
            *ngIf="selectedTrip as trip"
            type="button"
            class="use-trip-link"
            (click)="useTripDestination(trip)"
          >
            Use {{ trip.destination }} as search destination
          </button>
        </label>

        <div class="field destination-field">
          <span>Destination</span>
          <div class="destination-input-row">
            <input
              [(ngModel)]="searchDestination"
              [ngModelOptions]="{ standalone: true }"
              maxlength="180"
              autocomplete="off"
              placeholder="Search any Indian city or destination"
              (input)="onDestinationInput()"
              (keyup.enter)="discover()"
            />
            <button type="button" class="location-button" title="Use current location" [disabled]="isLocating" (click)="useCurrentLocation()">
              <span class="material-symbols-outlined">my_location</span>
            </button>
          </div>
          <div *ngIf="suggestions.length" class="suggestions" role="listbox">
            <button *ngFor="let suggestion of suggestions" type="button" (click)="selectSuggestion(suggestion)">
              <span class="material-symbols-outlined">location_on</span>
              <span><strong>{{ suggestion.city || suggestion.label }}</strong><small>{{ suggestion.label }}</small></span>
            </button>
          </div>
        </div>

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

      <nav class="type-tabs" aria-label="Catalogue type">
        <button *ngFor="let tab of itemTypeTabs" type="button" [class.active]="itemTypeFilter === tab.value" (click)="selectItemType(tab.value)">
          <span class="material-symbols-outlined">{{ tab.icon }}</span>{{ tab.label }}
        </button>
      </nav>

      <div *ngIf="!embeddedMode" class="casual-search-note">
        <span class="material-symbols-outlined">public</span>
        <div>
          <strong>Browse any destination</strong>
          <span>
            Search first, select the places you like, then choose an editable trip only when you are ready to add them.
          </span>
        </div>
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
          <h3>Searching {{ searchDestination }}</h3>
          <p>Finding places, activities, entry fees, and route details...</p>
        </div>
      </div>

      <div *ngIf="result as data" class="results-container">
        <div *ngIf="data.warnings?.length" class="data-warning">
          <span class="material-symbols-outlined">info</span>
          <div>
            <strong>Live source coverage can vary</strong>
            <span *ngFor="let warning of data.warnings">{{ warning }}</span>
          </div>
        </div>

        <div class="result-toolbar">
          <div>
            <h3>Found {{ filteredPlaces.length }} tourist places & activities in {{ data.query }}</h3>
            <p>Select places to add to your saved list or trip itinerary.</p>
          </div>

          <label class="local-filter">
            <span class="material-symbols-outlined">filter_alt</span>
            <input
              type="text"
              [(ngModel)]="filterText"
              [ngModelOptions]="{ standalone: true }"
              placeholder="Filter current results..."
            />
          </label>
        </div>

        <button type="button" class="mobile-filter-toggle" (click)="filtersOpen = !filtersOpen">
          <span class="material-symbols-outlined">tune</span> Filters
        </button>

        <div class="catalogue-layout">
          <aside class="catalogue-filters" [class.open]="filtersOpen" aria-label="Discovery filters">
            <div class="filter-heading"><strong>Filter results</strong><button type="button" (click)="clearFilters()">Clear</button></div>
            <label><span>Category</span><select [(ngModel)]="category"><option *ngFor="let item of categories" [value]="item">{{ formatCategory(item) }}</option></select></label>
            <label><span>Subcategory</span><input [(ngModel)]="subcategoryFilter" placeholder="e.g. rafting, museum" /></label>
            <label><span>Distance: {{ radiusKm }} km</span><input type="range" min="5" max="100" step="5" [(ngModel)]="radiusKm" /></label>
            <div class="range-row">
              <label><span>Min price</span><input type="number" min="0" [(ngModel)]="minPriceFilter" placeholder="₹0" /></label>
              <label><span>Max price</span><input type="number" min="0" [(ngModel)]="maxPriceFilter" placeholder="Any" /></label>
            </div>
            <label><span>Price information</span><select [(ngModel)]="priceStatusFilter">
              <option value="ALL">All price statuses</option><option value="FREE">Free entry</option>
              <option value="VERIFIED">Verified pricing only</option><option value="STARTING_FROM">Starting price</option>
              <option value="ESTIMATED">Estimated price</option><option value="UNKNOWN">Price not verified</option>
            </select></label>
            <label class="check-filter"><input type="checkbox" [(ngModel)]="openNowFilter" /> Open now</label>
            <label class="check-filter"><input type="checkbox" [(ngModel)]="familyFriendlyFilter" /> Family-friendly</label>
            <label><span>Difficulty</span><select [(ngModel)]="difficultyFilter"><option value="">Any difficulty</option><option>Easy</option><option>Moderate</option><option>Hard</option></select></label>
            <label><span>Maximum duration</span><select [(ngModel)]="maxDurationFilter"><option [ngValue]="undefined">Any duration</option><option [ngValue]="60">Up to 1 hour</option><option [ngValue]="180">Up to 3 hours</option><option [ngValue]="480">Up to 8 hours</option></select></label>
            <label><span>Minimum rating</span><select [(ngModel)]="minRatingFilter"><option [ngValue]="undefined">Any rating</option><option [ngValue]="3">3+</option><option [ngValue]="4">4+</option><option [ngValue]="4.5">4.5+</option></select></label>
            <button type="button" class="btn primary apply-filter" (click)="discover()">Apply filters</button>
          </aside>

          <main class="catalogue-main">
            <label class="sort-filter"><span>Sort by</span><select [(ngModel)]="sortOrder" (ngModelChange)="discover()">
              <option value="RELEVANCE">Relevance</option><option value="DISTANCE">Distance</option>
              <option value="PRICE_LOW">Price: low to high</option><option value="PRICE_HIGH">Price: high to low</option>
              <option value="POPULAR">Most popular</option><option value="VERIFIED">Best verified</option>
              <option value="RECENTLY_VERIFIED">Recently verified</option>
            </select></label>

        <div *ngIf="filteredPlaces.length === 0" class="empty-state">
          <span class="material-symbols-outlined">sentiment_dissatisfied</span>
          <h3>No matching places found</h3>
          <p>Try searching another category or clearing your filter text.</p>
        </div>

        <div class="places-grid">
          <article
            *ngFor="let place of filteredPlaces; trackBy: trackPlace"
            class="place-card"
            [class.selected]="isSelected(place)"
            [class.saved]="isAlreadySaved(place)"
          >
            <div class="media">
              <img
                [src]="getPlaceImage(place)"
                [alt]="place.name"
                loading="lazy"
                referrerpolicy="no-referrer"
                (error)="handleImageError($event, place)"
              />

              <span class="category-badge">{{ formatCategory(place.category) }}</span>
              <span *ngIf="place.activityType" class="activity-type-badge">{{ place.activityType }}</span>
              <span class="verification-badge" [class.verified]="place.priceStatus === 'VERIFIED' || place.priceStatus === 'FREE'" [class.expired]="place.verificationExpired">
                {{ place.verificationExpired ? 'May have changed' : priceStatusLabel(place) }}
              </span>
              <label *ngIf="canSelectPlaces" class="select-box" title="Select place">
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
                <span *ngIf="place.city || place.district">
                  <span class="material-symbols-outlined">location_on</span>
                  {{ place.city || place.district }}<ng-container *ngIf="place.state">, {{ place.state }}</ng-container>
                </span>
                <span>
                  <span class="material-symbols-outlined">near_me</span>
                  {{ place.distanceKm | number:'1.0-1' }} km
                </span>
                <span>
                  <span class="material-symbols-outlined">schedule</span>
                  ~{{ formatDuration(place.suggestedVisitMinutes) }}
                </span>
                <span
                  class="cost-badge"
                  [class.free-badge]="place.priceStatus === 'FREE'"
                  [class.unknown-badge]="!place.priceStatus || place.priceStatus === 'UNKNOWN'"
                >
                  <span class="material-symbols-outlined">payments</span>
                  {{ formatPlacePrice(place) }}
                </span>
              </div>

              <p class="description">{{ place.description || 'Details are not available from the source.' }}</p>

              <p *ngIf="place.openingHours" class="opening-hours">
                <span class="material-symbols-outlined">schedule</span>
                {{ place.openingHours }}
              </p>
              <p *ngIf="place.openNow != null" class="open-status" [class.open]="place.openNow">
                {{ place.openNow ? 'Open now' : 'Closed now' }}
              </p>

              <div class="source-row">
                <span>
                  Source: {{ place.sourceName || data.provider }}
                  <ng-container *ngIf="place.sourceLastCheckedAt">
                    · checked {{ place.sourceLastCheckedAt | date:'mediumDate' }}
                  </ng-container>
                </span>
                <span *ngIf="place.confidenceScore != null">
                  {{ place.confidenceScore * 100 | number:'1.0-0' }}% data confidence
                </span>
              </div>

              <div class="card-actions">
                <div class="quick-actions">
                  <button type="button" class="card-action secondary-action" (click)="openDetails(place)">
                    <span class="material-symbols-outlined">info</span>
                    <span>Details</span>
                  </button>
                  <button
                    type="button"
                    class="card-action secondary-action"
                    (click)="openMapRoute(place, $event)"
                    title="View turn-by-turn route on Google Maps"
                  >
                    <span class="material-symbols-outlined">directions</span>
                    <span>Map route</span>
                    <span class="material-symbols-outlined external-icon">open_in_new</span>
                  </button>
                </div>

                <div *ngIf="place.officialWebsite || place.website || place.bookingUrl" class="provider-actions">
                  <a
                    *ngIf="place.officialWebsite || place.website"
                    class="provider-action"
                    [href]="place.officialWebsite || place.website"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span class="material-symbols-outlined">language</span>
                    <span>Official details</span>
                    <span class="material-symbols-outlined external-icon">open_in_new</span>
                  </a>
                  <a *ngIf="place.bookingUrl" class="provider-action booking-action" [href]="place.bookingUrl" target="_blank" rel="noopener noreferrer">
                    <span class="material-symbols-outlined">confirmation_number</span>
                    <span>Book with provider</span>
                    <span class="material-symbols-outlined external-icon">open_in_new</span>
                  </a>
                </div>

                <div *ngIf="canSelectPlaces" class="trip-actions">
                  <button
                    *ngIf="activeTripId === 0 || !isAlreadySaved(place)"
                    type="button"
                    class="card-action primary-action"
                    [disabled]="isSaving"
                    (click)="addPlace(place)"
                  >
                    <span class="material-symbols-outlined">add_circle</span>
                    <span>{{ activeTripId > 0 ? 'Add to trip' : 'Add place' }}</span>
                  </button>
                  <button
                    type="button"
                    class="card-action primary-action"
                    [disabled]="isSaving"
                    (click)="addPlaceToItinerary(place)"
                  >
                    <span class="material-symbols-outlined">event_note</span>
                    <span>Add itinerary</span>
                  </button>
                </div>
              </div>

              <label
                *ngIf="effectiveCanEdit && activeTripId > 0 && isSelected(place)"
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

        <div *ngIf="(data.totalPages || 0) > 1" class="pagination">
          <button type="button" [disabled]="(data.page || 0) === 0 || isLoading" (click)="changePage((data.page || 0) - 1)">← Previous</button>
          <span>Page {{ (data.page || 0) + 1 }} of {{ data.totalPages }}</span>
          <button type="button" [disabled]="(data.page || 0) + 1 >= (data.totalPages || 0) || isLoading" (click)="changePage((data.page || 0) + 1)">Next →</button>
        </div>
          </main>
        </div>

        <div
          *ngIf="canSelectPlaces && selectedCount > 0"
          class="selection-bar"
        >
          <div>
            <strong>{{ selectedCount }} place{{ selectedCount === 1 ? '' : 's' }} selected</strong>
            <span>
              {{ activeTripId > 0
                ? 'Save the selected places or add them to the itinerary.'
                : 'Choose a trip below to add the selected places.' }}
            </span>
          </div>

          <label *ngIf="!embeddedMode" class="selection-trip-picker">
            <span>Save to</span>
            <select [ngModel]="activeTripId" (ngModelChange)="selectTrip($event)">
              <option [ngValue]="0">Choose a trip</option>
              <option *ngFor="let trip of editableTrips" [ngValue]="trip.id">
                {{ trip.name }}
              </option>
            </select>
          </label>

          <div *ngIf="activeTripId > 0" class="plan-buttons">
            <span>Suggested:</span>
            <button type="button" (click)="applySuggestedPlan(1)">1 Day</button>
            <button type="button" (click)="applySuggestedPlan(2)">2 Days</button>
            <button type="button" (click)="applySuggestedPlan(3)">3 Days</button>
          </div>

          <div class="bulk-actions">
            <button
              type="button"
              class="btn secondary"
              [disabled]="isSaving || activeTripId <= 0 || !effectiveCanEdit"
              (click)="saveSelected(false)"
            >
              Save to Places
            </button>
            <button
              type="button"
              class="btn primary"
              [disabled]="isSaving || activeTripId <= 0 || !effectiveCanEdit"
              (click)="saveSelected(true)"
            >
              {{ isSaving ? 'Saving...' : 'Save & Add to Itinerary' }}
            </button>
          </div>
        </div>
      </div>

      <div *ngIf="selectedDetail as place" class="detail-backdrop" (click)="closeDetails()">
        <article class="detail-dialog" role="dialog" aria-modal="true" [attr.aria-label]="place.name" (click)="$event.stopPropagation()">
          <button type="button" class="detail-close" aria-label="Close details" (click)="closeDetails()">
            <span class="material-symbols-outlined">close</span>
          </button>
          <div class="detail-gallery">
            <img [src]="getPlaceImage(place)" [alt]="place.name" (error)="handleImageError($event, place)" />
            <img *ngFor="let image of (place.imageGallery || []).slice(1, 4)" [src]="image.url" [alt]="place.name" loading="lazy" />
          </div>
          <div class="detail-content">
            <span class="eyebrow">{{ formatCategory(place.category) }} · {{ formatItemType(place.itemType) }}</span>
            <h2>{{ place.name }}</h2>
            <p>{{ place.detailedDescription || place.description || 'Details are not available from the source.' }}</p>
            <div *ngIf="place.priceOptions?.length" class="price-table">
              <h3>Price details</h3>
              <div *ngFor="let option of place.priceOptions">
                <strong>{{ option.label }}</strong>
                <span>{{ formatPriceOption(option) }}</span>
                <small>{{ option.mayHaveChanged ? 'May have changed' : (option.lastVerifiedAt ? 'Verified ' + (option.lastVerifiedAt | date:'mediumDate') : 'Verification date unavailable') }}</small>
                <a *ngIf="option.sourceUrl" [href]="option.sourceUrl" target="_blank" rel="noopener noreferrer">Source ↗</a>
              </div>
            </div>
            <dl>
              <div><dt>Price</dt><dd>{{ formatPlacePrice(place) }}</dd></div>
              <div><dt>Suggested time</dt><dd>{{ formatDuration(place.suggestedVisitMinutes) }}</dd></div>
              <div *ngIf="place.openingHours"><dt>Hours</dt><dd>{{ place.openingHours }}</dd></div>
              <div *ngIf="place.fullAddress || place.address"><dt>Address</dt><dd>{{ place.fullAddress || place.address }}</dd></div>
              <div *ngIf="place.bestTimeToVisit"><dt>Best time</dt><dd>{{ place.bestTimeToVisit }}</dd></div>
              <div *ngIf="place.difficultyLevel"><dt>Difficulty</dt><dd>{{ place.difficultyLevel }}</dd></div>
              <div *ngIf="place.minimumAge != null || place.maximumAge != null"><dt>Age</dt><dd>{{ formatRange(place.minimumAge, place.maximumAge, 'years') }}</dd></div>
              <div *ngIf="place.minimumWeight != null || place.maximumWeight != null"><dt>Weight</dt><dd>{{ formatRange(place.minimumWeight, place.maximumWeight, 'kg') }}</dd></div>
              <div *ngIf="place.safetyInformation"><dt>Safety</dt><dd>{{ place.safetyInformation }}</dd></div>
              <div *ngIf="place.accessibilityInformation"><dt>Accessibility</dt><dd>{{ place.accessibilityInformation }}</dd></div>
              <div *ngIf="place.contactPhone"><dt>Contact</dt><dd><a [href]="'tel:' + place.contactPhone">{{ place.contactPhone }}</a></dd></div>
              <div *ngIf="place.cancellationInformation"><dt>Cancellation</dt><dd>{{ place.cancellationInformation }}</dd></div>
              <div><dt>Source</dt><dd>{{ place.sourceName || result?.provider }}</dd></div>
              <div *ngIf="place.sourceLastCheckedAt"><dt>Last checked</dt><dd>{{ place.sourceLastCheckedAt | date:'medium' }}</dd></div>
              <div *ngIf="place.imageAttribution"><dt>Image credit</dt><dd>{{ place.imageAttribution }}{{ place.imageLicense ? ' · ' + place.imageLicense : '' }}</dd></div>
            </dl>
            <div class="detail-lists" *ngIf="place.inclusions?.length || place.exclusions?.length || place.thingsToCarry?.length">
              <section *ngIf="place.inclusions?.length"><h3>Inclusions</h3><ul><li *ngFor="let item of place.inclusions">{{ item }}</li></ul></section>
              <section *ngIf="place.exclusions?.length"><h3>Exclusions</h3><ul><li *ngFor="let item of place.exclusions">{{ item }}</li></ul></section>
              <section *ngIf="place.thingsToCarry?.length"><h3>Things to carry</h3><ul><li *ngFor="let item of place.thingsToCarry">{{ item }}</li></ul></section>
            </div>
            <div class="detail-actions">
              <a *ngIf="place.sourceUrl" class="btn secondary" [href]="place.sourceUrl" target="_blank" rel="noopener noreferrer">View source ↗</a>
              <a *ngIf="place.bookingUrl" class="btn secondary" [href]="place.bookingUrl" target="_blank" rel="noopener noreferrer">Book with provider ↗</a>
              <button type="button" class="btn primary" (click)="openMapRoute(place)">Open map route ↗</button>
              <button *ngIf="canSelectPlaces && !isAlreadySaved(place)" type="button" class="btn primary" (click)="addPlace(place)">Add to Trip</button>
              <button *ngIf="canSelectPlaces" type="button" class="btn primary" (click)="addPlaceToItinerary(place)">Add to Itinerary</button>
            </div>
          </div>
        </article>
      </div>
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
    .field small { color:#94a3b8; font-size:.62rem; font-weight:700; }
    .use-trip-link { align-self:flex-start; padding:0; border:0; color:#2563eb; background:transparent; font-size:.62rem; font-weight:800; cursor:pointer; text-align:left; }
    .use-trip-link:hover { text-decoration:underline; }
    .field input,.field select { min-width:0; padding:.68rem .72rem; border:1px solid #cbd5e1; border-radius:9px; color:#0f172a; background:#fff; font:inherit; font-weight:600; }
    .field input:focus,.field select:focus { outline:2px solid #bfdbfe; border-color:#2563eb; }
    .destination-field { position:relative; }
    .destination-input-row { display:flex; gap:.35rem; }
    .destination-input-row input { flex:1; }
    .location-button { display:grid; place-items:center; width:42px; border:1px solid #bfdbfe; border-radius:9px; color:#2563eb; background:#eff6ff; cursor:pointer; }
    .suggestions { position:absolute; top:100%; left:0; right:0; z-index:60; overflow:hidden; margin-top:.25rem; border:1px solid #cbd5e1; border-radius:9px; background:#fff; box-shadow:0 14px 30px rgba(15,23,42,.16); }
    .suggestions button { display:flex; width:100%; gap:.45rem; padding:.6rem; border:0; border-bottom:1px solid #f1f5f9; background:#fff; text-align:left; cursor:pointer; }
    .suggestions button:hover { background:#eff6ff; }
    .suggestions span:last-child { display:flex; flex-direction:column; }
    .suggestions small { color:#64748b; font-size:.58rem; }
    .btn { display:inline-flex; align-items:center; justify-content:center; gap:.35rem; padding:.68rem .85rem; border:0; border-radius:9px; font-weight:850; cursor:pointer; }
    .btn.primary { color:#fff; background:#2563eb; }
    .btn.secondary { color:#334155; background:#e2e8f0; }
    .btn:disabled { opacity:.55; cursor:not-allowed; }
    .search-btn { min-height:41px; white-space:nowrap; }
    .type-tabs { display:flex; gap:.4rem; overflow-x:auto; padding:.35rem 0 .9rem; scrollbar-width:thin; }
    .type-tabs button { display:inline-flex; align-items:center; gap:.28rem; flex:0 0 auto; padding:.48rem .7rem; border:1px solid #cbd5e1; border-radius:999px; color:#475569; background:#fff; font-size:.68rem; font-weight:800; cursor:pointer; }
    .type-tabs button.active { color:#fff; border-color:#2563eb; background:#2563eb; }
    .type-tabs .material-symbols-outlined { font-size:.9rem; }

    .casual-search-note,.browse-only-banner { display:flex; align-items:flex-start; gap:.55rem; padding:.75rem .9rem; margin-bottom:.7rem; border:1px solid #dbeafe; border-radius:10px; color:#1e3a8a; background:#eff6ff; font-size:.73rem; }
    .casual-search-note div,.browse-only-banner div { display:flex; flex-direction:column; gap:.12rem; }
    .casual-search-note .material-symbols-outlined,.browse-only-banner .material-symbols-outlined { color:#2563eb; font-size:1rem; }
    .message { display:flex; gap:.55rem; align-items:center; padding:.75rem .9rem; margin-bottom:1rem; border-radius:10px; font-size:.78rem; }
    .message div { display:flex; flex-direction:column; gap:.1rem; }
    .message.error { color:#991b1b; background:#fef2f2; border:1px solid #fecaca; }
    .message.success { color:#166534; background:#f0fdf4; border:1px solid #bbf7d0; }
    .data-warning { display:flex; align-items:flex-start; gap:.55rem; padding:.72rem .85rem; margin-bottom:.8rem; border:1px solid #fde68a; border-radius:10px; color:#854d0e; background:#fffbeb; font-size:.7rem; }
    .data-warning div { display:flex; flex-direction:column; gap:.16rem; }
    .data-warning .material-symbols-outlined { font-size:1rem; }

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
    .catalogue-layout { display:grid; grid-template-columns:220px minmax(0,1fr); gap:.85rem; }
    .catalogue-filters { display:flex; flex-direction:column; gap:.65rem; align-self:start; padding:.8rem; border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc; }
    .filter-heading { display:flex; align-items:center; justify-content:space-between; }
    .filter-heading button { padding:0; border:0; color:#2563eb; background:transparent; font-size:.65rem; font-weight:800; cursor:pointer; }
    .catalogue-filters label { display:flex; flex-direction:column; gap:.25rem; color:#64748b; font-size:.65rem; font-weight:750; }
    .catalogue-filters select,.catalogue-filters input { min-width:0; padding:.45rem .5rem; border:1px solid #cbd5e1; border-radius:7px; color:#334155; background:#fff; font-size:.67rem; }
    .catalogue-filters input[type=range] { padding:0; }
    .catalogue-filters .check-filter { flex-direction:row; align-items:center; }
    .catalogue-filters .check-filter input { width:auto; }
    .range-row { display:grid; grid-template-columns:1fr 1fr; gap:.35rem; }
    .apply-filter { width:100%; }
    .catalogue-main { min-width:0; }
    .sort-filter { display:flex; justify-content:flex-end; align-items:center; gap:.4rem; margin-bottom:.65rem; color:#64748b; font-size:.67rem; }
    .sort-filter select { padding:.42rem .5rem; border:1px solid #cbd5e1; border-radius:7px; background:#fff; }
    .mobile-filter-toggle { display:none; }

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
    .activity-type-badge { position:absolute; left:.65rem; top:.6rem; padding:.25rem .48rem; border-radius:999px; color:#fff; background:rgba(37,99,235,.9); backdrop-filter:blur(5px); font-size:.6rem; font-weight:850; }
    .verification-badge { position:absolute; right:.6rem; bottom:.6rem; padding:.24rem .42rem; border-radius:999px; color:#334155; background:rgba(255,255,255,.92); font-size:.56rem; font-weight:850; }
    .verification-badge.verified { color:#166534; background:#dcfce7; }
    .verification-badge.expired { color:#92400e; background:#fef3c7; }
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
    .cost-badge { color:#15803d !important; background:#dcfce7; padding:.2rem .45rem; border-radius:6px; font-weight:850; font-size:.68rem; }
    .cost-badge .material-symbols-outlined { color:#166534 !important; font-size:.85rem; }
    .description { min-height:42px; margin:.45rem 0; color:#475569; font-size:.72rem; line-height:1.45; }
    .opening-hours { display:flex; gap:.3rem; align-items:flex-start; color:#64748b; font-size:.66rem; }
    .opening-hours .material-symbols-outlined { font-size:.8rem; color:#2563eb; }
    .open-status { margin:.3rem 0; color:#b91c1c; font-size:.64rem; font-weight:850; }
    .open-status.open { color:#15803d; }
    .source-row { display:flex; flex-direction:column; gap:.12rem; margin-top:.45rem; color:#64748b; font-size:.58rem; }
    .card-actions { display:flex; flex-direction:column; gap:.5rem; margin-top:.75rem; padding-top:.7rem; border-top:1px solid #f1f5f9; }
    .quick-actions,.trip-actions { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.5rem; }
    .provider-actions { display:flex; flex-wrap:wrap; gap:.35rem .75rem; padding:.1rem .15rem; }
    .card-action,.provider-action { min-width:0; font:inherit; }
    .card-action { display:inline-flex; align-items:center; justify-content:center; gap:.35rem; min-height:38px; padding:.5rem .6rem; border-radius:9px; font-size:.67rem; font-weight:850; line-height:1.15; white-space:nowrap; cursor:pointer; transition:background-color 150ms ease,border-color 150ms ease,color 150ms ease,transform 150ms ease; }
    .card-action:hover:not(:disabled) { transform:translateY(-1px); }
    .card-action .material-symbols-outlined,.provider-action .material-symbols-outlined { flex:0 0 auto; font-size:.92rem; }
    .card-action .external-icon,.provider-action .external-icon { font-size:.7rem; }
    .secondary-action { border:1px solid #bfdbfe; color:#1d4ed8; background:#eff6ff; }
    .secondary-action:hover { border-color:#60a5fa; background:#dbeafe; }
    .primary-action { border:1px solid #2563eb; color:#fff; background:#2563eb; box-shadow:0 3px 8px rgba(37,99,235,.18); }
    .primary-action:hover:not(:disabled) { border-color:#1d4ed8; background:#1d4ed8; }
    .card-action:focus-visible,.provider-action:focus-visible { outline:3px solid rgba(59,130,246,.25); outline-offset:2px; }
    .card-action:disabled { opacity:.5; cursor:not-allowed; box-shadow:none; }
    .provider-action { display:inline-flex; align-items:center; gap:.25rem; color:#2563eb; text-decoration:none; font-size:.63rem; font-weight:800; }
    .provider-action:hover { color:#1e40af; text-decoration:underline; }
    .booking-action { color:#7c3aed; }
    .booking-action:hover { color:#6d28d9; }
    .free-badge { color:#0369a1 !important; background:#e0f2fe !important; }
    .unknown-badge { color:#475569 !important; background:#f1f5f9 !important; }
    .unknown-badge .material-symbols-outlined { color:#64748b !important; }
    .day-picker { display:flex; align-items:center; justify-content:space-between; gap:.6rem; margin-top:.65rem; padding:.5rem .6rem; border-radius:8px; color:#475569; background:#f8fafc; font-size:.67rem; font-weight:800; }
    .day-picker select { padding:.32rem .42rem; border:1px solid #cbd5e1; border-radius:6px; background:#fff; }

    .selection-bar { position:sticky; bottom:14px; z-index:20; display:flex; align-items:center; gap:1rem; padding:.8rem 1rem; margin-top:-70px; border:1px solid #bfdbfe; border-radius:14px; background:rgba(255,255,255,.96); box-shadow:0 14px 35px rgba(15,23,42,.16); backdrop-filter:blur(10px); }
    .selection-bar > div:first-child { min-width:180px; }
    .selection-bar strong { display:block; font-size:.78rem; }
    .selection-bar span { color:#64748b; font-size:.65rem; }
    .plan-buttons { display:flex; align-items:center; gap:.35rem; margin-left:auto; }
    .plan-buttons button { border:1px solid #cbd5e1; border-radius:7px; padding:.38rem .52rem; color:#334155; background:#fff; font-size:.64rem; font-weight:800; cursor:pointer; }
    .plan-buttons button:hover { border-color:#93c5fd; color:#2563eb; }
    .selection-trip-picker { display:flex; flex-direction:column; gap:.25rem; min-width:165px; color:#475569; font-size:.65rem; font-weight:800; }
    .selection-trip-picker select { padding:.48rem .55rem; border:1px solid #cbd5e1; border-radius:7px; color:#0f172a; background:#fff; font-size:.7rem; font-weight:700; }
    .bulk-actions { display:flex; gap:.45rem; }
    .pagination { display:flex; justify-content:center; align-items:center; gap:.7rem; margin:1rem 0 6rem; color:#64748b; font-size:.7rem; }
    .pagination button { padding:.45rem .65rem; border:1px solid #cbd5e1; border-radius:7px; color:#2563eb; background:#fff; cursor:pointer; }
    .pagination button:disabled { opacity:.45; cursor:not-allowed; }

    .detail-backdrop { position:fixed; inset:0; z-index:1000; display:grid; place-items:center; padding:1rem; background:rgba(15,23,42,.62); }
    .detail-dialog { position:relative; overflow:hidden; width:min(760px,100%); max-height:90vh; overflow-y:auto; border-radius:16px; background:#fff; box-shadow:0 24px 70px rgba(15,23,42,.3); }
    .detail-gallery { display:grid; grid-template-columns:2fr 1fr 1fr; gap:3px; height:260px; background:#f1f5f9; }
    .detail-gallery img { width:100%; height:100%; object-fit:cover; min-width:0; }
    .detail-content { padding:1.2rem; }
    .detail-content h2 { margin:.25rem 0 .5rem; }
    .detail-content > p { color:#475569; line-height:1.55; }
    .detail-content dl { display:grid; grid-template-columns:1fr 1fr; gap:.65rem; margin:1rem 0; }
    .detail-content dl div { padding:.65rem; border-radius:8px; background:#f8fafc; }
    .detail-content dt { color:#64748b; font-size:.62rem; font-weight:800; text-transform:uppercase; }
    .detail-content dd { margin:.2rem 0 0; color:#0f172a; font-size:.75rem; }
    .price-table { margin:1rem 0; padding:.8rem; border:1px solid #dbeafe; border-radius:10px; }
    .price-table h3,.detail-lists h3 { margin:0 0 .5rem; font-size:.8rem; }
    .price-table > div { display:grid; grid-template-columns:1fr auto; gap:.12rem .6rem; padding:.45rem 0; border-bottom:1px solid #f1f5f9; font-size:.7rem; }
    .price-table small { color:#64748b; }
    .price-table a { color:#2563eb; text-decoration:none; text-align:right; }
    .detail-lists { display:grid; grid-template-columns:repeat(3,1fr); gap:.6rem; margin:1rem 0; }
    .detail-lists section { padding:.7rem; border-radius:9px; background:#f8fafc; }
    .detail-lists ul { margin:0; padding-left:1rem; color:#475569; font-size:.7rem; }
    .detail-close { position:absolute; top:.7rem; right:.7rem; z-index:1; display:grid; place-items:center; width:34px; height:34px; border:0; border-radius:50%; color:#0f172a; background:rgba(255,255,255,.92); cursor:pointer; }
    .detail-actions { display:flex; justify-content:flex-end; gap:.5rem; }

    @media(max-width:1080px){
      .places-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .catalogue-layout { grid-template-columns:190px minmax(0,1fr); }
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
      .catalogue-layout { display:block; }
      .mobile-filter-toggle { display:inline-flex; align-items:center; gap:.3rem; margin-bottom:.6rem; padding:.5rem .7rem; border:1px solid #cbd5e1; border-radius:8px; background:#fff; }
      .catalogue-filters { display:none; margin-bottom:.7rem; }
      .catalogue-filters.open { display:flex; }
      .detail-gallery { height:190px; grid-template-columns:1fr; }
      .detail-gallery img:not(:first-child) { display:none; }
      .detail-content dl { grid-template-columns:1fr; }
      .detail-lists { grid-template-columns:1fr; }
      .card-action { min-height:42px; font-size:.72rem; }
    }
    @media(max-width:380px){
      .quick-actions,.trip-actions { grid-template-columns:1fr; }
    }
  `]
})
export class DestinationDiscoveryComponent implements OnInit, OnDestroy {
  private readonly discoveryService = inject(DiscoveryService);
  private readonly placeService = inject(PlaceService);
  private readonly itineraryService = inject(ItineraryService);
  private readonly tripService = inject(TripService);
  private readonly route = inject(ActivatedRoute);

  @Input() tripId = 0;
  @Input() destination = '';
  @Input() startDate = '';
  @Input() endDate = '';
  @Input() canEdit = true;

  @Output() placesChanged = new EventEmitter<void>();
  @Output() itineraryChanged = new EventEmitter<void>();

  activeTripId = 0;
  searchDestination = '';
  activeStartDate = '';
  activeEndDate = '';
  availableTrips: Trip[] = [];

  radiusKm = 25;
  category: DiscoveryCategory = 'ALL';
  filterText = '';
  itemTypeFilter: DiscoveryItemType | 'ALL' = 'ALL';
  priceStatusFilter: DiscoveryPriceStatus | 'ALL' = 'ALL';
  sortOrder: NonNullable<DiscoverySearchFilters['sort']> = 'RELEVANCE';
  subcategoryFilter = '';
  minPriceFilter?: number;
  maxPriceFilter?: number;
  openNowFilter = false;
  familyFriendlyFilter = false;
  difficultyFilter = '';
  maxDurationFilter?: number;
  minRatingFilter?: number;
  filtersOpen = false;
  suggestions: DiscoverySuggestion[] = [];
  isLocating = false;
  private suggestionTimer?: number;

  result: DestinationDiscoveryResponse | null = null;
  selectedDetail: DiscoveredPlace | null = null;
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
    'RIVER',
    'BEACH',
    'VIEWPOINT',
    'TEMPLE',
    'CHURCH',
    'MUSEUM',
    'PARK',
    'WILDLIFE',
    'ADVENTURE',
    'ENTERTAINMENT',
    'FAMILY',
    'CULTURAL',
    'NIGHTLIFE',
    'WELLNESS',
    'TRANSPORT',
    'SHOPPING',
    'FOOD',
    'STAY',
    'EVENT',
    'HISTORICAL'
  ];

  readonly itemTypeTabs: Array<{ value: DiscoveryItemType | 'ALL'; label: string; icon: string }> = [
    { value: 'ALL', label: 'All', icon: 'explore' },
    { value: 'PLACE', label: 'Places', icon: 'attractions' },
    { value: 'ACTIVITY', label: 'Activities', icon: 'hiking' },
    { value: 'FOOD', label: 'Food', icon: 'restaurant' },
    { value: 'STAY', label: 'Stays', icon: 'hotel' },
    { value: 'EVENT', label: 'Events', icon: 'event' },
    { value: 'TOUR_SERVICE', label: 'Tour essentials', icon: 'local_taxi' }
  ];

  get embeddedMode(): boolean {
    return this.tripId > 0;
  }

  get editableTrips(): Trip[] {
    return this.availableTrips.filter(
      (trip) => trip.userRole === 'OWNER' || trip.userRole === 'EDITOR'
    );
  }

  get selectedTrip(): Trip | undefined {
    return this.availableTrips.find((item) => item.id === this.activeTripId);
  }

  get effectiveCanEdit(): boolean {
    if (this.embeddedMode) return this.canEdit;
    return this.selectedTrip?.userRole === 'OWNER' || this.selectedTrip?.userRole === 'EDITOR';
  }

  get canSelectPlaces(): boolean {
    return this.embeddedMode ? this.effectiveCanEdit : this.editableTrips.length > 0;
  }

  get filteredPlaces(): DiscoveredPlace[] {
    const term = this.filterText.trim().toLowerCase();
    if (!term) return this.result?.places ?? [];
    return (this.result?.places ?? []).filter((place) =>
      place.name.toLowerCase().includes(term)
      || place.category.toLowerCase().includes(term)
      || (place.activityType ?? '').toLowerCase().includes(term)
      || (place.description ?? '').toLowerCase().includes(term)
      || (place.estimatedCostPerPerson != null && place.estimatedCostPerPerson.toString().includes(term))
    );
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  get availableDayNumbers(): number[] {
    const trip = this.availableTrips.find((item) => item.id === this.activeTripId);
    const start = this.activeStartDate || trip?.startDate;
    const end = this.activeEndDate || trip?.endDate;

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
      this.activeEndDate = this.endDate;
      void this.loadSavedPlaces();
      if (this.searchDestination.trim().length >= 2) {
        this.discover();
      }
      return;
    }

    this.loadTrips();

    this.route.queryParams.subscribe((params) => {
      const searchParam = params['search'] || params['q'];
      if (searchParam && searchParam.trim().length >= 2) {
        this.searchDestination = searchParam.trim();
        this.discover();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.suggestionTimer) window.clearTimeout(this.suggestionTimer);
  }

  onDestinationInput(): void {
    if (this.suggestionTimer) window.clearTimeout(this.suggestionTimer);
    const query = this.searchDestination.trim();
    if (query.length < 2) {
      this.suggestions = [];
      return;
    }
    this.suggestionTimer = window.setTimeout(() => {
      this.discoveryService.getSuggestions(query).subscribe({
        next: (suggestions) => this.suggestions = suggestions,
        error: () => this.suggestions = []
      });
    }, 300);
  }

  selectSuggestion(suggestion: DiscoverySuggestion): void {
    this.searchDestination = suggestion.label;
    this.suggestions = [];
    this.discover();
  }

  useCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.errorMessage = 'Current location is not supported by this browser.';
      return;
    }
    this.isLocating = true;
    navigator.geolocation.getCurrentPosition(
      (position) => this.discoveryService.reverseGeocode(position.coords.latitude, position.coords.longitude).subscribe({
        next: (location) => {
          this.isLocating = false;
          this.searchDestination = location.label;
          this.discover();
        },
        error: () => {
          this.isLocating = false;
          this.errorMessage = 'TripMate could not resolve this location inside India.';
        }
      }),
      () => {
        this.isLocating = false;
        this.errorMessage = 'Location permission was not granted.';
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }

  selectItemType(value: DiscoveryItemType | 'ALL'): void {
    this.itemTypeFilter = value;
    if (this.searchDestination.trim().length >= 2) this.discover();
  }

  clearFilters(): void {
    this.category = 'ALL';
    this.subcategoryFilter = '';
    this.radiusKm = 25;
    this.minPriceFilter = undefined;
    this.maxPriceFilter = undefined;
    this.priceStatusFilter = 'ALL';
    this.openNowFilter = false;
    this.familyFriendlyFilter = false;
    this.difficultyFilter = '';
    this.maxDurationFilter = undefined;
    this.minRatingFilter = undefined;
    this.sortOrder = 'RELEVANCE';
    if (this.searchDestination.trim().length >= 2) this.discover();
  }

  loadTrips(): void {
    this.tripService.getMyTrips().subscribe({
      next: (trips) => {
        // Global Explore always starts in casual browse mode.
        // Trips are available only as an optional save destination.
        this.availableTrips = trips ?? [];
        this.activeTripId = 0;
        this.savedPlaces = [];
        this.activeStartDate = '';
        this.activeEndDate = '';
      },
      error: () => {
        // Casual destination search must still work even if the user's trips fail to load.
        this.availableTrips = [];
        this.activeTripId = 0;
      }
    });
  }

  selectTrip(value: number | string): void {
    const tripId = Number(value);
    this.activeTripId = Number.isFinite(tripId) ? tripId : 0;
    const trip = this.selectedTrip;

    // Selecting a trip changes only where places will be saved.
    // It must never replace the destination that the user is casually browsing.
    if (trip) {
      this.activeStartDate = trip.startDate;
      this.activeEndDate = trip.endDate;
      void this.loadSavedPlaces();
    } else {
      this.savedPlaces = [];
      this.activeStartDate = '';
      this.activeEndDate = '';
    }

    // Keep selected tourist places when the user chooses/switches the save target.
    // Day assignments are reset because trip duration may differ.
    this.dayAssignments = {};
  }

  useTripDestination(trip: Trip): void {
    this.searchDestination = trip.destination;
    this.discover();
  }

  discover(page = 0): void {
    const destination = this.searchDestination.trim();
    if (destination.length < 2) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.suggestions = [];
    if (page === 0) {
      this.selectedIds.clear();
      this.dayAssignments = {};
    }

    this.discoveryService.discoverPlaces(destination, this.radiusKm, this.category, {
      itemType: this.itemTypeFilter,
      subcategory: this.subcategoryFilter || undefined,
      minPrice: this.minPriceFilter,
      maxPrice: this.maxPriceFilter,
      priceStatus: this.priceStatusFilter,
      openNow: this.openNowFilter,
      familyFriendly: this.familyFriendlyFilter,
      difficulty: this.difficultyFilter || undefined,
      maxDuration: this.maxDurationFilter,
      minRating: this.minRatingFilter,
      sort: this.sortOrder,
      page,
      size: 24
    }).subscribe({
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

  changePage(page: number): void {
    this.discover(Math.max(0, page));
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  async addPlace(place: DiscoveredPlace): Promise<void> {
    if (this.activeTripId > 0 && this.effectiveCanEdit) {
      if (this.isAlreadySaved(place) || this.isSaving) return;

      this.isSaving = true;
      this.errorMessage = '';
      this.successMessage = '';

      try {
        const created = await firstValueFrom(
          this.placeService.createPlace(this.activeTripId, {
            name: place.name,
            category: place.saveCategory,
            latitude: place.latitude,
            longitude: place.longitude,
            estimatedCost: place.estimatedCostPerPerson,
            notes: this.discoveryNotes(place)
          })
        );

        this.savedPlaces = [...this.savedPlaces, created];
        this.selectedIds.delete(place.externalId);
        delete this.dayAssignments[place.externalId];
        this.placesChanged.emit();
        this.successMessage = `${place.name} added to ${this.selectedTrip?.name || 'the trip'}.`;
      } catch (err: any) {
        this.errorMessage = err?.error?.message || 'Unable to add this place to the trip.';
      } finally {
        this.isSaving = false;
      }
      return;
    }

    this.selectedIds.add(place.externalId);
    this.dayAssignments[place.externalId] = this.dayAssignments[place.externalId] || 1;

    if (!this.embeddedMode) {
      this.successMessage = 'Place selected. Choose a trip to add it.';
      this.errorMessage = '';
    }
  }

  async saveSingle(place: DiscoveredPlace): Promise<void> {
    await this.addPlace(place);
  }

  async addPlaceToItinerary(place: DiscoveredPlace): Promise<void> {
    this.selectedIds.add(place.externalId);
    this.dayAssignments[place.externalId] = this.dayAssignments[place.externalId] || 1;

    if (this.activeTripId <= 0) {
      this.successMessage = 'Place selected. Choose an editable trip, then select Save & Add to Itinerary.';
      this.errorMessage = '';
      return;
    }

    if (!this.effectiveCanEdit) {
      this.errorMessage = 'Viewer access is read-only. Choose a trip where you are an Owner or Editor.';
      return;
    }

    await this.saveSelected(true);
    this.selectedDetail = null;
  }

  async saveSelected(addToItinerary: boolean): Promise<void> {
    if (this.selectedIds.size === 0 || this.isSaving) {
      return;
    }

    if (this.activeTripId <= 0 || !this.effectiveCanEdit) {
      this.errorMessage = 'Choose a trip where you have Owner or Editor access before saving places.';
      this.successMessage = '';
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
            estimatedCost: place.estimatedCostPerPerson,
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
          estimatedCost: place.estimatedCostPerPerson,
          displayOrder: day.items.length + 1
        })
      );

      day.items.push({ placeId: saved.id });
    }
  }

  private dateForDay(dayNumber: number): string {
    const base = this.activeStartDate || new Date().toISOString().slice(0, 10);
    const [year, month, day] = base.split('-').map(Number);
    const utc = new Date(Date.UTC(year, month - 1, day + dayNumber - 1));
    return utc.toISOString().slice(0, 10);
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
      `Discovered via ${place.sourceName || this.result?.provider || 'TripMate Discovery'} (${place.category})`,
      `${place.distanceKm.toFixed(1)} km from ${this.searchDestination.trim()}`
    ];
    if (place.activityType) parts.push(`Activity: ${place.activityType}`);
    if (place.priceStatus === 'FREE') {
      parts.push('Source lists entry as free');
    } else if (place.estimatedCostPerPerson != null && place.priceStatus !== 'UNKNOWN') {
      parts.push(`${place.priceStatus === 'ESTIMATED' ? 'Approx. cost' : 'Source-listed price'}: ₹${place.estimatedCostPerPerson}`);
    }
    if (place.openingHours) parts.push(`Hours: ${place.openingHours}`);
    if (place.sourceUrl) parts.push(`Source: ${place.sourceUrl}`);
    if (place.sourceLastCheckedAt) parts.push(`Checked: ${place.sourceLastCheckedAt}`);
    return parts.join(' · ');
  }

  openStreetMapUrl(place: DiscoveredPlace): string {
    return `https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=16/${place.latitude}/${place.longitude}`;
  }

  openMapRoute(place: DiscoveredPlace, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    let url = '';
    if (place.latitude && place.longitude && Math.abs(place.latitude) > 0.0001) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`;
    } else {
      const query = encodeURIComponent(`${place.name} ${this.searchDestination || ''}`);
      url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
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

  formatPlacePrice(place: DiscoveredPlace): string {
    const cost = place.estimatedCostPerPerson;
    if (place.priceStatus === 'FREE') {
      return 'Entry: Free';
    }
    if (cost == null || place.priceStatus === 'UNKNOWN' || !place.priceStatus) {
      return 'Price not verified — check official website';
    }

    const formattedCost = cost.toLocaleString('en-IN');
    const prefix = place.priceStatus === 'ESTIMATED'
      ? 'Approx.'
      : place.priceStatus === 'STARTING_FROM'
        ? 'From'
        : 'Price';
    const unit = this.priceUnit(place.priceType);
    return `${prefix}: ₹${formattedCost}${unit}`;
  }

  formatPriceOption(option: DiscoveryPriceOption): string {
    const amount = option.amount.toLocaleString('en-IN');
    const maximum = option.maximumAmount != null ? `–₹${option.maximumAmount.toLocaleString('en-IN')}` : '';
    const prefix = option.status === 'STARTING_FROM' ? 'From ' : option.status === 'ESTIMATED' ? 'Estimated ' : '';
    return `${prefix}₹${amount}${maximum}${this.priceUnit(option.priceType)}`;
  }

  formatRange(minimum: number | undefined, maximum: number | undefined, unit: string): string {
    if (minimum != null && maximum != null) return `${minimum}–${maximum} ${unit}`;
    if (minimum != null) return `Minimum ${minimum} ${unit}`;
    return `Maximum ${maximum} ${unit}`;
  }

  priceStatusLabel(place: DiscoveredPlace): string {
    switch (place.priceStatus) {
      case 'VERIFIED': return 'Verified';
      case 'FREE': return 'Free confirmed';
      case 'STARTING_FROM': return 'Starting from';
      case 'ESTIMATED': return 'Estimated';
      default: return 'Price unverified';
    }
  }

  private priceUnit(priceType: DiscoveredPlace['priceType']): string {
    switch (priceType) {
      case 'PER_NIGHT': return ' / night';
      case 'PER_ACTIVITY': return ' / activity';
      case 'PER_VEHICLE': return ' / vehicle';
      case 'PER_PERSON': return ' / person';
      default: return '';
    }
  }

  formatItemType(itemType?: DiscoveryItemType): string {
    if (!itemType) return 'Place';
    return itemType
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  openDetails(place: DiscoveredPlace): void {
    this.selectedDetail = place;
    this.discoveryService.getPlace(place.externalId).subscribe({
      next: (detail) => this.selectedDetail = detail,
      error: () => { /* Search-card data remains available if the detail cache expired. */ }
    });
  }

  closeDetails(): void {
    this.selectedDetail = null;
  }

  categoryIcon(category: DiscoveredPlace['category']): string {
    switch (category) {
      case 'WATERFALL': return 'water';
      case 'LAKE': return 'waves';
      case 'RIVER': return 'water';
      case 'BEACH': return 'beach_access';
      case 'VIEWPOINT': return 'landscape';
      case 'TEMPLE': return 'temple_hindu';
      case 'CHURCH': return 'church';
      case 'MUSEUM': return 'museum';
      case 'PARK': return 'park';
      case 'WILDLIFE': return 'pets';
      case 'NATURE': return 'forest';
      case 'ADVENTURE': return 'hiking';
      case 'ENTERTAINMENT': return 'attractions';
      case 'FAMILY': return 'family_restroom';
      case 'CULTURAL': return 'theater_comedy';
      case 'NIGHTLIFE': return 'nightlife';
      case 'WELLNESS': return 'spa';
      case 'TRANSPORT': return 'local_taxi';
      case 'SHOPPING': return 'shopping_bag';
      case 'FOOD': return 'restaurant';
      case 'STAY': return 'hotel';
      case 'EVENT': return 'event';
      case 'HISTORICAL': return 'castle';
      default: return 'attractions';
    }
  }

  getPlaceImage(place: DiscoveredPlace): string {
    const image = place.primaryImageUrl || place.imageUrl;
    if (image && place.imageExact !== false && image.startsWith('http')) {
      return image;
    }
    return '/place-placeholder.svg';
  }

  handleImageError(event: Event, _place: DiscoveredPlace): void {
    const img = event.target as HTMLImageElement;
    if (img && !img.src.endsWith('/place-placeholder.svg')) {
      img.src = '/place-placeholder.svg';
    }
  }

  trackPlace(_: number, place: DiscoveredPlace): string {
    return place.externalId;
  }
}
