import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Trip } from '../../core/models/trip.model';
import { CombinedPlacesComponent } from './combined-places.component';
@Component({
  selector:'app-explore',standalone:true,imports:[CombinedPlacesComponent],
  template:`<app-combined-places [tripId]="trip?.id || 0" [destination]="trip?.destination || ''" [startDate]="trip?.startDate || ''" [endDate]="trip?.endDate || ''" [canEdit]="canEdit" (placesChanged)="placesChanged.emit()" (itineraryChanged)="itineraryChanged.emit()"></app-combined-places>`
})
export class ExploreComponent {
  @Input() trip:Trip|null=null; @Input() canEdit=false;
  @Output() itineraryChanged=new EventEmitter<void>(); @Output() placesChanged=new EventEmitter<void>();
}
