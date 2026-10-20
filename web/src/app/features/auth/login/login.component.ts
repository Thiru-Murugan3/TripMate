import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { authReturnUrl } from '../../../core/utils/auth-return-url';
import {Subscription,finalize} from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnDestroy {
  private request?:Subscription;
  private slowTimer?:ReturnType<typeof setTimeout>;
  slowLogin=false;
  ngOnDestroy():void {this.request?.unsubscribe();clearTimeout(this.slowTimer);}
  cancelLogin():void {this.request?.unsubscribe();this.errorMessage='Sign-in cancelled. You can try again.';}
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly returnUrl = authReturnUrl(this.route.snapshot.queryParams['returnUrl']);

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
    if (this.loginForm.invalid||this.isLoading) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.slowLogin=false;
    this.slowTimer=setTimeout(()=>this.slowLogin=true,8000);

    const credentials = this.loginForm.value as { email: string; password: string };

    this.request=this.authService.login(credentials).pipe(finalize(()=>{this.isLoading=false;this.slowLogin=false;clearTimeout(this.slowTimer);})).subscribe({
      next: () => {
        void this.router.navigateByUrl(this.returnUrl).then(ok=>{if(!ok)this.errorMessage='Unable to open your trips. Please try again.';}).catch(()=>this.errorMessage='Unable to open your trips. Please try again.');
      },
      error: (err) => {
        this.isLoading = false;

        if(err?.name==='TimeoutError'){this.errorMessage='Sign-in timed out. Check your connection and try again.';return;}
        if (err.status === 0) {
          this.errorMessage =
            'Unable to reach Suttru. Check your connection and try again.';
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
            'This device could not connect to Suttru. Please try again shortly.';
        } else if([502,503,504].includes(err.status)){
          this.errorMessage='Suttru is temporarily unavailable. Please try again shortly.';
        } else if (serverMessage) {
          this.errorMessage = serverMessage;
        } else {
          this.errorMessage = `Login failed (HTTP ${err.status}). Please try again.`;
        }
      }
    });
  }
}
