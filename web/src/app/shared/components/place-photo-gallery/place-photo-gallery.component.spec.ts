import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { PlacePhotosService } from '../../../core/services/place-photos.service';
import { PlacePhotoGalleryComponent } from './place-photo-gallery.component';
const photo=(n:string)=>({url:'https://upload.wikimedia.org/'+n+'.jpg',sourcePage:'https://commons.wikimedia.org/wiki/File:'+n+'.jpg',author:'Photographer',attribution:'Photographer',license:'CC BY-SA 4.0',exact:true,primary:true});
describe('Credited place photo gallery',()=>{
 it('deduplicates, changes the active photo and its credit, and preserves photos on errors',()=>{
  const response=new Subject<any>();const get=jasmine.createSpy().and.returnValue(response);
  TestBed.configureTestingModule({providers:[{provide:PlacePhotosService,useValue:{get}}]});
  const f=TestBed.createComponent(PlacePhotoGalleryComponent);f.componentRef.setInput('externalId','wikidata:Q123');f.componentRef.setInput('name','Edakkal Caves');f.componentRef.setInput('initialImages',[photo('One')]);f.detectChanges();
  f.componentInstance.load();response.next({images:[photo('One'),photo('Two')],message:'Two photos',retryable:false});f.detectChanges();
  expect(f.componentInstance.images.length).toBe(2);expect(f.nativeElement.querySelector('details')).toBeNull();expect(f.nativeElement.textContent).not.toContain('source photos available');f.componentInstance.next();f.detectChanges();
  expect(f.nativeElement.querySelector('img').src).toContain('Two.jpg');expect(f.nativeElement.querySelector('figcaption a').href).toContain('Two.jpg');
  f.componentInstance.load();response.error(new Error('offline'));f.detectChanges();expect(f.componentInstance.images.length).toBe(2);expect(f.nativeElement.textContent).toContain('Retry photos');f.destroy();
 });
 it('keeps the gallery and touch controls inside a narrow mobile card',()=>{
  TestBed.configureTestingModule({providers:[{provide:PlacePhotosService,useValue:{get:jasmine.createSpy()}}]});
  const f=TestBed.createComponent(PlacePhotoGalleryComponent);f.componentRef.setInput('initialImages',[photo('One'),photo('Two')]);f.detectChanges();
  f.nativeElement.style.width='140px';document.body.appendChild(f.nativeElement);
  expect(f.nativeElement.scrollWidth).toBeLessThanOrEqual(140);
  for(const button of f.nativeElement.querySelectorAll('nav button'))expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  expect(f.nativeElement.textContent).not.toContain('Find location photos');f.destroy();
 });
 it('never fetches a name-only match and cancels stale place requests',()=>{
  const response=new Subject<any>();const get=jasmine.createSpy().and.returnValue(response);
  TestBed.configureTestingModule({providers:[{provide:PlacePhotosService,useValue:{get}}]});
  const f=TestBed.createComponent(PlacePhotoGalleryComponent);f.componentRef.setInput('name','Same name in two cities');f.detectChanges();f.componentInstance.load();expect(get).not.toHaveBeenCalled();
  f.componentRef.setInput('externalId','wikidata:Q123');f.detectChanges();f.componentInstance.load();
  f.componentRef.setInput('externalId','wikidata:Q456');f.detectChanges();response.next({images:[photo('Old')],message:'',retryable:false});expect(f.componentInstance.images.length).toBe(0);f.destroy();
 });
});
