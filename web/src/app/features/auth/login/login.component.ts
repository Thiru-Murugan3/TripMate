import { Component, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { ApiErrorResponse } from '../../../core/models/auth.models';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly heroImageUrl =
    'https://www.figma.com/api/mcp/asset/86cea92b-01f4-42ff-8229-5f660adcf0f4.png';
  readonly logoMarkUrl =
    'https://www.figma.com/api/mcp/asset/bf325b04-e236-42a0-8efb-140496061730.svg';
  readonly eyeIconUrl =
    'https://www.figma.com/api/mcp/asset/8acba900-fa17-436a-a79e-735e881a4474.svg';
  readonly googleIconUrl =
    'https://www.figma.com/api/mcp/asset/8795f862-a9b2-4d9e-828d-d682b0dee258.svg';
  readonly appleIconUrl =
    'https://www.figma.com/api/mcp/asset/67defdad-b057-4569-954a-4b902ba4d5e7.svg';

  readonly loginForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  showPassword = false;
  submitting = false;
  errorMessage = '';
  successMessage = this.route.snapshot.queryParamMap.get('registered')
    ? 'Account created successfully. Sign in to continue.'
    : '';

  get email() {
    return this.loginForm.controls.email;
  }

  get password() {
    return this.loginForm.controls.password;
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  submit(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.submitting = true;

    this.authService
      .login(this.loginForm.getRawValue())
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe({
        next: (response) => {
          this.successMessage = 'Welcome back, ' + response.name + '. Authentication is connected.';
        },
        error: (error: HttpErrorResponse) => {
          const apiError = error.error as ApiErrorResponse | undefined;
          this.errorMessage =
            apiError?.message ?? 'Unable to sign in. Please check your email and password.';
        }
      });
  }
}
