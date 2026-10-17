import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, OnChanges, OnDestroy, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { DestinationDiscoveryResponse } from '../../core/models/discovery.model';
import { DiscoveryService } from '../../core/services/discovery.service';

@Component({
  selector:'app-top-places',standalone:true,imports:[CommonModule],
  template:`
    <section class="top-places" aria-label="Top 10 places to visit">
      <button type="button" (click)="load()" [disabled]="busy || disabled || destination.trim().length<2">{{ busy ? 'Finding highlights…' : 'Top 10 places to visit' }}</button>
      <p class="note">Free, source-based highlights from OpenStreetMap, Wikidata and the verified catalogue.</p>
      <p *ngIf="busy" role="status">Finding places in {{ destination }}…</p>
      <p *ngIf="error" role="alert">{{ error }}</p>
      <section *ngIf="result as data" aria-live="polite">
        <header><h3>{{ data.places.length }} places to visit in {{ data.resolvedDestination }}</h3><button type="button" (click)="close()">Close</button></header>
        <p class="note">Within {{ data.radiusKm }} km. Selected by editorial verification, source coverage and distance; not visitor ratings.</p>
        <p *ngIf="data.places.length<10" class="note">{{ data.places.length ? 'Fewer than ten supported attractions are available for this area.' : 'No supported highlights were returned. Try a wider radius or another destination.' }}</p>
        <ol>
          <li *ngFor="let place of data.places">
            <div><strong>{{ place.name }}</strong><span class="note">{{ place.category.replaceAll('_',' ').toLowerCase() }} · {{ place.distanceKm }} km</span></div>
            <div class="actions"><a [href]="place.sourceUrl" target="_blank" rel="noopener noreferrer">{{ place.sourceName || 'Source' }} ↗</a><button *ngIf="canFind" type="button" [disabled]="disabled" (click)="placeRequested.emit(place.name)">Find in Explore</button></div>
          </li>
        </ol>
        <details *ngIf="data.warnings?.length"><summary>Source availability</summary><p *ngFor="let warning of data.warnings">{{ warning }}</p></details>
        <p class="note">{{ data.attribution }}</p>
      </section>
    </section>`,
  styles:[`:host{display:block;margin:16px 0}.top-places{border:1px solid #d9e4dc;border-radius:14px;padding:14px;background:white}button{font:inherit;padding:8px 12px;border:1px solid #174a33;border-radius:18px;background:#174a33;color:white;cursor:pointer}button:disabled{opacity:.55;cursor:default}.note{display:block;font-size:12px;color:#55675b;margin:6px 0}header,li,.actions{display:flex;align-items:center;justify-content:space-between;gap:12px}h3{font-size:16px}ol{padding-left:24px;list-style:decimal}li{display:list-item;padding:10px 0;border-bottom:1px solid #edf1ee}li>div{display:inline-block;vertical-align:middle;margin-right:12px}.actions{margin-top:4px}a{color:#174a33;font-size:12px}.actions button{font-size:12px;padding:5px 9px;margin-left:8px}details{font-size:12px;margin-top:12px}`]
})
export class TopPlacesComponent implements OnChanges,OnDestroy {
  @Input() destination=''; @Input() radiusKm=25; @Input() disabled=false; @Input() canFind=false;
  @Output() placeRequested=new EventEmitter<string>();
  private readonly discovery=inject(DiscoveryService);
  private request?:Subscription;
  busy=false;error='';result:DestinationDiscoveryResponse|null=null;
  ngOnChanges():void {this.close();}
  load():void {
    if(this.busy || this.disabled || this.destination.trim().length<2)return;
    this.close();this.busy=true;
    this.request=this.discovery.getTopPlaces(this.destination,this.radiusKm).subscribe({
      next:result=>{this.busy=false;this.result=result;},
      error:err=>{this.busy=false;this.error=err?.error?.message || err?.error?.detail || 'Highlights are unavailable. Your regular places are still available.';}
    });
  }
  close():void {this.request?.unsubscribe();this.request=undefined;this.result=null;this.error='';this.busy=false;}
  ngOnDestroy():void {this.close();}
}
