import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TripService } from '../../../core/services/trip.service';
import { DashboardComponent } from '../../../features/dashboard/dashboard.component';
import { NavbarComponent } from './navbar.component';

function atWidth(elements: HTMLElement[], width: number, check: (doc: Document) => void): void {
  const frame = document.createElement('iframe');
  frame.style.cssText = `width:${width}px;height:1800px;border:0;position:absolute;left:-10000px`;
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument!;
    for (const style of document.querySelectorAll('style')) doc.head.appendChild(style.cloneNode(true));
    doc.body.style.cssText = 'margin:0;overflow:visible';
    for (const element of elements) doc.body.appendChild(element.cloneNode(true));
    check(doc);
    expect(doc.documentElement.scrollWidth).withContext(`page overflow at ${width}px`).toBeLessThanOrEqual(width);
  } finally { frame.remove(); }
}

function fits(doc: Document, selector: string, width: number): void {
  for (const element of doc.querySelectorAll<HTMLElement>(selector)) {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    expect(rect.left).withContext(selector).toBeGreaterThanOrEqual(0);
    expect(rect.right).withContext(selector).toBeLessThanOrEqual(width);
  }
}

describe('Phone navigation and home layout', () => {
  const authenticated = signal(true);
  beforeEach(() => {
    authenticated.set(true);
    TestBed.configureTestingModule({
      imports: [NavbarComponent, DashboardComponent],
      providers: [provideRouter([]),
        { provide: AuthService, useValue: {
          isAuthenticated: authenticated,
          currentUser: () => ({ name: 'Thirumurugan with a very long account name', email: 'traveller@example.com', systemRole: 'ADMIN' })
        } },
        { provide: NotificationService, useValue: { unreadCount$: of(123), refreshUnreadCount: () => of({ count: 123 }) } },
        { provide: TripService, useValue: { getMyTrips: () => of([]) } }
      ]
    });
  });

  it('fits authenticated navigation and home actions on small phones without shrinking touch targets', () => {
    const nav = TestBed.createComponent(NavbarComponent);
    const home = TestBed.createComponent(DashboardComponent);
    nav.detectChanges(); home.detectChanges();
    try {
      for (const width of [320, 360, 390, 454, 768]) atWidth([nav.nativeElement, home.nativeElement], width, doc => {
        fits(doc, '.navbar,.brand-logo,.nav-links a,.nav-actions button,.hero-content,.hero-actions a,.hero-actions button', width);
        for (const button of doc.querySelectorAll<HTMLElement>('.nav-actions button,.nav-links a')) {
          expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
        }
        expect(doc.querySelector('.nav-actions')!.getBoundingClientRect().bottom)
          .toBeLessThanOrEqual(doc.querySelector('.nav-links')!.getBoundingClientRect().top);
      });
    } finally { nav.destroy(); home.destroy(); }
  });

  it('fits guest actions, account popover and search modal in a 320px viewport', () => {
    const nav = TestBed.createComponent(NavbarComponent);
    nav.detectChanges();
    try {
      nav.componentInstance.toggleProfileDropdown(); nav.detectChanges();
      atWidth([nav.nativeElement], 320, doc => fits(doc, '.profile-popover,.popover-name,.detail-value', 320));
      nav.componentInstance.toggleSearchModal(); nav.detectChanges();
      atWidth([nav.nativeElement], 320, doc => {
        fits(doc, '.search-modal-card,input,.search-submit-btn,.search-close-btn', 320);
        expect(doc.querySelector('input')!.getBoundingClientRect().width).toBeGreaterThan(100);
      });
      authenticated.set(false); nav.componentInstance.closeSearchModal(); nav.detectChanges();
      atWidth([nav.nativeElement], 320, doc => fits(doc, '.brand-logo,.nav-actions a', 320));
    } finally { nav.destroy(); }
  });

  it('retains the desktop account name and single-row navigation', () => {
    const nav = TestBed.createComponent(NavbarComponent); nav.detectChanges();
    try {
      atWidth([nav.nativeElement], 1440, doc => {
        fits(doc, '.navbar,.nav-actions', 1440);
        expect(doc.defaultView!.getComputedStyle(doc.querySelector('.user-name')!).display).not.toBe('none');
        expect(doc.defaultView!.getComputedStyle(doc.querySelector('.nav-container')!).display).toBe('flex');
      });
    } finally { nav.destroy(); }
  });
});
