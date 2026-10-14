import { Injectable, inject } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';

export const CATALOGUE_ROOT = 'india-catalogue/2026-10-14/';
export interface CatalogueState { name: string; file: string; count: number; }
export interface CatalogueIndex { snapshot: string; total: number; states: CatalogueState[]; }
export interface CatalogueFee {
  amount_inr: number; visitor_category: string; scope: string; payment_channel: string;
  condition: string; source_url: string; source_checked_at: string;
}
export interface CataloguePhoto {
  local_thumbnail: string; creator: string; license: string; license_url: string;
  source_page: string; capture_date_as_reported: string; attribution_text: string;
  restrictions: string; credit: string;
}
export interface CataloguePlace {
  place_id: string; name: string; state_ut: string; district: string | null;
  tourism_destination: string | null; record_type: string;
  latitude: number | null; longitude: number | null; coordinate_source: string | null;
  source_provider: string; source_url: string; source_checked_at: string;
  possible_duplicate_group: string | null; publication_status: string;
  fees: CatalogueFee[]; photo: CataloguePhoto | null;
}

/** Public static resources must not trigger auth refresh or carry account tokens. */
@Injectable({ providedIn: 'root' })
export class IndiaCatalogueService {
  private readonly http = new HttpClient(inject(HttpBackend));
  index() { return this.http.get<CatalogueIndex>(CATALOGUE_ROOT + 'index.json'); }
  state(state: CatalogueState) {
    return this.http.get<CataloguePlace[]>(CATALOGUE_ROOT + state.file);
  }
}
