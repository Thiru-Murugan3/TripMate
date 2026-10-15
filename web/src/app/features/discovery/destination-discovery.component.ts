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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';

import {
  DiscoveredPlace,
  DestinationDiscoveryResponse,
  DiscoveryCategory,
  DiscoveryImage,
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
import { IndiaCatalogueComponent } from '../india-catalogue/india-catalogue.component';
import { DestinationOverviewComponent, DestinationPhoto } from './destination-overview.component';
import { destinationPhotography } from './destination-photography';
import { CataloguePlace } from '../india-catalogue/india-catalogue.service';
import { PlanningPlace, catalogueKey, cataloguePlanningPlace } from '../india-catalogue/catalogue-selection';
import { TripService } from '../../core/services/trip.service';

@Component({
  selector: 'app-destination-discovery',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IndiaCatalogueComponent, DestinationOverviewComponent],
  template: `
    <section class="discover-page">
      <div class="discover-hero">
        <div>
          <span class="guide-breadcrumb">India <span aria-hidden="true">›</span> {{ searchDestination || 'Discover your next destination' }}</span>
        </div>
        <a *ngIf="!catalogueOnly" routerLink="/explore/india">Browse by state →</a>
        <a *ngIf="catalogueOnly" routerLink="/explore">Back to destination discovery</a>
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
            *ngIf="!catalogueOnly && selectedTrip as trip"
            type="button"
            class="use-trip-link"
            (click)="useTripDestination(trip)"
          >
            Use {{ trip.destination }} as search destination
          </button>
        </label>

        <div *ngIf="!catalogueOnly" class="field destination-field">
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

        <label *ngIf="!catalogueOnly" class="field">
          <span>Category</span>
          <select [(ngModel)]="category" [ngModelOptions]="{ standalone: true }">
            <option *ngFor="let item of categories" [value]="item">
              {{ formatCategory(item) }}
            </option>
          </select>
        </label>

        <button
          *ngIf="!catalogueOnly"
          type="button"
          class="btn primary search-btn"
          [disabled]="isLoading || searchDestination.trim().length < 2"
          (click)="discover()"
        >
          <span class="material-symbols-outlined">search</span>
          {{ isLoading ? 'Searching...' : 'Find Tourist Places' }}
        </button>
      </div>

      <nav *ngIf="!catalogueOnly" class="type-tabs" aria-label="Catalogue type">
        <button *ngFor="let tab of itemTypeTabs" type="button" [class.active]="itemTypeFilter === tab.value" [attr.aria-pressed]="itemTypeFilter === tab.value" (click)="selectItemType(tab.value)">
          <span class="material-symbols-outlined">{{ tab.icon }}</span>{{ tab.label }}
        </button>
      </nav>

      <app-destination-overview *ngIf="!catalogueOnly && !showCatalogueFallback && !isLoading"
        [title]="guideTitle" [photos]="destinationPhotos" />

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

      <app-india-catalogue *ngIf="catalogueOnly || showCatalogueFallback" [embedded]="true" [destination]="catalogueOnly ? '' : catalogueDestination"
        [discoveryCategory]="catalogueOnly ? 'ALL' : category"
        [selectable]="canSelectPlaces" [saving]="isSaving" [selectedIds]="selectedIds"
        [dayNumbers]="activeTripId > 0 ? availableDayNumbers : []" [dayAssignments]="dayAssignments"
        (selectionChange)="selectCataloguePlace($event)" (dayChange)="setCatalogueDay($event)" (scopeChange)="changeCatalogueScope($event)" />

      <div *ngIf="displayedResult as data" class="results-container">
        <div class="essential-heading"><h2>Essential {{ guideTitle }}</h2><p>Find your kind of adventure.</p></div>
        <nav class="interest-chips" aria-label="Explore interests">
          <button *ngFor="let interest of guideInterests" type="button" [class.active]="category === interest.value" [attr.aria-pressed]="category === interest.value"
            (click)="chooseInterest(interest.value)">{{ interest.label }}</button>
        </nav>
        <details *ngIf="data.warnings?.length" class="source-notes">
          <summary>Availability notes</summary>
          <p *ngFor="let warning of data.warnings">{{ warning }}</p>
        </details>

        <div class="result-toolbar">
          <div>
            <h3>{{ data.resultCount }} nearby places & activities</h3>

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

        <button type="button" class="mobile-filter-toggle" (click)="filtersOpen = !filtersOpen" [attr.aria-expanded]="filtersOpen">
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

        <section *ngFor="let section of discoverySections; trackBy: trackSection" class="guide-section" [attr.aria-label]="section.title">
        <div class="section-heading"><h3>{{ section.title }}</h3><button type="button" (click)="selectItemType(section.type)">See all</button></div>
        <div class="places-grid" tabindex="0" [attr.aria-label]="section.title + ' places'">
          <article
            *ngFor="let place of section.places; trackBy: trackPlace"
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
                  [disabled]="isSaving"
                  (change)="toggleSelection(place)"
                  [attr.aria-label]="'Select ' + place.name"
                />
              </label>
            </div>

            <p class="image-credit" *ngIf="creditedImages(place)[0] as image">
              <a [href]="image.sourcePage" target="_blank" rel="noopener noreferrer">{{ image.attribution }}</a>
              · {{ image.license }}
            </p>
            <div class="place-body">
              <div class="title-row">
                <h3>{{ place.name }}</h3>
                <span *ngIf="isAlreadySaved(place)" class="saved-pill">
                  <span class="material-symbols-outlined">bookmark_added</span>
                  Saved
                </span>
              </div>
              <p *ngIf="place.rating != null" class="place-rating"><span aria-hidden="true">●</span> {{ place.rating | number:'1.0-1' }}<span *ngIf="place.ratingCount != null"> ({{ place.ratingCount }})</span><small> · {{ place.sourceName || data.provider }}</small></p>

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

                <details *ngIf="place.officialWebsite || place.website || place.bookingUrl" class="provider-links"><summary>Provider links</summary><div class="provider-actions">
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
                </div></details>

                <div *ngIf="canSelectPlaces" class="trip-actions">
                  <button
                    type="button"
                    class="card-action primary-action full-action"
                    [disabled]="isSaving"
                    (click)="addPlaceToItinerary(place)"
                  >
                    <span class="material-symbols-outlined">event_note</span>
                    <span>Add to itinerary</span>
                  </button>
                </div>
              </div>

              <label
                *ngIf="effectiveCanEdit && activeTripId > 0"
                class="day-picker"
              >
                <span>Visit on</span>
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
        </section>

        <div *ngIf="(data.totalPages || 0) > 1" class="pagination">
          <button type="button" [disabled]="(data.page || 0) === 0 || isLoading" (click)="changePage((data.page || 0) - 1)">← Previous</button>
          <span>Page {{ (data.page || 0) + 1 }} of {{ data.totalPages }}</span>
          <button type="button" [disabled]="(data.page || 0) + 1 >= (data.totalPages || 0) || isLoading" (click)="changePage((data.page || 0) + 1)">Next →</button>
        </div>
          </main>
        </div>
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

          <div *ngIf="activeTripId > 0 && !hasCatalogueSelection" class="plan-buttons">
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

      <div *ngIf="selectedDetail as place" class="detail-backdrop" (click)="closeDetails()">
        <article class="detail-dialog" role="dialog" aria-modal="true" [attr.aria-label]="place.name" (click)="$event.stopPropagation()">
          <button type="button" class="detail-close" aria-label="Close details" (click)="closeDetails()">
            <span class="material-symbols-outlined">close</span>
          </button>
          <div class="detail-gallery">
            <img *ngIf="!creditedImages(place).length" src="/place-placeholder.svg" [alt]="place.name" />
            <figure *ngFor="let image of creditedImages(place).slice(0, 4)">
              <img [src]="image.url" [alt]="place.name" loading="lazy" (error)="handleImageError($event, place)" />
              <figcaption><a [href]="image.sourcePage" target="_blank" rel="noopener noreferrer">{{ image.attribution }}</a> · {{ image.license }}</figcaption>
            </figure>
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
              <div *ngIf="place.openNow != null"><dt>Status</dt><dd>{{ place.openNow ? 'Open now' : 'Closed now' }}</dd></div>
              <div *ngIf="place.confidenceScore != null"><dt>Data confidence</dt><dd>{{ place.confidenceScore * 100 | number:'1.0-0' }}%</dd></div>
              <div><dt>Source</dt><dd>{{ place.sourceName || result?.provider }}</dd></div>
              <div *ngIf="place.sourceLastCheckedAt"><dt>Last checked</dt><dd>{{ place.sourceLastCheckedAt | date:'medium' }}</dd></div>
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
              <button *ngIf="canSelectPlaces" type="button" class="btn primary" (click)="addPlaceToItinerary(place)">
                {{ isAlreadySaved(place) ? 'Add Saved Place to Itinerary' : 'Save & Add to Itinerary' }}
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  `,
  styleUrls: ['./destination-discovery.base.scss', './destination-guide.scss']
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
  catalogueDestination = '';
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
  private searchSubscription?: Subscription;
  private detailSubscription?: Subscription;
  private suggestionSubscription?: Subscription;
  private routeSubscription?: Subscription;

  result: DestinationDiscoveryResponse | null = null;
  selectedDetail: DiscoveredPlace | null = null;
  savedPlaces: Place[] = [];
  selectedIds = new Set<string>();
  private selectedListings = new Map<string, PlanningPlace>();
  private selectionDestination = '';
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
    { value: 'ALL', label: 'Overview', icon: 'explore' },
    { value: 'PLACE', label: 'Things to do', icon: 'attractions' },
    { value: 'ACTIVITY', label: 'Activities', icon: 'hiking' },
    { value: 'FOOD', label: 'Restaurants', icon: 'restaurant' },
    { value: 'STAY', label: 'Hotels', icon: 'hotel' },
    { value: 'EVENT', label: 'Events', icon: 'event' },
    { value: 'TOUR_SERVICE', label: 'Tour essentials', icon: 'local_taxi' }
  ];

  get embeddedMode(): boolean {
    return this.tripId > 0;
  }

  get editableTrips(): Trip[] {
    return this.availableTrips.filter(
      (trip) => trip.userRole === 'OWNER' || trip.userRole === 'EDITOR' || trip.userRole === 'PLANNER'
    );
  }

  get selectedTrip(): Trip | undefined {
    return this.availableTrips.find((item) => item.id === this.activeTripId);
  }

  get effectiveCanEdit(): boolean {
    if (this.embeddedMode) return this.canEdit;
    return this.selectedTrip?.userRole === 'OWNER' || this.selectedTrip?.userRole === 'EDITOR' || this.selectedTrip?.userRole === 'PLANNER';
  }

  get canSelectPlaces(): boolean {
    return this.embeddedMode ? this.effectiveCanEdit : this.editableTrips.length > 0;
  }
  get catalogueOnly(): boolean { return this.route.snapshot?.data?.['catalogueOnly'] === true; }
  get guideTitle(): string { return (this.result?.resolvedDestination || this.searchDestination || 'India').split(',')[0].trim(); }
  get destinationPhotos(): DestinationPhoto[] {
    const seen = new Set<string>();
    return [...destinationPhotography(this.guideTitle), ...(this.displayedResult?.places ?? []).flatMap(place => this.creditedImages(place).map(image => ({
      url:image.url, name:place.name, attribution:image.attribution!, license:image.license!, sourcePage:image.sourcePage!
    })))].filter(photo => { if(seen.has(photo.url)) return false; seen.add(photo.url); return true; }).slice(0,8);
  }
  readonly guideInterests: Array<{label:string;value:DiscoveryCategory}> = [
    {label:'Essentials',value:'ALL'},{label:'Outdoors',value:'NATURE'},{label:'Museums',value:'MUSEUM'},
    {label:'History',value:'HISTORICAL'},{label:'Family friendly',value:'FAMILY'}
  ];
  chooseInterest(value: DiscoveryCategory): void { this.category=value; this.discover(); }
  get discoverySections(): Array<{title:string;type:DiscoveryItemType;places:DiscoveredPlace[]}> {
    const groups: Array<{title:string;type:DiscoveryItemType;places:DiscoveredPlace[]}> = [
      {title:'Things to do',type:'PLACE',places:[]},{title:'Experiences & activities',type:'ACTIVITY',places:[]},
      {title:'Places to stay',type:'STAY',places:[]},{title:'Food & drink',type:'FOOD',places:[]},
      {title:'Events & culture',type:'EVENT',places:[]},{title:'Travel essentials',type:'TOUR_SERVICE',places:[]}
    ];
    for (const place of this.filteredPlaces) {
      const type=place.itemType || (place.saveCategory === 'HOTEL' ? 'STAY' : place.saveCategory === 'RESTAURANT' ? 'FOOD' : place.saveCategory === 'ACTIVITY' ? 'ACTIVITY' : 'PLACE');
      (groups.find(group=>group.type===type) || groups[0]).places.push(place);
    }
    return groups.filter(group=>group.places.length);
  }
  trackSection(_:number, section:{type:string}): string { return section.type; }
  get hasCatalogueSelection(): boolean { return [...this.selectedIds].some(id => id.startsWith('catalogue:')); }

  selectCataloguePlace(event: {place: CataloguePlace; selected: boolean}): void {
    if (!this.canSelectPlaces || this.isSaving) return;
    const key = catalogueKey(event.place);
    if (event.selected) {
      this.selectedIds.add(key); this.selectedListings.set(key, cataloguePlanningPlace(event.place));
      this.dayAssignments[key] ||= 1;
    } else {
      this.selectedIds.delete(key); this.selectedListings.delete(key); delete this.dayAssignments[key];
    }
  }
  setCatalogueDay(event: {place: CataloguePlace; day: number}): void {
    if (!this.canSelectPlaces || this.isSaving) return;
    this.dayAssignments[catalogueKey(event.place)] = Math.min(this.availableDayNumbers.length, Math.max(1,event.day || 1));
  }
  changeCatalogueScope(state: string): void {
    if (this.catalogueOnly) this.searchDestination = state;
    for (const key of [...this.selectedIds]) if (key.startsWith('catalogue:')) {
      this.selectedIds.delete(key); this.selectedListings.delete(key); delete this.dayAssignments[key];
    }
  }

  // Keep the actionable discovery cards primary. The source catalogue replaces
  // failed/empty searches rather than creating a second grid on the same page.
  get showCatalogueFallback(): boolean {
    return !!this.catalogueDestination && !this.isLoading && !this.result?.places.length
      && (this.itemTypeFilter === 'ALL' || this.itemTypeFilter === 'PLACE')
      && this.category !== 'STAY' && this.category !== 'FOOD';
  }

  get displayedResult(): DestinationDiscoveryResponse | null {
    return this.isLoading || this.showCatalogueFallback ? null : this.result;
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
    if (this.catalogueOnly) return;

    this.routeSubscription = this.route.queryParams.subscribe((params) => {
      const searchParam = params['search'] || params['q'];
      if (searchParam && searchParam.trim().length >= 2) {
        this.searchDestination = searchParam.trim();
        this.discover();
      }
    });
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
    this.detailSubscription?.unsubscribe();
    this.suggestionSubscription?.unsubscribe();
    this.routeSubscription?.unsubscribe();
    if (this.suggestionTimer) window.clearTimeout(this.suggestionTimer);
  }

  onDestinationInput(): void {
    this.suggestionSubscription?.unsubscribe();
    if (this.suggestionTimer) window.clearTimeout(this.suggestionTimer);
    const query = this.searchDestination.trim();
    if (query.length < 2) {
      this.suggestions = [];
      return;
    }
    this.suggestionTimer = window.setTimeout(() => {
      this.suggestionSubscription = this.discoveryService.getSuggestions(query).subscribe({
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
          this.errorMessage = 'Suttru could not resolve this location inside India.';
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

  async selectTrip(value: number | string): Promise<void> {
    const tripId = Number(value);
    this.activeTripId = Number.isFinite(tripId) ? tripId : 0;
    const trip = this.selectedTrip;

    // Selecting a trip changes only where places will be saved.
    // It must never replace the destination that the user is casually browsing.
    if (trip) {
      this.activeStartDate = trip.startDate;
      this.activeEndDate = trip.endDate;
      await this.loadSavedPlaces();
    } else {
      this.savedPlaces = [];
      this.activeStartDate = '';
      this.activeEndDate = '';
    }

    // Keep selected places and automatically add them after an editable trip is chosen.
    const maximumDay = Math.max(1, this.availableDayNumbers.length);
    for (const externalId of this.selectedIds) {
      this.dayAssignments[externalId] = Math.min(
        maximumDay,
        Math.max(1, this.dayAssignments[externalId] || 1)
      );
    }
    if (this.selectedIds.size > 0 && this.activeTripId > 0 && this.effectiveCanEdit) {
      await this.saveSelected(true);
    }
  }

  useTripDestination(trip: Trip): void {
    this.searchDestination = trip.destination;
    this.discover();
  }

  discover(page = 0): void {
    const destination = this.searchDestination.trim();
    if (destination.length < 2) return;
    this.catalogueDestination = destination;

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.suggestions = [];
    if (this.selectionDestination && this.selectionDestination !== destination.toLocaleLowerCase()) {
      this.selectedIds.clear();
      this.selectedListings.clear();
      this.dayAssignments = {};
    }

    this.selectionDestination = destination.toLocaleLowerCase();
    this.searchSubscription?.unsubscribe();
    this.searchSubscription = this.discoveryService.discoverPlaces(destination, this.radiusKm, this.category, {
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

  async toggleSelection(place: DiscoveredPlace): Promise<void> {
    if (this.selectedIds.has(place.externalId)) {
      this.selectedIds.delete(place.externalId);
      this.selectedListings.delete(place.externalId);
      delete this.dayAssignments[place.externalId];
      return;
    }

    this.selectedIds.add(place.externalId);
    this.selectedListings.set(place.externalId, place);
    this.dayAssignments[place.externalId] = this.dayAssignments[place.externalId] || 1;

    if (this.activeTripId > 0 && this.effectiveCanEdit) {
      await this.saveSelected(true);
      return;
    }

    this.successMessage = 'Place selected. Choose an editable trip to add it automatically to the itinerary.';
    this.errorMessage = '';
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
        this.selectedListings.set(place.externalId, place);
      }
    }

    const remaining = this.selectedPlaces().filter((place): place is PlanningPlace & {latitude:number;longitude:number} => place.latitude != null && place.longitude != null);
    const unmapped = this.selectedPlaces().filter(place => place.latitude == null || place.longitude == null);
    const routeOrdered: PlanningPlace[] = [];
    let current = {
      latitude: Number(this.result?.latitude ?? remaining[0]?.latitude ?? 0),
      longitude: Number(this.result?.longitude ?? remaining[0]?.longitude ?? 0)
    };

    while (remaining.length) {
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      remaining.forEach((place, index) => {
        const distance = this.coordinateDistanceKm(
          current.latitude,
          current.longitude,
          place.latitude,
          place.longitude
        );
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });
      const [nearest] = remaining.splice(nearestIndex, 1);
      routeOrdered.push(nearest);
      current = { latitude: nearest.latitude, longitude: nearest.longitude };
    }

    const ordered = [...routeOrdered, ...unmapped];
    const placesPerDay = Math.max(1, Math.ceil(ordered.length / days));
    ordered.forEach((place, index) => {
      this.dayAssignments[place.externalId] = Math.min(days, Math.floor(index / placesPerDay) + 1);
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
        this.selectedListings.delete(place.externalId);
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
    this.selectedListings.set(place.externalId, place);
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
    this.selectedListings.set(place.externalId, place);
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
      this.selectedListings.clear();
      this.dayAssignments = {};
    } catch (err: any) {
      this.errorMessage = err?.error?.message || 'Unable to save the selected places.';
    } finally {
      this.isSaving = false;
    }
  }

  private async addSelectedToItinerary(
    selected: PlanningPlace[],
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

    await this.optimizeItineraryByDistance();
  }

  private async optimizeItineraryByDistance(): Promise<void> {
    const itinerary = await firstValueFrom(this.itineraryService.getItinerary(this.activeTripId));
    const stay = this.savedPlaces.find((place) =>
      place.category === 'HOTEL' && place.latitude != null && place.longitude != null
    );
    const fallback = this.result
      ? { latitude: Number(this.result.latitude), longitude: Number(this.result.longitude) }
      : null;
    const start = stay
      ? { latitude: Number(stay.latitude), longitude: Number(stay.longitude) }
      : fallback;
    if (!start) return;

    const placeById = new Map(this.savedPlaces.map((place) => [place.id, place]));
    const orders: Array<{ itemId: number; displayOrder: number }> = [];

    for (const day of itinerary.days ?? []) {
      const remaining = [...(day.items ?? [])].filter((item) => {
        const place = item.placeId ? placeById.get(item.placeId) : undefined;
        return place?.latitude != null && place?.longitude != null;
      });
      const unmapped = [...(day.items ?? [])].filter((item) => !remaining.includes(item));
      const ordered = [];
      let current = start;

      while (remaining.length) {
        let nearestIndex = 0;
        let nearestDistance = Number.POSITIVE_INFINITY;
        remaining.forEach((item, index) => {
          const place = placeById.get(item.placeId!);
          if (!place) return;
          const distance = this.coordinateDistanceKm(
            current.latitude,
            current.longitude,
            Number(place.latitude),
            Number(place.longitude)
          );
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = index;
          }
        });
        const [nearest] = remaining.splice(nearestIndex, 1);
        ordered.push(nearest);
        const place = placeById.get(nearest.placeId!);
        if (place) {
          current = { latitude: Number(place.latitude), longitude: Number(place.longitude) };
        }
      }

      [...ordered, ...unmapped].forEach((item, index) => {
        orders.push({ itemId: item.id, displayOrder: index + 1 });
      });
    }

    if (orders.length) {
      await firstValueFrom(this.itineraryService.reorder(this.activeTripId, { items: orders }));
    }
  }

  private coordinateDistanceKm(
    fromLatitude: number,
    fromLongitude: number,
    toLatitude: number,
    toLongitude: number
  ): number {
    const toRadians = (value: number) => value * Math.PI / 180;
    const latitudeDelta = toRadians(toLatitude - fromLatitude);
    const longitudeDelta = toRadians(toLongitude - fromLongitude);
    const calculation = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(toRadians(fromLatitude)) * Math.cos(toRadians(toLatitude))
      * Math.sin(longitudeDelta / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(calculation), Math.sqrt(1 - calculation));
  }

  private dateForDay(dayNumber: number): string {
    const base = this.activeStartDate || new Date().toISOString().slice(0, 10);
    const [year, month, day] = base.split('-').map(Number);
    const utc = new Date(Date.UTC(year, month - 1, day + dayNumber - 1));
    return utc.toISOString().slice(0, 10);
  }

  private selectedPlaces(): PlanningPlace[] {
    return [...this.selectedListings.values()].filter(place => this.selectedIds.has(place.externalId));
  }

  isAlreadySaved(place: DiscoveredPlace): boolean {
    return this.findSavedPlace(place) !== undefined;
  }

  private findSavedPlace(place: PlanningPlace): Place | undefined {
    return this.savedPlaces.find((saved) => {
      if (place.catalogueNotes) {
        const recordId = place.externalId.slice('catalogue:'.length);
        return saved.notes?.split(' · ').includes(`CatalogueRecord=${recordId}`) === true;
      }
      if (saved.name.trim().toLowerCase() !== place.name.trim().toLowerCase()) return false;
      if (saved.latitude == null || saved.longitude == null) return true;

      return Math.abs(Number(saved.latitude) - Number(place.latitude)) < 0.001
        && Math.abs(Number(saved.longitude) - Number(place.longitude)) < 0.001;
    });
  }

  private discoveryNotes(place: PlanningPlace): string {
    if (place.catalogueNotes) return place.catalogueNotes;
    const parts = [
      `Discovered via ${place.sourceName || this.result?.provider || 'Suttru Discovery'} (${place.category})`,
      ...(place.distanceKm != null ? [`${place.distanceKm.toFixed(1)} km from ${this.searchDestination.trim()}`] : [])
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
    const routeImage = place.primaryImageUrl || place.imageUrl;
    if (routeImage) parts.push(`TripMateImage=${routeImage}`);
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

    const formattedCost = this.formatMoney(cost, place.currency);
    const prefix = place.priceStatus === 'ESTIMATED'
      ? 'Approx.'
      : place.priceStatus === 'STARTING_FROM'
        ? 'From'
        : 'Price';
    const unit = this.priceUnit(place.priceType);
    return `${prefix}: ${formattedCost}${unit}`;
  }

  formatPriceOption(option: DiscoveryPriceOption): string {
    const amount = this.formatMoney(option.amount, option.currency);
    const maximum = option.maximumAmount != null ? `–${this.formatMoney(option.maximumAmount, option.currency)}` : '';
    const prefix = option.status === 'STARTING_FROM' ? 'From ' : option.status === 'ESTIMATED' ? 'Estimated ' : '';
    return `${prefix}${amount}${maximum}${this.priceUnit(option.priceType)}`;
  }

  private formatMoney(amount: number, currency = 'INR'): string {
    try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount); }
    catch { return `${currency} ${amount.toLocaleString('en-IN')}`; }
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
    this.detailSubscription?.unsubscribe();
    this.selectedDetail = place;
    this.detailSubscription = this.discoveryService.getPlace(place.externalId).subscribe({
      next: (detail) => this.selectedDetail = detail,
      error: () => { /* Search-card data remains available if the detail cache expired. */ }
    });
  }

  closeDetails(): void {
    this.detailSubscription?.unsubscribe();
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

  creditedImages(place: DiscoveredPlace): DiscoveryImage[] {
    return (place.imageGallery ?? []).filter(image => image.exact && /^https?:\/\//i.test(image.url)
      && /^https?:\/\//i.test(image.sourcePage ?? '') && !!image.attribution?.trim()
      && !!image.license?.trim() && !/^see /i.test(image.license))
      .sort((a, b) => Number(b.primary) - Number(a.primary));
  }

  getPlaceImage(place: DiscoveredPlace): string {
    return this.creditedImages(place)[0]?.url ?? '/place-placeholder.svg';
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
