import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import {
  CreateInvitationRequest,
  InvitationRole,
  InvitationType,
  TripInvitation
} from '../../core/models/invitation.model';
import { Trip } from '../../core/models/trip.model';
import { InvitationService } from '../../core/services/invitation.service';
import { TripService } from '../../core/services/trip.service';

@Component({
  selector: 'app-share-trip',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <main class="share-page">
      <div class="page-shell">
        <header class="page-header">
          <div>
            <a class="back-link" [routerLink]="['/trips', tripId]">← Back to trip</a>
            <p class="eyebrow">TRIP COLLABORATION</p>
            <h1>Share {{ trip?.name || 'Trip' }}</h1>
            <p class="subtitle">
              Invite a traveler as an editor or viewer using email, mobile number,
              or a secure share link.
            </p>
          </div>
        </header>

        <section *ngIf="loadingTrip" class="state-card">
          <div class="spinner"></div>
          <p>Loading trip...</p>
        </section>

        <section *ngIf="!loadingTrip && tripError" class="state-card error">
          <strong>Unable to load this trip.</strong>
          <p>{{ tripError }}</p>
        </section>

        <ng-container *ngIf="!loadingTrip && trip">
          <section *ngIf="!canManageInvitations" class="state-card">
            <h2>Owner access required</h2>
            <p>Only the trip owner can create and manage invitations.</p>
            <a class="primary-link" [routerLink]="['/trips', tripId]">Open trip</a>
          </section>

          <ng-container *ngIf="canManageInvitations">
            <div class="content-grid">
              <section class="card invite-card">
                <div class="section-heading">
                  <div>
                    <p class="section-kicker">NEW INVITATION</p>
                    <h2>Invite traveler</h2>
                  </div>
                </div>

                <form [formGroup]="inviteForm" (ngSubmit)="createInvitation()">
                  <div class="method-grid">
                    <button
                      type="button"
                      class="method-btn"
                      *ngFor="let method of methods"
                      [class.active]="inviteForm.controls.type.value === method.value"
                      (click)="setInvitationType(method.value)"
                    >
                      <span class="material-symbols-outlined">{{ method.icon }}</span>
                      <strong>{{ method.label }}</strong>
                      <small>{{ method.help }}</small>
                    </button>
                  </div>

                  <div class="form-group" *ngIf="inviteForm.controls.type.value === 'EMAIL'">
                    <label for="invite-email">Email address</label>
                    <input
                      id="invite-email"
                      type="email"
                      formControlName="email"
                      placeholder="traveler@example.com"
                    />
                    <small>The account email must match when the invite is accepted.</small>
                  </div>

                  <div class="form-group" *ngIf="inviteForm.controls.type.value === 'MOBILE'">
                    <label for="invite-mobile">Mobile number</label>
                    <input
                      id="invite-mobile"
                      type="tel"
                      formControlName="mobileNumber"
                      placeholder="+91 98765 43210"
                    />
                    <small>The TripMate account mobile number must match.</small>
                  </div>

                  <div class="form-group" *ngIf="inviteForm.controls.type.value === 'LINK'">
                    <div class="info-box">
                      <span class="material-symbols-outlined">link</span>
                      <div>
                        <strong>Secure invitation link</strong>
                        <p>Anyone with the link can sign in and accept this role until it expires.</p>
                      </div>
                    </div>
                  </div>

                  <div class="form-group">
                    <label for="invite-role">Trip permission</label>
                    <select id="invite-role" formControlName="role">
                      <option value="VIEWER">Viewer — read only</option>
                      <option value="EDITOR">Editor — can update trip content</option>
                    </select>
                  </div>

                  <div *ngIf="formError" class="alert error-alert">{{ formError }}</div>

                  <button
                    class="primary-btn"
                    type="submit"
                    [disabled]="inviteForm.invalid || creating"
                  >
                    {{ creating ? 'Creating invitation...' : 'Create invitation' }}
                  </button>
                </form>

                <div class="created-link" *ngIf="lastCreatedInvitation?.inviteLink as inviteLink">
                  <div>
                    <span class="success-label">Invitation created</span>
                    <strong>Share this link</strong>
                  </div>
                  <div class="copy-row">
                    <input [value]="inviteLink" readonly aria-label="Invitation link" />
                    <button type="button" (click)="copyLink(inviteLink)">
                      {{ copyMessage || 'Copy' }}
                    </button>
                  </div>
                  <small>
                    For security, TripMate stores only a hash of the token. Copy this link now;
                    it cannot be reconstructed later.
                  </small>
                </div>
              </section>

              <section class="card pending-card">
                <div class="section-heading">
                  <div>
                    <p class="section-kicker">INVITATION HISTORY</p>
                    <h2>Trip invitations</h2>
                  </div>
                  <button class="text-btn" type="button" (click)="loadInvitations()" [disabled]="loadingInvitations">
                    Refresh
                  </button>
                </div>

                <div *ngIf="loadingInvitations" class="inline-state">
                  <div class="spinner small"></div>
                  Loading invitations...
                </div>

                <div *ngIf="!loadingInvitations && invitationsError" class="alert error-alert">
                  {{ invitationsError }}
                </div>

                <div
                  *ngIf="!loadingInvitations && !invitationsError && invitations.length === 0"
                  class="empty-state"
                >
                  <span class="material-symbols-outlined">group_add</span>
                  <strong>No invitations yet</strong>
                  <p>Create the first invitation for this trip.</p>
                </div>

                <div class="invitation-list" *ngIf="!loadingInvitations && invitations.length > 0">
                  <article class="invitation-row" *ngFor="let invitation of invitations">
                    <div class="invite-icon">
                      <span class="material-symbols-outlined">{{ invitationIcon(invitation.type) }}</span>
                    </div>
                    <div class="invite-main">
                      <div class="invite-topline">
                        <strong>{{ invitationTarget(invitation) }}</strong>
                        <span class="status-pill" [attr.data-status]="invitation.status">
                          {{ invitation.status }}
                        </span>
                      </div>
                      <p>
                        {{ invitation.role === 'EDITOR' ? 'Editor' : 'Viewer' }}
                        · {{ invitation.type }}
                        · expires {{ invitation.expiresAt | date:'mediumDate' }}
                      </p>
                    </div>
                    <button
                      *ngIf="invitation.status === 'PENDING'"
                      class="danger-text-btn"
                      type="button"
                      (click)="cancelInvitation(invitation)"
                      [disabled]="cancellingId === invitation.id"
                    >
                      {{ cancellingId === invitation.id ? 'Cancelling...' : 'Cancel' }}
                    </button>
                  </article>
                </div>
              </section>
            </div>
          </ng-container>
        </ng-container>
      </div>
    </main>
  `,
  styles: [`
    :host { display: block; }
    .share-page { min-height: calc(100vh - 72px); background: #f8fafc; padding: 2rem 1.25rem 4rem; }
    .page-shell { width: min(1120px, 100%); margin: 0 auto; }
    .page-header { margin-bottom: 1.5rem; }
    .back-link { color: #64748b; text-decoration: none; font-weight: 700; font-size: .85rem; }
    .eyebrow, .section-kicker { color: #2563eb; font-size: .72rem; font-weight: 800; letter-spacing: .12em; margin: .75rem 0 .25rem; }
    h1 { margin: 0; color: #0f172a; font-size: clamp(1.8rem, 4vw, 2.5rem); }
    h2 { margin: 0; color: #0f172a; }
    .subtitle { max-width: 700px; color: #64748b; line-height: 1.6; margin: .6rem 0 0; }
    .content-grid { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr); gap: 1.25rem; align-items: start; }
    .card, .state-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 18px; box-shadow: 0 8px 24px rgba(15,23,42,.05); }
    .invite-card, .pending-card { padding: 1.35rem; }
    .state-card { min-height: 220px; display: grid; place-items: center; text-align: center; padding: 2rem; color: #64748b; }
    .state-card.error { color: #991b1b; border-color: #fecaca; background: #fffafa; }
    .primary-link { color: #2563eb; font-weight: 800; text-decoration: none; }
    .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
    form { display: grid; gap: 1rem; }
    .method-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: .65rem; }
    .method-btn { display: grid; justify-items: start; gap: .25rem; padding: .85rem; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; color: #475569; cursor: pointer; text-align: left; }
    .method-btn.active { border-color: #60a5fa; background: #eff6ff; color: #1d4ed8; }
    .method-btn .material-symbols-outlined { font-size: 1.35rem; }
    .method-btn small { color: #94a3b8; line-height: 1.3; }
    .form-group { display: grid; gap: .45rem; }
    label { color: #334155; font-size: .82rem; font-weight: 800; }
    input, select { width: 100%; min-height: 46px; border: 1px solid #cbd5e1; border-radius: 10px; padding: .7rem .8rem; font: inherit; color: #0f172a; background: #fff; box-sizing: border-box; }
    .form-group small, .created-link small { color: #64748b; line-height: 1.4; }
    .info-box { display: flex; gap: .75rem; padding: .9rem; border-radius: 12px; background: #f8fafc; color: #475569; }
    .info-box p { margin: .2rem 0 0; font-size: .82rem; line-height: 1.45; }
    .primary-btn { min-height: 46px; border: 0; border-radius: 10px; background: #2563eb; color: #fff; font-weight: 800; cursor: pointer; }
    .primary-btn:disabled { opacity: .55; cursor: not-allowed; }
    .created-link { display: grid; gap: .65rem; margin-top: 1rem; padding: 1rem; border: 1px solid #bbf7d0; border-radius: 12px; background: #f0fdf4; }
    .success-label { display: block; color: #15803d; font-size: .72rem; font-weight: 800; text-transform: uppercase; }
    .copy-row { display: flex; gap: .5rem; }
    .copy-row input { min-width: 0; flex: 1; background: #fff; }
    .copy-row button, .text-btn, .danger-text-btn { border: 0; background: transparent; font: inherit; font-weight: 800; cursor: pointer; }
    .copy-row button { padding: 0 .9rem; border-radius: 9px; background: #166534; color: #fff; }
    .text-btn { color: #2563eb; }
    .danger-text-btn { color: #dc2626; white-space: nowrap; }
    .invitation-list { display: grid; gap: .65rem; }
    .invitation-row { display: flex; align-items: center; gap: .75rem; padding: .8rem; border: 1px solid #e2e8f0; border-radius: 12px; }
    .invite-icon { width: 38px; height: 38px; flex: 0 0 38px; display: grid; place-items: center; border-radius: 10px; background: #eff6ff; color: #2563eb; }
    .invite-main { min-width: 0; flex: 1; }
    .invite-topline { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
    .invite-topline strong { color: #0f172a; overflow-wrap: anywhere; }
    .invite-main p { margin: .3rem 0 0; color: #64748b; font-size: .78rem; }
    .status-pill { padding: .2rem .45rem; border-radius: 999px; background: #f1f5f9; color: #475569; font-size: .65rem; font-weight: 900; }
    .status-pill[data-status="PENDING"] { background: #fff7ed; color: #c2410c; }
    .status-pill[data-status="ACCEPTED"] { background: #ecfdf5; color: #047857; }
    .status-pill[data-status="REJECTED"], .status-pill[data-status="CANCELLED"] { background: #fef2f2; color: #b91c1c; }
    .empty-state, .inline-state { min-height: 180px; display: grid; place-items: center; align-content: center; gap: .35rem; text-align: center; color: #64748b; }
    .empty-state p { margin: 0; }
    .alert { padding: .75rem; border-radius: 10px; font-size: .85rem; }
    .error-alert { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
    .spinner { width: 30px; height: 30px; border: 3px solid #dbeafe; border-top-color: #2563eb; border-radius: 50%; animation: spin .8s linear infinite; }
    .spinner.small { width: 20px; height: 20px; border-width: 2px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 850px) { .content-grid { grid-template-columns: 1fr; } }
    @media (max-width: 600px) { .method-grid { grid-template-columns: 1fr; } .copy-row { flex-direction: column; } .copy-row button { min-height: 42px; } }
  `]
})
export class ShareTripComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly tripService = inject(TripService);
  private readonly invitationService = inject(InvitationService);

  readonly methods: Array<{ value: InvitationType; label: string; help: string; icon: string }> = [
    { value: 'EMAIL', label: 'Email', help: 'Match account email', icon: 'mail' },
    { value: 'MOBILE', label: 'Mobile', help: 'Match account mobile', icon: 'smartphone' },
    { value: 'LINK', label: 'Link', help: 'Share manually', icon: 'link' }
  ];

  tripId = 0;
  trip: Trip | null = null;
  invitations: TripInvitation[] = [];
  lastCreatedInvitation: TripInvitation | null = null;

  loadingTrip = true;
  loadingInvitations = false;
  creating = false;
  cancellingId: number | null = null;
  tripError = '';
  invitationsError = '';
  formError = '';
  copyMessage = '';

  inviteForm = this.fb.group({
    type: ['EMAIL' as InvitationType, Validators.required],
    email: ['', [Validators.email]],
    mobileNumber: [''],
    role: ['VIEWER' as InvitationRole, Validators.required]
  });

  get canManageInvitations(): boolean {
    return this.trip?.userRole === 'OWNER';
  }

  ngOnInit(): void {
    this.tripId = Number(this.route.snapshot.paramMap.get('id'));

    if (!Number.isFinite(this.tripId) || this.tripId <= 0) {
      this.loadingTrip = false;
      this.tripError = 'Invalid trip ID.';
      return;
    }

    this.updateMethodValidators('EMAIL');
    this.loadTrip();
  }

  setInvitationType(type: InvitationType): void {
    this.inviteForm.patchValue({
      type,
      email: type === 'EMAIL' ? this.inviteForm.controls.email.value : '',
      mobileNumber: type === 'MOBILE' ? this.inviteForm.controls.mobileNumber.value : ''
    });
    this.formError = '';
    this.lastCreatedInvitation = null;
    this.copyMessage = '';
    this.updateMethodValidators(type);
  }

  loadTrip(): void {
    this.loadingTrip = true;
    this.tripError = '';

    this.tripService.getTripById(this.tripId).subscribe({
      next: (trip) => {
        this.trip = trip;
        this.loadingTrip = false;
        if (trip.userRole === 'OWNER') {
          this.loadInvitations();
        }
      },
      error: (err) => {
        this.loadingTrip = false;
        this.tripError = err?.error?.message || 'Please try again.';
      }
    });
  }

  loadInvitations(): void {
    if (!this.canManageInvitations) return;

    this.loadingInvitations = true;
    this.invitationsError = '';

    this.invitationService.getTripInvitations(this.tripId).subscribe({
      next: (invitations) => {
        this.invitations = invitations ?? [];
        this.loadingInvitations = false;
      },
      error: (err) => {
        this.invitations = [];
        this.loadingInvitations = false;
        this.invitationsError = err?.error?.message || 'Unable to load invitations.';
      }
    });
  }

  createInvitation(): void {
    if (!this.canManageInvitations || this.inviteForm.invalid) return;

    const value = this.inviteForm.getRawValue();
    const type = value.type as InvitationType;

    const request: CreateInvitationRequest = {
      type,
      role: value.role as InvitationRole
    };

    if (type === 'EMAIL') {
      request.email = value.email?.trim() || undefined;
    } else if (type === 'MOBILE') {
      request.mobileNumber = value.mobileNumber?.trim() || undefined;
    }

    this.creating = true;
    this.formError = '';
    this.lastCreatedInvitation = null;
    this.copyMessage = '';

    this.invitationService.createInvitation(this.tripId, request).subscribe({
      next: (invitation) => {
        this.creating = false;
        this.lastCreatedInvitation = invitation;
        this.loadInvitations();
      },
      error: (err) => {
        this.creating = false;
        this.formError = err?.error?.message || 'Unable to create invitation.';
      }
    });
  }

  cancelInvitation(invitation: TripInvitation): void {
    if (invitation.status !== 'PENDING') return;

    if (!window.confirm('Cancel this pending invitation?')) {
      return;
    }

    this.cancellingId = invitation.id;
    this.invitationsError = '';

    this.invitationService.cancelInvitation(this.tripId, invitation.id).subscribe({
      next: () => {
        this.cancellingId = null;
        this.loadInvitations();
      },
      error: (err) => {
        this.cancellingId = null;
        this.invitationsError = err?.error?.message || 'Unable to cancel invitation.';
      }
    });
  }

  async copyLink(link: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(link);
      this.copyMessage = 'Copied';
    } catch {
      this.copyMessage = 'Copy failed';
    }
  }

  invitationTarget(invitation: TripInvitation): string {
    if (invitation.inviteeEmail) return invitation.inviteeEmail;
    if (invitation.inviteeMobile) return invitation.inviteeMobile;
    return 'Share link';
  }

  invitationIcon(type: InvitationType): string {
    if (type === 'EMAIL') return 'mail';
    if (type === 'MOBILE') return 'smartphone';
    return 'link';
  }

  private updateMethodValidators(type: InvitationType): void {
    const email = this.inviteForm.controls.email;
    const mobile = this.inviteForm.controls.mobileNumber;

    email.clearValidators();
    mobile.clearValidators();

    if (type === 'EMAIL') {
      email.setValidators([Validators.required, Validators.email]);
    } else if (type === 'MOBILE') {
      mobile.setValidators([Validators.required, Validators.minLength(6)]);
    }

    email.updateValueAndValidity();
    mobile.updateValueAndValidity();
  }
}
