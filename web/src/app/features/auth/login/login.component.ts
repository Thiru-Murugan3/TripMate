import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isLoading = false;
  showPassword = false;
  errorMessage = '';

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    rememberMe: [false]
  });

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  isFieldInvalid(field: string): boolean {
    const control = this.loginForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';

    const credentials = this.loginForm.value as { email: string; password: string };

    this.authService.login(credentials).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.isLoading = false;

        if (err.status === 0) {
          this.errorMessage =
            `Backend is unreachable from this device. Check that Spring Boot is running and accessible at ${environment.apiUrl}.`;
          return;
        }

        const serverMessage =
          err?.error?.message ||
          err?.error?.detail ||
          (typeof err?.error === 'string' ? err.error : '');

        if (err.status === 401) {
          this.errorMessage = serverMessage || 'Invalid email or password';
        } else if (
          err.status === 403 &&
          typeof serverMessage === 'string' &&
          serverMessage.toLowerCase().includes('cors')
        ) {
          this.errorMessage =
            'This device is not allowed by the backend CORS configuration. Restart the backend after updating the latest TripMate code.';
        } else if (serverMessage) {
          this.errorMessage = serverMessage;
        } else {
          this.errorMessage = `Login failed (HTTP ${err.status}). Please try again.`;
        }
      }
    });
  }
}
