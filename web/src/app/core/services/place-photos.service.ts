import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DiscoveryImage } from '../models/discovery.model';
import { environment } from '../../../environments/environment';
export interface PlacePhotoGallery { images:DiscoveryImage[];message:string;retryable:boolean; }
export function photoSourceId(externalId:string, sourceUrl=''):string|null {
  const wd=/^(?:wikidata:|wd-)(Q[1-9][0-9]{0,14})$/.exec(externalId);
  if(wd)return 'wikidata:'+wd[1];
  if(/^osm:(node|way|relation):[1-9][0-9]{0,18}$/.test(externalId))return externalId;
  try {
    const u=new URL(sourceUrl);if(u.protocol!=='https:' || u.username || u.password)return null;
    if(u.hostname==='www.wikidata.org' || u.hostname==='wikidata.org') {
      const m=/^\/(?:wiki|entity)\/(Q[1-9][0-9]{0,14})$/.exec(u.pathname);return m?'wikidata:'+m[1]:null;
    }
    if(u.hostname==='www.openstreetmap.org' || u.hostname==='openstreetmap.org') {
      const m=/^\/(node|way|relation)\/([1-9][0-9]{0,18})$/.exec(u.pathname);return m?'osm:'+m[1]+':'+m[2]:null;
    }
  } catch {}
  return null;
}
@Injectable({providedIn:'root'})
export class PlacePhotosService {
  private http=inject(HttpClient);
  get(sourceId:string) {return this.http.get<PlacePhotoGallery>(`${environment.apiUrl}/discovery/place-photos`,{params:{sourceId}});}
}
