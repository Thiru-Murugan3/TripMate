import { PlacePhotoGalleryComponent } from '../../shared/components/place-photo-gallery/place-photo-gallery.component';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { DiscoveredPlace } from '../../core/models/discovery.model';
import { PlaceService } from '../../core/services/place.service';
import { TripService } from '../../core/services/trip.service';
import { DestinationDiscoveryComponent } from './destination-discovery.component';
import { DiscoveryService } from '../../core/services/discovery.service';

@Component({
  selector:'app-top-places',standalone:true,imports:[CommonModule,FormsModule,PlacePhotoGalleryComponent],
  template:`
    <section class="top-places" aria-label="Top 10 places to visit">
      <button type="button" (click)="load()" [disabled]="busy || disabled || isSaving || destination.trim().length<2">{{ busy ? 'Finding highlights…' : 'Top 10 places to visit' }}</button>
      <p *ngIf="busy" role="status">Finding places in {{ destination }}…</p>
      <p *ngIf="error" role="alert">{{ error }}</p>
      <p *ngIf="successMessage" role="status">{{ successMessage }}</p>
      <section *ngIf="result as data" aria-live="polite">
        <header><h3>{{ data.places.length }} places to visit in {{ data.resolvedDestination }}</h3><button type="button" (click)="close()" [disabled]="isSaving || disabled">Close</button></header>
        <p *ngIf="!data.places.length">No places found. Try a wider radius or another destination.</p>
        <label class="trip-picker" *ngIf="!embeddedMode">Add to trip<select [ngModel]="activeTripId" (ngModelChange)="selectTrip($event)" [disabled]="isSaving || disabled || tripsLoading"><option [ngValue]="0">Choose a trip</option><option *ngFor="let trip of editableTrips" [ngValue]="trip.id">{{ trip.name }}</option></select></label>
        <p *ngIf="tripsLoading" role="status">Loading your trips…</p>
        <p *ngIf="!tripsLoading && !canSelectPlaces" class="note">{{ embeddedMode ? 'This trip is read-only.' : 'An editable trip is needed to add places to an itinerary.' }}</p>
        <div *ngIf="selectedCount" class="selection-actions"><span>{{ selectedCount }} selected</span><button type="button" (click)="saveSelected(true)" [disabled]="isSaving || disabled || !activeTripId || !effectiveCanEdit">{{ isSaving ? 'Adding…' : 'Add selected to itinerary' }}</button></div>
        <ol>
          <li *ngFor="let place of data.places">
            <app-place-photo-gallery [externalId]="place.externalId" [sourceUrl]="place.sourceUrl || ''" [name]="place.name" [initialImages]="place.imageGallery!" />
            <div class="place-heading"><label class="place-option"><input type="checkbox" [checked]="isSelected(place)" [disabled]="isSaving || disabled || !canSelectPlaces" (change)="toggleSelection(place)" [attr.aria-label]="'Select ' + place.name" /> <strong>{{ place.name }}</strong></label><span class="note">{{ place.category.replaceAll('_',' ').toLowerCase() }} · {{ place.distanceKm }} km</span></div>
            <label class="day-picker" *ngIf="isSelected(place) && activeTripId">Trip day<select [ngModel]="dayAssignments[place.externalId]" (ngModelChange)="setDayAssignment(place,$event)" [disabled]="isSaving || disabled"><option *ngFor="let day of availableDayNumbers" [ngValue]="day">Day {{ day }}</option></select></label>
            <div class="actions"><a [href]="place.sourceUrl" target="_blank" rel="noopener noreferrer">{{ place.sourceName || 'Source' }} ↗</a><button *ngIf="canFind" type="button" [disabled]="disabled || isSaving" (click)="placeRequested.emit(place.name)">Find in Explore</button></div>
          </li>
        </ol>
        <p class="note">{{ data.attribution }}</p>
      </section>
    </section>`,
  styleUrl:'./top-places.component.scss'
})
export class TopPlacesComponent extends DestinationDiscoveryComponent implements OnChanges {
  @Input() override radiusKm=25; @Input() disabled=false; @Input() canFind=false;
  @Output() placeRequested=new EventEmitter<string>();
  @Output() savingChanged=new EventEmitter<boolean>();
  private readonly discovery=inject(DiscoveryService);
  private readonly planningPlaces=inject(PlaceService);
  private readonly planningTrips=inject(TripService);
  private request?:Subscription;
  private tripsRequest?:Subscription;
  private pendingContext=false;
  tripsLoading=false;
  get busy():boolean {return this.isLoading;}
  set busy(value:boolean) {this.isLoading=value;}
  get error():string {return this.errorMessage;}
  set error(value:string) {this.errorMessage=value;}
  constructor() {super();this.autoAddOnSelect=false;}
  override ngOnInit():void {this.syncContext();}
  ngOnChanges(changes:SimpleChanges):void {
    if (['destination','radiusKm','tripId','startDate','endDate'].some(key=>changes[key])) {
      if (this.isSaving) {this.pendingContext=true;return;}
      this.resetPanel();this.syncContext();
    }
  }
  private syncContext():void {
    this.activeTripId=this.tripId || 0;this.searchDestination=this.destination.trim();
    this.activeStartDate=this.startDate;this.activeEndDate=this.endDate;this.savedPlaces=[];
  }
  load():void {
    if(this.busy || this.disabled || this.isSaving || this.destination.trim().length<2)return;
    this.request?.unsubscribe();this.result=null;this.error='';this.successMessage='';this.busy=true;
    if (!this.embeddedMode && !this.tripsLoading && !this.availableTrips.length) {
      this.tripsLoading=true;
      this.tripsRequest=this.planningTrips.getMyTrips().subscribe({
        next:trips=>{this.availableTrips=trips || [];this.tripsLoading=false;},
        error:()=>{this.tripsLoading=false;this.availableTrips=[];}
      });
    }
    this.request=this.discovery.getTopPlaces(this.destination,this.radiusKm).subscribe({
      next:result=>{this.busy=false;this.result=result;},
      error:err=>{this.busy=false;this.error=err?.error?.message || err?.error?.detail || 'Highlights are unavailable. Your regular places are still available.';}
    });
  }
  override async toggleSelection(place:DiscoveredPlace):Promise<void> {
    if(this.disabled || this.isSaving)return;
    await super.toggleSelection(place);
    this.successMessage='';
  }
  override setDayAssignment(place:DiscoveredPlace,day:number|string):void {
    if(this.isSaving || this.disabled)return;
    super.setDayAssignment(place,Math.min(this.availableDayNumbers.length,Math.max(1,Math.trunc(Number(day)||1))));
  }
  override async saveSelected(addToItinerary:boolean):Promise<void> {
    if(this.isSaving || this.disabled || !this.selectedCount)return;
    if(!this.activeTripId || !this.effectiveCanEdit) {this.error='Choose an editable trip before adding places.';return;}
    this.isSaving=true;this.savingChanged.emit(true);
    try {
      // Refresh before writing so a failed itinerary save can reuse an already-saved place on retry.
      this.savedPlaces=await firstValueFrom(this.planningPlaces.getPlaces(this.activeTripId));
      this.isSaving=false;
      await super.saveSelected(addToItinerary);
    } catch(err:any) {this.error=err?.error?.message || 'Unable to check saved places. Please retry.';}
    finally {
      this.isSaving=false;this.savingChanged.emit(false);
      if(this.pendingContext) {this.pendingContext=false;this.resetPanel();this.syncContext();}
    }
  }
  private resetPanel():void {
    this.request?.unsubscribe();this.request=undefined;this.tripsRequest?.unsubscribe();this.tripsRequest=undefined;
    this.tripsLoading=false;this.result=null;this.error='';this.successMessage='';this.busy=false;this.clearSelection();
  }
  close():void {if(!this.isSaving && !this.disabled)this.resetPanel();}
  override ngOnDestroy():void {this.resetPanel();super.ngOnDestroy();}
}
