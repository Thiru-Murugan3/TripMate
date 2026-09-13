import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="navbar glass-panel">
      <div class="nav-container">
        <!-- Logo -->
        <a routerLink="/" class="brand-logo">
          <span class="material-symbols-outlined brand-icon">flight_takeoff</span>
          <span class="brand-text">Trip<span class="brand-highlight">Mate</span></span>
        </a>

        <!-- Nav Links -->
        <div class="nav-links" *ngIf="authService.isAuthenticated()">
          <a routerLink="/dashboard" routerLinkActive="active" class="nav-link">
            <span class="material-symbols-outlined">dashboard</span>
            Dashboard
          </a>
          <a routerLink="/trips" routerLinkActive="active" class="nav-link">
            <span class="material-symbols-outlined">explore</span>
            My Trips
          </a>
        </div>

        <!-- User Menu / Actions -->
        <div class="nav-actions">
          <ng-container *ngIf="authService.isAuthenticated(); else guestActions">
            <div class="user-profile">
              <div class="avatar">
                {{ getUserInitials() }}
              </div>
              <span class="user-name">{{ authService.currentUser()?.name }}</span>
            </div>
            <button (click)="logout()" class="btn btn-secondary btn-sm logout-btn">
              <span class="material-symbols-outlined">logout</span>
              Logout
            </button>
          </ng-container>

          <ng-template #guestActions>
            <a routerLink="/login" class="btn btn-secondary">Login</a>
            <a routerLink="/register" class="btn btn-primary">Get Started</a>
          </ng-template>
        </div>
      </div>
    </nav>
  `,
  styles: [`
    .navbar {
      position: sticky;
      top: 0;
      z-index: 1000;
      padding: 0.75rem 2rem;
      border-bottom: 1px solid var(--border);
    }
    .nav-container {
      max-width: 1280px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand-logo {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-family: var(--font-heading);
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--text-main);
      text-decoration: none;
    }
    .brand-icon {
      font-size: 2rem;
      color: var(--primary);
    }
    .brand-highlight {
      color: var(--primary);
    }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }
    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-weight: 600;
      color: var(--text-secondary);
      padding: 0.5rem 0.75rem;
      border-radius: var(--radius-sm);
      transition: all 0.2s ease;
    }
    .nav-link:hover, .nav-link.active {
      color: var(--primary);
      background-color: var(--primary-light);
    }
    .nav-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .user-profile {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: var(--brand-gradient);
      color: white;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
    }
    .user-name {
      font-weight: 600;
      font-size: 0.95rem;
    }
    .btn-sm {
      padding: 0.4rem 0.8rem;
      font-size: 0.85rem;
    }
  `]
})
export class NavbarComponent {
  authService = inject(AuthService);
  private router = inject(Router);

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  getUserInitials(): string {
    const user = this.authService.currentUser();
    if (!user || !user.name) return 'U';
    const parts = user.name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }
}
