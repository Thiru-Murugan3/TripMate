import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

interface GoogleCredentialResponse {
  credential: string;
  select_by?: string;
}

interface GoogleIdentityApi {
  accounts: {
    id: {
      initialize(config: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
        auto_select?: boolean;
        cancel_on_tap_outside?: boolean;
      }): void;
      renderButton(
        parent: HTMLElement,
        options: {
          type: 'standard';
          theme: 'outline';
          size: 'large';
          text: 'signin_with';
          shape: 'rectangular';
          logo_alignment: 'left';
          width: number;
        }
      ): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityApi;
  }
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements AfterViewInit {
  @ViewChild('googleButton')
  private googleButton?: ElementRef<HTMLDivElement>;

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private zone = inject(NgZone);

  isLoading = false;
  isGoogleLoading = false;
  showPassword = false;
  errorMessage = '';
  googleStatusMessage = '';

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    rememberMe: [false]
  });

  ngAfterViewInit(): void {
    this.initializeGoogleSignIn();
  }

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

    const credentials = this.loginForm.value as {
      email: string;
      password: string;
    };

    this.authService.login(credentials).subscribe({
      next: () => this.navigateAfterLogin(),
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = this.getLoginErrorMessage(
          err,
          'Invalid email or password'
        );
      }
    });
  }

  private initializeGoogleSignIn(): void {
    this.googleStatusMessage = '';

    this.authService.getGoogleAuthConfig().subscribe({
      next: (config) => {
        if (!config.enabled || !config.clientId) {
          this.googleStatusMessage =
            'Google Sign-In is not configured yet. Add GOOGLE_CLIENT_ID to backend/.env.';
          return;
        }

        this.loadGoogleIdentityScript()
          .then(() => this.renderGoogleButton(config.clientId))
          .catch(() => {
            this.zone.run(() => {
              this.googleStatusMessage =
                'Unable to load Google Sign-In. Check your internet connection and try again.';
            });
          });
      },
      error: () => {
        this.googleStatusMessage =
          'Google Sign-In configuration could not be loaded.';
      }
    });
  }

  private loadGoogleIdentityScript(): Promise<void> {
    if (window.google?.accounts?.id) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const scriptId = 'google-identity-services';
      const existing = document.getElementById(scriptId) as HTMLScriptElement | null;

      const handleLoad = () => {
        if (window.google?.accounts?.id) {
          resolve();
        } else {
          reject(new Error('Google Identity Services did not initialize.'));
        }
      };

      if (existing) {
        existing.addEventListener('load', handleLoad, { once: true });
        existing.addEventListener('error', () => reject(new Error('Google script failed to load.')), {
          once: true
        });
        return;
      }

      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = handleLoad;
      script.onerror = () => reject(new Error('Google script failed to load.'));

      document.head.appendChild(script);
    });
  }

  private renderGoogleButton(clientId: string): void {
    const google = window.google;
    const host = this.googleButton?.nativeElement;

    if (!google?.accounts?.id || !host) {
      this.googleStatusMessage = 'Google Sign-In is unavailable.';
      return;
    }

    google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        this.zone.run(() => this.handleGoogleCredential(response));
      },
      auto_select: false,
      cancel_on_tap_outside: true
    });

    host.replaceChildren();

    const measuredWidth = Math.floor(host.getBoundingClientRect().width);
    const buttonWidth = Math.max(
      240,
      Math.min(measuredWidth || 360, 400)
    );

    google.accounts.id.renderButton(host, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: buttonWidth
    });
  }

  private handleGoogleCredential(response: GoogleCredentialResponse): void {
    if (!response.credential) {
      this.errorMessage = 'Google did not return a valid sign-in credential.';
      return;
    }

    this.isGoogleLoading = true;
    this.errorMessage = '';
    this.googleStatusMessage = '';

    this.authService.loginWithGoogle(response.credential).subscribe({
      next: () => this.navigateAfterLogin(),
      error: (err) => {
        this.isGoogleLoading = false;
        this.errorMessage = this.getLoginErrorMessage(
          err,
          'Google Sign-In failed. Please try again.'
        );
      }
    });
  }

  private navigateAfterLogin(): void {
    const returnUrl =
      this.route.snapshot.queryParams['returnUrl'] || '/dashboard';

    this.router.navigateByUrl(returnUrl);
  }

  private getLoginErrorMessage(
    err: any,
    fallback: string
  ): string {
    if (err?.status === 0) {
      return 'Backend server unreachable. Please ensure the Spring Boot server is running on http://localhost:8080.';
    }

    if (err?.error?.message) {
      return err.error.message;
    }

    return fallback;
  }
}
