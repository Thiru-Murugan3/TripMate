import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { DiscoveryAdminService } from './discovery-admin.service';

describe('DiscoveryAdminService', () => {
  let service: DiscoveryAdminService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DiscoveryAdminService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DiscoveryAdminService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads records missing verified prices or images', () => {
    service.list({ missingPrice: true, missingImage: true }).subscribe();
    const request = http.expectOne((req) => req.url === `${environment.apiUrl}/admin/discovery`);
    expect(request.request.params.get('missingPrice')).toBe('true');
    expect(request.request.params.get('missingImage')).toBe('true');
    request.flush([]);
  });

  it('verifies a record with explicit timestamps', () => {
    const checked = '2026-09-20T10:00:00.000Z';
    const expires = '2026-10-20T10:00:00.000Z';
    service.verify(42, checked, expires).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/admin/discovery/42/verify`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ verifiedAt: checked, expiresAt: expires });
    request.flush({});
  });

  it('disables an incorrect listing without deleting it', () => {
    service.setEnabled(42, false).subscribe();
    const request = http.expectOne((req) => req.url.endsWith('/admin/discovery/42/enabled'));
    expect(request.request.method).toBe('PATCH');
    expect(request.request.params.get('enabled')).toBe('false');
    request.flush({});
  });
});
