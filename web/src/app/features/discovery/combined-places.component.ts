import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TopPlacesComponent } from './top-places.component';
import { DestinationDiscoveryComponent } from './destination-discovery.component';

/** Compact view reusing existing discovery, credited media and itinerary selection/save logic. */
@Component({
  selector:'app-combined-places', standalone:true, imports:[CommonModule,FormsModule,RouterLink,TopPlacesComponent],
  template:`
    <section class="explore">
      <header><h1>Explore places</h1><p>Find places, choose your trip day and build your itinerary.</p></header>
      <form class="search-form" (ngSubmit)="discover()">
        <label>City or area<input name="destination" [(ngModel)]="searchDestination" (ngModelChange)="cityChanged()" [disabled]="isSaving" maxlength="180" placeholder="Ooty, Tamil Nadu" required /></label>
        <label>Show<select name="category" [(ngModel)]="category" [disabled]="isSaving"><option value="ALL">Places & activities</option><option value="FOOD">Restaurants</option><option value="STAY">Hotels</option></select></label>
        <label>Within<select name="radius" [(ngModel)]="radiusKm" [disabled]="isSaving"><option [ngValue]="10">10 km</option><option [ngValue]="25">25 km</option><option [ngValue]="50">50 km</option><option [ngValue]="100">100 km · wider region</option></select></label>
        <button [disabled]="isLoading || isSaving || searchDestination.trim().length < 2">Search</button>
      </form>
      <p *ngIf="isLoading" role="status">Finding places from configured sources…</p>
      <p *ngIf="errorMessage" role="alert" class="notice">{{ errorMessage }}</p>
      <p *ngIf="successMessage && !selectedCount" role="status" class="notice">{{ successMessage }}</p>
      <ng-container *ngIf="result as data">
        <app-top-places *ngIf="!isLoading" [destination]="data.query" [radiusKm]="radiusKm" [disabled]="isSaving" [canFind]="true" (placeRequested)="filterText=$event; discover()" />
        <div class="result-heading"><h2>{{ data.resolvedDestination }}</h2><span>{{ data.resultCount }} available matches</span></div>
        <form class="search-form" (ngSubmit)="discover()">
          <label>Find a particular place here<input name="placeName" [(ngModel)]="filterText" [disabled]="isSaving" maxlength="180" placeholder="e.g. Botanical Garden" /></label>
          <button [disabled]="isSaving || isLoading">Find place</button><button *ngIf="filterText" type="button" [disabled]="isSaving || isLoading" (click)="filterText=''; discover()">All places</button>
        </form>
        <p class="footnote">Sources: {{ data.provider }}. Search covers places returned by configured providers within {{ data.radiusKm }} km; coverage varies.</p>
        <details *ngIf="data.warnings?.length" class="source-notes"><summary>Source availability and coverage</summary><p *ngFor="let warning of data.warnings">{{ warning }}</p></details>
        <p *ngIf="!data.places.length">No places found. Try another name, a wider radius or check source configuration.</p>
        <div *ngIf="selectedCount" class="plan-panel">
          <h2>{{ selectedCount }} selected</h2>
          <label *ngIf="!embeddedMode">Add to trip<select [ngModel]="activeTripId" (ngModelChange)="selectTrip($event)" [disabled]="isSaving"><option [ngValue]="0">Choose a trip</option><option *ngFor="let trip of editableTrips" [ngValue]="trip.id">{{ trip.name }}</option></select></label>
          <p>Choose a day on each selected card.</p>
          <button type="button" [disabled]="isSaving || !effectiveCanEdit || !activeTripId" (click)="saveSelected(true)">{{ isSaving ? 'Adding…' : 'Add selected to itinerary' }}</button>
          <button class="text-button" type="button" [disabled]="isSaving" (click)="clearSelection()">Clear selection</button>
        </div>
        <div class="cards">
          <article *ngFor="let place of data.places; trackBy:trackPlace" class="card">
            <figure *ngIf="creditedImages(place)[0] as image; else missingPhoto"><a [href]="image.sourcePage" target="_blank" rel="noopener noreferrer"><img class="place-photo" [src]="image.url" [alt]="place.name" loading="lazy" (error)="handleImageError($event,place)" /></a><figcaption><a [href]="image.sourcePage" target="_blank" rel="noopener noreferrer">{{ image.attribution }} · {{ image.license }}</a></figcaption></figure>
            <ng-template #missingPhoto><div class="no-photo">No credited photo available</div></ng-template>
            <div class="card-body"><h3>{{ place.name }}</h3><p>{{ formatCategory(place.category) }} · {{ place.distanceKm }} km</p><p>{{ formatPlacePrice(place) }}</p>
              <label class="place-select"><input type="checkbox" [checked]="isSelected(place)" [disabled]="isSaving || !canSelectPlaces" (change)="toggleSelection(place)" /> Select place</label>
              <label *ngIf="isSelected(place) && activeTripId">Trip day<select [ngModel]="dayAssignments[place.externalId]" (ngModelChange)="setDayAssignment(place,$event)" [disabled]="isSaving"><option *ngFor="let day of availableDayNumbers" [ngValue]="day">Day {{ day }}</option></select></label>
              <a *ngIf="place.sourceUrl" [href]="place.sourceUrl" target="_blank" rel="noopener noreferrer" class="source-link">{{ place.sourceName || 'Source' }} ↗</a>
              <button type="button" class="text-button" (click)="openMapRoute(place)">View map</button>
            </div>
          </article>
        </div>
        <nav *ngIf="(data.totalPages || 0) > 1" class="pagination" aria-label="Combined places pages"><button [disabled]="isLoading || isSaving || !data.page" (click)="changePage((data.page || 0)-1)">Previous</button><span>Page {{ (data.page || 0)+1 }} of {{ data.totalPages }}</span><button [disabled]="isLoading || isSaving || (data.page || 0)+1 >= (data.totalPages || 0)" (click)="changePage((data.page || 0)+1)">Next</button></nav>
        <p class="footnote"><a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Powered by Geoapify</a> when configured. {{ data.attribution }}</p>
      </ng-container>
    </section>`,
  styleUrls:['./tripadvisor.component.scss'],
  styles:[`.search-form label { min-width:140px; }.source-link { display:block; font-size:11px; margin-top:12px; }.source-notes { font-size:12px; margin:12px 0; }.source-notes p { margin:6px 0; }.plan-panel h2 { margin-bottom:12px; }`]
})
export class CombinedPlacesComponent extends DestinationDiscoveryComponent {
  constructor() { super(); this.autoAddOnSelect=false; }
  cityChanged(): void { this.cancelDiscoverySearch(); this.filterText=''; this.clearSelection(); this.errorMessage=''; this.successMessage=''; }
}
