import { PlaceCategory } from './place.model';

export type DiscoveryCategory =
  | 'ALL'
  | 'ATTRACTION'
  | 'NATURE'
  | 'WATERFALL'
  | 'LAKE'
  | 'RIVER'
  | 'BEACH'
  | 'VIEWPOINT'
  | 'TEMPLE'
  | 'CHURCH'
  | 'MUSEUM'
  | 'PARK'
  | 'WILDLIFE'
  | 'ADVENTURE'
  | 'ENTERTAINMENT'
  | 'FAMILY'
  | 'CULTURAL'
  | 'NIGHTLIFE'
  | 'WELLNESS'
  | 'TRANSPORT'
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
  status?: DiscoveryPriceStatus;
  expiresAt?: string;
  mayHaveChanged?: boolean;
}

export interface DiscoveryImage {
  url: string;
  sourcePage?: string;
  sourceName?: string;
  author?: string;
  license?: string;
  attribution?: string;
  exact: boolean;
  primary: boolean;
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
  slug?: string;
  itemType?: DiscoveryItemType;
  subcategory?: string;
  city?: string;
  district?: string;
  state?: string;
  fullAddress?: string;
  address?: string;
  shortDescription?: string;
  detailedDescription?: string;
  primaryImageUrl?: string;
  imageGallery?: DiscoveryImage[];
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
  activityDuration?: number;
  minimumAge?: number;
  maximumAge?: number;
  minimumWeight?: number;
  maximumWeight?: number;
  difficultyLevel?: string;
  safetyInformation?: string;
  inclusions?: string[];
  exclusions?: string[];
  thingsToCarry?: string[];
  accessibilityInformation?: string;
  contactPhone?: string;
  officialWebsite?: string;
  bookingUrl?: string;
  cancellationInformation?: string;
  verificationExpiresAt?: string;
  verificationExpired?: boolean;
  rating?: number;
  ratingCount?: number;
  popularityScore?: number;
  familyFriendly?: boolean;
  openNow?: boolean;
  curated?: boolean;
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
  appliedFilters?: Record<string, unknown>;
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
  subcategory?: string;
  minPrice?: number;
  maxPrice?: number;
  priceStatus?: DiscoveryPriceStatus | 'ALL';
  openNow?: boolean;
  familyFriendly?: boolean;
  difficulty?: string;
  minDuration?: number;
  maxDuration?: number;
  minRating?: number;
  sort?: 'RELEVANCE' | 'DISTANCE' | 'PRICE_LOW' | 'PRICE_HIGH' | 'POPULAR' | 'VERIFIED' | 'RECENTLY_VERIFIED' | 'NAME';
  page?: number;
  size?: number;
}

export interface DiscoverySuggestion {
  label: string;
  city?: string;
  district?: string;
  state?: string;
  latitude: number;
  longitude: number;
  provider: string;
}
