import {
  DiscoveredPlace,
  DiscoveryCategory,
  DiscoveryImage,
  DiscoveryItemType,
  DiscoveryPriceOption,
  DiscoveryPriceStatus,
  DiscoveryPriceType
} from './discovery.model';

export interface AdminDiscoveryItem {
  id: number;
  listing: DiscoveredPlace;
  enabled: boolean;
  conflictStatus?: string;
  conflictNotes?: string;
  createdBy?: number;
  updatedBy?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminDiscoveryQuery {
  missingPrice?: boolean;
  missingImage?: boolean;
  conflictsOnly?: boolean;
}

export interface AdminDiscoveryUpsert {
  externalId?: string;
  name: string;
  itemType: DiscoveryItemType;
  category: Exclude<DiscoveryCategory, 'ALL'>;
  subcategory?: string;
  city?: string;
  district?: string;
  state?: string;
  fullAddress?: string;
  latitude: number;
  longitude: number;
  shortDescription?: string;
  detailedDescription?: string;
  openingHours?: string;
  suggestedVisitMinutes?: number;
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
  priceStatus: DiscoveryPriceStatus;
  priceType: DiscoveryPriceType;
  currency: string;
  basePrice?: number;
  sourceName: string;
  sourceUrl: string;
  sourceLastCheckedAt?: string;
  verificationExpiresAt?: string;
  confidenceScore?: number;
  rating?: number;
  ratingCount?: number;
  popularityScore?: number;
  familyFriendly?: boolean;
  conflictStatus?: string;
  conflictNotes?: string;
  enabled: boolean;
  priceOptions: DiscoveryPriceOption[];
  images: Array<{
    imageUrl: string;
    sourcePage: string;
    sourceName: string;
    author?: string;
    license?: string;
    attribution?: string;
    exact: boolean;
    primary: boolean;
  }>;
}

export function adminPayloadFrom(item: AdminDiscoveryItem): AdminDiscoveryUpsert {
  const place = item.listing;
  return {
    externalId: place.externalId,
    name: place.name,
    itemType: place.itemType ?? 'PLACE',
    category: place.category,
    subcategory: place.subcategory,
    city: place.city,
    district: place.district,
    state: place.state,
    fullAddress: place.fullAddress,
    latitude: place.latitude,
    longitude: place.longitude,
    shortDescription: place.shortDescription ?? place.description,
    detailedDescription: place.detailedDescription,
    openingHours: place.openingHours,
    suggestedVisitMinutes: place.suggestedVisitMinutes,
    bestTimeToVisit: place.bestTimeToVisit,
    activityDuration: place.activityDuration,
    minimumAge: place.minimumAge,
    maximumAge: place.maximumAge,
    minimumWeight: place.minimumWeight,
    maximumWeight: place.maximumWeight,
    difficultyLevel: place.difficultyLevel,
    safetyInformation: place.safetyInformation,
    inclusions: place.inclusions,
    exclusions: place.exclusions,
    thingsToCarry: place.thingsToCarry,
    accessibilityInformation: place.accessibilityInformation,
    contactPhone: place.contactPhone,
    officialWebsite: place.officialWebsite,
    bookingUrl: place.bookingUrl,
    cancellationInformation: place.cancellationInformation,
    priceStatus: place.priceStatus ?? 'UNKNOWN',
    priceType: place.priceType ?? 'UNKNOWN',
    currency: place.currency ?? 'INR',
    basePrice: place.estimatedCostPerPerson,
    sourceName: place.sourceName ?? '',
    sourceUrl: place.sourceUrl ?? '',
    sourceLastCheckedAt: place.sourceLastCheckedAt,
    verificationExpiresAt: place.verificationExpiresAt,
    confidenceScore: place.confidenceScore,
    rating: place.rating,
    ratingCount: place.ratingCount,
    popularityScore: place.popularityScore,
    familyFriendly: place.familyFriendly,
    conflictStatus: item.conflictStatus,
    conflictNotes: item.conflictNotes,
    enabled: item.enabled,
    priceOptions: place.priceOptions ?? [],
    images: (place.imageGallery ?? []).map((image: DiscoveryImage) => ({
      imageUrl: image.url,
      sourcePage: image.sourcePage ?? '',
      sourceName: image.sourceName ?? '',
      author: image.author,
      license: image.license,
      attribution: image.attribution,
      exact: image.exact,
      primary: image.primary
    }))
  };
}
