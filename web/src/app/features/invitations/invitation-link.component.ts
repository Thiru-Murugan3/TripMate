import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { TripInvitation } from '../../core/models/invitation.model';
import { AuthService } from '../../core/services/auth.service';
import { InvitationService } from '../../core/services/invitation.service';

@Component({
  selector: 'app-invitation-link',
  standalone: true,
  imports: [CommonModule],
  template: `
    <main class="invite-page">
      <section class="invite-shell">
        <div class="brand-mark">S</div>

        <div *ngIf="loading" class="state">
          <div class="spinner"></div>
          <p>Checking invitation...</p>
        </div>

        <div *ngIf="!loading && errorMessage && !invitation" class="state error">
          <span class="material-symbols-outlined">link_off</span>
          <h1>Invitation unavailable</h1>
          <p>{{ errorMessage }}</p>
          <button type="button" (click)="goHome()">Go to Suttru</button>
        </div>

        <ng-container *ngIf="!loading && invitation as invite">
          <p class="eyebrow">TRIP INVITATION</p>
          <h1>You’re invited to {{ invite.tripName }}</h1>
          <p class="description">
            <strong>{{ invite.inviterName }}</strong> invited you to join as
            <strong>{{ invite.role === 'EXPENSE_MANAGER' ? 'an expense manager' : invite.role === 'PLANNER' ? 'a planner' : invite.role === 'EDITOR' ? 'an editor' : 'a viewer' }}</strong>.
          </p>

          <div class="invite-summary">
            <div>
              <span>Permission</span>
              <strong>{{ invite.role === 'EXPENSE_MANAGER' ? 'Expense manager' : invite.role === 'PLANNER' ? 'Planner' : invite.role === 'EDITOR' ? 'Editor' : 'Viewer' }}</strong>
            </div>
            <div>
              <span>Valid until</span>
              <strong>{{ invite.expiresAt | date:'medium' }}</strong>
            </div>
          </div>

          <p *ngIf="acceptError" class="accept-error" role="alert">{{ acceptError }}</p>
          <button *ngIf="acceptError" type="button" class="secondary-btn" (click)="switchAccount()" [disabled]="accepting">Sign in with another account</button>
          <a *ngIf="showAndroidLink" class="secondary-btn open-app" [href]="androidLink">Open in Suttru Android app</a>
          <div *ngIf="invite.status !== 'PENDING'" class="processed">
            This invitation is {{ invite.status.toLowerCase() }} and can no longer be accepted.
          </div>

          <button
            *ngIf="invite.status === 'PENDING' && !authService.isAuthenticated()"
            class="primary-btn"
            type="button"
            (click)="signInToAccept()"
          >
            Sign in to accept invitation
          </button>

          <button
            *ngIf="invite.status === 'PENDING' && authService.isAuthenticated()"
            class="primary-btn"
            type="button"
            (click)="acceptInvitation()"
            [disabled]="accepting"
          >
            {{ accepting ? 'Accepting...' : 'Accept invitation' }}
          </button>

          <button type="button" class="secondary-btn" (click)="goHome()">
            Maybe later
          </button>
        </ng-container>
      </section>
    </main>
  `,
  styles: [`
@use '../../shared/styles/mobile-panels' as mobile;

    :host { display:block; }
    .invite-page { min-height:calc(100vh - 72px); display:grid; place-items:center; padding:2rem 1.25rem; background:linear-gradient(135deg,#f8fafc,#eff6ff); }
    .invite-shell { width:min(540px,100%); padding:2rem; border:1px solid #dbeafe; border-radius:22px; background:#fff; box-shadow:0 24px 60px rgba(15,23,42,.1); text-align:center; }
    .brand-mark { width:52px; height:52px; display:grid; place-items:center; margin:0 auto 1rem; border-radius:15px; background:#2563eb; color:#fff; font-weight:900; }
    .eyebrow { color:#2563eb; font-size:.72rem; font-weight:900; letter-spacing:.14em; }
    h1 { margin:.3rem 0 .75rem; color:#0f172a; font-size:clamp(1.7rem,5vw,2.3rem); }
    .description { color:#64748b; line-height:1.6; }
    .invite-summary { display:grid; grid-template-columns:1fr 1fr; gap:.7rem; margin:1.25rem 0; text-align:left; }
    .invite-summary div { padding:.9rem; border:1px solid #e2e8f0; border-radius:12px; }
    .invite-summary span { display:block; color:#94a3b8; font-size:.72rem; font-weight:800; text-transform:uppercase; }
    .invite-summary strong { display:block; margin-top:.3rem; color:#0f172a; }
    .primary-btn, .secondary-btn, .state button { width:100%; min-height:46px; border-radius:10px; font:inherit; font-weight:800; cursor:pointer; }
    .primary-btn { border:0; background:#2563eb; color:#fff; margin-top:.5rem; }
    .secondary-btn { border:0; background:transparent; color:#64748b; margin-top:.45rem; }
    .accept-error { color:#991b1b; background:#fef2f2; padding:12px; border-radius:10px; }
    .open-app { display:flex; align-items:center; justify-content:center; text-decoration:none; }
    .processed { padding:.8rem; margin:1rem 0; border-radius:10px; background:#f8fafc; color:#475569; }
    .state { min-height:260px; display:grid; place-items:center; align-content:center; gap:.5rem; color:#64748b; }
    .state.error { color:#991b1b; }
    .state .material-symbols-outlined { font-size:2.5rem; }
    .state h1 { margin:0; }
    .state p { margin:0 0 .7rem; }
    .state button { border:0; background:#2563eb; color:#fff; padding:0 1rem; }
    .spinner { width:32px; height:32px; border:3px solid #dbeafe; border-top-color:#2563eb; border-radius:50%; animation:spin .8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    @media (max-width:480px) { .invite-summary { grid-template-columns:1fr; } .invite-shell { padding:1.4rem; } }
  @include mobile.panels;
  @media(max-width:760px) { .invite-page { min-height:0; padding:20px 16px; background:#f8fafc; } .invite-shell { padding:20px 16px; border-radius:18px; box-shadow:none; border-color:#e2e8f0; } h1 { font-size:23px; } .description { font-size:13px; } }
  `]
})
export class InvitationLinkComponent implements OnInit {
  readonly authService = inject(AuthService);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly invitationService = inject(InvitationService);

  token = '';
  invitation: TripInvitation | null = null;
  loading = true;
  accepting = false;
  errorMessage = '';
  acceptError = '';
  readonly showAndroidLink = /Android/i.test(navigator.userAgent) && !(window as any).SuttruNative;
  get androidLink():string { return 'suttru://invite/' + encodeURIComponent(this.token); }

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') || '';

    if (!this.token) {
      this.loading = false;
      this.errorMessage = 'Invitation token is missing.';
      return;
    }

    this.invitationService.getInvitationByToken(this.token).subscribe({
      next: (invitation) => {
        this.invitation = invitation;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'This invitation may be invalid or expired.';
      }
    });
  }

  signInToAccept(): void {
    const returnUrl = this.router.url;
    void this.router.navigate(['/login'], {
      queryParams: { returnUrl }
    });
  }

  acceptInvitation(): void {
    if (!this.token || this.accepting) return;

    this.accepting = true;
    this.acceptError = '';

    this.invitationService.acceptInvitationByToken(this.token).subscribe({
      next: (accepted) => {
        this.accepting = false;
        void this.router.navigate(['/trips', accepted.tripId]);
      },
      error: (err) => {
        this.accepting = false;
        this.acceptError = err?.error?.message || 'Unable to accept this invitation. Please try again.';
      }
    });
  }

  switchAccount(): void {
    if (this.accepting) return;
    this.accepting = true;
    this.authService.logout().subscribe(() => this.signInToAccept());
  }

  goHome(): void {
    void this.router.navigate([
      this.authService.isAuthenticated() ? '/dashboard' : '/login'
    ]);
  }
}
