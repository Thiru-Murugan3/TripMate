import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Provider content exists only in this view's memory, never in saved itinerary/offline data. */
@Component({
  selector: 'app-tripadvisor-reference', standalone: true, imports: [CommonModule],
  template: `
    <span *ngIf="name && webUrl; else pending"><a [href]="webUrl" target="_blank" rel="noopener noreferrer">{{ name }} / Tripadvisor ↗</a></span>
    <ng-template #pending><span>Tripadvisor place #{{ locationId }}</span>
      <small *ngIf="loading" role="status"> · Loading place…</small>
      <button *ngIf="!loading" type="button" (click)="load()">{{ failed ? 'Retry place information' : 'Load place information' }}</button>
    </ng-template>`,
  styles: [`:host { display:block; font-size:13px; margin:5px 0; } a { color:#215b3b; } button { margin-left:8px; cursor:pointer; font:inherit; background:white; color:#215b3b; border:1px solid #c0d1c5; border-radius:8px; padding:5px 8px; }`]
})
export class TripadvisorReferenceComponent implements OnChanges, OnDestroy {
  @Input({required:true}) locationId = '';
  private http = inject(HttpClient);
  private request?: Subscription;
  name = ''; webUrl = ''; loading = false; failed = false;
  ngOnChanges(): void { this.request?.unsubscribe(); this.loading = false; this.name = ''; this.webUrl = ''; this.load(); }
  load(): void {
    if (this.loading || !/^[0-9]{1,12}$/.test(this.locationId)) return;
    if (!navigator.onLine) { this.failed = true; return; }
    this.loading = true; this.failed = false;
    this.request = this.http.get<{name?:string;webUrl?:string}>(`${environment.apiUrl}/discovery/tripadvisor/locations/${this.locationId}`).subscribe({
      next: place => { this.name = place.name || ''; this.webUrl = place.webUrl || ''; this.loading = false; this.failed = !this.name || !this.webUrl; },
      error: () => { this.loading = false; this.failed = true; }
    });
  }
  ngOnDestroy(): void { this.request?.unsubscribe(); this.name = ''; this.webUrl = ''; }
}
