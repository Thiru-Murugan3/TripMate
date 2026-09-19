import { PlaceCategory } from './place.model';

export type DiscoveryCategory =
  | 'ALL'
  | 'ATTRACTION'
  | 'NATURE'
  | 'WATERFALL'
  | 'LAKE'
  | 'BEACH'
  | 'VIEWPOINT'
  | 'TEMPLE'
  | 'CHURCH'
  | 'MUSEUM'
  | 'PARK'
  | 'WILDLIFE'
  | 'ADVENTURE'
  | 'ENTERTAINMENT'
  | 'SHOPPING'
  | 'FOOD'
  | 'STAY'
  | 'EVENT'
  | 'HISTORICAL';

export type DiscoveryItemType = 'PLACE' | 'ACTIVITY' | 'FOOD' | 'STAY' | 'EVENT' | 'TOUR_SERVICE';
export type DiscoveryPriceStatus = 'FREE' | 'VERIFIED' | 'STARTING_FROM' | 'ESTIMATED' | 'UNKNOWN';
export type DiscoveryPriceType =
  | 'PER_PERSON'
  | 'PER_ACTIVITY'
  | 'PER_VEHICLE'
  | 'PER_NIGHT'
  | 'FIXED'
  | 'RANGE'
  | 'UNKNOWN';

export interface DiscoveryPriceOption {
  label: string;
  amount: number;
  maximumAmount?: number;
  priceType: DiscoveryPriceType;
  currency: string;
  sourceUrl?: string;
  lastVerifiedAt?: string;
}

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
  itemType?: DiscoveryItemType;
  address?: string;
  mapUrl?: string;
  priceStatus?: DiscoveryPriceStatus;
  priceType?: DiscoveryPriceType;
  currency?: string;
  priceOptions?: DiscoveryPriceOption[];
  sourceName?: string;
  sourceUrl?: string;
  sourceLastCheckedAt?: string;
  confidenceScore?: number;
  imageSource?: string;
  imageAttribution?: string;
  imageLicense?: string;
  imageExact?: boolean;
  bestTimeToVisit?: string;
  safetyInformation?: string;
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
  providersUsed?: string[];
  warnings?: string[];
  lastUpdatedAt?: string;
  page?: number;
  size?: number;
  totalPages?: number;
}

export interface DiscoverySearchFilters {
  itemType?: DiscoveryItemType | 'ALL';
  minPrice?: number;
  maxPrice?: number;
  priceStatus?: DiscoveryPriceStatus | 'ALL';
  sort?: 'DISTANCE' | 'PRICE_LOW' | 'PRICE_HIGH' | 'VERIFIED' | 'NAME';
  page?: number;
  size?: number;
}
