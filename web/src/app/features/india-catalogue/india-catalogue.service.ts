import { Injectable, inject } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';

export const CATALOGUE_ROOT = 'india-catalogue/2026-10-15/';
export interface CatalogueState { name: string; file: string; count: number; }
export interface CatalogueIndex { snapshot: string; total: number; states: CatalogueState[]; unassigned?: CatalogueState; destinationStates?: Record<string, string[]>; }
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
  place_id: string; name: string; state_ut: string | null; district: string | null;
  tourism_destination: string | null; record_type: string;
  latitude: number | null; longitude: number | null; coordinate_source: string | null;
  source_provider: string; source_url: string; source_checked_at: string;
  possible_duplicate_group: string | null; publication_status: string;
  fees: CatalogueFee[]; photo: CataloguePhoto | null;
  source_kind?: string; categories?: string[]; name_variants?: string[];
  district_status?: string; district_as_published?: string;
  visitor_access_status?: string; tourist_relevance_status?: string;
}

/** Public static resources must not trigger auth refresh or carry account tokens. */
@Injectable({ providedIn: 'root' })
export class IndiaCatalogueService {
  private readonly http = new HttpClient(inject(HttpBackend));
  index() { return this.http.get<CatalogueIndex>(CATALOGUE_ROOT + 'index.json?schema=3'); }
  state(state: CatalogueState) {
    return this.http.get<CataloguePlace[]>(CATALOGUE_ROOT + state.file);
  }
}
