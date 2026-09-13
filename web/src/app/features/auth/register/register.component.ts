import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-container">
      <div class="auth-card card glass-panel">
        <div class="auth-header">
          <div class="brand-badge">
            <span class="material-symbols-outlined icon">person_add</span>
          </div>
          <h2>Create Account</h2>
          <p class="subtitle">Join TripMate to start planning unforgettable trips</p>
        </div>

        <div *ngIf="errorMessage" class="alert alert-danger">
          <span class="material-symbols-outlined">error</span>
          {{ errorMessage }}
        </div>

        <div *ngIf="successMessage" class="alert alert-success">
          <span class="material-symbols-outlined">check_circle</span>
          {{ successMessage }}
        </div>

        <form [formGroup]="registerForm" (ngSubmit)="onSubmit()">
          <!-- Full Name -->
          <div class="form-group">
            <label class="form-label" for="name">Full Name</label>
            <input
              id="name"
              type="text"
              class="form-control"
              [class.is-invalid]="isFieldInvalid('name')"
              formControlName="name"
              placeholder="John Doe"
            />
            <div *ngIf="isFieldInvalid('name')" class="form-error">
              Name is required (max 120 chars)
            </div>
          </div>

          <!-- Email Address -->
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
              Valid email is required
            </div>
          </div>

          <!-- Mobile Number -->
          <div class="form-group">
            <label class="form-label" for="mobile">Mobile Number (10 digits)</label>
            <input
              id="mobile"
              type="tel"
              class="form-control"
              [class.is-invalid]="isFieldInvalid('mobile')"
              formControlName="mobile"
              placeholder="9876543210"
            />
            <div *ngIf="isFieldInvalid('mobile')" class="form-error">
              Valid 10-digit mobile number required
            </div>
          </div>

          <!-- Password -->
          <div class="form-group">
            <label class="form-label" for="password">Password</label>
            <input
              id="password"
              type="password"
              class="form-control"
              [class.is-invalid]="isFieldInvalid('password')"
              formControlName="password"
              placeholder="At least 6 characters"
            />
            <div *ngIf="isFieldInvalid('password')" class="form-error">
              Password must be at least 6 characters
            </div>
          </div>

          <!-- Confirm Password -->
          <div class="form-group">
            <label class="form-label" for="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              class="form-control"
              [class.is-invalid]="isFieldInvalid('confirmPassword') || registerForm.hasError('passwordsMismatch')"
              formControlName="confirmPassword"
              placeholder="Re-enter password"
            />
            <div *ngIf="registerForm.hasError('passwordsMismatch') && registerForm.get('confirmPassword')?.touched" class="form-error">
              Passwords do not match
            </div>
          </div>

          <!-- Submit Button -->
          <button type="submit" class="btn btn-primary btn-block" [disabled]="registerForm.invalid || isLoading">
            <span *ngIf="isLoading" class="material-symbols-outlined spin">sync</span>
            <span>{{ isLoading ? 'Creating Account...' : 'Create Account' }}</span>
          </button>
        </form>

        <div class="auth-footer">
          Already have an account? <a routerLink="/login">Sign In</a>
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
      max-width: 480px;
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
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  isLoading = false;
  errorMessage = '';
  successMessage = '';

  registerForm = this.fb.group(
    {
      name: ['', [Validators.required, Validators.maxLength(120)]],
      email: ['', [Validators.required, Validators.email]],
      mobile: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    },
    { validators: this.passwordsMatchValidator }
  );

  passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
    const pass = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return pass === confirm ? null : { passwordsMismatch: true };
  }

  isFieldInvalid(field: string): boolean {
    const control = this.registerForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  onSubmit(): void {
    if (this.registerForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const { name, email, mobile, password } = this.registerForm.value;

    this.authService
      .register({ name: name!, email: email!, mobile: mobile!, password: password! })
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          this.successMessage = res.message || 'Registration successful! Redirecting to login...';
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 1500);
        },
        error: (err) => {
          this.isLoading = false;
          if (err.error && err.error.message) {
            this.errorMessage = err.error.message;
          } else if (err.status === 409) {
            this.errorMessage = 'Email address is already registered';
          } else {
            this.errorMessage = 'Registration failed. Please check your inputs.';
          }
        }
      });
  }
}
