import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'verify-email',
    loadComponent: () =>
      import('./features/auth/verify-email/verify-email.component').then((m) => m.VerifyEmailComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then((m) => m.ForgotPasswordComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then((m) => m.ResetPasswordComponent),
    canActivate: [guestGuard]
  },

  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'trips',
    loadComponent: () =>
      import('./features/trips/my-trips/my-trips.component').then((m) => m.MyTripsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'trips/:id/bookings/new',
    loadComponent: () =>
      import('./features/bookings/booking-marketplace.component').then((m) => m.BookingMarketplaceComponent),
    canActivate: [authGuard]
  },
  {
    path: 'trips/:id',
    loadComponent: () =>
      import('./features/trips/trip-details/trip-details.component').then((m) => m.TripDetailsComponent),
    canActivate: [authGuard]
  },

  { path: '**', redirectTo: 'login' }
];
