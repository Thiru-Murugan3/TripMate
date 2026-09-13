import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-container">
      <div class="auth-card card glass-panel">
        <div class="auth-header">
          <div class="brand-badge">
            <span class="material-symbols-outlined icon">key</span>
          </div>
          <h2>Set New Password</h2>
          <p class="subtitle">Enter your new password below</p>
        </div>

        <div *ngIf="errorMessage" class="alert alert-danger">
          <span class="material-symbols-outlined">error</span>
          {{ errorMessage }}
        </div>

        <div *ngIf="successMessage" class="alert alert-success">
          <span class="material-symbols-outlined">check_circle</span>
          {{ successMessage }}
        </div>

        <form [formGroup]="resetForm" (ngSubmit)="onSubmit()" *ngIf="!successMessage">
          <!-- New Password -->
          <div class="form-group">
            <label class="form-label" for="newPassword">New Password</label>
            <input
              id="newPassword"
              type="password"
              class="form-control"
              [class.is-invalid]="isFieldInvalid('newPassword')"
              formControlName="newPassword"
              placeholder="At least 6 characters"
            />
            <div *ngIf="isFieldInvalid('newPassword')" class="form-error">
              Password must be at least 6 characters
            </div>
          </div>

          <!-- Confirm New Password -->
          <div class="form-group">
            <label class="form-label" for="confirmPassword">Confirm New Password</label>
            <input
              id="confirmPassword"
              type="password"
              class="form-control"
              [class.is-invalid]="isFieldInvalid('confirmPassword') || resetForm.hasError('passwordsMismatch')"
              formControlName="confirmPassword"
              placeholder="Re-enter new password"
            />
            <div *ngIf="resetForm.hasError('passwordsMismatch') && resetForm.get('confirmPassword')?.touched" class="form-error">
              Passwords do not match
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-block" [disabled]="resetForm.invalid || isLoading || !token">
            <span *ngIf="isLoading" class="material-symbols-outlined spin">sync</span>
            <span>{{ isLoading ? 'Resetting...' : 'Reset Password' }}</span>
          </button>
        </form>

        <div class="auth-footer">
          <a routerLink="/login">Back to Sign In</a>
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
export class ResetPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  token = '';
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  resetForm = this.fb.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    },
    { validators: this.passwordsMatchValidator }
  );

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParams['token'] || '';
    if (!this.token) {
      this.errorMessage = 'Invalid or missing password reset token';
    }
  }

  passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
    const pass = group.get('newPassword')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return pass === confirm ? null : { passwordsMismatch: true };
  }

  isFieldInvalid(field: string): boolean {
    const control = this.resetForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  onSubmit(): void {
    if (this.resetForm.invalid || !this.token) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const { newPassword } = this.resetForm.value;

    this.authService
      .resetPassword({ token: this.token, newPassword: newPassword! })
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          this.successMessage = res.message || 'Password reset successfully! Redirecting to login...';
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 2000);
        },
        error: (err) => {
          this.isLoading = false;
          if (err.error && err.error.message) {
            this.errorMessage = err.error.message;
          } else {
            this.errorMessage = 'Failed to reset password. Token may be expired or invalid.';
          }
        }
      });
  }
}
