import { hasNativeFiles } from '../../../core/utils/native-files';
import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TimelineService } from '../../../core/services/timeline.service';
import { DocumentService } from '../../../core/services/document.service';
import { TripDocument } from '../../../core/models/document.model';
import { session, savePack } from '../../../../../public/offline-store.js';

@Component({
  selector: 'app-offline-trip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="offline-card">
      <div class="offline-heading"><h3>Offline access</h3><button type="button" class="mobile-offline-toggle" (click)="mobileExpanded=!mobileExpanded" [attr.aria-expanded]="mobileExpanded" aria-controls="offline-access-options">{{mobileExpanded ? 'Close' : 'Open'}}</button></div>
      <div id="offline-access-options" class="offline-options" [class.mobile-expanded]="mobileExpanded">
      <p>Save the daily timeline and selected documents on this device. Save again after changing your plans. Saving replaces the previous copy and includes only the documents checked below.</p>
      <p>Only use a trusted device. Copies are not separately encrypted and signing out clears offline access.
        Browser storage may be cleared by the device.</p>
      <button type="button" [disabled]="busy" (click)="loadDocuments()">Choose essential documents</button>
      <div *ngFor="let doc of documents">
        <label><input type="checkbox" [checked]="selected.has(doc.id)" [disabled]="busy" (change)="toggle(doc.id)">
          {{ doc.fileName }} · {{ (doc.fileSize / 1048576) | number:'1.1-1' }} MB</label>
      </div>
      <p *ngIf="loaded && !documents.length">No documents uploaded. You can still save the timeline.</p>
      <div class="actions">
        <button type="button" [disabled]="busy" (click)="save()">{{ busy ? 'Saving…' : 'Save for offline' }}</button>
        <a href="/offline.html">Open saved trips</a>
      </div>
      <p role="status" aria-live="polite">{{ message }}</p>
      </div>
    </section>
  `,
  styles: [`
@use '../../../shared/styles/mobile-panels' as mobile;

    .offline-card{padding:1rem;margin-bottom:1rem;background:#eef2ff;border:1px solid #c7d2fe;border-radius:14px}
    h3{margin:0 0 .5rem}p{line-height:1.5;font-size:.9rem}label{display:flex;align-items:center;gap:.6rem;padding:.6rem 0;overflow-wrap:anywhere}
    button,a{min-height:44px;padding:.7rem;border-radius:8px;font:inherit}button{border:1px solid #a5b4fc;background:white;cursor:pointer}
    a{color:#3730a3}.actions{display:flex;gap:.6rem;flex-wrap:wrap;margin-top:.7rem}input{min-width:20px;min-height:20px}

@include mobile.panels;
.mobile-offline-toggle { display:none; }
@media(max-width:760px) {
 .offline-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; }
 .offline-heading h3 { margin:0; font-size:15px; }
 .mobile-offline-toggle { display:inline-flex; align-items:center; padding:8px 12px; background:#eff6ff; color:#2563eb; border-color:#dbeafe; font-size:12px; }
 .offline-options { display:none; }
 .offline-options.mobile-expanded { display:block; }
 .offline-options p { font-size:12px; }
}

`]
})
export class OfflineTripComponent {
  mobileExpanded=false;
  @Input({ required: true }) tripId!: number;
  private timelineService = inject(TimelineService);
  private documentService = inject(DocumentService);
  documents: TripDocument[] = [];
  selected = new Set<number>();
  loaded = false;
  busy = false;
  message = '';

  toggle(id: number): void {
    this.selected.has(id) ? this.selected.delete(id) : this.selected.add(id);
  }

  async loadDocuments(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      this.documents = await firstValueFrom(this.documentService.getDocuments(this.tripId));
      this.selected = new Set([...this.selected].filter(id => this.documents.some(d => d.id === id)));
      this.loaded = true;
      this.message = '';
    } catch { this.message = 'Could not load documents. Reconnect and try again; existing offline copies are unchanged.'; }
    finally { this.busy = false; }
  }

  async save(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.message = '';
    const tripId = this.tripId;
    try {
      if ((!hasNativeFiles() && !('serviceWorker' in navigator)) || !('indexedDB' in window) || !window.isSecureContext)
        throw new Error('Offline saving needs HTTPS and a browser with offline storage support.');
      const identity = session();
      const chosen = this.documents.filter(d => this.selected.has(d.id));
      if (chosen.length > 10 || chosen.reduce((n, d) => n + d.fileSize, 0) > 25 * 1024 * 1024)
        throw new Error('Choose up to 10 documents totalling 25 MB or less.');
      if (!hasNativeFiles()) {
        await navigator.serviceWorker.register('/offline-worker.js', { scope: '/', updateViaCache: 'none' });
        await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Offline viewer setup timed out. Reconnect and retry.')), 20000))
        ]);
      }
      const timeline = await firstValueFrom(this.timelineService.getTimeline(tripId));
      const documents: { id: number; name: string; blob: Blob }[] = [];
      let bytes = new Blob([JSON.stringify(timeline)]).size;
      for (const doc of chosen) {
        this.message = 'Saving ' + doc.fileName + '…';
        const blob = await firstValueFrom(this.documentService.getDocumentContent(tripId, doc.id));
        if (!blob.size) throw new Error('An empty document was returned. Existing offline copy has been kept.');
        bytes += blob.size;
        if (bytes > 25 * 1024 * 1024) throw new Error('This travel pack exceeds 25 MB. Choose fewer documents.');
        documents.push({ id: doc.id, name: doc.fileName, blob });
      }
      await savePack({ key: identity.owner + ':' + identity.epoch + ':' + tripId,
        ...identity, tripId, savedAt: new Date().toISOString(), timeline, documents, bytes });
      this.message = 'Saved for offline. Open saved trips to check the copy before you travel.';
    } catch (error) {
      this.message = error instanceof Error ? error.message :
        'Save failed. Check your connection and available device storage. Any previous copy is unchanged.';
    } finally { this.busy = false; }
  }
}
