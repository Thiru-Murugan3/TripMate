import { DiscoveredPlace } from '../../core/models/discovery.model';
import { CataloguePlace } from './india-catalogue.service';

/** Planning supports unmapped source records without manufacturing coordinates or prices. */
export type PlanningPlace = Omit<DiscoveredPlace, 'latitude' | 'longitude' | 'distanceKm' | 'suggestedVisitMinutes'> & {
  latitude?: number; longitude?: number; distanceKm?: number; suggestedVisitMinutes?: number;
  catalogueNotes?: string;
};

export const catalogueKey = (place: CataloguePlace): string => `catalogue:${place.place_id}`;

export function cataloguePlanningPlace(place: CataloguePlace): PlanningPlace {
  const notes = [
    `CatalogueRecord=${place.place_id}`, `Source name: ${place.name}`,
    `Source: ${place.source_provider} ${place.source_url}`, `Checked: ${place.source_checked_at}`,
    `Review required. Tourist relevance and visitor access must be confirmed.`,
    `Location: ${[place.district, place.state_ut].filter(Boolean).join(', ') || 'Not assigned'}`
  ];
  if (place.latitude == null || place.longitude == null) notes.push('Exact coordinates not verified.');
  if (place.district_status === 'ASI_PUBLISHED_DISTRICT_CURRENT_BOUNDARY_NOT_VERIFIED') {
    notes.push(`Historical district as published: ${place.district_as_published || place.district}; current boundary unverified.`);
  }
  notes.push(place.fees.length ? 'Historical fee options available in the source catalogue; confirm current applicable total.' : 'Entry fee unknown; not confirmed free.');
  return {
    externalId: catalogueKey(place), name: place.name.slice(0,180), category: 'ATTRACTION', saveCategory: 'ATTRACTION',
    latitude: place.latitude ?? undefined, longitude: place.longitude ?? undefined,
    description: `Source catalogue record. Review required. ${place.source_url}`,
    sourceUrl: place.source_url, sourceName: place.source_provider, sourceLastCheckedAt: place.source_checked_at,
    priceStatus: 'UNKNOWN', catalogueNotes: notes.join(' · ')
  };
}
