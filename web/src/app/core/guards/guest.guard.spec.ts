import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { guestGuard } from './guest.guard';
import { AuthService } from '../services/auth.service';
import { routes } from '../../app.routes';

describe('guestGuard', () => {
  const signedIn = signal(false);

  beforeEach(() => {
    signedIn.set(false);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: { isAuthenticated: signedIn } }]
    });
  });

  const run = (queryParams: Record<string, string> = {}) => TestBed.runInInjectionContext(() =>
    guestGuard({ queryParams } as unknown as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
  const url = (result: unknown) => TestBed.inject(Router).serializeUrl(result as UrlTree);

  it('shows the login page to signed-out visitors', () => {
    expect(run()).toBeTrue();
  });

  it('sends a signed-in user opening the app straight to their trips', () => {
    signedIn.set(true);
    expect(url(run())).toBe('/dashboard');
  });

  it('honours a safe return URL such as an invitation link', () => {
    signedIn.set(true);
    expect(url(run({ returnUrl: '/invite/abc-123' }))).toBe('/invite/abc-123');
  });

  it('ignores an unsafe external return URL', () => {
    signedIn.set(true);
    expect(url(run({ returnUrl: '//evil.example/steal' }))).toBe('/dashboard');
  });

  it('guards the default login route, which is where the app opens', () => {
    const login = routes.find(route => route.path === 'login');
    expect(login?.canActivate).toContain(guestGuard);
    expect(routes.find(route => route.path === '')?.redirectTo).toBe('login');
  });
});
