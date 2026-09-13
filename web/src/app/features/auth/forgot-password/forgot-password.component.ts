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
    <div class="auth-container">
      <div class="auth-card card glass-panel">
        <div class="auth-header">
          <div class="brand-badge">
            <span class="material-symbols-outlined icon">lock_reset</span>
          </div>
          <h2>Reset Password</h2>
          <p class="subtitle">Enter your registered email to receive password reset instructions</p>
        </div>

        <div *ngIf="errorMessage" class="alert alert-danger">
          <span class="material-symbols-outlined">error</span>
          {{ errorMessage }}
        </div>

        <div *ngIf="successMessage" class="alert alert-success">
          <span class="material-symbols-outlined">check_circle</span>
          {{ successMessage }}
        </div>

        <form [formGroup]="forgotForm" (ngSubmit)="onSubmit()" *ngIf="!successMessage">
          <div class="form-group">
            <label class="form-label" for="email">Email Address</label>
            <input
              id="email"
              type="email"
              class="form-control"
              [class.is-invalid]="isFieldInvalid('email')"
              formControlName="email"
              placeholder="you@example.com"
            />
            <div *ngIf="isFieldInvalid('email')" class="form-error">
              Valid email address is required
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-block" [disabled]="forgotForm.invalid || isLoading">
            <span *ngIf="isLoading" class="material-symbols-outlined spin">sync</span>
            <span>{{ isLoading ? 'Sending Link...' : 'Send Reset Link' }}</span>
          </button>
        </form>

        <div class="auth-footer">
          Remember password? <a routerLink="/login">Back to Sign In</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-container {
      min-height: 80vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
    }
    .auth-card {
      width: 100%;
      max-width: 440px;
      padding: 2.5rem 2rem;
    }
    .auth-header {
      text-align: center;
      margin-bottom: 1.8rem;
    }
    .brand-badge {
      width: 60px;
      height: 60px;
      margin: 0 auto 1rem;
      border-radius: 50%;
      background: var(--brand-gradient);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: var(--shadow-glow);
    }
    .brand-badge .icon {
      font-size: 2.2rem;
    }
    .subtitle {
      color: var(--text-muted);
      font-size: 0.9rem;
      margin-top: 0.4rem;
    }
    .auth-footer {
      text-align: center;
      margin-top: 1.5rem;
      font-size: 0.9rem;
      color: var(--text-secondary);
    }
    .spin {
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      100% { transform: rotate(360deg); }
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
    if (this.forgotForm.invalid) return;

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
