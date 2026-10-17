import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subscription, catchError, from, map, mergeMap, of } from 'rxjs';
import { environment } from '../../../environments/environment';
interface Location { id: string; name: string; address: string | null; webUrl?: string | null; }
interface Details extends Location { description: string | null; webUrl: string | null; ratingImageUrl: string | null; reviewCount: string | null; }
interface Photo { url: string; caption: string | null; author: string; sourceUrl: string | null; }
interface PhotoState { photos: Photo[]; loading: boolean; error: string; }
@Component({
  selector: 'app-tripadvisor', standalone: true, imports: [CommonModule, FormsModule],
  template: `
    <section class="explore" aria-labelledby="explore-title">
      <header><div><span class="eyebrow">Explore</span><h1 id="explore-title">Find your next stop</h1><p>Places and traveller photos from Tripadvisor.</p></div>
        <a href="https://www.tripadvisor.com/" target="_blank" rel="noopener noreferrer"><img class="brand" src="https://files.readme.io/9f59534-Vector_1.png" alt="Tripadvisor" /></a>
      </header>
      <form (ngSubmit)="search()" class="search-form">
        <label>City or place<input name="query" [(ngModel)]="query" (ngModelChange)="clear()" maxlength="180" required placeholder="Ooty, Tamil Nadu, India" /></label>
        <label class="category">Show<select name="category" [(ngModel)]="category" (ngModelChange)="clear()"><option value="attractions">Things to do</option><option value="hotels">Hotels</option><option value="restaurants">Restaurants</option></select></label>
        <button type="submit" [disabled]="!available || busy || query.trim().length < 2">Search</button>
      </form>
      <p *ngIf="checking || busy" role="status">{{ checking ? 'Connecting to Tripadvisor…' : 'Finding places…' }}</p>
      <div *ngIf="error" role="alert" class="notice"><p>{{ error }}</p><button *ngIf="!available && !checking" type="button" (click)="checkAvailability()">Check connection</button></div>
      <p *ngIf="searched && !busy && !results.length && !error">No accessible places found. Try a more specific name. Terra accounts may need their allowed locations or contracted geography configured.</p>
      <div *ngIf="results.length" class="result-heading"><h2>{{ submittedQuery }}</h2><span>{{ results.length }} matches from Tripadvisor</span></div>
      <p *ngIf="photoFailure" role="alert" class="notice">{{ photoFailure }}</p>
      <div class="cards">
        <article *ngFor="let place of visiblePlaces; trackBy: trackPlace" class="card">
          <ng-container *ngIf="photoStates[place.id] as state">
            <figure *ngIf="visiblePhoto(place) as photo; else noPhoto">
              <a [href]="photoLink(place, photo)" target="_blank" rel="noopener noreferrer"><img class="place-photo" [src]="photo.url" [alt]="photo.caption || place.name" (error)="hidePhoto(place.id, photo)" /></a>
              <figcaption><a [href]="photoLink(place, photo)" target="_blank" rel="noopener noreferrer">{{ photo.author }} / Tripadvisor ↗</a></figcaption>
            </figure>
            <ng-template #noPhoto><div class="no-photo">{{ state.loading ? 'Loading photo…' : state.error ? 'Photo unavailable' : 'No photo supplied' }}</div></ng-template>
            <div class="card-body"><h3><a *ngIf="place.webUrl; else plainName" [href]="place.webUrl" target="_blank" rel="noopener noreferrer">{{ place.name }}</a><ng-template #plainName>{{ place.name }}</ng-template></h3><p>{{ place.address }}</p>
              <button type="button" [disabled]="detailsLoading" (click)="open(place.id)">View details &amp; ratings</button>
              <button *ngIf="state.error && !state.loading" type="button" class="text-button" (click)="retryPhoto(place.id)">Retry photo</button>
            </div>
          </ng-container>
        </article>
      </div>
      <nav *ngIf="results.length > pageSize" aria-label="Tripadvisor results pages" class="pagination">
        <button type="button" [disabled]="page === 0" (click)="setPage(page - 1)">Previous</button><span>Page {{ page + 1 }} of {{ totalPages }}</span><button type="button" [disabled]="page + 1 >= totalPages" (click)="setPage(page + 1)">Next</button>
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
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/discovery/tripadvisor`;
  private searchRequest?: Subscription;
  private statusRequest?: Subscription;
  private detailRequest?: Subscription;
  private photoRequests = new Subscription();
  readonly pageSize = 4;
  category = 'attractions'; available = false; checking = false; busy = false; error = ''; searched = false;
  submittedQuery = ''; page = 0; results: Location[] = []; detail: Details | null = null;
  detailsLoading = false; detailError = ''; photoStates: Record<string, PhotoState> = {};
  get visiblePlaces(): Location[] { return this.results.slice(this.page * this.pageSize, (this.page + 1) * this.pageSize); }
  get photoFailure(): string { return this.visiblePlaces.map(p => this.photoStates[p.id]?.error).find(Boolean) || ''; }
  get totalPages(): number { return Math.ceil(this.results.length / this.pageSize); }
  ngOnInit(): void { this.checkAvailability(); }
  ngOnChanges(changes: SimpleChanges): void { if (changes['query'] && !changes['query'].firstChange) this.clear(); }
  checkAvailability(): void {
    this.statusRequest?.unsubscribe(); this.checking = true; this.error = '';
    this.statusRequest = this.http.get<{available: boolean; apiMode?: string; setupCode?: string}>(`${this.base}/status`).subscribe({
      next: status => { this.checking = false; this.available = status.available; if (!status.available) this.error = status.setupCode === 'TERRA_SETUP_REQUIRED' ? 'Terra setup needs a confirmed account allowance and an entity budget before activation.' : 'Tripadvisor is not connected. Please check the app’s API configuration.'; },
      error: () => { this.checking = false; this.available = false; this.error = 'Unable to connect to Tripadvisor. Please try again.'; }
    });
  }
  clear(): void {
    this.searchRequest?.unsubscribe(); this.photoRequests.unsubscribe(); this.photoRequests = new Subscription(); this.closeDetails();
    this.busy = false; this.error = ''; this.searched = false; this.page = 0; this.results = []; this.photoStates = {}; this.submittedQuery = '';
  }
  search(): void {
    if (!this.available || this.busy || this.query.trim().length < 2) return;
    this.clear(); this.busy = true; this.searched = true; this.submittedQuery = this.query.trim();
    const params = new HttpParams().set('query', this.submittedQuery).set('category', this.category);
    this.searchRequest = this.http.get<Location[]>(`${this.base}/search`, {params}).subscribe({
      next: results => { this.results = results; this.busy = false; this.loadVisiblePhotos(); },
      error: e => { this.busy = false; this.error = this.errorMessage(e); }
    });
  }
  setPage(page: number): void {
    if (page < 0 || page >= this.totalPages || page === this.page) return;
    this.page = page; this.closeDetails(); this.loadVisiblePhotos();
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
  ngOnDestroy(): void { this.clear(); this.statusRequest?.unsubscribe(); }
}
