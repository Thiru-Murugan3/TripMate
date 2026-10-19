import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Trip } from '../../core/models/trip.model';
import { CombinedPlacesComponent } from './combined-places.component';
import { TripadvisorComponent } from './tripadvisor.component';
@Component({
  selector:'app-explore',standalone:true,imports:[CommonModule,CombinedPlacesComponent,TripadvisorComponent],
  template:`
    <nav aria-label="Place sources" class="sources"><button type="button" [attr.aria-pressed]="source==='combined'" (click)="source='combined'">Places & activities</button><button type="button" [attr.aria-pressed]="source==='tripadvisor'" (click)="source='tripadvisor'">Tripadvisor</button></nav>
    <app-combined-places *ngIf="source==='combined'" [tripId]="trip?.id || 0" [destination]="trip?.destination || ''" [startDate]="trip?.startDate || ''" [endDate]="trip?.endDate || ''" [canEdit]="canEdit" (placesChanged)="placesChanged.emit()" (itineraryChanged)="itineraryChanged.emit()"></app-combined-places>
    <app-tripadvisor *ngIf="source==='tripadvisor'" [query]="trip?.destination || ''" [trip]="trip" [canEdit]="canEdit" (placesChanged)="placesChanged.emit()" (itineraryChanged)="itineraryChanged.emit()"></app-tripadvisor>`,
  styles:[`.sources { box-sizing:border-box; min-width:0; flex-wrap:wrap; display:flex; gap:8px; padding:16px 20px 0; max-width:1180px; margin:auto; }.sources button { font:inherit; min-height:44px; min-width:0; overflow-wrap:anywhere; padding:10px 18px; border-radius:24px; border:1px solid #c0d1c5; background:white; color:#174a33; cursor:pointer; }.sources button[aria-pressed=true] { background:#174a33; color:white; } @media(max-width:560px) { .sources { padding:12px 12px 0; gap:8px; } .sources button { flex:1 1 0; padding:10px 8px; font-size:13px; } } @media(max-width:760px) { .sources { padding:0; margin:0 0 14px; gap:4px; border-radius:12px; background:#eaf0f8; padding:4px; } .sources button { flex:1; border:0; border-radius:9px; color:#475569; background:transparent; font-size:12px; padding:10px 8px; } .sources button[aria-pressed=true] { background:white; color:#2563eb; box-shadow:0 2px 6px #0f172a08; } }`]
})
export class ExploreComponent {
  @Input() trip:Trip|null=null; @Input() canEdit=false;
  @Output() itineraryChanged=new EventEmitter<void>(); @Output() placesChanged=new EventEmitter<void>();
  source:'combined'|'tripadvisor'='combined';
}
