import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { PlaceIllustrationsService } from '../../../core/services/place-illustrations.service';
import { PlacePhotosService } from '../../../core/services/place-photos.service';
import { PlacePhotoGalleryComponent } from './place-photo-gallery.component';
const artOff={provide:PlaceIllustrationsService,useValue:{enabled:()=>of(false),get:jasmine.createSpy('art.get')}};
const photo=(n:string)=>({url:'https://upload.wikimedia.org/'+n+'.jpg',sourcePage:'https://commons.wikimedia.org/wiki/File:'+n+'.jpg',author:'Photographer',attribution:'Photographer',license:'CC BY-SA 4.0',exact:true,primary:true});
describe('Credited place photo gallery',()=>{
 it('deduplicates, changes the active photo and its credit, and preserves photos on errors',()=>{
  const response=new Subject<any>();const get=jasmine.createSpy().and.returnValue(response);
  TestBed.configureTestingModule({providers:[{provide:PlacePhotosService,useValue:{get}},artOff]});
  const f=TestBed.createComponent(PlacePhotoGalleryComponent);f.componentRef.setInput('externalId','wikidata:Q123');f.componentRef.setInput('name','Edakkal Caves');f.componentRef.setInput('initialImages',[photo('One')]);f.detectChanges();
  f.componentInstance.load();response.next({images:[photo('One'),photo('Two')],message:'Two photos',retryable:false});f.detectChanges();
  expect(f.componentInstance.images.length).toBe(2);expect(f.nativeElement.querySelector('details')).toBeNull();expect(f.nativeElement.textContent).not.toContain('source photos available');f.componentInstance.next();f.detectChanges();
  expect(f.nativeElement.querySelector('img').src).toContain('Two.jpg');expect(f.nativeElement.querySelector('figcaption a').href).toContain('Two.jpg');
  f.componentInstance.load();response.error(new Error('offline'));f.detectChanges();expect(f.componentInstance.images.length).toBe(2);expect(f.nativeElement.textContent).toContain('Retry photos');f.destroy();
 });
 it('rejects regional substitutes, missing credits and unsafe source links',()=>{
  TestBed.configureTestingModule({providers:[{provide:PlacePhotosService,useValue:{get:jasmine.createSpy()}},artOff]});
  const f=TestBed.createComponent(PlacePhotoGalleryComponent);
  f.componentRef.setInput('initialImages',[{...photo('Region'),exact:false},{...photo('Unsafe'),sourcePage:'javascript:alert(1)'},{...photo('NoCredit'),attribution:''},photo('Exact')]);f.detectChanges();
  expect(f.componentInstance.images.length).toBe(1);expect(f.nativeElement.querySelector('img').src).toContain('Exact.jpg');f.destroy();
 });
 it('links to provider photos without copying unverified images',()=>{
  TestBed.configureTestingModule({providers:[{provide:PlacePhotosService,useValue:{get:jasmine.createSpy()}},artOff]});
  const f=TestBed.createComponent(PlacePhotoGalleryComponent);f.componentRef.setInput('officialWebsite','https://venue.example/gallery/');f.detectChanges();
  expect(f.nativeElement.querySelector('.provider-photos').href).toBe('https://venue.example/gallery/');expect(f.nativeElement.querySelector('img')).toBeNull();
  f.componentRef.setInput('officialWebsite','javascript:alert(1)');f.detectChanges();expect(f.nativeElement.querySelector('.provider-photos')).toBeNull();f.destroy();
 });
 it('keeps the gallery and touch controls inside a narrow mobile card',()=>{
  TestBed.configureTestingModule({providers:[{provide:PlacePhotosService,useValue:{get:jasmine.createSpy()}},artOff]});
  const f=TestBed.createComponent(PlacePhotoGalleryComponent);f.componentRef.setInput('initialImages',[photo('One'),photo('Two')]);f.detectChanges();
  f.nativeElement.style.width='140px';document.body.appendChild(f.nativeElement);
  expect(f.nativeElement.scrollWidth).toBeLessThanOrEqual(140);
  for(const button of f.nativeElement.querySelectorAll('nav button'))expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  expect(f.nativeElement.textContent).not.toContain('Find location photos');f.destroy();
 });
 it('never fetches a name-only match and cancels stale place requests',()=>{
  const response=new Subject<any>();const get=jasmine.createSpy().and.returnValue(response);
  TestBed.configureTestingModule({providers:[{provide:PlacePhotosService,useValue:{get}},artOff]});
  const f=TestBed.createComponent(PlacePhotoGalleryComponent);f.componentRef.setInput('name','Same name in two cities');f.detectChanges();f.componentInstance.load();expect(get).not.toHaveBeenCalled();
  f.componentRef.setInput('externalId','wikidata:Q123');f.detectChanges();f.componentInstance.load();
  f.componentRef.setInput('externalId','wikidata:Q456');f.detectChanges();response.next({images:[photo('Old')],message:'',retryable:false});expect(f.componentInstance.images.length).toBe(0);f.destroy();
 });
 it('shows a labelled AI illustration only when no real photo exists',()=>{
  const response=new Subject<any>();const art=new Subject<any>();const artGet=jasmine.createSpy().and.returnValue(art);
  TestBed.configureTestingModule({providers:[{provide:PlacePhotosService,useValue:{get:()=>response}},{provide:PlaceIllustrationsService,useValue:{enabled:()=>of(true),get:artGet}}]});
  const f=TestBed.createComponent(PlacePhotoGalleryComponent);f.componentRef.setInput('externalId','wikidata:Q123');f.componentRef.setInput('name','Emerald Lake');f.detectChanges();
  f.componentInstance.load();response.next({images:[],message:'none',retryable:false});f.detectChanges();
  expect(artGet).toHaveBeenCalledWith('wikidata:Q123');expect(f.nativeElement.textContent).toContain('Creating illustration');
  art.next({imageUrl:'/api/v1/discovery/place-illustrations/image/abc.png',label:'AI illustration',notice:'AI-generated illustration · Not a real photo of this place'});art.complete();f.detectChanges();
  expect(f.nativeElement.querySelector('.ai-badge').textContent).toContain('AI illustration');
  expect(f.nativeElement.querySelector('.ai-note').textContent).toContain('Not a real photo');
  expect(f.nativeElement.querySelector('.ai-figure img').alt).toContain('not a real photo');f.destroy();
 });
 it('never requests an AI illustration when a real photo exists or the feature is off',()=>{
  const response=new Subject<any>();const artGet=jasmine.createSpy();
  TestBed.configureTestingModule({providers:[{provide:PlacePhotosService,useValue:{get:()=>response}},{provide:PlaceIllustrationsService,useValue:{enabled:()=>of(true),get:artGet}}]});
  const f=TestBed.createComponent(PlacePhotoGalleryComponent);f.componentRef.setInput('externalId','wikidata:Q123');f.detectChanges();
  f.componentInstance.load();response.next({images:[photo('Real')],message:'',retryable:false});f.detectChanges();
  expect(artGet).not.toHaveBeenCalled();expect(f.nativeElement.querySelector('.ai-badge')).toBeNull();f.destroy();
  TestBed.resetTestingModule();
  const off=new Subject<any>();const offGet=jasmine.createSpy();
  TestBed.configureTestingModule({providers:[{provide:PlacePhotosService,useValue:{get:()=>off}},{provide:PlaceIllustrationsService,useValue:{enabled:()=>of(false),get:offGet}}]});
  const g=TestBed.createComponent(PlacePhotoGalleryComponent);g.componentRef.setInput('externalId','wikidata:Q9');g.detectChanges();
  g.componentInstance.load();off.next({images:[],message:'',retryable:false});g.detectChanges();
  expect(offGet).not.toHaveBeenCalled();expect(g.nativeElement.textContent).toContain('Photo unavailable');g.destroy();
 });
 it('falls back to a labelled illustration when photo sources are down, and a real photo replaces it later',()=>{
  const response=new Subject<any>();const art=new Subject<any>();const artGet=jasmine.createSpy().and.returnValue(art);
  TestBed.configureTestingModule({providers:[{provide:PlacePhotosService,useValue:{get:()=>response}},{provide:PlaceIllustrationsService,useValue:{enabled:()=>of(true),get:artGet}}]});
  const f=TestBed.createComponent(PlacePhotoGalleryComponent);f.componentRef.setInput('externalId','wikidata:Q5');f.detectChanges();
  f.componentInstance.load();response.next({images:[],message:'Photo sources are temporarily unavailable.',retryable:true});
  art.next({imageUrl:'/x.png',label:'AI illustration',notice:'Not a real photo'});art.complete();f.detectChanges();
  expect(artGet).toHaveBeenCalled();expect(f.nativeElement.querySelector('.ai-badge')).not.toBeNull();
  const retry=new Subject<any>();(f.componentInstance as any).api={get:()=>retry};
  f.componentInstance.load();retry.next({images:[photo('Real')],message:'',retryable:false});f.detectChanges();
  expect(f.nativeElement.querySelector('.ai-badge')).toBeNull();expect(f.nativeElement.querySelector('figure img').src).toContain('Real.jpg');f.destroy();
 });
});
