import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription, timer } from 'rxjs';
import { Booking } from '../../../core/models/booking.model';
import { FlightSetup, FlightStatus, FlightTrackingService } from '../../../core/services/flight-tracking.service';

@Component({
  selector: 'app-flight-alerts', standalone: true, imports: [CommonModule, FormsModule],
  template: `
    <section class="flight-panel" *ngIf="eligibleBookings.length || flights.length">
      <header><div><h3>Flight updates</h3><p>Track confirmed flights and choose your in-app alerts.</p></div>
        <button type="button" (click)="load()" [disabled]="loading">{{ loading ? 'Refreshing…' : 'Refresh' }}</button>
      </header>
      <p *ngIf="!available && !loading">Live tracking is not configured yet. Your saved bookings remain available.</p>
      <p role="alert" *ngIf="error">{{ error }}</p>
      <p class="help">Checks run about every 15 minutes during the travel window while the service is running. Alerts appear in Suttru; browser push and SMS are not enabled. Confirm important changes with your airline.</p>
      <article *ngFor="let flight of flights" class="flight-card">
        <header><strong>{{ flight.ident }} · {{ flight.origin }} → {{ flight.destination }}</strong>
          <span>{{ flight.snapshot?.status || 'Awaiting flight data' }}</span></header>
        <p>{{ flight.departureDate }} · {{ flight.enabled ? 'Tracking enabled' : 'Tracking paused' }}</p>
        <p *ngIf="flight.message">{{ flight.message }}</p>
        <p class="stale" *ngIf="flight.stale || error">{{ flight.lastChecked ? 'Saved information may be out of date.' : 'No verified live status yet.' }}</p>
        <ng-container *ngIf="flight.snapshot as status">
          <div class="details">
            <div><strong>Departure</strong>
              <p>Scheduled: {{ time(status.scheduledDeparture, flight.departureZone) }}</p>
              <p>Estimated: {{ time(status.estimatedDeparture, flight.departureZone) }}</p>
              <p *ngIf="status.actualDeparture">Actual: {{ time(status.actualDeparture, flight.departureZone) }}</p>
              <p>Gate {{ status.departureGate || 'unavailable' }} · Terminal {{ status.departureTerminal || 'unavailable' }}</p></div>
            <div><strong>Arrival</strong>
              <p>Scheduled: {{ time(status.scheduledArrival, flight.departureZone) }}</p>
              <p>Estimated: {{ time(status.estimatedArrival, flight.departureZone) }}</p>
              <p *ngIf="status.actualArrival">Actual: {{ time(status.actualArrival, flight.departureZone) }}</p>
              <p>Gate {{ status.arrivalGate || 'unavailable' }} · Terminal {{ status.arrivalTerminal || 'unavailable' }}</p></div>
          </div>
          <small>All times above use {{ flight.departureZone }}. Source: {{ flight.source }}.</small>
        </ng-container>
        <p class="help">Last successful check: {{ flight.lastChecked ? (flight.lastChecked | date:'medium') : 'Never' }}</p>
        <label><input type="checkbox" [checked]="flight.subscribed" [disabled]="saving"
          (change)="subscribe(flight, $any($event.target).checked)" /> Notify me of flight changes</label>
        <button type="button" *ngIf="canManage && eligible(flight.bookingId)" (click)="edit(flight.bookingId)" [disabled]="saving">Edit tracking</button>
      </article>
      <div *ngIf="canManage && eligibleBookings.length" class="setup-select">
        <label>Set up or edit tracking for
          <select [(ngModel)]="selectedBooking" (ngModelChange)="edit($event)">
            <option [ngValue]="0">Choose a flight booking</option>
            <option *ngFor="let booking of eligibleBookings" [ngValue]="booking.id">{{ booking.providerName }} · {{ booking.departure }} → {{ booking.arrival }} · {{ booking.startDatetime | date:'mediumDate' }}</option>
          </select>
        </label>
      </div>
      <form *ngIf="canManage && selectedBooking" #trackingForm="ngForm" (ngSubmit)="save()">
        <p>Verify these details against your confirmation. Use the operating airline code for codeshares; the reservation reference is not a flight number.</p>
        <div class="details">
          <label>Airline code (IATA or ICAO)<input name="airline" [(ngModel)]="form.airlineCode" required pattern="[A-Z0-9]{2,3}" maxlength="3" placeholder="AI" /></label>
          <label>Flight number<input name="number" [(ngModel)]="form.flightNumber" required pattern="[0-9]{1,4}[A-Z]?" maxlength="5" placeholder="101" /></label>
          <label>Departure date at origin<input name="date" type="date" [(ngModel)]="form.departureDate" required /></label>
          <label>Departure time zone<input name="zone" [(ngModel)]="form.departureZone" required maxlength="64" placeholder="Asia/Kolkata" /></label>
          <label>Origin airport code<input name="origin" [(ngModel)]="form.origin" required pattern="[A-Z]{3,4}" maxlength="4" placeholder="DEL" /></label>
          <label>Destination airport code<input name="destination" [(ngModel)]="form.destination" required pattern="[A-Z]{3,4}" maxlength="4" placeholder="BOM" /></label>
        </div>
        <label><input type="checkbox" name="enabled" [(ngModel)]="form.enabled" /> Enable tracking for this flight</label>
        <p role="alert" *ngIf="formError">{{ formError }}</p>
        <button type="submit" [disabled]="trackingForm.invalid || saving || (form.enabled && !available)">{{ saving ? 'Saving…' : 'Save flight details' }}</button>
        <button type="button" (click)="selectedBooking = 0" [disabled]="saving">Cancel</button>
        <p class="help">After saving, select “Notify me” to opt into alerts. Tracking never changes or cancels your booking.</p>
      </form>
    </section>
  `,
  styles: [`
    .flight-panel { background: #fff; border: 1px solid #dce4ed; border-radius: 16px; padding: 20px; margin-bottom: 18px; color: #183044; }
    header { display: flex; justify-content: space-between; align-items: start; gap: 12px; flex-wrap: wrap; }
    h3 { margin: 0; } p { margin: 8px 0; } .help, small { color: #546578; font-size: .85rem; }
    .flight-card { padding: 16px; margin: 14px 0; border: 1px solid #dce4ed; border-radius: 12px; }
    .details { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14px; margin: 14px 0; }
    label { display: block; font-size: .9rem; } input:not([type=checkbox]), select { display: block; box-sizing: border-box; width: 100%; padding: 10px; margin: 5px 0; border: 1px solid #b7c6d2; border-radius: 8px; }
    button { padding: 9px 13px; margin: 6px 6px 0 0; border: 1px solid #a6bbc9; border-radius: 8px; background: #edf6fc; cursor: pointer; }
    button:disabled { opacity: .5; cursor: default; } .stale, [role=alert] { color: #9a3f13; }
    form { border-top: 1px solid #dce4ed; margin-top: 16px; padding-top: 12px; }
    @media(max-width:600px) { .details { grid-template-columns: 1fr; } .flight-panel { padding: 14px; } }
  `]
})
export class FlightAlertsComponent implements OnChanges, OnDestroy {
  @Input() tripId = 0;
  @Input() canManage = false;
  @Input() bookings: Booking[] = [];
  private api = inject(FlightTrackingService);
  private polling?: Subscription;
  private request?: Subscription;
  private mutation?: Subscription;
  flights: FlightStatus[] = [];
  available = false; loading = false; saving = false; error = ''; formError = ''; selectedBooking = 0;
  form: FlightSetup = this.emptyForm();
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tripId']) {
      this.request?.unsubscribe(); this.mutation?.unsubscribe(); this.polling?.unsubscribe();
      this.polling = undefined; this.flights = []; this.selectedBooking = 0; this.available = false;
      this.loading = false; this.saving = false; this.error = ''; this.formError = '';
    }
    if (!this.polling && this.tripId) this.polling = timer(0, 60000).subscribe(() => this.load());
  }
  ngOnDestroy(): void { this.polling?.unsubscribe(); this.request?.unsubscribe(); this.mutation?.unsubscribe(); }
  get eligibleBookings() { return this.bookings.filter(b => b.transportType === 'FLIGHT' && b.status === 'CONFIRMED' && b.bookingSource !== 'TRIPMATE_SANDBOX'); }
  eligible(id: number) { return this.eligibleBookings.some(b => b.id === id); }
  load(): void {
    if (!this.tripId || this.loading || this.saving) return;
    this.loading = true;
    this.request = this.api.list(this.tripId).subscribe({ next: r => { this.flights = r.flights; this.available = r.available; this.loading = false; this.error = ''; },
      error: () => { this.loading = false; this.error = 'Unable to refresh flight updates. Reconnect and try again; saved details may be stale.'; } });
  }
  edit(id: number): void {
    if (!this.canManage || !this.eligible(id)) return;
    this.selectedBooking = id; this.formError = '';
    const saved = this.flights.find(f => f.bookingId === id);
    const booking = this.bookings.find(b => b.id === id)!;
    this.form = saved ? { airlineCode: saved.airlineCode, flightNumber: saved.flightNumber, departureDate: saved.departureDate, origin: saved.origin,
      destination: saved.destination, departureZone: saved.departureZone, enabled: saved.enabled }
      : { ...this.emptyForm(), departureDate: booking.startDatetime?.slice(0,10) || '' };
  }
  save(): void {
    if (!this.canManage || !this.selectedBooking || this.saving || !this.eligible(this.selectedBooking)) return;
    this.request?.unsubscribe(); this.loading = false;
    this.saving = true; this.formError = '';
    this.mutation = this.api.configure(this.tripId,this.selectedBooking,this.form).subscribe({ next: () => { this.saving = false; this.selectedBooking = 0; this.load(); },
      error: e => { this.saving = false; this.formError = e?.error?.message || 'Unable to save flight details. Please retry.'; } });
  }
  subscribe(flight: FlightStatus, enabled: boolean): void {
    if (this.saving) return;
    this.request?.unsubscribe(); this.loading = false;
    this.saving = true;
    this.mutation = this.api.subscribe(this.tripId,flight.bookingId,enabled).subscribe({ next: updated => { this.flights = this.flights.map(f => f.bookingId === updated.bookingId ? updated : f); this.saving = false; },
      error: () => { this.saving = false; this.error = 'Unable to change alert preference. Refresh and try again.'; this.load(); } });
  }
  time(value: string | null, zone: string): string {
    if (!value) return 'Unavailable';
    return new Intl.DateTimeFormat('en-IN', { timeZone: zone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }
  private emptyForm(): FlightSetup { return { airlineCode: '', flightNumber: '', departureDate: '', origin: '', destination: '', departureZone: 'Asia/Kolkata', enabled: true }; }
}
