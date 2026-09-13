import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <footer class="footer">
      <div class="footer-container">
        <div class="footer-brand">
          <div class="brand">
            <span class="material-symbols-outlined">flight_takeoff</span>
            TripMate
          </div>
          <p class="tagline">Your intelligent AI trip & group travel companion.</p>
        </div>
        <div class="copyright">
          &copy; {{ currentYear }} TripMate Inc. All rights reserved.
        </div>
      </div>
    </footer>
  `,
  styles: [`
    .footer {
      border-top: 1px solid var(--border);
      background-color: var(--surface-card);
      padding: 2rem;
      margin-top: auto;
    }
    .footer-container {
      max-width: 1280px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      text-align: center;
    }
    .brand {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      font-family: var(--font-heading);
      font-size: 1.25rem;
      font-weight: 800;
      color: var(--primary);
    }
    .tagline {
      font-size: 0.9rem;
      color: var(--text-muted);
      margin-top: 0.2rem;
    }
    .copyright {
      font-size: 0.85rem;
      color: var(--text-secondary);
    }
  `]
})
export class FooterComponent {
  currentYear = new Date().getFullYear();
}
