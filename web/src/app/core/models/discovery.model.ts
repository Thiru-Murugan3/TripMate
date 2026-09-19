import { PlaceCategory } from './place.model';

export type DiscoveryCategory =
  | 'ALL'
  | 'ATTRACTION'
  | 'NATURE'
  | 'WATERFALL'
  | 'LAKE'
  | 'VIEWPOINT'
  | 'TEMPLE'
  | 'CHURCH'
  | 'MUSEUM'
  | 'PARK'
  | 'ADVENTURE'
  | 'SHOPPING'
  | 'FOOD'
  | 'HISTORICAL';

export interface DiscoveredPlace {
  externalId: string;
  name: string;
  category: Exclude<DiscoveryCategory, 'ALL'>;
  latitude: number;
  longitude: number;
  distanceKm: number;
  suggestedVisitMinutes: number;
  description?: string;
  imageUrl?: string;
  openingHours?: string;
  website?: string;
  saveCategory: PlaceCategory;
  estimatedCostPerPerson?: number;
  activityType?: string;
}

export interface DestinationDiscoveryResponse {
  query: string;
  resolvedDestination: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  category: DiscoveryCategory;
  provider: string;
  attribution: string;
  resultCount: number;
  places: DiscoveredPlace[];
}
