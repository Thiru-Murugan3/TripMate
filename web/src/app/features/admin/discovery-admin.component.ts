import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  AdminDiscoveryItem,
  AdminDiscoveryUpsert,
  adminPayloadFrom
} from '../../core/models/discovery-admin.model';
import {
  DiscoveryCategory,
  DiscoveryItemType,
  DiscoveryPriceStatus,
  DiscoveryPriceType
} from '../../core/models/discovery.model';
import { DiscoveryAdminService } from '../../core/services/discovery-admin.service';

type ListingCategory = Exclude<DiscoveryCategory, 'ALL'>;

@Component({
  selector: 'app-discovery-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="admin-page">
      <header class="page-header">
        <div>
          <span class="eyebrow">TripMate data operations</span>
          <h1>Explore India verification</h1>
          <p>Curate real listings and keep their sources, prices, timings and images auditable.</p>
        </div>
        <button class="primary" type="button" (click)="startCreate()">+ Add verified listing</button>
      </header>

      <section class="summary-grid" aria-label="Catalogue quality summary">
        <article><strong>{{ items.length }}</strong><span>records shown</span></article>
        <article><strong>{{ missingPriceCount }}</strong><span>missing price</span></article>
        <article><strong>{{ missingImageCount }}</strong><span>missing image</span></article>
        <article><strong>{{ conflictCount }}</strong><span>conflicts</span></article>
      </section>

      <section class="toolbar">
        <label><input type="checkbox" [(ngModel)]="missingPrice" (change)="load()" /> Missing prices</label>
        <label><input type="checkbox" [(ngModel)]="missingImage" (change)="load()" /> Missing images</label>
        <label><input type="checkbox" [(ngModel)]="conflictsOnly" (change)="load()" /> Provider conflicts</label>
        <button class="secondary" type="button" (click)="clearFilters()">Clear</button>
      </section>

      @if (errorMessage) { <p class="alert error" role="alert">{{ errorMessage }}</p> }
      @if (successMessage) { <p class="alert success" role="status">{{ successMessage }}</p> }

      @if (loading) {
        <div class="empty-state">Loading verification catalogue…</div>
      } @else if (!items.length) {
        <div class="empty-state">No records match these quality filters.</div>
      } @else {
        <section class="table-wrap">
          <table>
            <thead><tr><th>Listing</th><th>Location</th><th>Price</th><th>Source status</th><th>Actions</th></tr></thead>
            <tbody>
              @for (item of items; track item.id) {
                <tr [class.disabled]="!item.enabled">
                  <td><strong>{{ item.listing.name }}</strong><small>{{ item.listing.itemType }} · {{ item.listing.category }}</small></td>
                  <td>{{ location(item) }}<small>{{ item.listing.latitude }}, {{ item.listing.longitude }}</small></td>
                  <td><span class="badge" [class.warn]="item.listing.priceStatus === 'UNKNOWN'">{{ item.listing.priceStatus }}</span><small>{{ priceText(item) }}</small></td>
                  <td>
                    <a [href]="item.listing.sourceUrl" target="_blank" rel="noopener">{{ item.listing.sourceName || 'Open source' }}</a>
                    <small>{{ item.listing.sourceLastCheckedAt ? ('Checked ' + (item.listing.sourceLastCheckedAt | date:'mediumDate')) : 'Not verified yet' }}</small>
                    @if (item.conflictStatus) { <span class="conflict">{{ item.conflictStatus }}</span> }
                  </td>
                  <td class="actions">
                    <button type="button" class="link" (click)="edit(item)">Edit</button>
                    <button type="button" class="link" (click)="verify(item)">Verify</button>
                    <button type="button" class="link danger" (click)="toggle(item)">{{ item.enabled ? 'Disable' : 'Enable' }}</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </section>
      }

      @if (editorOpen) {
        <div class="modal-backdrop" (click)="closeEditor()">
          <section class="editor" role="dialog" aria-modal="true" aria-labelledby="editor-title" (click)="$event.stopPropagation()">
            <header><div><span class="eyebrow">Source-backed record</span><h2 id="editor-title">{{ editingId ? 'Update listing' : 'Add listing' }}</h2></div><button class="close" type="button" (click)="closeEditor()" aria-label="Close">×</button></header>
            <form (ngSubmit)="save()" #listingForm="ngForm">
              <div class="form-grid">
                <label class="wide">Name<input name="name" [(ngModel)]="draft.name" required maxlength="220" /></label>
                <label>Item type<select name="itemType" [(ngModel)]="draft.itemType" required>@for (value of itemTypes; track value) { <option [value]="value">{{ value }}</option> }</select></label>
                <label>Category<select name="category" [(ngModel)]="draft.category" required>@for (value of categories; track value) { <option [value]="value">{{ value }}</option> }</select></label>
                <label>Subcategory<input name="subcategory" [(ngModel)]="draft.subcategory" /></label>
                <label>City<input name="city" [(ngModel)]="draft.city" /></label>
                <label>District<input name="district" [(ngModel)]="draft.district" /></label>
                <label>State<input name="state" [(ngModel)]="draft.state" /></label>
                <label class="wide">Full address<input name="fullAddress" [(ngModel)]="draft.fullAddress" /></label>
                <label>Latitude<input name="latitude" type="number" step="0.000001" min="6" max="37.5" [(ngModel)]="draft.latitude" required /></label>
                <label>Longitude<input name="longitude" type="number" step="0.000001" min="68" max="97.5" [(ngModel)]="draft.longitude" required /></label>
                <label class="wide">Short description<textarea name="shortDescription" [(ngModel)]="draft.shortDescription" rows="2"></textarea></label>
                <label class="wide">Detailed description<textarea name="detailedDescription" [(ngModel)]="draft.detailedDescription" rows="4"></textarea></label>
                <label>Opening hours<input name="openingHours" [(ngModel)]="draft.openingHours" placeholder="Mo-Su 09:00-18:00" /></label>
                <label>Visit duration (minutes)<input name="duration" type="number" min="1" [(ngModel)]="draft.suggestedVisitMinutes" /></label>
                <label>Price status<select name="priceStatus" [(ngModel)]="draft.priceStatus" required>@for (value of priceStatuses; track value) { <option [value]="value">{{ value }}</option> }</select></label>
                <label>Price unit<select name="priceType" [(ngModel)]="draft.priceType" required>@for (value of priceTypes; track value) { <option [value]="value">{{ value }}</option> }</select></label>
                <label>Base price (INR)<input name="basePrice" type="number" min="0" [(ngModel)]="draft.basePrice" /></label>
                <label>Family friendly<select name="familyFriendly" [(ngModel)]="familyFriendlyValue"><option value="">Unknown</option><option value="true">Yes</option><option value="false">No</option></select></label>
                <label class="wide">Official source name<input name="sourceName" [(ngModel)]="draft.sourceName" required placeholder="Kerala Tourism" /></label>
                <label class="wide">Official/source URL<input name="sourceUrl" type="url" [(ngModel)]="draft.sourceUrl" required placeholder="https://…" /></label>
                <label>Last checked<input name="sourceLastCheckedAt" type="datetime-local" [(ngModel)]="checkedAtLocal" /></label>
                <label>Expires<input name="verificationExpiresAt" type="datetime-local" [(ngModel)]="expiresAtLocal" /></label>
                <label class="wide">Exact image URL<input name="imageUrl" type="url" [(ngModel)]="imageUrl" placeholder="Optional; leave empty for category placeholder" /></label>
                <label class="wide">Image source page<input name="imageSourcePage" type="url" [(ngModel)]="imageSourcePage" /></label>
                <label>Image licence<input name="imageLicense" [(ngModel)]="imageLicense" placeholder="CC BY-SA 4.0" /></label>
                <label>Image attribution<input name="imageAttribution" [(ngModel)]="imageAttribution" /></label>
                <label>Conflict status<input name="conflictStatus" [(ngModel)]="draft.conflictStatus" placeholder="Optional" /></label>
                <label class="wide">Conflict notes<textarea name="conflictNotes" [(ngModel)]="draft.conflictNotes" rows="2"></textarea></label>
              </div>
              <p class="form-note">Only enter a fee or exact image when its URL verifies that data. Unknown prices remain explicitly unknown.</p>
              <footer><button class="secondary" type="button" (click)="closeEditor()">Cancel</button><button class="primary" type="submit" [disabled]="listingForm.invalid || saving">{{ saving ? 'Saving…' : 'Save listing' }}</button></footer>
            </form>
          </section>
        </div>
      }
    </main>
  `,
  styles: [`
    :host { display:block; background:#f6f8fb; min-height:calc(100vh - 72px); color:#172033; }
    .admin-page { max-width:1280px; margin:auto; padding:2.5rem 1.25rem 4rem; }
    .page-header, .editor header, .editor footer { display:flex; align-items:center; justify-content:space-between; gap:1rem; }
    h1 { margin:.25rem 0; font-size:clamp(1.8rem,4vw,2.7rem); } h2 { margin:.2rem 0; }
    p { color:#60708a; } .eyebrow { color:#176b57; font-size:.75rem; font-weight:800; letter-spacing:.1em; text-transform:uppercase; }
    button { cursor:pointer; font:inherit; border-radius:.7rem; padding:.68rem 1rem; border:1px solid #ccd5e2; }
    button.primary { background:#176b57; color:white; border-color:#176b57; font-weight:700; } button.secondary { background:white; }
    .summary-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:1rem; margin:1.6rem 0; }
    .summary-grid article { background:white; border:1px solid #e1e7ef; padding:1.1rem; border-radius:1rem; display:flex; flex-direction:column; }
    .summary-grid strong { font-size:1.7rem; } .summary-grid span, small { display:block; color:#718096; font-size:.78rem; margin-top:.25rem; }
    .toolbar { display:flex; align-items:center; flex-wrap:wrap; gap:1rem; background:white; padding:1rem; border:1px solid #e1e7ef; border-radius:1rem; margin-bottom:1rem; }
    .toolbar label { display:flex; align-items:center; gap:.4rem; } .alert,.empty-state { padding:1rem; border-radius:.8rem; }
    .alert.error { background:#fff0f0; color:#9f2d2d; } .alert.success { background:#eaf8f2; color:#176b57; } .empty-state { background:white; text-align:center; color:#60708a; }
    .table-wrap { overflow:auto; background:white; border:1px solid #e1e7ef; border-radius:1rem; } table { width:100%; border-collapse:collapse; min-width:900px; }
    th,td { padding:1rem; text-align:left; border-bottom:1px solid #edf0f4; vertical-align:top; } th { color:#60708a; font-size:.76rem; text-transform:uppercase; letter-spacing:.05em; }
    tr.disabled { opacity:.56; } td a { color:#176b57; } .badge,.conflict { display:inline-block; padding:.25rem .5rem; border-radius:999px; background:#e8f6f1; color:#176b57; font-size:.72rem; font-weight:800; }
    .badge.warn,.conflict { background:#fff3dc; color:#9a5a05; } .conflict { margin-top:.35rem; } .actions { white-space:nowrap; }
    button.link { background:transparent; border:0; color:#176b57; padding:.3rem; } button.link.danger { color:#aa3434; }
    .modal-backdrop { position:fixed; inset:0; z-index:1200; background:rgba(15,23,42,.58); display:grid; place-items:center; padding:1rem; }
    .editor { width:min(900px,100%); max-height:92vh; overflow:auto; background:white; border-radius:1.1rem; padding:1.25rem; box-shadow:0 24px 70px rgba(0,0,0,.25); }
    .close { background:transparent; border:0; font-size:1.8rem; } .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:.9rem; margin:1rem 0; }
    .form-grid label { display:flex; flex-direction:column; gap:.35rem; font-size:.79rem; font-weight:700; color:#53627a; } .form-grid .wide { grid-column:1/-1; }
    input,select,textarea { border:1px solid #cbd5e1; border-radius:.55rem; padding:.65rem; font:inherit; color:#172033; background:white; }
    textarea { resize:vertical; } .form-note { font-size:.8rem; } .editor footer { justify-content:flex-end; padding-top:1rem; border-top:1px solid #edf0f4; }
    @media (max-width:720px) { .page-header { align-items:flex-start; flex-direction:column; } .summary-grid { grid-template-columns:1fr 1fr; } .form-grid { grid-template-columns:1fr; } .form-grid .wide { grid-column:auto; } }
  `]
})
export class DiscoveryAdminComponent implements OnInit {
  readonly categories: ListingCategory[] = ['ATTRACTION','NATURE','WATERFALL','LAKE','RIVER','BEACH','VIEWPOINT','TEMPLE','CHURCH','MUSEUM','PARK','WILDLIFE','ADVENTURE','ENTERTAINMENT','FAMILY','CULTURAL','NIGHTLIFE','WELLNESS','TRANSPORT','SHOPPING','FOOD','STAY','EVENT','HISTORICAL'];
  readonly itemTypes: DiscoveryItemType[] = ['PLACE','ACTIVITY','FOOD','STAY','EVENT','TOUR_SERVICE'];
  readonly priceStatuses: DiscoveryPriceStatus[] = ['FREE','VERIFIED','STARTING_FROM','ESTIMATED','UNKNOWN'];
  readonly priceTypes: DiscoveryPriceType[] = ['PER_PERSON','PER_ACTIVITY','PER_VEHICLE','PER_NIGHT','FIXED','RANGE','UNKNOWN'];

  items: AdminDiscoveryItem[] = [];
  loading = false;
  saving = false;
  editorOpen = false;
  editingId?: number;
  missingPrice = false;
  missingImage = false;
  conflictsOnly = false;
  errorMessage = '';
  successMessage = '';
  checkedAtLocal = '';
  expiresAtLocal = '';
  imageUrl = '';
  imageSourcePage = '';
  imageLicense = '';
  imageAttribution = '';
  familyFriendlyValue = '';
  draft = this.emptyDraft();

  constructor(private readonly service: DiscoveryAdminService) {}

  ngOnInit(): void { this.load(); }

  get missingPriceCount(): number { return this.items.filter(({ listing }) => listing.priceStatus === 'UNKNOWN' || !listing.priceOptions?.length).length; }
  get missingImageCount(): number { return this.items.filter(({ listing }) => !listing.imageGallery?.some((image) => image.exact)).length; }
  get conflictCount(): number { return this.items.filter((item) => !!item.conflictStatus).length; }

  load(): void {
    this.loading = true; this.errorMessage = '';
    this.service.list({ missingPrice: this.missingPrice, missingImage: this.missingImage, conflictsOnly: this.conflictsOnly }).subscribe({
      next: (items) => { this.items = items; this.loading = false; },
      error: () => { this.errorMessage = 'Unable to load the verification catalogue.'; this.loading = false; }
    });
  }

  clearFilters(): void { this.missingPrice = this.missingImage = this.conflictsOnly = false; this.load(); }
  startCreate(): void { this.editingId = undefined; this.draft = this.emptyDraft(); this.resetAuxiliary(); this.editorOpen = true; }

  edit(item: AdminDiscoveryItem): void {
    this.editingId = item.id;
    this.draft = adminPayloadFrom(item);
    this.familyFriendlyValue = this.draft.familyFriendly == null ? '' : String(this.draft.familyFriendly);
    this.checkedAtLocal = this.toLocal(this.draft.sourceLastCheckedAt);
    this.expiresAtLocal = this.toLocal(this.draft.verificationExpiresAt);
    const primary = this.draft.images.find((image) => image.primary) ?? this.draft.images[0];
    this.imageUrl = primary?.imageUrl ?? ''; this.imageSourcePage = primary?.sourcePage ?? '';
    this.imageLicense = primary?.license ?? ''; this.imageAttribution = primary?.attribution ?? '';
    this.editorOpen = true;
  }

  closeEditor(): void { this.editorOpen = false; }

  save(): void {
    this.saving = true; this.errorMessage = '';
    const payload: AdminDiscoveryUpsert = {
      ...this.draft,
      sourceLastCheckedAt: this.iso(this.checkedAtLocal),
      verificationExpiresAt: this.iso(this.expiresAtLocal),
      familyFriendly: this.familyFriendlyValue === '' ? undefined : this.familyFriendlyValue === 'true',
      priceOptions: this.priceOptions(),
      images: this.imageUrl ? [{ imageUrl: this.imageUrl, sourcePage: this.imageSourcePage, sourceName: this.draft.sourceName, license: this.imageLicense, attribution: this.imageAttribution, exact: true, primary: true }] : []
    };
    const request = this.editingId ? this.service.update(this.editingId, payload) : this.service.create(payload);
    request.subscribe({
      next: () => { this.saving = false; this.editorOpen = false; this.successMessage = 'Catalogue record saved with its verification metadata.'; this.load(); },
      error: (error) => { this.saving = false; this.errorMessage = error?.error?.message || 'The listing could not be saved. Check required source and coordinate fields.'; }
    });
  }

  verify(item: AdminDiscoveryItem): void {
    const verifiedAt = new Date().toISOString();
    const expires = new Date(Date.now() + 30 * 86400000).toISOString();
    this.service.verify(item.id, verifiedAt, expires).subscribe({ next: () => { this.successMessage = `${item.listing.name} verified for 30 days.`; this.load(); }, error: () => this.errorMessage = 'Verification update failed.' });
  }

  toggle(item: AdminDiscoveryItem): void {
    this.service.setEnabled(item.id, !item.enabled).subscribe({ next: () => { this.successMessage = `${item.listing.name} ${item.enabled ? 'disabled' : 'enabled'}.`; this.load(); }, error: () => this.errorMessage = 'Status update failed.' });
  }

  location(item: AdminDiscoveryItem): string { return [item.listing.city, item.listing.district, item.listing.state].filter(Boolean).join(', ') || item.listing.fullAddress || 'Location not labelled'; }
  priceText(item: AdminDiscoveryItem): string { const amount = item.listing.estimatedCostPerPerson; return amount == null ? 'Price not verified' : new Intl.NumberFormat('en-IN', { style:'currency', currency:item.listing.currency ?? 'INR', maximumFractionDigits:0 }).format(amount); }

  private priceOptions() {
    if (this.draft.basePrice == null || this.draft.priceStatus === 'UNKNOWN') return this.draft.priceOptions ?? [];
    return [{ label: this.draft.priceStatus === 'FREE' ? 'Entry' : 'Base price', amount: this.draft.basePrice, priceType: this.draft.priceType, currency: this.draft.currency, sourceUrl: this.draft.sourceUrl, lastVerifiedAt: this.iso(this.checkedAtLocal), status: this.draft.priceStatus, expiresAt: this.iso(this.expiresAtLocal) }];
  }

  private resetAuxiliary(): void { this.checkedAtLocal = ''; this.expiresAtLocal = ''; this.imageUrl = ''; this.imageSourcePage = ''; this.imageLicense = ''; this.imageAttribution = ''; this.familyFriendlyValue = ''; }
  private toLocal(value?: string): string { return value ? new Date(value).toISOString().slice(0, 16) : ''; }
  private iso(value: string): string | undefined { return value ? new Date(value).toISOString() : undefined; }
  private emptyDraft(): AdminDiscoveryUpsert {
    return { name:'', itemType:'PLACE', category:'ATTRACTION', latitude:0, longitude:0, priceStatus:'UNKNOWN', priceType:'UNKNOWN', currency:'INR', sourceName:'', sourceUrl:'', enabled:true, priceOptions:[], images:[] };
  }
}
