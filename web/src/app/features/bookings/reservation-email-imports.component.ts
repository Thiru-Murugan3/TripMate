import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import {
  ReservationEmailImport,
  ReservationImportAddress,
  ReservationImportSelection
} from '../../core/models/reservation-import.model';
import { ReservationImportService } from '../../core/services/reservation-import.service';

@Component({
  selector: 'app-reservation-email-imports',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section *ngIf="canEdit" class="email-import-card card">
      <header>
        <div>
          <span class="eyebrow">AUTOMATIC IMPORT</span>
          <h3>Forward reservation emails</h3>
          <p>Forward flight, bus, train or hotel confirmations. Nothing is added until you review it.</p>
        </div>
        <button type="button" class="refresh-btn" [disabled]="loading" (click)="refresh()">
          <span class="material-symbols-outlined">refresh</span>
          Refresh
        </button>
      </header>

      <div *ngIf="address as currentAddress" class="forwarding-address" [class.not-ready]="!currentAddress.receivingConfigured">
        <div>
          <small>Your private forwarding address</small>
          <strong>{{ currentAddress.forwardingAddress || 'Inbound email setup required' }}</strong>
          <span>{{ currentAddress.setupMessage }}</span>
        </div>
        <button *ngIf="currentAddress.forwardingAddress" type="button" (click)="copyAddress(currentAddress.forwardingAddress)">
          <span class="material-symbols-outlined">content_copy</span>
          {{ copied ? 'Copied' : 'Copy' }}
        </button>
      </div>

      <div *ngIf="error" class="import-error">{{ error }}</div>
      <div *ngIf="loading" class="loading-row"><span class="spinner small"></span>Checking forwarded emails...</div>

      <div *ngIf="!loading && pendingImports.length" class="import-list">
        <article *ngFor="let item of pendingImports" class="import-item">
          <div class="import-icon"><span class="material-symbols-outlined">forward_to_inbox</span></div>
          <div class="import-copy">
            <strong>{{ item.subject || 'Forwarded reservation' }}</strong>
            <span>{{ item.senderAddress || 'Unknown sender' }} · {{ formatDate(item.receivedAt) }}</span>
            <small *ngIf="item.attachmentCount">{{ item.attachmentCount }} attachment{{ item.attachmentCount === 1 ? '' : 's' }}</small>
            <small *ngIf="item.draft">{{ Math.round(item.draft.confidence * 100) }}% extraction confidence</small>
            <small *ngIf="item.errorMessage" class="failed">{{ item.errorMessage }}</small>
          </div>
          <div class="import-actions">
            <button *ngIf="item.draft" type="button" class="review-btn" (click)="review(item)">Review</button>
            <button type="button" class="dismiss-btn" (click)="dismiss(item)">Dismiss</button>
          </div>
        </article>
      </div>

      <p *ngIf="!loading && !pendingImports.length && !error" class="empty-copy">
        No forwarded reservations are waiting for review.
      </p>
    </section>
  `,
  styles: [`
    .email-import-card{margin-bottom:1rem;padding:1rem;border:1px solid #dbeafe;background:linear-gradient(135deg,#eff6ff,#fff)}
    header{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:.9rem}
    h3{margin:.12rem 0 .2rem;color:#0f172a;font-size:1.05rem} p{margin:0;color:#64748b;font-size:.78rem}
    .eyebrow{color:#2563eb;font-size:.62rem;font-weight:900;letter-spacing:.1em}
    .refresh-btn,.forwarding-address button,.review-btn,.dismiss-btn{display:inline-flex;align-items:center;gap:.28rem;border:0;border-radius:8px;cursor:pointer;font:inherit;font-weight:800}
    .refresh-btn{padding:.45rem .65rem;color:#1d4ed8;background:#dbeafe}.refresh-btn span{font-size:1rem}
    .forwarding-address{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.75rem;border:1px solid #bfdbfe;border-radius:10px;background:#fff}
    .forwarding-address.not-ready{border-color:#fed7aa;background:#fff7ed}.forwarding-address div{display:grid;gap:.16rem;min-width:0}
    .forwarding-address small{color:#64748b}.forwarding-address strong{overflow:hidden;color:#1e3a8a;font-size:.82rem;text-overflow:ellipsis}.forwarding-address span{color:#64748b;font-size:.68rem}
    .forwarding-address button{padding:.48rem .65rem;color:#fff;background:#2563eb;white-space:nowrap}.forwarding-address button span{font-size:1rem}
    .loading-row,.empty-copy{padding:.8rem;color:#64748b;text-align:center}.loading-row{display:flex;justify-content:center;gap:.5rem}
    .import-error{margin-top:.75rem;padding:.65rem;border-radius:8px;color:#991b1b;background:#fee2e2}
    .import-list{display:grid;gap:.6rem;margin-top:.75rem}.import-item{display:grid;grid-template-columns:auto 1fr auto;gap:.65rem;align-items:center;padding:.7rem;border:1px solid #e2e8f0;border-radius:10px;background:#fff}
    .import-icon{display:grid;width:36px;height:36px;place-items:center;border-radius:10px;color:#1d4ed8;background:#dbeafe}.import-copy{display:grid;gap:.1rem;min-width:0}.import-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.import-copy span,.import-copy small{color:#64748b;font-size:.68rem}.import-copy .failed{color:#b91c1c}
    .import-actions{display:flex;gap:.35rem}.review-btn{padding:.42rem .65rem;color:#fff;background:#2563eb}.dismiss-btn{padding:.42rem .6rem;color:#475569;background:#f1f5f9}
    @media(max-width:640px){header,.forwarding-address{align-items:stretch;flex-direction:column}.forwarding-address button,.refresh-btn{justify-content:center}.import-item{grid-template-columns:auto 1fr}.import-actions{grid-column:1/-1}.review-btn,.dismiss-btn{flex:1;justify-content:center}}
  `]
})
export class ReservationEmailImportsComponent implements OnInit {
  @Input() canEdit = false;
  @Output() draftSelected = new EventEmitter<ReservationImportSelection>();

  private readonly service = inject(ReservationImportService);
  readonly Math = Math;
  address: ReservationImportAddress | null = null;
  imports: ReservationEmailImport[] = [];
  loading = false;
  error = '';
  copied = false;

  get pendingImports(): ReservationEmailImport[] {
    return this.imports.filter((item) => item.status === 'NEEDS_REVIEW' || item.status === 'FAILED');
  }

  ngOnInit(): void {
    if (this.canEdit) this.refresh();
  }

  refresh(): void {
    this.loading = true;
    this.error = '';
    this.service.getAddress().subscribe({
      next: (address) => {
        this.address = address;
        this.loadImports();
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Unable to load the reservation forwarding address.';
      }
    });
  }

  review(item: ReservationEmailImport): void {
    if (item.draft) this.draftSelected.emit({ importId: item.id, draft: item.draft });
  }

  dismiss(item: ReservationEmailImport): void {
    this.service.dismiss(item.id).subscribe({
      next: () => this.imports = this.imports.filter((existing) => existing.id !== item.id),
      error: (err) => this.error = err?.error?.message || 'Unable to dismiss this email import.'
    });
  }

  markCompleted(importId: number): void {
    this.imports = this.imports.filter((item) => item.id !== importId);
  }

  async copyAddress(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.copied = true;
      window.setTimeout(() => this.copied = false, 1800);
    } catch {
      this.error = 'Copy failed. Select the forwarding address and copy it manually.';
    }
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleString();
  }

  private loadImports(): void {
    this.service.getImports().subscribe({
      next: (items) => {
        this.imports = items;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Unable to load forwarded reservation emails.';
      }
    });
  }
}
