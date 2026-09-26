import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

import { Trip } from '../../../core/models/trip.model';

@Component({
  selector: 'app-missed-trip-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="backdrop" role="presentation">
      <section class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="missed-trip-title">
        <div class="icon" aria-hidden="true">!</div>
        <p class="eyebrow">TRIP DATE PASSED</p>
        <h2 id="missed-trip-title">You missed the trip</h2>
        <p class="message">
          The start date for <strong>{{ trip.name }}</strong> was {{ formatDate(trip.startDate) }}.
          Do you want to cancel the trip or reschedule it?
        </p>

        @if (errorMessage) {
          <p class="error" role="alert">{{ errorMessage }}</p>
        }

        <div class="actions">
          <button type="button" class="secondary" [disabled]="busy" (click)="dismiss.emit()">
            Decide Later
          </button>
          <button type="button" class="danger" [disabled]="busy" (click)="cancelTrip.emit()">
            {{ busy ? 'Cancelling...' : 'Cancel Trip' }}
          </button>
          <button type="button" class="primary" [disabled]="busy" (click)="reschedule.emit()">
            Reschedule Trip
          </button>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .backdrop { position: fixed; inset: 0; z-index: 1200; display: grid; place-items: center; padding: 20px; background: rgba(15, 23, 42, .7); backdrop-filter: blur(4px); }
    .dialog { width: min(100%, 500px); padding: 30px; border-radius: 22px; background: #fff; box-shadow: 0 24px 70px rgba(15, 23, 42, .3); text-align: center; }
    .icon { width: 54px; height: 54px; margin: 0 auto 14px; display: grid; place-items: center; border-radius: 50%; background: #fef3c7; color: #b45309; font-size: 30px; font-weight: 900; }
    .eyebrow { margin: 0 0 7px; color: #b45309; font-size: 11px; font-weight: 850; letter-spacing: .12em; }
    h2 { margin: 0; color: #0f172a; font-size: 26px; }
    .message { margin: 13px auto 0; color: #64748b; font-size: 14px; line-height: 1.65; }
    .message strong { color: #0f172a; }
    .error { margin: 16px 0 0; padding: 10px 12px; border-radius: 9px; background: #fef2f2; color: #b91c1c; font-size: 13px; }
    .actions { margin-top: 24px; display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
    button { min-height: 42px; padding: 0 16px; border-radius: 10px; font: inherit; font-size: 13px; font-weight: 750; cursor: pointer; }
    button:disabled { opacity: .6; cursor: wait; }
    .secondary { border: 1px solid #cbd5e1; background: #fff; color: #475569; }
    .danger { border: 1px solid #fecaca; background: #fef2f2; color: #b91c1c; }
    .primary { border: 1px solid #2563eb; background: #2563eb; color: #fff; }
    @media (max-width: 520px) { .dialog { padding: 24px 18px; } .actions { flex-direction: column-reverse; } button { width: 100%; } }
  `]
})
export class MissedTripDialogComponent {
  @Input({ required: true }) trip!: Trip;
  @Input() busy = false;
  @Input() errorMessage = '';

  @Output() cancelTrip = new EventEmitter<void>();
  @Output() reschedule = new EventEmitter<void>();
  @Output() dismiss = new EventEmitter<void>();

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      .format(new Date(`${value}T00:00:00`));
  }
}
