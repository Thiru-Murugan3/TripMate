import {AfterViewInit,Component,ElementRef,Input,NgZone,OnChanges,OnDestroy,ViewChild,inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import * as L from 'leaflet';

export interface RouteMapPoint {id:string;name:string;latitude:number;longitude:number;}

@Component({selector:'app-day-route-map',standalone:true,imports:[CommonModule],template:`
 <div #frame class="route-map-frame" [class.is-fullscreen]="fullscreen" [attr.role]="fullscreen ? 'dialog' : null" [attr.aria-modal]="fullscreen ? 'true' : null" [attr.aria-label]="fullscreen ? 'Day '+dayNumber+' route map, full screen' : null">
  <div #canvas class="route-map" role="region" [attr.aria-label]="'Day '+dayNumber+' sightseeing route map'" tabindex="0"></div>
  <span *ngIf="fullscreen" class="fullscreen-title">Day {{ dayNumber }} route</span>
  <button type="button" class="fullscreen-btn" (click)="toggleFullscreen()" [attr.aria-label]="fullscreen ? 'Exit full screen map' : 'Expand Day '+dayNumber+' map to full screen'" [attr.aria-pressed]="fullscreen">
   <span class="material-symbols-outlined" aria-hidden="true">{{ fullscreen ? 'close_fullscreen' : 'open_in_full' }}</span>
  </button>
 </div>
 <p *ngIf="tilesUnavailable" role="status">Map background unavailable. Your route stops are still shown.</p>
`,styles:[`
 :host{display:block;min-width:0}
 .route-map-frame{position:relative;min-width:0}
 .route-map{height:340px;min-width:0;width:100%;border-radius:12px;background:#e9f0e7;isolation:isolate}
 .fullscreen-btn{position:absolute;top:10px;right:10px;z-index:500;display:grid;place-items:center;width:44px;height:44px;padding:0;border:1px solid #d9ecea;border-radius:12px;background:#fff;color:#0b3c49;box-shadow:0 4px 14px rgba(15,23,42,.18);cursor:pointer}
 .fullscreen-btn:focus-visible{outline:3px solid #0f766e;outline-offset:2px}
 .fullscreen-btn .material-symbols-outlined{font-size:22px}
 .route-map-frame.is-fullscreen{position:fixed;inset:0;z-index:5000;background:#e9f0e7;padding:var(--safe-area-inset-top,env(safe-area-inset-top,0px)) var(--safe-area-inset-right,env(safe-area-inset-right,0px)) var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)) var(--safe-area-inset-left,env(safe-area-inset-left,0px))}
 .route-map-frame.is-fullscreen .route-map{height:100%;border-radius:0}
 .route-map-frame.is-fullscreen .fullscreen-btn{top:calc(12px + var(--safe-area-inset-top,env(safe-area-inset-top,0px)));right:calc(12px + var(--safe-area-inset-right,env(safe-area-inset-right,0px)))}
 .fullscreen-title{position:absolute;z-index:500;top:calc(12px + var(--safe-area-inset-top,env(safe-area-inset-top,0px)));left:calc(12px + var(--safe-area-inset-left,env(safe-area-inset-left,0px)));padding:10px 14px;border-radius:12px;background:#fff;color:#0b3c49;font-weight:800;font-size:14px;box-shadow:0 4px 14px rgba(15,23,42,.18)}
 p{font-size:12px;color:#64748b}
 @media(max-width:560px){.route-map{height:300px}}
`]})
export class DayRouteMapComponent implements AfterViewInit,OnChanges,OnDestroy {
 @Input() roadPath:number[][]=[];@Input() stops:RouteMapPoint[]=[];@Input() dayNumber=1;
 @ViewChild('canvas',{static:true}) canvas!:ElementRef<HTMLDivElement>;
 @ViewChild('frame',{static:true}) frame!:ElementRef<HTMLDivElement>;
 private readonly zone=inject(NgZone);private map?:L.Map;private layers?:L.LayerGroup;private resize?:ResizeObserver;
 private signature='';private ready=false;private destroyed=false;
 private placeholder?:Comment;private previousOverflow='';
 fullscreen=false;
 tilesUnavailable=false;
 private readonly onKeydown=(event:KeyboardEvent)=>{if(event.key==='Escape'&&this.fullscreen)this.zone.run(()=>this.toggleFullscreen());};
 ngAfterViewInit():void{this.ready=true;this.zone.runOutsideAngular(()=>{this.resize=new ResizeObserver(()=>this.render());this.resize.observe(this.canvas.nativeElement);this.render();});}
 ngOnChanges():void{if(this.ready)this.zone.runOutsideAngular(()=>this.render());}

 /**
  * The routed page is its own stacking context, so a fixed overlay inside it would sit under
  * the header and tab bar. While full screen, the map frame moves to <body> and comes back after.
  */
 toggleFullscreen():void{
  const frame=this.frame.nativeElement;
  if(!this.fullscreen){
   this.placeholder=document.createComment('route-map');
   frame.replaceWith(this.placeholder);
   document.body.appendChild(frame);
   this.previousOverflow=document.body.style.overflow;
   document.body.style.overflow='hidden';
   document.addEventListener('keydown',this.onKeydown);
   this.fullscreen=true;
  }else{
   this.restoreFrame();
   this.fullscreen=false;
  }
  this.map?.scrollWheelZoom[this.fullscreen?'enable':'disable']();
  // Re-fit the route to the new size once the layout has settled.
  requestAnimationFrame(()=>{this.signature='';this.zone.runOutsideAngular(()=>this.render());this.frame.nativeElement.querySelector<HTMLButtonElement>('.fullscreen-btn')?.focus();});
 }

 private restoreFrame():void{
  const frame=this.frame.nativeElement;
  if(this.placeholder?.parentNode){this.placeholder.replaceWith(frame);}else{frame.remove();}
  this.placeholder=undefined;
  document.body.style.overflow=this.previousOverflow;
  document.removeEventListener('keydown',this.onKeydown);
 }

 private markerLayer?:L.LayerGroup;private markerStops:Array<{point:RouteMapPoint;label:string;coordinate:L.LatLng}>=[];
 private lastSize='';

 private render():void{
  const element=this.canvas.nativeElement;
  if(this.destroyed||!element.clientWidth||!element.clientHeight)return;
  if(!this.map){
   this.map=L.map(element,{scrollWheelZoom:false});
   const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(this.map);
   tiles.on('tileerror',()=>this.zone.run(()=>this.tilesUnavailable=true));
   tiles.on('tileload',()=>{if(this.tilesUnavailable)this.zone.run(()=>this.tilesUnavailable=false);});
   this.layers=L.layerGroup().addTo(this.map);
   this.markerLayer=L.layerGroup().addTo(this.map);
   // Spacing between nearby markers depends on zoom, so lay them out again after each zoom.
   this.map.on('zoomend',()=>this.drawMarkers());
  }
  this.map.invalidateSize({pan:false});
  const points=this.stops.filter(p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180);
  const road=this.roadPath.filter(p=>p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=90&&Math.abs(p[1])<=180);
  // Re-fit when the stops change and also when the map box changes size, so no stop sits off-screen.
  const size=`${element.clientWidth}x${element.clientHeight}`;
  const signature=JSON.stringify([points,road]);
  if(signature===this.signature&&size===this.lastSize)return;
  const stopsChanged=signature!==this.signature;
  this.signature=signature;this.lastSize=size;
  if(!points.length){this.layers!.clearLayers();this.markerLayer!.clearLayers();this.markerStops=[];this.map.setView([20.5937,78.9629],5);return;}
  const coordinates=points.map(p=>L.latLng(p.latitude,p.longitude));
  if(stopsChanged){
   this.layers!.clearLayers();
   L.polyline(road.length>1?road.map(p=>L.latLng(p[0],p[1])):coordinates,{color:'#0f766e',weight:4,dashArray:road.length>1?undefined:'8 8'}).addTo(this.layers!);
   for(let i=1;road.length<2&&i<coordinates.length;i++){
    const from=this.map.project(coordinates[i-1],10),to=this.map.project(coordinates[i],10);if(from.distanceTo(to)<0.01)continue;
    const angle=Math.atan2(to.y-from.y,to.x-from.x)*180/Math.PI;
    const midpoint=L.latLng((coordinates[i-1].lat+coordinates[i].lat)/2,(coordinates[i-1].lng+coordinates[i].lng)/2);
    L.marker(midpoint,{interactive:false,keyboard:false,icon:L.divIcon({className:'route-direction',html:`<span style="display:block;color:#115e59;font-size:22px;transform:rotate(${angle}deg)">➤</span>`,iconSize:[22,22],iconAnchor:[11,11]})}).addTo(this.layers!);
   }
   // Every stop gets a marker; only the closing "return to stay" stop is skipped (it repeats H).
   this.markerStops=points
    .map((point,index)=>({point,label:index===0?'H':String(index),coordinate:coordinates[index]}))
    .filter((_,index)=>!(index===points.length-1&&index>0&&points[index].latitude===points[0].latitude&&points[index].longitude===points[0].longitude));
  }
  this.map.fitBounds(L.latLngBounds([...coordinates,...road.map(p=>L.latLng(p[0],p[1]))]),{padding:[40,40],maxZoom:15,animate:false});
  this.drawMarkers();
 }

 /**
  * Draws one numbered marker per stop. Stops that are at (or very near) the same spot would
  * hide each other, so markers closer than one marker-width are fanned out around that spot.
  */
 private drawMarkers():void{
  if(!this.map||!this.markerLayer)return;
  this.markerLayer.clearLayers();
  const minGap=34,placed:L.Point[]=[];
  // Candidate offsets: the true spot, then 6 around it, then 12 further out.
  const candidates=[L.point(0,0)];
  for(const [ring,slots] of [[1,6],[2,12]]){
   for(let slot=0;slot<slots;slot++){
    const angle=(slot/slots)*2*Math.PI-Math.PI/2;
    candidates.push(L.point(Math.round(Math.cos(angle)*minGap*ring),Math.round(Math.sin(angle)*minGap*ring)));
   }
  }
  this.markerStops.forEach(({point,label,coordinate})=>{
   const origin=this.map!.latLngToLayerPoint(coordinate);
   const offset=candidates.find(c=>placed.every(p=>p.distanceTo(origin.add(c))>=minGap))??candidates[candidates.length-1];
   placed.push(origin.add(offset));
   const color=label==='H'?'#166534':'#0f766e';
   const icon=L.divIcon({className:'sightseeing-number',html:`<span style="display:grid;place-items:center;width:32px;height:32px;border:3px solid white;border-radius:50%;background:${color};color:white;font:bold 15px sans-serif;box-shadow:0 2px 8px #0005">${label}</span>`,iconSize:[38,38],iconAnchor:[19-offset.x,19-offset.y]});
   const text=document.createElement('span');text.textContent=(label==='H'?'Stay: ':label+'. ')+point.name;
   L.marker(coordinate,{icon,title:text.textContent,keyboard:true,zIndexOffset:label==='H'?1000:0}).bindTooltip(text).addTo(this.markerLayer!);
  });
 }
 ngOnDestroy():void{
  this.destroyed=true;
  if(this.fullscreen)this.restoreFrame();
  this.resize?.disconnect();this.map?.remove();
 }
}
