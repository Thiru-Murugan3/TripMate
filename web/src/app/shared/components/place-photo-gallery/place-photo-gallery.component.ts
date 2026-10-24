import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, AfterViewInit, NgZone, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { DiscoveryImage } from '../../../core/models/discovery.model';
import { PlacePhotosService, photoSourceId } from '../../../core/services/place-photos.service';
import { CataloguePhoto } from '../../../features/india-catalogue/india-catalogue.service';

@Component({selector:'app-place-photo-gallery',standalone:true,imports:[CommonModule],template:`
 <section class="gallery" [attr.aria-label]="name+' photographs'">
  <figure *ngIf="current as photo;else missing">
   <a [href]="photo.sourcePage" target="_blank" rel="noopener noreferrer"><img [src]="photo.url" [alt]="name+' — source photograph '+(index+1)" loading="lazy" (error)="imageFailed(photo)" /></a>
   <figcaption><a [href]="photo.sourcePage" target="_blank" rel="noopener noreferrer">{{photo.attribution}} · {{photo.license}} ↗</a></figcaption>
  </figure>
  <ng-template #missing><div class="missing">Photo unavailable</div></ng-template>
  <nav *ngIf="images.length>1" aria-label="Photo navigation"><button type="button" (click)="previous()" aria-label="Previous photo">‹</button><span>{{index+1}} / {{images.length}} photos</span><button type="button" (click)="next()" aria-label="Next photo">›</button></nav>
  <p *ngIf="loading" role="status" class="availability">Loading photos…</p>
  <button *ngIf="sourceId && !loading && (retryable || (!requested && images.length<2))" class="retry" type="button" (click)="load()">{{retryable ? 'Retry photos' : 'Find location photos'}}</button>
 </section>`,styles:[`
 :host{display:block;min-width:0;overflow-wrap:anywhere}.gallery{background:#fff}figure{margin:0}img{display:block;width:100%;height:170px;object-fit:cover;background:#eff6ff}figcaption{font-size:10px;line-height:1.5;padding:6px 10px}a{color:#1d4ed8}.missing{min-height:110px;display:grid;place-items:center;text-align:center;padding:12px;background:#f1f5f9;color:#64748b;font-size:12px}nav{display:flex;align-items:center;justify-content:space-between;padding:0 4px;gap:4px}nav span{min-width:0;text-align:center;font-size:10px;color:#475569}button{min-height:44px;min-width:44px;border:0;border-radius:9px;background:#eff6ff;color:#2563eb;cursor:pointer;font:inherit}.availability{font-size:10px;color:#64748b;padding:0 10px;margin:6px 0}.retry{font-size:11px;margin:4px 10px;max-width:calc(100% - 20px);padding:8px}details{font-size:10px;padding:0 10px;color:#475569}summary{min-height:44px;display:flex;align-items:center;cursor:pointer}details p{line-height:1.5}button:focus-visible,a:focus-visible{outline:3px solid #38bdf8;outline-offset:2px}@media(max-width:760px){img{height:112px}.missing{min-height:112px;font-size:11px}}@media(max-width:359px){img{height:100px}.missing{min-height:100px}}
 `]})
export class PlacePhotoGalleryComponent implements OnChanges,AfterViewInit,OnDestroy {
 @Input() externalId='';@Input() sourceUrl='';@Input() name='Place';@Input() initialImages:DiscoveryImage[]=[];
 @Input() cataloguePhoto:CataloguePhoto|null=null;@Input() assetRoot='';
 private zone=inject(NgZone);private api=inject(PlacePhotosService);
 private request?:Subscription;private ready=false;private destroyed=false;
 images:DiscoveryImage[]=[];index=0;loading=false;retryable=false;requested=false;message='';sourceId:string|null=null;
 get current():DiscoveryImage|undefined{return this.images[this.index];}
 ngOnChanges():void {
  this.request?.unsubscribe();this.loading=false;this.requested=false;this.retryable=false;this.message='';this.index=0;
  this.sourceId=photoSourceId(this.externalId,this.sourceUrl);this.images=this.distinct(this.initialImages || []);
  const p=this.cataloguePhoto;
  if(p?.local_thumbnail && p.source_page && p.license && p.creator)this.images=this.distinct([...this.images,{url:this.assetRoot+p.local_thumbnail,sourcePage:p.source_page,sourceName:'Catalogue source',author:p.creator,license:p.license,attribution:p.attribution_text||p.creator,exact:true,primary:true}]);
  if(!this.sourceId && this.images.length<2)this.message='Additional photographs need an exact source identity. No name-only or nearby substitutes were used.';
  if(this.ready)this.loadRenderedPage();
 }
 ngAfterViewInit():void {this.ready=true;this.loadRenderedPage();}
 private loadRenderedPage():void {
  // Load only the rendered result page. The shared service queues three requests at a time.
  queueMicrotask(()=>{if(!this.destroyed && this.sourceId && this.images.length<2 && !this.requested)this.zone.run(()=>this.load());});
 }
 load():void {
  if(!this.sourceId || this.loading)return;this.loading=true;this.requested=true;this.retryable=false;
  this.request=this.api.get(this.sourceId).subscribe({next:r=>{this.images=this.distinct([...this.images,...r.images]).slice(0,2);this.index=0;this.loading=false;this.retryable=r.retryable;this.message=r.message;},error:()=>{this.loading=false;this.retryable=true;this.message='Photos are temporarily unavailable. Existing photos remain available.';}});
 }
 previous():void{this.index=(this.index+this.images.length-1)%this.images.length;}next():void{this.index=(this.index+1)%this.images.length;}
 imageFailed(photo:DiscoveryImage):void {this.images=this.images.filter(i=>i!==photo);this.index=0;this.retryable=!!this.sourceId;this.message='A source photo could not load. Retry to check available photographs.';}
 private distinct(images:DiscoveryImage[]):DiscoveryImage[]{const seen=new Set<string>();const urls=new Set<string>();return images.filter(i=>{if(!i.exact || !i.sourcePage || !/^https?:\/\//i.test(i.sourcePage) || !i.license || !i.attribution || !/^(https?:\/\/|india-catalogue\/)/i.test(i.url))return false;const key=i.sourcePage.split(/[?#]/)[0];if(seen.has(key) || urls.has(i.url))return false;seen.add(key);urls.add(i.url);return true;});}
 ngOnDestroy():void{this.destroyed=true;this.request?.unsubscribe();}
}
