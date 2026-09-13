import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { ApiErrorResponse } from '../../../core/models/auth.model';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <main class="verify-page">
      <div class="glow-sphere glow-sphere-1" aria-hidden="true"></div>
      <div class="glow-sphere glow-sphere-2" aria-hidden="true"></div>

      <div class="verify-card glass-card">
        <div class="brand-badge">
          <div class="logo-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3.414 13.778 2 15.192l4.95 4.95 2.12-2.122-2.828-2.828 5.657-5.657 5.657 5.657-2.829 2.828 2.122 2.122 4.95-4.95-1.414-1.414L12 6.707l-8.586 7.071z"/>
              <path d="M12 2 2 12h3v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8h3L12 2zm0 3.828L18 11.8v7.2H6v-7.2l6-5.972z"/>
            </svg>
          </div>
          <span class="brand-text">TripMate</span>
        </div>

        <div class="mail-icon-circle">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9"/>
            <polyline points="22 7 12 13 2 7"/>
            <polyline points="16 19 19 22 24 17"/>
          </svg>
        </div>

        <header class="verify-header">
          <h2>Verify Your Email</h2>
          <p class="subtitle">
            We've sent a 6-digit verification code to<br>
            <strong class="email-highlight">{{ maskedEmail }}</strong>
          </p>
        </header>

        @if (devOtp) {
          <div class="alert alert--dev-info" role="alert">
            <svg class="alert-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <div>
              <strong>Development OTP Code:</strong> <span class="dev-otp-code">{{ devOtp }}</span>
              <div class="dev-note">(Check Spring Boot console log for full verification details)</div>
            </div>
          </div>
        }

        @if (errorMessage) {
          <div class="alert alert--error" role="alert">
            <svg class="alert-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{{ errorMessage }}</span>
          </div>
        }

        @if (successMessage) {
          <div class="alert alert--success" role="alert">
            <svg class="alert-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <span>{{ successMessage }}</span>
          </div>
        }

        <form (submit)="onVerifySubmit($event)" novalidate>
          <div class="otp-boxes-container">
            @for (digit of otpDigits; track $index) {
              <input
                #otpInput
                type="text"
                inputmode="numeric"
                maxlength="1"
                class="otp-box"
                [class.has-value]="otpDigits[$index]"
                [(ngModel)]="otpDigits[$index]"
                [name]="'otpDigit' + $index"
                (keyup)="onDigitInput($event, $index)"
                (paste)="onPaste($event)"
                autocomplete="off"
              />
            }
          </div>

          <button type="submit" class="submit-btn" [disabled]="isLoading || !isOtpComplete()">
            @if (isLoading) {
              <span class="spinner"></span>
              <span>Verifying Code...</span>
            } @else {
              <span>Verify Email</span>
              <svg class="arrow-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            }
          </button>
        </form>

        <div class="resend-block">
          <p>Didn't receive the code?</p>
          @if (resendCountdown > 0) {
            <span class="timer-text">Resend OTP in <strong>00:{{ resendCountdown < 10 ? '0' + resendCountdown : resendCountdown }}</strong></span>
          } @else {
            <button type="button" class="resend-btn" (click)="onResendOtp()" [disabled]="isResending">
              {{ isResending ? 'Resending...' : 'Resend OTP Code' }}
            </button>
          }
        </div>

        <div class="verify-footer">
          <a routerLink="/register" class="back-link">
            ← Change email or details
          </a>
        </div>
      </div>
    </main>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      font-family: var(--tm-font, 'Plus Jakarta Sans', sans-serif);
    }

    .verify-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
      background-color: #04121e;
      background-image: 
        radial-gradient(at 0% 0%, rgba(5, 150, 105, 0.25) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(16, 185, 129, 0.18) 0px, transparent 50%),
        radial-gradient(at 50% 50%, rgba(4, 120, 87, 0.15) 0px, transparent 50%);
      position: relative;
      overflow: hidden;
    }

    .glow-sphere {
      position: absolute;
      border-radius: 50%;
      filter: blur(100px);
      pointer-events: none;
    }
    .glow-sphere-1 {
      width: 400px; height: 400px;
      top: -100px; left: -100px;
      background: rgba(16, 185, 129, 0.25);
    }
    .glow-sphere-2 {
      width: 350px; height: 350px;
      bottom: -80px; right: -80px;
      background: rgba(5, 150, 105, 0.2);
    }

    .verify-card {
      width: 100%;
      max-width: 460px;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 24px;
      padding: 2.5rem 2rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      text-align: center;
      position: relative;
      z-index: 10;
    }

    .brand-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
    }
    .logo-icon {
      width: 32px; height: 32px;
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
      border-radius: 8px;
      color: white;
      display: flex; align-items: center; justify-content: center;
    }
    .logo-icon svg { width: 18px; height: 18px; }
    .brand-text {
      font-size: 1.2rem; font-weight: 800; color: white;
    }

    .mail-icon-circle {
      width: 64px; height: 64px;
      margin: 0 auto 1.25rem auto;
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.3) 100%);
      border: 1px solid rgba(16, 185, 129, 0.4);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      color: #34d399;
    }
    .mail-icon-circle svg { width: 30px; height: 30px; }

    .verify-header h2 {
      font-size: 1.6rem;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 0.5rem;
    }
    .subtitle {
      font-size: 0.9rem;
      color: #94a3b8;
      line-height: 1.5;
      margin-bottom: 1.75rem;
    }
    .email-highlight {
      color: #34d399;
      font-weight: 700;
    }

    .alert {
      display: flex; align-items: center; gap: 0.6rem;
      padding: 0.85rem 1rem;
      border-radius: 12px;
      font-size: 0.85rem; font-weight: 600;
      margin-bottom: 1.5rem;
      text-align: left;
    }
    .alert--error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5;
    }
    .alert--success {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #6ee7b7;
    }
    .alert--dev-info {
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid rgba(59, 130, 246, 0.35);
      color: #93c5fd;
    }
    .dev-otp-code {
      font-size: 1.1rem;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: 0.1em;
      margin-left: 0.3rem;
    }
    .dev-note {
      font-size: 0.725rem;
      color: #94a3b8;
      font-weight: 400;
      margin-top: 2px;
    }
    .alert-icon { width: 18px; height: 18px; flex-shrink: 0; }

    /* 6-Digit OTP Boxes */
    .otp-boxes-container {
      display: flex;
      justify-content: center;
      gap: 0.5rem;
      margin-bottom: 1.75rem;
    }
    .otp-box {
      width: 48px;
      height: 56px;
      background: rgba(255, 255, 255, 0.06);
      border: 1.5px solid rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      font-size: 1.5rem;
      font-weight: 800;
      color: #ffffff;
      text-align: center;
      outline: none;
      transition: all 0.2s ease;
    }
    .otp-box:focus {
      border-color: #10b981;
      background: rgba(16, 185, 129, 0.1);
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.25);
    }
    .otp-box.has-value {
      border-color: #059669;
      background: rgba(5, 150, 105, 0.15);
    }

    .submit-btn {
      width: 100%;
      padding: 0.85rem 1.5rem;
      background: linear-gradient(135deg, #059669 0%, #10b981 50%, #047857 100%);
      color: #ffffff;
      border: none;
      border-radius: 14px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 0.5rem;
      box-shadow: 0 4px 16px rgba(5, 150, 105, 0.4);
      transition: all 0.2s ease;
    }
    .submit-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(5, 150, 105, 0.55);
    }
    .submit-btn:disabled {
      opacity: 0.5; cursor: not-allowed;
    }
    .arrow-icon { width: 18px; height: 18px; }

    .resend-block {
      margin-top: 1.5rem;
      font-size: 0.85rem;
      color: #94a3b8;
    }
    .resend-block p { margin-bottom: 0.25rem; }
    .timer-text { color: #cbd5e1; }
    .resend-btn {
      background: none; border: none;
      color: #34d399; font-weight: 700; font-size: 0.875rem;
      cursor: pointer; text-decoration: underline;
    }
    .resend-btn:hover { color: #6ee7b7; }

    .verify-footer {
      margin-top: 2rem;
      padding-top: 1.25rem;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }
    .back-link {
      color: #94a3b8; font-size: 0.85rem; text-decoration: none; font-weight: 600;
      transition: color 0.15s;
    }
    .back-link:hover { color: #ffffff; }

    .spinner {
      width: 18px; height: 18px;
      border: 2.5px solid rgba(255, 255, 255, 0.3);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class VerifyEmailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);

  email = '';
  maskedEmail = '';
  devOtp = '';
  otpDigits = ['', '', '', '', '', ''];
  isLoading = false;
  isResending = false;
  errorMessage = '';
  successMessage = '';
  resendCountdown = 60;
  private timerInterval?: number;

  ngOnInit(): void {
    this.email = this.route.snapshot.queryParams['email'] || '';
    this.devOtp = this.route.snapshot.queryParams['devOtp'] || '';

    if (!this.email) {
      void this.router.navigate(['/register']);
      return;
    }

    if (this.devOtp && this.devOtp.length === 6) {
      this.autoFillOtp(this.devOtp);
    }

    this.maskedEmail = this.maskEmail(this.email);
    this.startCountdownTimer();
  }

  autoFillOtp(code: string): void {
    const digits = code.split('');
    for (let i = 0; i < 6; i++) {
      this.otpDigits[i] = digits[i] || '';
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  maskEmail(rawEmail: string): string {
    const parts = rawEmail.split('@');
    if (parts.length < 2) return rawEmail;
    const name = parts[0];
    const domain = parts[1];
    const maskedName = name.length > 3 ? name.substring(0, 3) + '***' : name + '***';
    return `${maskedName}@${domain}`;
  }

  startCountdownTimer(): void {
    this.resendCountdown = 60;
    this.clearTimer();
    this.timerInterval = window.setInterval(() => {
      if (this.resendCountdown > 0) {
        this.resendCountdown--;
      } else {
        this.clearTimer();
      }
    }, 1000);
  }

  clearTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = undefined;
    }
  }

  isOtpComplete(): boolean {
    return this.otpDigits.every((d) => d.trim().length === 1);
  }

  onDigitInput(event: KeyboardEvent, index: number): void {
    const target = event.target as HTMLInputElement;
    if (event.key === 'Backspace' && !target.value && index > 0) {
      const prevBox = target.previousElementSibling as HTMLInputElement;
      if (prevBox) prevBox.focus();
      return;
    }

    if (target.value && index < 5) {
      const nextBox = target.nextElementSibling as HTMLInputElement;
      if (nextBox) nextBox.focus();
    }
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedData = event.clipboardData?.getData('text') || '';
    const digitsOnly = pastedData.replace(/\D/g, '').substring(0, 6);

    for (let i = 0; i < 6; i++) {
      this.otpDigits[i] = digitsOnly[i] || '';
    }
  }

  onVerifySubmit(event: Event): void {
    event.preventDefault();
    if (!this.isOtpComplete()) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const otpCode = this.otpDigits.join('');

    this.authService.verifyEmail({ email: this.email, otp: otpCode }).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.successMessage = res.message || 'Email verified successfully! Account created.';
        setTimeout(() => {
          void this.router.navigate(['/login'], {
            queryParams: { verified: 1 }
          });
        }, 1200);
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        const apiError = error.error as ApiErrorResponse | undefined;
        this.errorMessage = apiError?.message || 'Invalid or expired OTP code. Please try again.';
      }
    });
  }

  onResendOtp(): void {
    this.isResending = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authService.resendEmailOtp(this.email).subscribe({
      next: (res) => {
        this.isResending = false;
        this.successMessage = res.message || 'New OTP verification code sent!';
        if (res.devOtp) {
          this.devOtp = res.devOtp;
          this.autoFillOtp(res.devOtp);
        } else {
          this.otpDigits = ['', '', '', '', '', ''];
        }
        this.startCountdownTimer();
      },
      error: (error: HttpErrorResponse) => {
        this.isResending = false;
        const apiError = error.error as ApiErrorResponse | undefined;
        this.errorMessage = apiError?.message || 'Failed to resend OTP. Please try again.';
      }
    });
  }
}
