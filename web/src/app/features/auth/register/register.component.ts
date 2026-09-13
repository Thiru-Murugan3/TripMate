import { Component, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ApiErrorResponse } from '../../../core/models/auth.models';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly heroImageUrl =
    'https://www.figma.com/api/mcp/asset/86cea92b-01f4-42ff-8229-5f660adcf0f4.png';
  readonly logoMarkUrl =
    'https://www.figma.com/api/mcp/asset/bf325b04-e236-42a0-8efb-140496061730.svg';

  readonly registerForm = this.formBuilder.nonNullable.group({
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
    ]
  });

  submitting = false;
  errorMessage = '';
  serverFieldErrors: Record<string, string> = {};

  get controls() {
    return this.registerForm.controls;
  }

  submit(): void {
    this.errorMessage = '';
    this.serverFieldErrors = {};

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.submitting = true;

    this.authService.register(this.registerForm.getRawValue()).subscribe({
      next: () => {
        void this.router.navigate(['/login'], {
          queryParams: {
            registered: 1
          }
        });
      },
      error: (error: HttpErrorResponse) => {
        const apiError = error.error as ApiErrorResponse | undefined;
        this.serverFieldErrors = apiError?.validationErrors ?? {};
        this.errorMessage = apiError?.message ?? 'Unable to create your account. Please try again.';
      },
      complete: () => {
        this.submitting = false;
      }
    });
  }
}
