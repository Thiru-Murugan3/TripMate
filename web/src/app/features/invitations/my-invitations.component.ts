import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';

import { TripInvitation } from '../../core/models/invitation.model';
import { InvitationService } from '../../core/services/invitation.service';

@Component({
  selector: 'app-my-invitations',
  standalone: true,
  imports: [CommonModule],
  template: `
    <main class="page">
      <div class="shell">
        <header class="header">
          <div>
            <p class="eyebrow">COLLABORATION</p>
            <h1>My Invitations</h1>
            <p>Accept or decline pending invitations sent to your TripMate email or mobile number.</p>
          </div>
          <button type="button" class="refresh-btn" (click)="loadInvitations()" [disabled]="loading">
            Refresh
          </button>
        </header>

        <section *ngIf="loading" class="state-card">
          <div class="spinner"></div>
          <p>Loading invitations...</p>
        </section>

        <section *ngIf="!loading && errorMessage" class="state-card error">
          <strong>Unable to load invitations.</strong>
          <p>{{ errorMessage }}</p>
          <button type="button" (click)="loadInvitations()">Try again</button>
        </section>

        <section *ngIf="!loading && !errorMessage && invitations.length === 0" class="state-card">
          <span class="material-symbols-outlined empty-icon">mark_email_read</span>
          <h2>No pending invitations</h2>
          <p>New trip invitations linked to your account will appear here.</p>
        </section>

        <div class="invite-grid" *ngIf="!loading && !errorMessage && invitations.length > 0">
          <article class="invite-card" *ngFor="let invitation of invitations">
            <div class="icon-box">
              <span class="material-symbols-outlined">travel_explore</span>
            </div>

            <div class="content">
              <span class="role-chip">{{ invitation.role === 'EDITOR' ? 'Editor' : 'Viewer' }}</span>
              <h2>{{ invitation.tripName }}</h2>
              <p>
                <strong>{{ invitation.inviterName }}</strong> invited you to join this trip.
              </p>
              <div class="meta">
                <span>{{ invitation.type }}</span>
                <span>•</span>
                <span>Expires {{ invitation.expiresAt | date:'medium' }}</span>
              </div>
            </div>

            <div class="actions">
              <button
                type="button"
                class="reject-btn"
                (click)="reject(invitation)"
                [disabled]="processingId === invitation.id"
              >
                Decline
              </button>
              <button
                type="button"
                class="accept-btn"
                (click)="accept(invitation)"
                [disabled]="processingId === invitation.id"
              >
                {{ processingId === invitation.id ? 'Working...' : 'Accept' }}
              </button>
            </div>
          </article>
        </div>
      </div>
    </main>
  `,
  styles: [`
    :host { display:block; }
    .page { min-height: calc(100vh - 72px); background:#f8fafc; padding:2rem 1.25rem 4rem; }
    .shell { width:min(900px,100%); margin:0 auto; }
    .header { display:flex; justify-content:space-between; gap:1rem; align-items:flex-start; margin-bottom:1.25rem; }
    .eyebrow { color:#2563eb; font-size:.72rem; font-weight:800; letter-spacing:.12em; margin:0 0 .3rem; }
    h1 { margin:0; color:#0f172a; font-size:clamp(1.8rem,4vw,2.4rem); }
    .header p { color:#64748b; margin:.55rem 0 0; line-height:1.5; }
    .refresh-btn, .state-card button { border:1px solid #cbd5e1; border-radius:9px; background:#fff; padding:.6rem .85rem; font-weight:800; cursor:pointer; }
    .invite-grid { display:grid; gap:.8rem; }
    .invite-card { display:grid; grid-template-columns:auto 1fr auto; gap:1rem; align-items:center; padding:1rem; background:#fff; border:1px solid #e2e8f0; border-radius:15px; box-shadow:0 5px 18px rgba(15,23,42,.04); }
    .icon-box { width:48px; height:48px; display:grid; place-items:center; border-radius:13px; background:#eff6ff; color:#2563eb; }
    .content h2 { margin:.2rem 0; color:#0f172a; font-size:1.05rem; }
    .content p { margin:.25rem 0; color:#475569; }
    .role-chip { display:inline-block; padding:.2rem .45rem; border-radius:999px; background:#f1f5f9; color:#475569; font-size:.68rem; font-weight:900; }
    .meta { display:flex; flex-wrap:wrap; gap:.35rem; color:#94a3b8; font-size:.75rem; margin-top:.5rem; }
    .actions { display:flex; gap:.5rem; }
    .accept-btn, .reject-btn { min-height:40px; border-radius:9px; padding:0 .85rem; font-weight:800; cursor:pointer; }
    .accept-btn { border:0; background:#2563eb; color:#fff; }
    .reject-btn { border:1px solid #cbd5e1; background:#fff; color:#475569; }
    .accept-btn:disabled, .reject-btn:disabled { opacity:.55; cursor:not-allowed; }
    .state-card { min-height:260px; display:grid; place-items:center; align-content:center; gap:.4rem; padding:2rem; background:#fff; border:1px solid #e2e8f0; border-radius:16px; text-align:center; color:#64748b; }
    .state-card.error { color:#991b1b; border-color:#fecaca; background:#fffafa; }
    .state-card h2 { margin:.25rem 0 0; color:#0f172a; }
    .state-card p { margin:0; }
    .empty-icon { font-size:2.5rem; color:#2563eb; }
    .spinner { width:30px; height:30px; border:3px solid #dbeafe; border-top-color:#2563eb; border-radius:50%; animation:spin .8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    @media (max-width:650px) { .invite-card { grid-template-columns:auto 1fr; } .actions { grid-column:1 / -1; } .actions button { flex:1; } .header { flex-direction:column; } }
  `]
})
export class MyInvitationsComponent implements OnInit {
  private readonly invitationService = inject(InvitationService);
  private readonly router = inject(Router);

  invitations: TripInvitation[] = [];
  loading = false;
  processingId: number | null = null;
  errorMessage = '';

  ngOnInit(): void {
    this.loadInvitations();
  }

  loadInvitations(): void {
    this.loading = true;
    this.errorMessage = '';

    this.invitationService.getMyInvitations().subscribe({
      next: (invitations) => {
        this.invitations = invitations ?? [];
        this.loading = false;
      },
      error: (err) => {
        this.invitations = [];
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Please try again.';
      }
    });
  }

  accept(invitation: TripInvitation): void {
    this.processingId = invitation.id;
    this.errorMessage = '';

    this.invitationService.acceptInvitation(invitation.id).subscribe({
      next: (accepted) => {
        this.processingId = null;
        void this.router.navigate(['/trips', accepted.tripId]);
      },
      error: (err) => {
        this.processingId = null;
        this.errorMessage = err?.error?.message || 'Unable to accept invitation.';
      }
    });
  }

  reject(invitation: TripInvitation): void {
    this.processingId = invitation.id;
    this.errorMessage = '';

    this.invitationService.rejectInvitation(invitation.id).subscribe({
      next: () => {
        this.processingId = null;
        this.invitations = this.invitations.filter((item) => item.id !== invitation.id);
      },
      error: (err) => {
        this.processingId = null;
        this.errorMessage = err?.error?.message || 'Unable to decline invitation.';
      }
    });
  }
}
