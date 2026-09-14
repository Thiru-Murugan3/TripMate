import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="navbar glass-panel">
      <div class="nav-container">
        <!-- Logo -->
        <a routerLink="/" class="brand-logo">
          <div class="logo-icon-badge">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3.414 13.778 2 15.192l4.95 4.95 2.12-2.122-2.828-2.828 5.657-5.657 5.657 5.657-2.829 2.828 2.122 2.122 4.95-4.95-1.414-1.414L12 6.707l-8.586 7.071z"/>
              <path d="M12 2 2 12h3v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8h3L12 2zm0 3.828L18 11.8v7.2H6v-7.2l6-5.972z"/>
            </svg>
          </div>
          <div class="brand-title-block">
            <span class="brand-text">Trip<span class="brand-highlight">Mate</span></span>
            <span class="brand-subtext">EXPLORE BEYOND</span>
          </div>
        </a>

        <!-- Nav Links -->
        <div class="nav-links" *ngIf="authService.isAuthenticated()">
          <a
            routerLink="/dashboard"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
            class="nav-link"
          >
            Home
          </a>
          <a
            routerLink="/trips"
            routerLinkActive="active"
            class="nav-link"
            aria-label="Open My Trips"
          >
            My Trips
          </a>
          <a href="javascript:void(0)" class="nav-link">
            Explore
          </a>
          <a href="javascript:void(0)" class="nav-link">
            Expenses
          </a>
          <a href="javascript:void(0)" class="nav-link">
            Bookings
          </a>
          <a href="javascript:void(0)" class="nav-link">
            Documents
          </a>
        </div>

        <!-- User Menu / Actions -->
        <div class="nav-actions">
          <ng-container *ngIf="authService.isAuthenticated(); else guestActions">
            <!-- Search & Notification Icons -->
            <button class="icon-btn" aria-label="Search">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="header-icon">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </button>

            <button
              class="icon-btn"
              type="button"
              routerLink="/invitations"
              aria-label="Open invitations"
              title="Invitations"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="header-icon">
                <rect x="3" y="5" width="18" height="14" rx="2"/>
                <path d="m3 7 9 6 9-6"/>
              </svg>
            </button>

            <button
              class="icon-btn notification-btn"
              type="button"
              routerLink="/notifications"
              aria-label="Open notifications"
              title="Notifications"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="header-icon">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <span
                class="notification-badge"
                *ngIf="(notificationService.unreadCount$ | async) as unreadCount"
              >
                {{ unreadCount > 99 ? '99+' : unreadCount }}
              </span>
            </button>

            <div class="header-divider"></div>

            <!-- Profile Trigger Button & Popover Dropdown -->
            <div class="profile-dropdown-container">
              <button 
                type="button" 
                class="user-profile-btn" 
                (click)="toggleProfileDropdown()" 
                [attr.aria-expanded]="showProfileDropdown"
                title="View Profile Details"
              >
                <div class="avatar-wrapper">
                  <div class="avatar">
                    {{ getUserInitials() }}
                  </div>
                </div>
                <span class="user-name">{{ getUserDisplayName() }}</span>
                <svg class="chevron-icon" [class.rotated]="showProfileDropdown" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              <!-- Profile Details Popover -->
              <div class="profile-popover" *ngIf="showProfileDropdown">
                <div class="profile-popover-header">
                  <div class="popover-avatar">
                    {{ getUserInitials() }}
                  </div>
                  <div class="popover-user-info">
                    <h4 class="popover-name">{{ getUserDisplayName() }}</h4>
                    <span class="role-badge">{{ getUserRole() }}</span>
                  </div>
                  <button (click)="showProfileDropdown = false" class="popover-close-btn">&times;</button>
                </div>

                <div class="profile-details-list">
                  <div class="detail-item">
                    <svg class="detail-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                    <div class="detail-content">
                      <span class="detail-label">Email Address</span>
                      <span class="detail-value">{{ getUserEmail() }}</span>
                    </div>
                  </div>

                  <div class="detail-item">
                    <svg class="detail-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                      <line x1="12" y1="18" x2="12.01" y2="18"/>
                    </svg>
                    <div class="detail-content">
                      <span class="detail-label">Mobile Number</span>
                      <span class="detail-value">{{ getUserMobile() }}</span>
                    </div>
                  </div>

                  <div class="detail-item">
                    <svg class="detail-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                    <div class="detail-content">
                      <span class="detail-label">Account Status</span>
                      <span class="detail-value status-active">
                        <span class="status-dot"></span> Active Traveler
                      </span>
                    </div>
                  </div>
                </div>

                <div class="profile-popover-actions">
                  <button (click)="logout()" class="popover-logout-btn">
                    <span class="material-symbols-outlined">logout</span>
                    Sign Out Account
                  </button>
                </div>
              </div>
            </div>
          </ng-container>

          <ng-template #guestActions>
            <a routerLink="/login" class="btn btn-secondary">Login</a>
            <a routerLink="/register" class="btn btn-primary">Sign Up</a>
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
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
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
      gap: 0.65rem;
      text-decoration: none;
    }
    .logo-icon-badge {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: #2563eb;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      box-shadow: 0 3px 10px rgba(37, 99, 235, 0.3);
    }
    .logo-icon-badge svg {
      width: 20px;
      height: 20px;
    }
    .brand-title-block {
      display: flex;
      flex-direction: column;
      line-height: 1.1;
    }
    .brand-text {
      font-family: var(--tm-font, sans-serif);
      font-size: 1.3rem;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.02em;
    }
    .brand-highlight {
      color: #2563eb;
    }
    .brand-subtext {
      font-size: 0.6rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      color: #64748b;
    }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 1.75rem;
    }
    .nav-link {
      font-size: 0.9rem;
      font-weight: 500;
      color: #64748b;
      padding: 0.5rem 0.2rem;
      text-decoration: none;
      transition: all 0.15s ease;
      position: relative;
    }
    .nav-link:hover {
      color: #1e293b;
    }
    .nav-link.active {
      color: #2563eb;
      font-weight: 600;
    }
    .nav-link.active::after {
      content: '';
      position: absolute;
      bottom: -0.8rem;
      left: 0;
      right: 0;
      height: 2.5px;
      background-color: #2563eb;
      border-radius: 2px;
    }
    .nav-actions {
      display: flex;
      align-items: center;
      gap: 1.1rem;
    }
    .icon-btn {
      background: transparent;
      border: none;
      padding: 0.4rem;
      cursor: pointer;
      color: #64748b;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      transition: background 0.15s ease;
      position: relative;
    }
    .icon-btn:hover {
      background: #f1f5f9;
      color: #1e293b;
    }
    .header-icon {
      width: 20px;
      height: 20px;
    }
    .notification-badge {
      position: absolute;
      top: -4px;
      right: -6px;
      min-width: 18px;
      height: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
      background-color: #ef4444;
      color: #ffffff;
      border-radius: 999px;
      border: 1.5px solid #ffffff;
      font-size: 0.62rem;
      font-weight: 800;
      line-height: 1;
    }
    .header-divider {
      width: 1px;
      height: 22px;
      background-color: #e2e8f0;
    }
    .profile-dropdown-container {
      position: relative;
    }
    .user-profile-btn {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      background: transparent;
      border: none;
      padding: 0.35rem 0.6rem;
      border-radius: 10px;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .user-profile-btn:hover {
      background: #f1f5f9;
    }
    .avatar-wrapper {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      overflow: hidden;
      border: 1.5px solid #3b82f6;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.2);
    }
    .avatar {
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
      color: white;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
    }
    .user-name {
      font-weight: 600;
      font-size: 0.875rem;
      color: #1e293b;
    }
    .chevron-icon {
      width: 16px;
      height: 16px;
      color: #64748b;
      transition: transform 0.2s ease;
    }
    .chevron-icon.rotated {
      transform: rotate(180deg);
    }

    /* Popover */
    .profile-popover {
      position: absolute;
      top: calc(100% + 10px);
      right: 0;
      width: 290px;
      background: #ffffff;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 20px 40px rgba(15, 23, 42, 0.15);
      padding: 1.25rem;
      z-index: 2000;
      animation: popoverFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes popoverFadeIn {
      from { opacity: 0; transform: translateY(-8px) scale(0.96); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .profile-popover-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #f1f5f9;
      position: relative;
    }
    .popover-avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, #2563eb 0%, #38bdf8 100%);
      color: white;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
    }
    .popover-user-info {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      flex: 1;
    }
    .popover-name {
      font-size: 1rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }
    .role-badge {
      display: inline-block;
      align-self: flex-start;
      font-size: 0.65rem;
      font-weight: 800;
      color: #2563eb;
      background: #eff6ff;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      letter-spacing: 0.05em;
    }
    .popover-close-btn {
      background: none;
      border: none;
      font-size: 1.4rem;
      color: #94a3b8;
      cursor: pointer;
      line-height: 1;
      padding: 0.2rem;
    }
    .popover-close-btn:hover {
      color: #0f172a;
    }
    .profile-details-list {
      padding: 0.85rem 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .detail-item {
      display: flex;
      align-items: flex-start;
      gap: 0.65rem;
    }
    .detail-icon {
      width: 18px;
      height: 18px;
      color: #2563eb;
      margin-top: 2px;
      flex-shrink: 0;
    }
    .detail-content {
      display: flex;
      flex-direction: column;
    }
    .detail-label {
      font-size: 0.675rem;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .detail-value {
      font-size: 0.85rem;
      font-weight: 600;
      color: #1e293b;
      word-break: break-all;
    }
    .status-active {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      color: #059669;
    }
    .status-dot {
      width: 7px;
      height: 7px;
      background-color: #10b981;
      border-radius: 50%;
      display: inline-block;
    }
    .profile-popover-actions {
      padding-top: 0.85rem;
      border-top: 1px solid #f1f5f9;
    }
    .popover-logout-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      padding: 0.6rem;
      background-color: #fef2f2;
      color: #dc2626;
      border: 1px solid #fecaca;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .popover-logout-btn:hover {
      background-color: #fee2e2;
      border-color: #fca5a5;
    }
    .popover-logout-btn .material-symbols-outlined {
      font-size: 1.1rem;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem 1.1rem;
      font-family: var(--tm-font, sans-serif);
      font-size: 0.875rem;
      font-weight: 600;
      border-radius: 8px;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .btn-secondary {
      color: #334155;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
    }
    .btn-primary {
      color: #ffffff;
      background: #2563eb;
      border: 0;
    }
  `]
})
export class NavbarComponent {
  authService = inject(AuthService);
  readonly notificationService = inject(NotificationService);
  private router = inject(Router);

  showProfileDropdown = false;

  constructor() {
    effect(() => {
      if (this.authService.isAuthenticated()) {
        this.notificationService.refreshUnreadCount().subscribe({
          error: () => {
            // Keep navigation usable if the unread-count request is temporarily unavailable.
          }
        });
      }
    });
  }

  toggleProfileDropdown(): void {
    this.showProfileDropdown = !this.showProfileDropdown;
  }

  logout(): void {
    this.showProfileDropdown = false;
    this.authService.logout().subscribe(() => {
      this.router.navigate(['/login']);
    });
  }

  getUserDisplayName(): string {
    const user = this.authService.currentUser();
    return user?.name || 'Thiru S.';
  }

  getUserEmail(): string {
    const user = this.authService.currentUser();
    return user?.email || 'thiru@example.com';
  }

  getUserMobile(): string {
    const user = this.authService.currentUser();
    return user?.mobile || '+91 98765 43210';
  }

  getUserRole(): string {
    const user = this.authService.currentUser();
    return user?.systemRole || 'EXPLORER';
  }

  getUserInitials(): string {
    const name = this.getUserDisplayName();
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }
}
