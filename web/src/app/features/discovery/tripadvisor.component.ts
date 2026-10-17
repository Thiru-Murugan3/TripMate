import { CommonModule } from '@angular/common';
import { AfterViewInit, ElementRef, ViewChild, Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
interface Location { id: string; name: string; address: string | null; }
interface Details extends Location { description: string | null; webUrl: string | null; ratingImageUrl: string | null; reviewCount: string | null; }
interface Photo { url: string; caption: string | null; author: string; sourceUrl: string; }
@Component({
  selector: 'app-tripadvisor', standalone: true, imports: [CommonModule, FormsModule],
  template: `
    <dialog #dialog (cancel)="close.emit()" aria-labelledby="ta-title">
      <header><h2 id="ta-title">Explore with Tripadvisor</h2><button type="button" (click)="close.emit()">Close ✕</button></header>
      <a href="https://www.tripadvisor.com/" target="_blank" rel="noopener noreferrer"><img class="brand" src="https://files.readme.io/9f59534-Vector_1.png" alt="Tripadvisor" /></a>
      <p>Look up places, ratings and real photos. Photos are traveller uploads, not a live camera feed.</p>
      <p class="hint">Use Suttru’s place checkboxes to plan your itinerary. Tripadvisor content is for live viewing and is not saved to your trip or offline pack.</p>
      <form (ngSubmit)="search()">
        <label>City or place<input name="query" [(ngModel)]="query" (ngModelChange)="clear()" maxlength="180" required placeholder="Ooty, Tamil Nadu, India" /></label>
        <label>Show<select name="category" [(ngModel)]="category" (ngModelChange)="clear()"><option value="attractions">Things to do</option><option value="hotels">Hotels</option><option value="restaurants">Restaurants</option></select></label>
        <button type="submit" [disabled]="!available || busy || query.trim().length < 2">Search Tripadvisor</button>
      </form>
      <p *ngIf="busy" role="status">Loading from Tripadvisor…</p><p *ngIf="error" role="alert">{{ error }}</p>
      <p *ngIf="searched && !busy && !results.length && !error">No matching places returned. Try a more specific place name.</p>
      <p *ngIf="results.length" class="hint">Up to 10 matches. Open a place for ratings; load photos only when needed.</p>
      <div class="results"><button type="button" *ngFor="let place of results" [disabled]="busy" (click)="open(place.id)"><strong>{{ place.name }}</strong><small>{{ place.address }}</small><span>View details →</span></button></div>
      <article *ngIf="detail as d">
        <h3>{{ d.name }}</h3><p>{{ d.address }}</p>
        <div *ngIf="d.ratingImageUrl" class="rating"><img class="brand" src="https://files.readme.io/9f59534-Vector_1.png" alt="Tripadvisor" /><img class="bubbles" [src]="d.ratingImageUrl" alt="Tripadvisor traveller rating" /><span *ngIf="d.reviewCount">{{ d.reviewCount }} reviews</span></div>
        <p>{{ d.description }}</p><a *ngIf="d.webUrl" [href]="d.webUrl" target="_blank" rel="noopener noreferrer">View on Tripadvisor ↗</a>
        <p class="hint">Entry fees and bookable hotel prices are not supplied by this lookup. Check the official venue or booking provider.</p>
        <button type="button" (click)="loadPhotos(d.id)" [disabled]="busy || photosLoaded">{{ photosLoaded ? 'Photos loaded' : 'Load traveller photos' }}</button>
        <p *ngIf="photosLoaded && !photos.length">No credited photos available.</p>
        <div class="photos"><figure *ngFor="let photo of photos"><img [src]="photo.url" [alt]="photo.caption || d.name" loading="lazy" (error)="hidePhoto(photo)" /><figcaption>{{ photo.caption }} · {{ photo.author }} / Tripadvisor <a [href]="photo.sourceUrl" target="_blank" rel="noopener noreferrer">Photo source ↗</a></figcaption></figure></div>
      </article>
    </dialog>`,
  styles: [`dialog{background:#fff;color:#172d23;border:0;border-radius:20px;padding:24px;width:850px;max-width:calc(100vw - 32px);max-height:90dvh;overflow:auto;box-sizing:border-box}dialog::backdrop{background:#0008}header{display:flex;justify-content:space-between;gap:16px;align-items:center}h2{font-size:24px;margin:0 0 14px}.brand{height:24px;width:auto;max-width:100%}p{line-height:1.5}.hint,small{color:#53655c;font-size:13px}form{display:flex;flex-wrap:wrap;align-items:end;gap:12px}label{display:grid;gap:6px;flex:1}input,select{padding:10px;border:1px solid #bac9c0;border-radius:9px;min-width:0;width:100%;box-sizing:border-box}button{border:1px solid #cedbd3;border-radius:12px;background:#f2f7f3;padding:10px 14px;color:#163d28;cursor:pointer}button:disabled{opacity:.5;cursor:default}.results{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin:16px 0}.results button{text-align:left;display:grid;gap:7px}.results span{font-size:12px}.rating{display:flex;flex-wrap:wrap;align-items:center;gap:10px;background:white}.bubbles{min-width:55px;height:22px;width:auto}article{border-top:1px solid #dae4dd;padding-top:12px}.photos{display:flex;gap:12px;overflow:auto;margin-top:14px}figure{margin:0;flex:0 0 240px}figure img{width:240px;height:180px;object-fit:contain;background:#f2f7f3}figcaption{font-size:12px;line-height:1.5}a{color:#165d38}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #1b7650;outline-offset:2px}@media(max-width:500px){dialog{padding:16px;max-height:95dvh}h2{font-size:20px}form{display:grid}}`]
})
export class TripadvisorComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() query = '';
  @Output() close = new EventEmitter<void>();
  @ViewChild('dialog') dialog!: ElementRef<HTMLDialogElement>;
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/discovery/tripadvisor`;
  private request?: Subscription;
  private statusRequest?: Subscription;
  category = 'attractions'; available = false; busy = false; error = ''; searched = false;
  results: Location[] = []; detail: Details | null = null; photos: Photo[] = []; photosLoaded = false;
  ngAfterViewInit(): void { this.dialog.nativeElement.showModal(); }
  ngOnInit(): void {
    this.statusRequest = this.http.get<{available: boolean}>(`${this.base}/status`).subscribe({
      next: status => { this.available = status.available; if (!status.available) this.error = 'Tripadvisor is not configured yet. Suttru discovery remains available.'; },
      error: () => this.error = 'Unable to check Tripadvisor availability. Close and reopen to retry.'
    });
  }
  clear(): void {
    this.request?.unsubscribe(); this.busy = false; this.error = ''; this.searched = false;
    this.results = []; this.detail = null; this.photos = []; this.photosLoaded = false;
  }
  search(): void {
    if (!this.available || this.busy || this.query.trim().length < 2) return;
    this.clear(); this.busy = true; this.searched = true;
    const params = new HttpParams().set('query', this.query.trim()).set('category', this.category);
    this.request = this.http.get<Location[]>(`${this.base}/search`, {params}).subscribe({
      next: results => { this.results = results; this.busy = false; }, error: e => this.fail(e)
    });
  }
  open(id: string): void {
    if (this.busy) return;
    this.detail = null; this.photos = []; this.photosLoaded = false; this.error = ''; this.busy = true;
    this.request = this.http.get<Details>(`${this.base}/locations/${encodeURIComponent(id)}`).subscribe({
      next: d => { this.detail = d; this.busy = false; }, error: e => this.fail(e)
    });
  }
  loadPhotos(id: string): void {
    if (this.busy || this.photosLoaded) return;
    this.error = ''; this.busy = true;
    this.request = this.http.get<Photo[]>(`${this.base}/locations/${encodeURIComponent(id)}/photos`).subscribe({
      next: photos => { this.photos = photos; this.photosLoaded = true; this.busy = false; }, error: e => this.fail(e)
    });
  }
  hidePhoto(photo: Photo): void { this.photos = this.photos.filter(p => p !== photo); }
  private fail(e: {status?: number}): void {
    this.busy = false;
    this.error = e.status === 429 ? 'Tripadvisor usage limit reached. Please try later; your Suttru places are still available.' : 'Tripadvisor is unavailable. Please try again; your Suttru places are still available.';
  }
  ngOnDestroy(): void { this.statusRequest?.unsubscribe(); this.request?.unsubscribe(); this.results = []; this.detail = null; this.photos = []; this.dialog?.nativeElement.close(); }
}
