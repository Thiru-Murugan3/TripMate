import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';

interface ApiErrorResponse {
  message?: string;
  validationErrors?: Record<string, string>;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly heroImageUrl =
    'https://www.figma.com/api/mcp/asset/452be6a7-1a5d-4e35-9c3b-9fd7a9b9582c.png';
  readonly logoMarkUrl =
    'https://www.figma.com/api/mcp/asset/9eb8d94f-455c-4dbc-8538-702e6f198cd2.svg';

  isLoading = false;
  errorMessage = '';
  serverFieldErrors: Record<string, string> = {};
  showPassword = false;
  showConfirmPassword = false;

  readonly registerForm = this.fb.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.maxLength(120)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(180)]],
      mobile: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(20),
          Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])(?=\S+$).{8,20}$/)
        ]
      ],
      confirmPassword: ['', Validators.required]
    },
    {
      validators: [RegisterComponent.passwordsMatchValidator]
    }
  );

  get controls() {
    return this.registerForm.controls;
  }

  static passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPasswordControl = control.get('confirmPassword');
    const confirmPassword = confirmPasswordControl?.value;

    if (!password || !confirmPassword) {
      return null;
    }

    if (password !== confirmPassword) {
      confirmPasswordControl?.setErrors({ ...confirmPasswordControl.errors, passwordsMismatch: true });
      return { passwordsMismatch: true };
    } else {
      if (confirmPasswordControl?.hasError('passwordsMismatch')) {
        const errors = { ...confirmPasswordControl.errors };
        delete errors['passwordsMismatch'];
        confirmPasswordControl.setErrors(Object.keys(errors).length ? errors : null);
      }
      return null;
    }
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  get passwordValue(): string {
    return this.registerForm.controls.password.value || '';
  }

  get hasMinLength(): boolean {
    const val = this.passwordValue;
    return val.length >= 8 && val.length <= 20;
  }

  get hasUppercase(): boolean {
    return /[A-Z]/.test(this.passwordValue);
  }

  get hasLowercase(): boolean {
    return /[a-z]/.test(this.passwordValue);
  }

  get hasNumber(): boolean {
    return /\d/.test(this.passwordValue);
  }

  get hasSpecialChar(): boolean {
    return /[^A-Za-z0-9]/.test(this.passwordValue);
  }

  get passwordScore(): number {
    if (!this.passwordValue) return 0;
    let score = 0;
    if (this.hasMinLength) score += 20;
    if (this.hasUppercase) score += 20;
    if (this.hasLowercase) score += 20;
    if (this.hasNumber) score += 20;
    if (this.hasSpecialChar) score += 20;
    return score;
  }

  get passwordStrengthLabel(): string {
    const score = this.passwordScore;
    if (score === 0) return '';
    if (score <= 40) return 'Weak';
    if (score <= 60) return 'Fair';
    if (score <= 80) return 'Good';
    return 'Strong 💪';
  }

  submit(): void {
    this.errorMessage = '';
    this.serverFieldErrors = {};

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const { name, email, mobile, password } = this.registerForm.getRawValue();

    this.authService
      .register({ name, email, mobile, password })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (res) => {
          void this.router.navigate(['/verify-email'], {
            queryParams: { email: res.email || email }
          });
        },
        error: (error: HttpErrorResponse) => {
          const apiError = error.error as ApiErrorResponse | undefined;
          this.serverFieldErrors = apiError?.validationErrors ?? {};
          if (error.status === 0) {
            this.errorMessage = 'Backend server unreachable. Please ensure the Spring Boot server is running on http://localhost:8080.';
          } else if (error.status === 409) {
            this.errorMessage = 'An account already exists with this email or mobile number.';
          } else {
            this.errorMessage =
              apiError?.message ??
              'Registration failed. Please check your details and try again.';
          }
        }
      });
  }
}
