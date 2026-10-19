import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PlacePhotosService, photoSourceId } from './place-photos.service';
describe('Exact photo identity',()=>{
 it('accepts linked Wikidata and OSM IDs without guessing from names',()=>{
  expect(photoSourceId('wd-Q123')).toBe('wikidata:Q123');
  expect(photoSourceId('wikidata:Q123')).toBe('wikidata:Q123');
  expect(photoSourceId('other','https://www.openstreetmap.org/way/123')).toBe('osm:way:123');
  for(const url of ['https://www.wikidata.org.evil.test/wiki/Q123','https://user@www.wikidata.org/wiki/Q123','https://tourism.example/place'])expect(photoSourceId('unknown',url)).toBeNull();
 });
});

describe('Photo request queue',()=>{
 it('limits concurrent requests, skips cancelled queued cards and releases failed slots',()=>{
  TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting()]});
  const service=TestBed.inject(PlacePhotosService),http=TestBed.inject(HttpTestingController);
  for(const id of [1,2,3])service.get('wikidata:Q'+id).subscribe({error:()=>{}});
  const cancelled=service.get('wikidata:Q4').subscribe();cancelled.unsubscribe();
  let result:any;service.get('wikidata:Q5').subscribe(r=>result=r);
  const first=http.match(()=>true);expect(first.length).toBe(3);
  first[0].flush({}, {status:503,statusText:'Unavailable'});
  http.expectNone(r=>r.params.get('sourceId')==='wikidata:Q4');
  http.expectOne(r=>r.params.get('sourceId')==='wikidata:Q5').flush({images:[],message:'No photos',retryable:false});
  for(const req of first.slice(1))req.flush({images:[],message:'',retryable:false});
  expect(result.message).toBe('No photos');http.verify();
 });
});
