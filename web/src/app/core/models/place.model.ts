export type PlaceCategory =
  | 'ATTRACTION'
  | 'RESTAURANT'
  | 'HOTEL'
  | 'ACTIVITY'
  | 'SHOPPING'
  | 'FUEL'
  | 'REST_STOP'
  | 'OTHER';

export interface Place {
  id: number;
  tripId: number;
  name: string;
  category: PlaceCategory;
  latitude?: number;
  longitude?: number;
  estimatedCost?: number;
  notes?: string;
}

export interface CreatePlaceRequest {
  name: string;
  category: PlaceCategory;
  latitude?: number;
  longitude?: number;
  estimatedCost?: number;
  notes?: string;
  /** Area to look the place up in when no coordinates are sent (e.g. "Goa"). */
  locationHint?: string;
}

/** On update, locationHint is only sent to repair a place saved without a real location. */
export interface UpdatePlaceRequest extends CreatePlaceRequest {}
