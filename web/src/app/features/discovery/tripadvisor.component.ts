import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Trip } from '../../core/models/trip.model';
import { TripService } from '../../core/services/trip.service';
import { ItineraryService } from '../../core/services/itinerary.service';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subscription, catchError, from, map, mergeMap, of } from 'rxjs';
import { environment } from '../../../environments/environment';
interface Location { id: string; name: string; address: string | null; webUrl?: string | null; }
interface SearchPage { places: Location[]; page: number; size: number; totalElements: number | null; totalPages: number | null; hasNext: boolean; }
interface Details extends Location { description: string | null; webUrl: string | null; ratingImageUrl: string | null; reviewCount: string | null; }
interface Photo { url: string; caption: string | null; author: string; sourceUrl: string | null; }
interface PhotoState { photos: Photo[]; loading: boolean; error: string; }
@Component({
  selector: 'app-tripadvisor', standalone: true, imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="explore" aria-labelledby="explore-title">
      <header><div><span class="eyebrow">Explore</span><h1 id="explore-title">Find your next stop</h1><p>Places and traveller photos from Tripadvisor.</p></div>
        <a href="https://www.tripadvisor.com/" target="_blank" rel="noopener noreferrer"><img class="brand" src="https://files.readme.io/9f59534-Vector_1.png" alt="Tripadvisor" /></a>
      </header>
      <form (ngSubmit)="search()" class="search-form">
        <label>City or area<input [disabled]="saving" name="query" [(ngModel)]="query" (ngModelChange)="clear()" maxlength="180" required placeholder="Ooty, Tamil Nadu, India" /></label>
        <label class="category">Show<select [disabled]="saving" name="category" [(ngModel)]="category" (ngModelChange)="clear()"><option value="attractions">Things to do</option><option value="hotels">Hotels</option><option value="restaurants">Restaurants</option></select></label>
        <button type="submit" [disabled]="!available || busy || saving || query.trim().length < 2">Search</button>
      </form>
      <p *ngIf="checking || busy" role="status">{{ checking ? 'Connecting to Tripadvisor…' : 'Finding places…' }}</p>
      <div *ngIf="error" role="alert" class="notice"><p>{{ error }}</p><button *ngIf="!available && !checking" type="button" (click)="checkAvailability()">Check connection</button></div>
      <p *ngIf="searched && !busy && !results.length && !error">No accessible places found. Try a more specific name. Terra accounts may need their allowed locations or contracted geography configured.</p>
      <div *ngIf="results.length" class="result-heading"><h2>{{ submittedQuery }}</h2><span>{{ resultSummary }}</span></div>
      <form *ngIf="cityReady" (ngSubmit)="searchPlace()" class="search-form place-search" aria-label="Search for a place within the city">
        <label>Find a particular place in {{ submittedQuery }}<input name="placeQuery" [(ngModel)]="placeQuery" [disabled]="saving" maxlength="180" placeholder="e.g. Government Botanical Garden" /></label>
        <button type="submit" [disabled]="busy || saving || placeQuery.trim().length < 2">Find place</button>
        <button *ngIf="submittedPlaceQuery" type="button" [disabled]="busy || saving" (click)="showAllPlaces()">All places in {{ submittedQuery }}</button>
      </form>
      <p *ngIf="submittedPlaceQuery && cityReady">Results for “{{ submittedPlaceQuery }}” in {{ submittedQuery }}</p>
      <p *ngIf="photoFailure" role="alert" class="notice">{{ photoFailure }}</p>
      <p *ngIf="planningSuccess" role="status" class="notice">{{ planningSuccess }} <a [routerLink]="['/trips', savedTripId]">Open trip ↗</a></p>
      <section *ngIf="selectedPlace as selected" class="plan-panel" aria-label="Add selected place to itinerary">
        <header><h2>{{ selected.name }}</h2><button type="button" [disabled]="saving" (click)="cancelSelection()">Cancel</button></header>
        <p *ngIf="loadingTrips" role="status">Loading your trips…</p>
        <div class="plan-fields">
          <label>Trip<select [(ngModel)]="activeTripId" (ngModelChange)="selectedDay = 1" [disabled]="saving || loadingTrips">
            <option [ngValue]="0">Choose a trip</option><option *ngFor="let t of availableTrips" [ngValue]="t.id">{{ t.name }}</option>
          </select></label>
          <label>Trip day<input type="number" min="1" [max]="tripDayCount" step="1" [(ngModel)]="selectedDay" [disabled]="saving || !activeTripId" /></label>
          <label>Your activity title<input maxlength="180" [(ngModel)]="activityTitle" [disabled]="saving" placeholder="e.g. Morning sightseeing" /></label>
        </div>
        <p class="footnote">Your title and schedule stay in your itinerary. Tripadvisor place information loads online.</p>
        <p *ngIf="planningError" role="alert" class="notice">{{ planningError }}</p>
        <button type="button" [disabled]="saving || loadingTrips || !validPlan" (click)="addSelectedPlace()">{{ saving ? 'Adding…' : 'Add to itinerary' }}</button>
      </section>
      <div class="cards">
        <article *ngFor="let place of visiblePlaces; trackBy: trackPlace" class="card">
          <ng-container *ngIf="photoStates[place.id] as state">
            <figure *ngIf="visiblePhoto(place) as photo; else noPhoto">
              <a [href]="photoLink(place, photo)" target="_blank" rel="noopener noreferrer"><img class="place-photo" [src]="photo.url" [alt]="photo.caption || place.name" (error)="hidePhoto(place.id, photo)" /></a>
              <figcaption><a [href]="photoLink(place, photo)" target="_blank" rel="noopener noreferrer">{{ photo.author }} / Tripadvisor ↗</a></figcaption>
            </figure>
            <ng-template #noPhoto><div class="no-photo">{{ state.loading ? 'Loading photo…' : state.error ? 'Photo unavailable' : 'No photo supplied' }}</div></ng-template>
            <div class="card-body"><h3><a *ngIf="place.webUrl; else plainName" [href]="place.webUrl" target="_blank" rel="noopener noreferrer">{{ place.name }}</a><ng-template #plainName>{{ place.name }}</ng-template></h3><p>{{ place.address }}</p>
              <label class="place-select"><input type="checkbox" [checked]="selectedPlace?.id === place.id" [disabled]="saving || (!!trip && !canEdit)" (change)="selectPlace(place)" /> Select place</label>
              <button type="button" [disabled]="detailsLoading" (click)="open(place.id)">View details &amp; ratings</button>
              <button *ngIf="state.error && !state.loading" type="button" class="text-button" (click)="retryPhoto(place.id)">Retry photo</button>
            </div>
          </ng-container>
        </article>
      </div>
      <nav *ngIf="searched && (hasNext || page > 1)" aria-label="Tripadvisor results pages" class="pagination">
        <button type="button" [disabled]="busy || saving || page === 1" (click)="setPage(page - 1)">Previous</button><span>Page {{ page }}<ng-container *ngIf="totalPages !== null"> of {{ totalPages }}</ng-container></span><button type="button" [disabled]="busy || saving || !hasNext" (click)="setPage(page + 1)">Next</button>
      </nav>
      <p *ngIf="detailsLoading" role="status">Loading place details…</p>
      <p *ngIf="detailError" role="alert" class="notice">{{ detailError }}</p>
      <article *ngIf="detail as d" class="details" aria-label="Place details">
        <header><h2>{{ d.name }}</h2><button type="button" (click)="closeDetails()">Close details</button></header><p>{{ d.address }}</p>
        <div *ngIf="d.ratingImageUrl" class="rating"><img class="brand" src="https://files.readme.io/9f59534-Vector_1.png" alt="Tripadvisor" /><img class="bubbles" [src]="d.ratingImageUrl" alt="Tripadvisor traveller rating" /><a *ngIf="d.reviewCount && d.webUrl" [href]="d.webUrl" target="_blank" rel="noopener noreferrer">{{ d.reviewCount }} reviews</a></div>
        <p>{{ d.description }}</p><a *ngIf="d.webUrl" [href]="d.webUrl" target="_blank" rel="noopener noreferrer">View on Tripadvisor ↗</a>
      </article>
      <p class="footnote">Photos are traveller uploads, not live camera images. Entry fees and booking prices should be checked with the venue or booking provider.</p>
    </section>`,
  styleUrl: './tripadvisor.component.scss'
})
export class TripadvisorComponent implements OnInit, OnChanges, OnDestroy {
  @Input() query = '';
  @Input() trip: Trip | null = null;
  @Input() canEdit = false;
  @Output() itineraryChanged = new EventEmitter<void>();
  private tripService = inject(TripService);
  private itineraryService = inject(ItineraryService);
  private planningRequests = new Subscription();
  private tripsRequest?: Subscription;
  placeQuery = ''; submittedPlaceQuery = ''; cityReady = false;
  selectedPlace: Location | null = null;
  availableTrips: Trip[] = []; activeTripId = 0; selectedDay = 1; activityTitle = 'Planned visit';
  loadingTrips = false; saving = false; planningError = ''; planningSuccess = ''; savedTripId = 0;
  get tripDayCount(): number {
    const trip = this.availableTrips.find(t => t.id === this.activeTripId);
    if (!trip) return 0;
    return Math.max(0, Math.round((Date.parse(trip.endDate) - Date.parse(trip.startDate)) / 86400000) + 1) || 0;
  }
  get validPlan(): boolean {
    return !!this.selectedPlace && this.availableTrips.some(t => t.id === this.activeTripId)
      && Number.isInteger(this.selectedDay) && this.selectedDay >= 1 && this.selectedDay <= this.tripDayCount
      && this.activityTitle.trim().length > 0 && this.activityTitle.length <= 180;
  }
  selectPlace(place: Location): void {
    if (this.saving || (this.trip && !this.canEdit)) return;
    if (this.selectedPlace?.id === place.id) { this.cancelSelection(); return; }
    this.cancelSelection(); this.selectedPlace = place; this.planningSuccess = '';
    this.activityTitle = 'Planned visit'; this.selectedDay = 1;
    if (this.trip) { this.availableTrips = [this.trip]; this.activeTripId = this.trip.id; return; }
    this.loadingTrips = true;
    this.tripsRequest = this.tripService.getMyTrips().subscribe({
      next: trips => {
        this.loadingTrips = false;
        this.availableTrips = trips.filter(t => ['OWNER','EDITOR','PLANNER'].includes(t.userRole));
        this.activeTripId = this.availableTrips.length === 1 ? this.availableTrips[0].id : 0;
        if (!this.availableTrips.length) this.planningError = 'Create a trip or ask for planner access before adding a place.';
      },
      error: () => { this.loadingTrips = false; this.planningError = 'Unable to load your trips. Select the place again to retry.'; }
    });
  }
  cancelSelection(): void {
    if (this.saving) return;
    this.tripsRequest?.unsubscribe(); this.loadingTrips = false; this.selectedPlace = null;
    this.planningError = ''; this.availableTrips = []; this.activeTripId = 0;
  }
  addSelectedPlace(): void {
    if (this.saving || !this.validPlan || !this.selectedPlace) return;
    const tripId = this.activeTripId;
    this.saving = true; this.planningError = '';
    this.planningRequests.add(this.itineraryService.addTripadvisorPlace(tripId, {
      locationId: this.selectedPlace.id, dayNumber: this.selectedDay, title: this.activityTitle.trim()
    }).subscribe({
      next: () => {
        this.saving = false; this.savedTripId = tripId; this.cancelSelection();
        this.planningSuccess = 'Place added to your itinerary.'; this.itineraryChanged.emit();
      },
      error: e => {
        this.saving = false;
        this.planningError = e.status === 403 ? 'You no longer have permission to edit this trip.'
          : e.status === 400 ? 'Check your activity title and choose a day within the trip dates.' : 'Unable to add this place. Please retry; it will not be added twice to the same day.';
      }
    }));
  }
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/discovery/tripadvisor`;
  private searchRequest?: Subscription;
  private statusRequest?: Subscription;
  private detailRequest?: Subscription;
  private photoRequests = new Subscription();
  readonly pageSize = 4;
  category = 'attractions'; available = false; checking = false; busy = false; error = ''; searched = false;
  submittedQuery = ''; page = 1;
  totalElements: number | null = null; totalPages: number | null = null; hasNext = false;
  private submittedCategory = 'attractions';
  results: Location[] = []; detail: Details | null = null;
  detailsLoading = false; detailError = ''; photoStates: Record<string, PhotoState> = {};
  get visiblePlaces(): Location[] { return this.results; }
  get photoFailure(): string { return this.visiblePlaces.map(p => this.photoStates[p.id]?.error).find(Boolean) || ''; }
  get resultSummary(): string {
    const start = (this.page - 1) * this.pageSize + 1;
    return this.totalElements !== null ? `Showing ${start}–${start + this.results.length - 1} of ${this.totalElements} available matches from Tripadvisor`
      : `${this.results.length} places on page ${this.page} from Tripadvisor`;
  }
  ngOnInit(): void { this.checkAvailability(); }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['query'] && !changes['query'].firstChange) this.clear();
    else if (changes['trip'] || changes['canEdit']) this.cancelSelection();
  }
  checkAvailability(): void {
    this.statusRequest?.unsubscribe(); this.checking = true; this.error = '';
    this.statusRequest = this.http.get<{available: boolean; apiMode?: string; setupCode?: string}>(`${this.base}/status`).subscribe({
      next: status => { this.checking = false; this.available = status.available; if (!status.available) this.error = status.setupCode === 'TERRA_SETUP_REQUIRED' ? 'Terra setup needs a confirmed account allowance and an entity budget before activation.' : 'Tripadvisor is not connected. Please check the app’s API configuration.'; },
      error: () => { this.checking = false; this.available = false; this.error = 'Unable to connect to Tripadvisor. Please try again.'; }
    });
  }
  clear(): void {
    this.cancelSelection(); this.planningSuccess = '';
    this.cityReady = false; this.placeQuery = ''; this.submittedPlaceQuery = '';
    this.searchRequest?.unsubscribe(); this.photoRequests.unsubscribe(); this.photoRequests = new Subscription(); this.closeDetails();
    this.busy = false; this.error = ''; this.searched = false; this.page = 1; this.totalElements = null; this.totalPages = null; this.hasNext = false; this.results = []; this.photoStates = {}; this.submittedQuery = '';
  }
  search(): void {
    if (!this.available || this.busy || this.saving || this.query.trim().length < 2) return;
    this.clear(); this.busy = true; this.searched = true; this.submittedQuery = this.query.trim();
    this.submittedCategory = this.category;
    this.loadPage(1);
  }
  searchPlace(): void {
    if (!this.cityReady || !this.available || this.busy || this.saving || this.placeQuery.trim().length < 2) return;
    this.submittedPlaceQuery = this.placeQuery.trim(); this.restartWithinCity();
  }
  showAllPlaces(): void {
    if (!this.cityReady || this.busy || this.saving) return;
    this.placeQuery = ''; this.submittedPlaceQuery = ''; this.restartWithinCity();
  }
  private restartWithinCity(): void {
    this.searchRequest?.unsubscribe(); this.photoRequests.unsubscribe(); this.photoRequests = new Subscription();
    this.cancelSelection(); this.closeDetails(); this.planningSuccess = ''; this.results = []; this.photoStates = {};
    this.page = 1; this.totalElements = null; this.totalPages = null; this.hasNext = false;
    this.loadPage(1);
  }
  setPage(page: number): void {
    if (this.busy || this.saving || page < 1 || page === this.page || (page > this.page && !this.hasNext)) return;
    this.loadPage(page);
  }
  private loadPage(page: number): void {
    this.busy = true; this.error = '';
    const params = new HttpParams().set('query', this.submittedPlaceQuery || this.submittedQuery).set('category', this.submittedCategory)
      .set('page', page).set('size', this.pageSize).set('searchType', this.submittedPlaceQuery ? 'NAME' : 'COMBINED').set('city', this.submittedPlaceQuery ? this.submittedQuery : '');
    this.searchRequest = this.http.get<SearchPage>(`${this.base}/search-page`, {params}).subscribe({
      next: result => {
        this.photoRequests.unsubscribe(); this.photoRequests = new Subscription(); this.closeDetails();
        this.cancelSelection(); this.planningSuccess = '';
        this.photoStates = {}; this.results = result.places; this.page = result.page;
        this.cityReady = true;
        this.totalElements = result.totalElements; this.totalPages = result.totalPages; this.hasNext = result.hasNext;
        this.busy = false; this.loadVisiblePhotos();
      },
      error: e => { this.busy = false; this.error = this.errorMessage(e); }
    });
  }
  private loadVisiblePhotos(): void {
    const pending = this.visiblePlaces.filter(p => !this.photoStates[p.id]);
    pending.forEach(p => this.photoStates[p.id] = {photos:[], loading:true, error:''});
    this.photoRequests.add(from(pending).pipe(mergeMap(place => this.fetchPhotos(place.id), 2)).subscribe(result => this.photoStates[result.id] = result.state));
  }
  private fetchPhotos(id: string) {
    return this.http.get<Photo[]>(`${this.base}/locations/${encodeURIComponent(id)}/photos`).pipe(
      map(photos => ({id, state: {photos, loading:false, error:''}})),
      catchError(e => of({id, state: {photos:[] as Photo[], loading:false, error:this.errorMessage(e)}}))
    );
  }
  retryPhoto(id: string): void {
    if (this.photoStates[id]?.loading) return;
    this.photoStates[id] = {photos:[], loading:true, error:''};
    this.photoRequests.add(this.fetchPhotos(id).subscribe(result => this.photoStates[result.id] = result.state));
  }
  open(id: string): void {
    this.closeDetails(); this.detailsLoading = true;
    this.detailRequest = this.http.get<Details>(`${this.base}/locations/${encodeURIComponent(id)}`).subscribe({
      next: d => { this.detail = d; this.detailsLoading = false; }, error: e => { this.detailsLoading = false; this.detailError = this.errorMessage(e); }
    });
  }
  closeDetails(): void { this.detailRequest?.unsubscribe(); this.detail = null; this.detailsLoading = false; this.detailError = ''; }
  hidePhoto(id: string, photo: Photo): void { const state = this.photoStates[id]; if (state) state.photos = state.photos.filter(p => p !== photo); }
  photoLink(place: Location, photo: Photo): string { return place.webUrl || photo.sourceUrl || ''; }
  visiblePhoto(place: Location): Photo | undefined {
    const photo = this.photoStates[place.id]?.photos[0];
    return photo && this.photoLink(place, photo) ? photo : undefined;
  }
  trackPlace(_: number, place: Location): string { return place.id; }
  private errorMessage(e: {status?: number; error?: {code?: string}}): string {
    if (e.error?.code === 'TERRA_ENTITY_LIMIT') return 'The app’s configured Terra entity budget is exhausted. Ask the app owner to review usage.';
    if (e.status === 429) return 'Tripadvisor usage limit reached. Please try later.';
    switch (e.error?.code) {
      case 'CITY_FILTER_UNAVAILABLE': return 'Searching for a place within a city requires the Terra API connection.';
      case 'TERRA_SETUP_REQUIRED': return 'Terra setup needs a confirmed account allowance and an entity budget before activation.';
      case 'TERRA_AUTHENTICATION': return 'Terra rejected the API key. Check that the key belongs to the Terra account.';
      case 'TERRA_ACCESS_DENIED': return 'This Terra key cannot access the requested endpoint. Check your package and API permissions.';
      case 'LOCATION_ACCESS_REQUIRED': return 'This place is unavailable or outside your Terra location access. Check allowed locations or contracted geography.';
      case 'ACCESS_DENIED': return 'Tripadvisor rejected the connection. Check the API key’s allowed domain/IP and Content API v1 access.';
      case 'NOT_CONFIGURED': return 'Tripadvisor is not connected. Please check the app’s API configuration.';
      case 'LOCATION_UNAVAILABLE': return 'This Tripadvisor place is currently unavailable.';
      case 'CONNECTION_FAILED': return 'Unable to reach Tripadvisor. Please try again.';
      default: return 'Tripadvisor is temporarily unavailable. Please try again.';
    }
  }
  ngOnDestroy(): void { this.planningRequests.unsubscribe(); this.saving = false; this.clear(); this.statusRequest?.unsubscribe(); }
}
