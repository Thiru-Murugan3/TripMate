import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Trip } from '../../core/models/trip.model';
import { CombinedPlacesComponent } from './combined-places.component';
import { TripadvisorComponent } from './tripadvisor.component';
@Component({
  selector:'app-explore',standalone:true,imports:[CommonModule,CombinedPlacesComponent,TripadvisorComponent],
  template:`
    <nav aria-label="Place sources" class="sources"><button type="button" [attr.aria-pressed]="source==='combined'" (click)="source='combined'">Combined places</button><button type="button" [attr.aria-pressed]="source==='tripadvisor'" (click)="source='tripadvisor'">Tripadvisor</button></nav>
    <app-combined-places *ngIf="source==='combined'" [tripId]="trip?.id || 0" [destination]="trip?.destination || ''" [startDate]="trip?.startDate || ''" [endDate]="trip?.endDate || ''" [canEdit]="canEdit" (placesChanged)="placesChanged.emit()" (itineraryChanged)="itineraryChanged.emit()"></app-combined-places>
    <app-tripadvisor *ngIf="source==='tripadvisor'" [query]="trip?.destination || ''" [trip]="trip" [canEdit]="canEdit" (itineraryChanged)="itineraryChanged.emit()"></app-tripadvisor>`,
  styles:[`.sources { display:flex; gap:8px; padding:16px 20px 0; max-width:1180px; margin:auto; }.sources button { padding:10px 18px; border-radius:24px; border:1px solid #c0d1c5; background:white; color:#174a33; cursor:pointer; }.sources button[aria-pressed=true] { background:#174a33; color:white; }`]
})
export class ExploreComponent {
  @Input() trip:Trip|null=null; @Input() canEdit=false;
  @Output() itineraryChanged=new EventEmitter<void>(); @Output() placesChanged=new EventEmitter<void>();
  source:'combined'|'tripadvisor'='combined';
}
