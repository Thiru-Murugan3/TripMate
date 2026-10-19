import {AfterViewInit,Component,ElementRef,Input,NgZone,OnChanges,OnDestroy,ViewChild,inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import * as L from 'leaflet';

export interface RouteMapPoint {id:string;name:string;latitude:number;longitude:number;}

@Component({selector:'app-day-route-map',standalone:true,imports:[CommonModule],template:`
 <div #canvas class="route-map" role="region" [attr.aria-label]="'Day '+dayNumber+' sightseeing route map'" tabindex="0"></div>
 <p *ngIf="tilesUnavailable" role="status">Map background unavailable. Your route stops are still shown.</p>
`,styles:[`:host{display:block;min-width:0}.route-map{height:340px;min-width:0;width:100%;border-radius:12px;background:#e9f0e7;isolation:isolate}p{font-size:12px;color:#64748b}@media(max-width:560px){.route-map{height:300px}}`]})
export class DayRouteMapComponent implements AfterViewInit,OnChanges,OnDestroy {
 @Input() stops:RouteMapPoint[]=[];@Input() dayNumber=1;
 @ViewChild('canvas',{static:true}) canvas!:ElementRef<HTMLDivElement>;
 private readonly zone=inject(NgZone);private map?:L.Map;private layers?:L.LayerGroup;private resize?:ResizeObserver;
 private signature='';private ready=false;private destroyed=false;
 tilesUnavailable=false;
 ngAfterViewInit():void{this.ready=true;this.zone.runOutsideAngular(()=>{this.resize=new ResizeObserver(()=>this.render());this.resize.observe(this.canvas.nativeElement);this.render();});}
 ngOnChanges():void{if(this.ready)this.zone.runOutsideAngular(()=>this.render());}
 private render():void{
  const element=this.canvas.nativeElement;
  if(this.destroyed||!element.clientWidth||!element.clientHeight)return;
  if(!this.map){
   this.map=L.map(element,{scrollWheelZoom:false});
   const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(this.map);
   tiles.on('tileerror',()=>this.zone.run(()=>this.tilesUnavailable=true));
   tiles.on('tileload',()=>{if(this.tilesUnavailable)this.zone.run(()=>this.tilesUnavailable=false);});
   this.layers=L.layerGroup().addTo(this.map);
  }
  this.map.invalidateSize({pan:false});
  const points=this.stops.filter(p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180);
  const signature=JSON.stringify(points);if(signature===this.signature)return;this.signature=signature;
  this.layers!.clearLayers();if(!points.length){this.map.setView([20.5937,78.9629],5);return;}
  const coordinates=points.map(p=>L.latLng(p.latitude,p.longitude));
  L.polyline(coordinates,{color:'#2563eb',weight:4,dashArray:'8 8'}).addTo(this.layers!);
  points.forEach((point,index)=>{
   if(index===points.length-1&&index>0&&point.latitude===points[0].latitude&&point.longitude===points[0].longitude)return;
   const label=index===0?'H':String(index),color=index===0?'#166534':'#2563eb';
   const icon=L.divIcon({className:'sightseeing-number',html:`<span style="display:grid;place-items:center;width:32px;height:32px;border:3px solid white;border-radius:50%;background:${color};color:white;font:bold 15px sans-serif;box-shadow:0 2px 8px #0005">${label}</span>`,iconSize:[38,38],iconAnchor:[19,19]});
   const text=document.createElement('span');text.textContent=(index===0?'Stay: ':index+'. ')+point.name;
   L.marker(coordinates[index],{icon,title:text.textContent,keyboard:true}).bindTooltip(text).addTo(this.layers!);
  });
  for(let i=1;i<coordinates.length;i++){
   const from=this.map.project(coordinates[i-1],10),to=this.map.project(coordinates[i],10);if(from.distanceTo(to)<0.01)continue;
   const angle=Math.atan2(to.y-from.y,to.x-from.x)*180/Math.PI;
   const midpoint=L.latLng((coordinates[i-1].lat+coordinates[i].lat)/2,(coordinates[i-1].lng+coordinates[i].lng)/2);
   L.marker(midpoint,{interactive:false,keyboard:false,icon:L.divIcon({className:'route-direction',html:`<span style="display:block;color:#1d4ed8;font-size:22px;transform:rotate(${angle}deg)">➤</span>`,iconSize:[22,22],iconAnchor:[11,11]})}).addTo(this.layers!);
  }
  this.map.fitBounds(L.latLngBounds(coordinates),{padding:[32,32],maxZoom:15,animate:false});
 }
 ngOnDestroy():void{this.destroyed=true;this.resize?.disconnect();this.map?.remove();}
}
