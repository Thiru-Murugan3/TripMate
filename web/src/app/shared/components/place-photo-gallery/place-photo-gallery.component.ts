import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, AfterViewInit, NgZone, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { DiscoveryImage } from '../../../core/models/discovery.model';
import { PlacePhotosService, photoSourceId } from '../../../core/services/place-photos.service';
import { PlaceIllustration, PlaceIllustrationsService } from '../../../core/services/place-illustrations.service';
import { CataloguePhoto } from '../../../features/india-catalogue/india-catalogue.service';

@Component({selector:'app-place-photo-gallery',standalone:true,imports:[CommonModule],template:`
 <section class="gallery" [attr.aria-label]="name+' photographs'">
  <figure *ngIf="current as photo;else missing">
   <a [href]="photo.sourcePage" target="_blank" rel="noopener noreferrer"><img [src]="photo.url" [alt]="name+' — source photograph '+(index+1)" loading="lazy" (error)="imageFailed(photo)" /></a>
   <figcaption><a [href]="photo.sourcePage" target="_blank" rel="noopener noreferrer" [title]="photo.attribution+' · '+photo.license"><span class="credit-text">{{photo.attribution}}</span><span class="credit-license">{{photo.license}} ↗</span></a></figcaption>
  </figure>
  <ng-template #missing>
   <figure *ngIf="illustration as art;else noArt" class="ai-figure">
    <div class="ai-frame"><img [src]="art.imageUrl" [alt]="'AI illustration evoking '+name+' (not a real photo)'" loading="lazy" (error)="illustration=null" /><span class="ai-badge">✦ {{art.label}}</span></div>
    <figcaption class="ai-note">{{art.notice}}</figcaption>
   </figure>
   <ng-template #noArt><div class="missing">{{illustrating ? 'Creating illustration…' : 'Photo unavailable'}}</div></ng-template>
  </ng-template>
  <nav *ngIf="images.length>1" aria-label="Photo navigation"><button type="button" (click)="previous()" aria-label="Previous photo">‹</button><span>{{index+1}} / {{images.length}} photos</span><button type="button" (click)="next()" aria-label="Next photo">›</button></nav>
  <a *ngIf="!images.length && providerPhotoPage" class="provider-photos" [href]="providerPhotoPage" target="_blank" rel="noopener noreferrer">View provider photos ↗</a>
 <p *ngIf="loading" role="status" class="availability">Loading photos…</p>
  <button *ngIf="sourceId && !loading && (retryable || (!requested && images.length<2))" class="retry" type="button" (click)="load()">{{retryable ? 'Retry photos' : 'Find location photos'}}</button>
 </section>`,styles:[`
 :host{display:block;min-width:0;overflow-wrap:anywhere}.gallery{background:#fff}figure{margin:0}img{display:block;width:100%;height:170px;object-fit:cover;background:#effaf8}figcaption{font-size:10px;line-height:1.45;padding:6px 10px}figcaption a{display:flex;gap:6px;align-items:baseline;text-decoration:none}figcaption .credit-text{flex:1;min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:#475569}figcaption .credit-license{flex-shrink:0;color:#115e59;font-weight:600}figcaption a:hover .credit-text{color:#1e293b}a{color:#115e59}.ai-frame{position:relative}.ai-badge{position:absolute;left:8px;top:8px;padding:3px 8px;border-radius:999px;background:rgba(15,23,42,.72);color:#fff;font-size:10px;font-weight:700;letter-spacing:.02em;backdrop-filter:blur(4px)}.ai-note{font-size:10px;line-height:1.45;padding:6px 10px;color:#115e59;background:#fffbeb}.missing{min-height:110px;display:grid;place-items:center;text-align:center;padding:12px;background:#f1f5f9;color:#64748b;font-size:12px}nav{display:flex;align-items:center;justify-content:space-between;padding:0 4px;gap:4px}nav span{min-width:0;text-align:center;font-size:10px;color:#475569}button{min-height:44px;min-width:44px;border:0;border-radius:9px;background:#effaf8;color:#0f766e;cursor:pointer;font:inherit}.provider-photos{display:flex;align-items:center;min-height:44px;padding:0 10px;font-size:11px}.availability{font-size:10px;color:#64748b;padding:0 10px;margin:6px 0}.retry{font-size:11px;margin:4px 10px;max-width:calc(100% - 20px);padding:8px}details{font-size:10px;padding:0 10px;color:#475569}summary{min-height:44px;display:flex;align-items:center;cursor:pointer}details p{line-height:1.5}button:focus-visible,a:focus-visible{outline:3px solid #f6d27a;outline-offset:2px}@media(max-width:760px){img{height:112px}.missing{min-height:112px;font-size:11px}}@media(max-width:359px){img{height:100px}.missing{min-height:100px}}
 `]})
export class PlacePhotoGalleryComponent implements OnChanges,AfterViewInit,OnDestroy {
 @Input() officialWebsite='';@Input() externalId='';@Input() sourceUrl='';@Input() name='Place';@Input() initialImages:DiscoveryImage[]=[];
 @Input() cataloguePhoto:CataloguePhoto|null=null;@Input() assetRoot='';
 private zone=inject(NgZone);private api=inject(PlacePhotosService);private art=inject(PlaceIllustrationsService);
 illustration:PlaceIllustration|null=null;illustrating=false;private artRequest?:Subscription;
 private request?:Subscription;private ready=false;private destroyed=false;
 images:DiscoveryImage[]=[];index=0;loading=false;retryable=false;requested=false;message='';sourceId:string|null=null;
 get providerPhotoPage():string|null {try {const u=new URL(this.officialWebsite);return u.protocol==='https:'&&!u.username&&!u.password ? u.href : null;} catch {return null;}}
 get current():DiscoveryImage|undefined{return this.images[this.index];}
 ngOnChanges():void {
  this.request?.unsubscribe();this.artRequest?.unsubscribe();this.illustration=null;this.illustrating=false;this.loading=false;this.requested=false;this.retryable=false;this.message='';this.index=0;
  this.sourceId=photoSourceId(this.externalId,this.sourceUrl);this.images=this.distinct(this.initialImages || []);
  const p=this.cataloguePhoto;
  if(p?.local_thumbnail && p.source_page && p.license && p.creator)this.images=this.distinct([...this.images,{url:this.assetRoot+p.local_thumbnail,sourcePage:p.source_page,sourceName:'Catalogue source',author:p.creator,license:p.license,attribution:p.attribution_text||p.creator,exact:true,primary:true}]);
  if(!this.sourceId && this.images.length<2)this.message='Additional photographs need an exact source identity. No name-only or nearby substitutes were used.';
  if(!this.sourceId && !this.images.length)this.illustrate();
  if(this.ready)this.loadRenderedPage();
 }
 ngAfterViewInit():void {this.ready=true;this.loadRenderedPage();}
 private loadRenderedPage():void {
  // Load only the rendered result page. The shared service queues three requests at a time.
  queueMicrotask(()=>{if(!this.destroyed && this.sourceId && this.images.length<2 && !this.requested)this.zone.run(()=>this.load());});
 }
 load():void {
  if(!this.sourceId || this.loading)return;this.loading=true;this.requested=true;this.retryable=false;
  this.request=this.api.get(this.sourceId).subscribe({next:r=>{this.images=this.distinct([...this.images,...r.images]).slice(0,2);this.index=0;this.loading=false;this.retryable=r.retryable;this.message=r.message;if(this.images.length){this.illustration=null;}else this.illustrate();},error:()=>{this.loading=false;this.retryable=true;this.message='Photos are temporarily unavailable. Existing photos remain available.';if(!this.images.length)this.illustrate();}});
 }
 previous():void{this.index=(this.index+this.images.length-1)%this.images.length;}next():void{this.index=(this.index+1)%this.images.length;}
 imageFailed(photo:DiscoveryImage):void {this.images=this.images.filter(i=>i!==photo);this.index=0;this.retryable=!!this.sourceId;this.message='A source photo could not load. Retry to check available photographs.';}
 private distinct(images:DiscoveryImage[]):DiscoveryImage[]{const seen=new Set<string>();const urls=new Set<string>();return images.filter(i=>{if(!i.exact || !i.sourcePage || !/^https?:\/\//i.test(i.sourcePage) || !i.license || !i.attribution || !/^(https?:\/\/|india-catalogue\/)/i.test(i.url))return false;const key=i.sourcePage.split(/[?#]/)[0];if(seen.has(key) || urls.has(i.url))return false;seen.add(key);urls.add(i.url);return true;});}
 /** Real photos always win; a labelled AI illustration only fills an otherwise empty card. */
 private illustrate():void {
  const id=this.externalId;if(!id || this.illustration || this.illustrating || this.images.length)return;
  this.artRequest?.unsubscribe();
  this.artRequest=this.art.enabled().subscribe(on=>{
   if(!on || this.destroyed || this.images.length || id!==this.externalId)return;
   this.illustrating=true;
   this.artRequest=this.art.get(id).subscribe({
    next:a=>{if(!this.images.length && id===this.externalId)this.illustration=a;this.illustrating=false;},
    error:()=>{this.illustrating=false;},complete:()=>{this.illustrating=false;}
   });
  });
 }
 ngOnDestroy():void{this.destroyed=true;this.request?.unsubscribe();this.artRequest?.unsubscribe();}
}
