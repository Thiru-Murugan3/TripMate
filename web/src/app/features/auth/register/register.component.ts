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
    const confirmPassword = control.get('confirmPassword')?.value;

    if (!password || !confirmPassword) {
      return null;
    }

    return password === confirmPassword ? null : { passwordsMismatch: true };
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
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
        next: () => {
          void this.router.navigate(['/login'], {
            queryParams: { registered: 1 }
          });
        },
        error: (error: HttpErrorResponse) => {
          const apiError = error.error as ApiErrorResponse | undefined;
          this.serverFieldErrors = apiError?.validationErrors ?? {};
          this.errorMessage =
            apiError?.message ??
            (error.status === 409
              ? 'An account already exists with this email or mobile number.'
              : 'Registration failed. Please check your details and try again.');
        }
      });
  }
}
