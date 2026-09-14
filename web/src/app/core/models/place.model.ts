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
