import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <main class="forgot-page">
      <div class="glow glow--one" aria-hidden="true"></div>
      <div class="glow glow--two" aria-hidden="true"></div>

      <div class="page-shell">
        <a routerLink="/login" class="brand" aria-label="TripMate sign in">
          <span class="brand__mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M3.414 13.778 2 15.192l4.95 4.95 2.12-2.122-2.828-2.828 5.657-5.657 5.657 5.657-2.829 2.828 2.122 2.122 4.95-4.95-1.414-1.414L12 6.707l-8.586 7.071z"/>
              <path d="M12 2 2 12h3v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8h3L12 2zm0 3.828L18 11.8v7.2H6v-7.2l6-5.972z"/>
            </svg>
          </span>
          <span>TripMate</span>
        </a>

        <section class="recovery-card" aria-labelledby="forgot-title">
          <div class="icon-shell" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M7 10V8a5 5 0 0 1 9.6-2"/>
              <rect x="4" y="10" width="16" height="11" rx="3"/>
              <path d="M12 14v3"/>
              <path d="M18.5 2.5v4h-4"/>
            </svg>
          </div>

          <header class="card-header">
            <span class="eyebrow">ACCOUNT RECOVERY</span>
            <h1 id="forgot-title">Forgot your password?</h1>
            <p>Enter the email linked to your TripMate account and we’ll send you a secure reset link.</p>
          </header>

          <div *ngIf="errorMessage" class="alert alert--error" role="alert" aria-live="polite">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="12" cy="12" r="9"/>
              <path d="M12 8v5"/>
              <path d="M12 16.5h.01"/>
            </svg>
            <span>{{ errorMessage }}</span>
          </div>

          <div *ngIf="successMessage" class="success-state" role="status" aria-live="polite">
            <div class="success-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="m5 12 4 4L19 6"/>
              </svg>
            </div>
            <h2>Check your inbox</h2>
            <p>{{ successMessage }}</p>
            <a routerLink="/login" class="secondary-btn">Return to Sign In</a>
          </div>

          <form *ngIf="!successMessage" [formGroup]="forgotForm" (ngSubmit)="onSubmit()" novalidate>
            <div class="field" [class.field--error]="isFieldInvalid('email')">
              <label for="email">Email Address</label>
              <div class="input-wrapper">
                <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
                <input
                  id="email"
                  type="email"
                  formControlName="email"
                  autocomplete="email"
                  inputmode="email"
                  placeholder="name@example.com"
                  [attr.aria-invalid]="isFieldInvalid('email')"
                  aria-describedby="email-help"
                />
              </div>
              <span id="email-help" class="field-help" [class.field-help--error]="isFieldInvalid('email')">
                {{ isFieldInvalid('email') ? 'Please enter a valid email address.' : 'We’ll only use this email to send your reset link.' }}
              </span>
            </div>

            <button type="submit" class="submit-btn" [disabled]="forgotForm.invalid || isLoading">
              <span *ngIf="isLoading" class="spinner" aria-hidden="true"></span>
              <span>{{ isLoading ? 'Sending Reset Link...' : 'Send Reset Link' }}</span>
              <svg *ngIf="!isLoading" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
          </form>

          <footer *ngIf="!successMessage" class="card-footer">
            <span>Remember your password?</span>
            <a routerLink="/login">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <line x1="19" y1="12" x2="5" y2="12"/>
                <polyline points="12 19 5 12 12 5"/>
              </svg>
              Back to Sign In
            </a>
          </footer>
        </section>

        <p class="security-note">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
          Secure password recovery
        </p>
      </div>
    </main>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      min-height: 100dvh;
    }

    .forgot-page {
      position: relative;
      min-height: 100vh;
      min-height: 100dvh;
      display: grid;
      place-items: center;
      overflow: hidden;
      padding: 2rem 1rem;
      background:
        radial-gradient(circle at 12% 12%, rgba(99, 102, 241, 0.1), transparent 28rem),
        radial-gradient(circle at 88% 88%, rgba(139, 92, 246, 0.1), transparent 30rem),
        #f8fafc;
      color: #0f172a;
    }

    .glow {
      position: absolute;
      border-radius: 50%;
      filter: blur(90px);
      pointer-events: none;
      opacity: 0.55;
    }

    .glow--one {
      width: 22rem;
      height: 22rem;
      top: -9rem;
      left: -8rem;
      background: rgba(99, 102, 241, 0.28);
    }

    .glow--two {
      width: 24rem;
      height: 24rem;
      right: -10rem;
      bottom: -10rem;
      background: rgba(168, 85, 247, 0.22);
    }

    .page-shell {
      position: relative;
      z-index: 1;
      width: min(100%, 500px);
    }

    .brand {
      width: fit-content;
      margin: 0 auto 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.7rem;
      color: #0f172a;
      font-size: 1.35rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      text-decoration: none;
    }

    .brand__mark {
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      border-radius: 13px;
      color: #fff;
      background: linear-gradient(135deg, #4f46e5, #6366f1 55%, #7c3aed);
      box-shadow: 0 10px 24px rgba(79, 70, 229, 0.3);
    }

    .brand__mark svg {
      width: 23px;
      height: 23px;
    }

    .recovery-card {
      width: 100%;
      padding: 2.5rem;
      border: 1px solid #e2e8f0;
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.98);
      box-shadow: 0 24px 60px -16px rgba(15, 23, 42, 0.18);
      animation: fade-in 0.45s ease-out;
    }

    .icon-shell {
      width: 64px;
      height: 64px;
      margin-bottom: 1.5rem;
      display: grid;
      place-items: center;
      border-radius: 19px;
      color: #4f46e5;
      background: linear-gradient(145deg, #eef2ff, #f5f3ff);
      border: 1px solid #e0e7ff;
      box-shadow: 0 12px 28px -12px rgba(79, 70, 229, 0.45);
    }

    .icon-shell svg {
      width: 31px;
      height: 31px;
    }

    .card-header {
      margin-bottom: 1.75rem;
    }

    .eyebrow {
      display: block;
      margin-bottom: 0.5rem;
      color: #4f46e5;
      font-size: 0.73rem;
      font-weight: 800;
      letter-spacing: 0.11em;
    }

    .card-header h1 {
      margin: 0 0 0.65rem;
      color: #0f172a;
      font-size: clamp(1.7rem, 5vw, 2rem);
      line-height: 1.2;
      letter-spacing: -0.035em;
    }

    .card-header p {
      margin: 0;
      color: #64748b;
      font-size: 0.94rem;
      line-height: 1.65;
    }

    .alert {
      display: flex;
      align-items: flex-start;
      gap: 0.65rem;
      margin-bottom: 1.35rem;
      padding: 0.85rem 1rem;
      border-radius: 12px;
      font-size: 0.86rem;
      line-height: 1.45;
    }

    .alert svg {
      width: 20px;
      height: 20px;
      flex: 0 0 auto;
    }

    .alert--error {
      color: #991b1b;
      background: #fef2f2;
      border: 1px solid #fecaca;
    }

    form {
      display: grid;
      gap: 1.25rem;
    }

    .field {
      display: grid;
      gap: 0.45rem;
    }

    .field label {
      color: #334155;
      font-size: 0.84rem;
      font-weight: 700;
    }

    .input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .input-icon {
      position: absolute;
      left: 14px;
      width: 20px;
      height: 20px;
      color: #94a3b8;
      pointer-events: none;
      transition: color 0.2s ease;
    }

    input {
      width: 100%;
      height: 52px;
      padding: 0 1rem 0 2.9rem;
      border: 1.5px solid #e2e8f0;
      border-radius: 14px;
      outline: none;
      background: #f8fafc;
      color: #0f172a;
      font: inherit;
      font-size: 0.95rem;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
    }

    input::placeholder {
      color: #94a3b8;
    }

    .input-wrapper:focus-within .input-icon {
      color: #4f46e5;
    }

    input:focus {
      border-color: #4f46e5;
      background: #fff;
      box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.13);
    }

    .field--error input {
      border-color: #ef4444;
      background: #fff7f7;
    }

    .field--error .input-icon {
      color: #ef4444;
    }

    .field-help {
      color: #64748b;
      font-size: 0.76rem;
      line-height: 1.4;
    }

    .field-help--error {
      color: #dc2626;
      font-weight: 600;
    }

    .submit-btn,
    .secondary-btn {
      width: 100%;
      min-height: 52px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.65rem;
      border: 0;
      border-radius: 14px;
      font: inherit;
      font-size: 0.96rem;
      font-weight: 700;
      text-decoration: none;
      transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
    }

    .submit-btn {
      color: #fff;
      cursor: pointer;
      background: linear-gradient(135deg, #4f46e5, #6366f1 55%, #4338ca);
      box-shadow: 0 12px 26px -8px rgba(79, 70, 229, 0.55);
    }

    .submit-btn svg {
      width: 20px;
      height: 20px;
      transition: transform 0.2s ease;
    }

    .submit-btn:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 16px 30px -8px rgba(79, 70, 229, 0.65);
    }

    .submit-btn:hover:not(:disabled) svg {
      transform: translateX(3px);
    }

    .submit-btn:disabled {
      cursor: not-allowed;
      opacity: 0.58;
      box-shadow: none;
    }

    .spinner {
      width: 20px;
      height: 20px;
      border: 2.5px solid rgba(255, 255, 255, 0.35);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
    }

    .card-footer {
      margin-top: 1.65rem;
      padding-top: 1.4rem;
      border-top: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 0.45rem;
      color: #64748b;
      font-size: 0.86rem;
    }

    .card-footer a {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      color: #4f46e5;
      font-weight: 700;
      text-decoration: none;
    }

    .card-footer a:hover {
      color: #4338ca;
      text-decoration: underline;
    }

    .card-footer svg {
      width: 16px;
      height: 16px;
    }

    .success-state {
      text-align: center;
    }

    .success-icon {
      width: 58px;
      height: 58px;
      margin: 0 auto 1rem;
      display: grid;
      place-items: center;
      color: #047857;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 50%;
    }

    .success-icon svg {
      width: 30px;
      height: 30px;
    }

    .success-state h2 {
      margin: 0 0 0.55rem;
      font-size: 1.35rem;
      color: #0f172a;
    }

    .success-state p {
      margin: 0 0 1.4rem;
      color: #475569;
      font-size: 0.9rem;
      line-height: 1.6;
    }

    .secondary-btn {
      color: #4338ca;
      background: #eef2ff;
      border: 1px solid #c7d2fe;
    }

    .secondary-btn:hover {
      transform: translateY(-1px);
      background: #e0e7ff;
    }

    .security-note {
      margin: 1.15rem 0 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      color: #64748b;
      font-size: 0.78rem;
    }

    .security-note svg {
      width: 16px;
      height: 16px;
      color: #4f46e5;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @keyframes fade-in {
      from {
        opacity: 0;
        transform: translateY(16px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (max-width: 560px) {
      .forgot-page {
        align-items: start;
        padding: 1.5rem 1rem;
      }

      .brand {
        margin-bottom: 1.1rem;
      }

      .recovery-card {
        padding: 1.7rem 1.3rem;
        border-radius: 20px;
      }

      .icon-shell {
        width: 56px;
        height: 56px;
        border-radius: 17px;
      }

      .card-footer {
        flex-direction: column;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
  `]
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  isLoading = false;
  errorMessage = '';
  successMessage = '';

  forgotForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  isFieldInvalid(field: string): boolean {
    const control = this.forgotForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  onSubmit(): void {
    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const { email } = this.forgotForm.value;

    this.authService.forgotPassword(email!).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.successMessage = res.message || 'Password reset link sent to your email!';
      },
      error: (err) => {
        this.isLoading = false;
        if (err.error && err.error.message) {
          this.errorMessage = err.error.message;
        } else {
          this.errorMessage = 'Failed to process request. Please try again.';
        }
      }
    });
  }
}
