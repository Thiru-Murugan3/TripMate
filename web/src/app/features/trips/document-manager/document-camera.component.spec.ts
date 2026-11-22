import {TestBed} from '@angular/core/testing';
import {of} from 'rxjs';
import {DocumentService} from '../../../core/services/document.service';
import {DocumentManagerComponent} from './document-manager.component';
describe('Document camera review',()=>{
 const target=window as any;
 let service:any;
 beforeEach(()=>{service={getDocuments:()=>of([]),uploadDocument:jasmine.createSpy()};TestBed.configureTestingModule({providers:[{provide:DocumentService,useValue:service}]});});
 afterEach(()=>{delete target.SuttruDevice;delete target.SuttruCameraInterrupted;});
 function setup(capture:()=>Promise<File|null>){target.SuttruDevice={takeDocumentPhoto:capture};const f=TestBed.createComponent(DocumentManagerComponent);f.componentInstance.canEdit=true;f.componentInstance.tripId=10;f.componentInstance.openUploadModal();return f;}
 it('selects the camera file for review without uploading it automatically',async()=>{
  const photo=new File(['photo'],'document.jpg',{type:'image/jpeg'}),f=setup(async()=>photo);await f.componentInstance.captureDocument();
  expect(f.componentInstance.selectedFile).toBe(photo);expect(service.uploadDocument).not.toHaveBeenCalled();f.destroy();
 });
 it('uses the gallery action without opening the camera or uploading',async()=>{
  const camera=jasmine.createSpy().and.resolveTo(null),f=setup(camera),photo=new File(['photo'],'gallery.jpg',{type:'image/jpeg'});target.SuttruDevice.pickDocumentPhoto=jasmine.createSpy().and.resolveTo(photo);
  await f.componentInstance.captureDocument(undefined,'gallery');expect(f.componentInstance.selectedFile).toBe(photo);expect(camera).not.toHaveBeenCalled();expect(service.uploadDocument).not.toHaveBeenCalled();f.destroy();
 });
 it('keeps a previously selected file on cancellation or denial and explains recovery',async()=>{
  const f=setup(async()=>null),previous=new File(['ticket'],'ticket.pdf');f.componentInstance.selectedFile=previous;
  await f.componentInstance.captureDocument();expect(f.componentInstance.selectedFile).toBe(previous);
  target.SuttruDevice.takeDocumentPhoto=async()=>{throw new Error('Camera access is off. Open Android Settings.');};await f.componentInstance.captureDocument();
  expect(f.componentInstance.selectedFile).toBe(previous);expect(f.componentInstance.uploadError).toContain('Android Settings');expect(f.componentInstance.isCapturing).toBeFalse();f.destroy();
 });
 it('discards a delayed camera result when the trip changes and blocks read-only capture',async()=>{
  let resolve!:(file:File)=>void;const capture=jasmine.createSpy().and.callFake(()=>new Promise<File>(r=>resolve=r));const f=setup(capture);
  const pending=f.componentInstance.captureDocument();f.componentInstance.tripId=20;resolve(new File(['photo'],'document.jpg'));await pending;
  expect(f.componentInstance.selectedFile).toBeNull();f.componentInstance.canEdit=false;await f.componentInstance.captureDocument();expect(capture).toHaveBeenCalledTimes(1);f.destroy();
 });
});
