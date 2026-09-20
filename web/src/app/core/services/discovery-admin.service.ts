import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AdminDiscoveryItem,
  AdminDiscoveryQuery,
  AdminDiscoveryUpsert
} from '../models/discovery-admin.model';

@Injectable({ providedIn: 'root' })
export class DiscoveryAdminService {
  private readonly apiUrl = `${environment.apiUrl}/admin/discovery`;

  constructor(private readonly http: HttpClient) {}

  list(query: AdminDiscoveryQuery = {}): Observable<AdminDiscoveryItem[]> {
    let params = new HttpParams();
    if (query.missingPrice) params = params.set('missingPrice', true);
    if (query.missingImage) params = params.set('missingImage', true);
    if (query.conflictsOnly) params = params.set('conflictsOnly', true);
    return this.http.get<AdminDiscoveryItem[]>(this.apiUrl, { params });
  }

  create(payload: AdminDiscoveryUpsert): Observable<AdminDiscoveryItem> {
    return this.http.post<AdminDiscoveryItem>(this.apiUrl, payload);
  }

  update(id: number, payload: AdminDiscoveryUpsert): Observable<AdminDiscoveryItem> {
    return this.http.put<AdminDiscoveryItem>(`${this.apiUrl}/${id}`, payload);
  }

  verify(id: number, verifiedAt: string, expiresAt: string): Observable<AdminDiscoveryItem> {
    return this.http.patch<AdminDiscoveryItem>(`${this.apiUrl}/${id}/verify`, { verifiedAt, expiresAt });
  }

  setEnabled(id: number, enabled: boolean): Observable<AdminDiscoveryItem> {
    const params = new HttpParams().set('enabled', enabled);
    return this.http.patch<AdminDiscoveryItem>(`${this.apiUrl}/${id}/enabled`, null, { params });
  }
}
