export interface ItineraryItem {
  id: number;
  dayId: number;
  tripId: number;
  placeId?: number;
  placeName?: string;
  title: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  estimatedCost?: number;
  displayOrder?: number;
}

export interface ItineraryDay {
  id: number;
  tripId: number;
  dayNumber: number;
  dayDate?: string;
  title?: string;
  notes?: string;
  items: ItineraryItem[];
}

export interface TripItinerary {
  tripId: number;
  totalDays: number;
  totalActivities: number;
  totalEstimatedCost: number;
  days: ItineraryDay[];
}

export interface CreateItineraryDayRequest {
  dayNumber: number;
  dayDate: string;
  title?: string;
  notes?: string;
}

export interface UpdateItineraryDayRequest extends CreateItineraryDayRequest {}

export interface CreateItineraryItemRequest {
  placeId?: number;
  title: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  estimatedCost?: number;
  displayOrder?: number;
}

export interface UpdateItineraryItemRequest extends CreateItineraryItemRequest {}

export interface ReorderItineraryRequest {
  items: Array<{
    itemId: number;
    displayOrder: number;
  }>;
}
