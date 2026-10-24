import { PlacePhotoGalleryComponent } from '../../shared/components/place-photo-gallery/place-photo-gallery.component';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TopPlacesComponent } from './top-places.component';
import { DiscoveredPlace, DiscoveryPriceOption, DiscoveryCategory } from '../../core/models/discovery.model';
import { DestinationDiscoveryComponent } from './destination-discovery.component';

/** Compact view reusing existing discovery, credited media and itinerary selection/save logic. */
@Component({
  selector:'app-combined-places', standalone:true, imports:[CommonModule,FormsModule,TopPlacesComponent,PlacePhotoGalleryComponent],
  template:`
    <section class="explore">
      <header><h1>Explore</h1></header>
      <form class="search-form city-search" [class.mobile-filter-open]="mobileFiltersOpen" (ngSubmit)="discover()">
        <label>City or area<input name="destination" [(ngModel)]="searchDestination" (ngModelChange)="cityChanged()" [disabled]="isSaving" maxlength="180" placeholder="Ooty, Tamil Nadu" required /></label>
        <label class="advanced-filter">Category<select name="category" [(ngModel)]="category" (ngModelChange)="categoryChanged()" [disabled]="isSaving"><option value="ALL">All categories</option><option *ngFor="let value of exploreCategories" [value]="value">{{ formatCategory(value) }}</option></select></label>
        <label class="advanced-filter">Price<select name="price" [(ngModel)]="priceStatusFilter" [disabled]="isSaving"><option value="ALL">Any price</option><option value="FREE">Free entry</option><option value="VERIFIED">Verified price</option></select></label>
        <label class="advanced-filter">Visit duration<select name="duration" [(ngModel)]="maxDurationFilter" [disabled]="isSaving"><option [ngValue]="undefined">Any duration</option><option [ngValue]="60">Up to 1 hour</option><option [ngValue]="180">Up to 3 hours</option><option [ngValue]="480">Up to 8 hours</option></select></label>
        <label class="advanced-filter">Within<select name="radius" [(ngModel)]="radiusKm" [disabled]="isSaving"><option [ngValue]="10">10 km</option><option [ngValue]="25">25 km</option><option [ngValue]="50">50 km</option><option [ngValue]="100">100 km · wider region</option></select></label>
        <button class="phone-filter-button" type="button" (click)="mobileFiltersOpen=!mobileFiltersOpen" [attr.aria-expanded]="mobileFiltersOpen">{{mobileFiltersOpen ? 'Hide filters' : 'Filters'}}</button>
        <button [disabled]="isLoading || isSaving || searchDestination.trim().length < 2">Search</button>
      </form>
      <nav class="experience-tabs" aria-label="Experience type"><button *ngFor="let tab of exploreTabs" type="button" [class.active]="itemTypeFilter === tab.value" [attr.aria-pressed]="itemTypeFilter === tab.value" [disabled]="isSaving || isLoading" (click)="selectItemType(tab.value)">{{ tab.label }}</button></nav>
      <p *ngIf="isLoading" role="status">Finding places…</p>
      <p *ngIf="errorMessage" role="alert" class="notice">{{ errorMessage }}</p>
      <p *ngIf="successMessage && !selectedCount" role="status" class="notice">{{ successMessage }}</p>
      <ng-container *ngIf="result as data">
        <app-top-places *ngIf="!isLoading && itemTypeFilter === 'ALL'" [destination]="data.query" [radiusKm]="radiusKm" [tripId]="activeTripId" [startDate]="activeStartDate" [endDate]="activeEndDate" [canEdit]="effectiveCanEdit" [disabled]="isSaving" (savingChanged)="isSaving=$event" (placesChanged)="loadSavedPlaces(); placesChanged.emit()" (itineraryChanged)="itineraryChanged.emit()" [canFind]="true" (placeRequested)="filterText=$event; discover()" />
        <div class="result-heading"><h2>{{ data.resolvedDestination }}</h2><span>{{ data.resultCount }} matches from available sources</span></div>
        <details *ngIf="coverageWarnings.length" class="coverage-status"><summary>Coverage and source status</summary><p *ngFor="let warning of coverageWarnings">{{ warning }}</p></details>
        <form class="search-form" (ngSubmit)="discover()">
          <label>Find a particular place here<input name="placeName" [(ngModel)]="filterText" [disabled]="isSaving" maxlength="180" placeholder="e.g. Botanical Garden" /></label>
          <button [disabled]="isSaving || isLoading">Find place</button><button *ngIf="filterText" type="button" [disabled]="isSaving || isLoading" (click)="filterText=''; discover()">All places</button>
        </form>
        <div *ngIf="!data.places.length" class="notice" role="status"><p>No matching places could be loaded from the available sources.</p><p>Try All categories, a wider radius or a particular place name.</p>

        </div>
        <div *ngIf="selectedCount" class="plan-panel">
          <h2>{{ selectedCount }} selected</h2>
          <label *ngIf="!embeddedMode">Add to trip<select [ngModel]="activeTripId" (ngModelChange)="selectTrip($event)" [disabled]="isSaving"><option [ngValue]="0">Choose a trip</option><option *ngFor="let trip of editableTrips" [ngValue]="trip.id">{{ trip.name }}</option></select></label>
          <p>Choose a day on each selected card.</p>
          <button type="button" [disabled]="isSaving || !effectiveCanEdit || !activeTripId" (click)="saveSelected(true)">{{ isSaving ? 'Adding…' : 'Add selected to itinerary' }}</button>
          <button class="text-button" type="button" [disabled]="isSaving" (click)="clearSelection()">Clear selection</button>
        </div>
        <div class="cards">
          <article *ngFor="let place of data.places; trackBy:trackPlace" class="card">
            <app-place-photo-gallery [externalId]="place.externalId" [sourceUrl]="place.sourceUrl || ''" [name]="place.name" [initialImages]="place.imageGallery!" [officialWebsite]="place.officialWebsite || place.website || ''" />
            <div class="card-body"><h3>{{ place.name }}</h3><p>{{ formatCategory(place.category) }} · {{ place.distanceKm }} km</p><p class="duration">{{ visitTime(place) }}</p><p class="hours-status">{{ place.openingHours?.trim() ? 'Opening hours in details' : 'Opening hours not listed' }}</p><p class="price">{{ formatPlacePrice(place) }}</p>
              <label class="place-select"><input type="checkbox" [checked]="isSelected(place)" [disabled]="isSaving || !canSelectPlaces" (change)="toggleSelection(place)" /> Select place</label>
              <label *ngIf="isSelected(place) && activeTripId">Trip day<select [ngModel]="dayAssignments[place.externalId]" (ngModelChange)="setDayAssignment(place,$event)" [disabled]="isSaving"><option *ngFor="let day of availableDayNumbers" [ngValue]="day">Day {{ day }}</option></select></label>
              <details class="place-details"><summary>View details</summary>
                <p *ngIf="place.shortDescription || place.description">{{ place.shortDescription || place.description }}</p>
                <p><strong>Opening hours:</strong> {{ openingSchedule(place.openingHours) }}</p>
                <p *ngIf="place.openingHours">Source schedule; holiday and seasonal changes may apply.</p>
                <div class="price-evidence">
                  <p *ngIf="priceNeedsReview(place)"><strong>Price needs confirmation.</strong> The listed fee may have changed.</p>
                  <div *ngFor="let option of place.priceOptions">
                    <p><strong>{{ option.label }}:</strong> {{ listingPriceOption(option) }}<span *ngIf="priceNeedsReview(option)"> · May have changed</span></p>
                    <a *ngIf="safeBookingUrl(option.sourceUrl) as priceSource" [href]="priceSource" target="_blank" rel="noopener noreferrer">Price source ↗</a>
                    <p *ngIf="sourceDate(option.lastVerifiedAt) as checked">Price checked: {{ checked }}</p>
                  </div>
                  <p *ngIf="!place.priceOptions?.length">{{ place.priceStatus === 'UNKNOWN' || !place.priceStatus ? 'No verified fee is available.' : 'Confirm the fee with the listing source before travelling.' }}</p>
                  <p *ngIf="sourceDate(place.sourceLastCheckedAt) as checked">Listing retrieved: {{ checked }}</p>
                </div>
                <p *ngIf="place.fullAddress || place.address">{{ place.fullAddress || place.address }}</p>
                <p *ngIf="place.bestTimeToVisit">{{ place.bestTimeToVisit }}</p>
                <p *ngIf="place.accessibilityInformation">{{ place.accessibilityInformation }}</p>
                <p *ngIf="place.inclusions?.length"><strong>Includes:</strong> {{ place.inclusions?.join(', ') }}</p>
                <p *ngIf="place.exclusions?.length"><strong>Excludes:</strong> {{ place.exclusions?.join(', ') }}</p>
                <p *ngIf="place.cancellationInformation"><strong>Cancellation:</strong> {{ place.cancellationInformation }}</p>
                <p *ngIf="place.safetyInformation">{{ place.safetyInformation }}</p>
                <p *ngIf="!place.description && !place.shortDescription && !place.openingHours && !place.inclusions?.length">Check the source for visitor information.</p>
              </details>
              <a *ngIf="safeBookingUrl(place.bookingUrl) as booking" class="booking-link" [href]="booking" target="_blank" rel="noopener noreferrer">Book with provider ↗</a>
              <a *ngIf="safeBookingUrl(place.sourceUrl) as source" [href]="source" target="_blank" rel="noopener noreferrer" class="source-link">{{ place.sourceName || 'Listing source' }} ↗</a>
              <button type="button" class="text-button" (click)="openMapRoute(place)">View map</button>
            </div>
          </article>
        </div>
        <nav *ngIf="(data.totalPages || 0) > 1" class="pagination" aria-label="Combined places pages"><button [disabled]="isLoading || isSaving || !data.page" (click)="changePage((data.page || 0)-1)">Previous</button><span>Page {{ (data.page || 0)+1 }} of {{ data.totalPages }}</span><button [disabled]="isLoading || isSaving || (data.page || 0)+1 >= (data.totalPages || 0)" (click)="changePage((data.page || 0)+1)">Next</button></nav>
        <p *ngIf="data.attribution" class="footnote"><a *ngIf="data.providersUsed?.includes('Geoapify')" href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Geoapify · </a>{{ data.attribution }}</p>
      </ng-container>
    </section>`,
  styleUrls:['./combined-places.component.scss'],
  styles:[`.phone-filter-button { display:none; } @media(max-width:760px) { .city-search .advanced-filter { display:none; } .city-search.mobile-filter-open .advanced-filter { display:grid; } .city-search .phone-filter-button { display:block; background:#eff6ff; color:#2563eb; border-color:#dbeafe; } .city-search>button { grid-column:auto; } } @media(min-width:761px) { .search-form label { min-width:140px; } }.source-link { display:block; font-size:11px; margin-top:12px; }.plan-panel h2 { margin-bottom:12px; }`]
})
export class CombinedPlacesComponent extends DestinationDiscoveryComponent {
  mobileFiltersOpen=false;
  visitTime(place:DiscoveredPlace):string {
    const activity=place.activityDuration;
    const minutes=activity!=null&&Number.isFinite(activity)&&activity>0 ? activity : place.suggestedVisitMinutes;
    return Number.isFinite(minutes)&&minutes>0 ? 'Suggested visit: '+this.formatDuration(Math.max(1,Math.round(minutes))) : 'Visit duration not listed';
  }
  openingSchedule(hours?:string):string {
    const value=hours?.trim();
    if(!value) return 'Not listed — confirm with the venue';
    if(value==='24/7') return '24 hours daily (source schedule)';
    const days:Record<string,string>={Mo:'Mon',Tu:'Tue',We:'Wed',Th:'Thu',Fr:'Fri',Sa:'Sat',Su:'Sun'};
    if(value.split(';').every(part=>/^\s*(?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:[-,](?:Mo|Tu|We|Th|Fr|Sa|Su))*\s+)?(?:(?:[01]\d|2[0-3]):[0-5]\d-(?:[01]\d|2[0-3]):[0-5]\d(?:,(?:[01]\d|2[0-3]):[0-5]\d-(?:[01]\d|2[0-3]):[0-5]\d)*|off)\s*$/.test(part))) {
      return value.replace(/Mo|Tu|We|Th|Fr|Sa|Su/g,day=>days[day]).replace(/off/g,'Closed').replace(/-/g,'–').replace(/;/g,'; ');
    }
    return 'Source schedule: '+value;
  }
  sourceDate(value?:string):string|null {
    if(!value) return null;
    const date=new Date(value);
    return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'}).format(date) : null;
  }
  priceNeedsReview(value:DiscoveredPlace|DiscoveryPriceOption):boolean {
    const item=value as DiscoveredPlace;const option=value as DiscoveryPriceOption;
    const deadline=item.verificationExpiresAt || option.expiresAt;
    return !!item.verificationExpired || !!option.mayHaveChanged || !!item.priceOptions?.some(price=>this.priceNeedsReview(price)) || (!!deadline&&(!Number.isFinite(Date.parse(deadline))||Date.parse(deadline)<=Date.now()));
  }
  listingPriceOption(option:DiscoveryPriceOption):string {
    if(!Number.isFinite(option.amount)||option.amount<0||option.status==='UNKNOWN') return 'Price not verified';
    return (this.priceNeedsReview(option) ? 'Previously listed: ' : '')+this.formatPriceOption(option);
  }
  override formatPlacePrice(place:DiscoveredPlace):string {
    if(this.priceNeedsReview(place)) return place.priceStatus==='FREE' ? 'Previously free — confirm current fee' : 'Previous price — confirm current fee';
    if(place.estimatedCostPerPerson==null && place.priceOptions?.some(option=>this.safeBookingUrl(option.sourceUrl)&&Number.isFinite(option.amount))) return 'See sourced prices in details';
    return super.formatPlacePrice(place);
  }
  get coverageWarnings():string[] {
    return this.result?.warnings?.filter(warning=>!warning.startsWith('Prices and opening hours')
      && !warning.startsWith('No source-backed listings')) || [];
  }
  readonly exploreCategories = ['NATURE','TEMPLE','MUSEUM','ADVENTURE','FAMILY','FOOD','STAY'] as const;
  readonly exploreTabs = [
    {value:'ALL',label:'All'}, {value:'PLACE',label:'Places to visit'},
    {value:'ACTIVITY',label:'Activities'}, {value:'TOUR_SERVICE',label:'Tours'}
  ] as const;
  categoryChanged():void { this.itemTypeFilter='ALL'; }
  override discover(page=0):void {
    const query=this.searchDestination.trim();
    const match=query.match(/^(.+?)\s+(adventure|family|nature|temple|museum|food)(?:\s+(?:activities|places))?$/i);
    if(match && match[1].trim().length>=2) {
      this.searchDestination=match[1].trim();this.category=match[2].toUpperCase() as DiscoveryCategory;
      this.itemTypeFilter='ALL';
    }
    super.discover(page);
  }
  safeBookingUrl(value?:string):string|null {
    if(!value) return null;
    try { const url=new URL(value); return ['https:','http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
  }
  constructor() { super(); this.autoAddOnSelect=false; }
  cityChanged(): void { this.cancelDiscoverySearch(); this.filterText=''; this.clearSelection(); this.errorMessage=''; this.successMessage=''; }
}
