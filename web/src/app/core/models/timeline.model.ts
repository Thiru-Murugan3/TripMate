export type TimelineItemType =
  | 'TRANSPORT_DEPARTURE'
  | 'TRANSPORT_ARRIVAL'
  | 'HOTEL_CHECKIN'
  | 'HOTEL_CHECKOUT'
  | 'ACTIVITY'
  | 'MEAL'
  | 'OTHER';

export interface TimelineItem {
  id: string;
  sourceType: 'BOOKING' | 'ITINERARY_ITEM';
  sourceId: number;
  tripadvisorLocationId?: string;
  itemType: TimelineItemType;
  category: string;
  title: string;
  subtitle?: string;
  startDatetime?: string;
  endDatetime?: string;
  timeFormatted?: string;
  endTimeFormatted?: string;
  location?: string;
  departure?: string;
  arrival?: string;
  provider?: string;
  bookingReference?: string;
  status?: string;
  amount?: number;
  currency?: string;
  notes?: string;
  icon: string;
  badgeColor: string;
  flexible?: boolean;
  conflict: boolean;
  warning?: string;
}

export interface TimelineDay {
  dayNumber: number;
  date: string;
  formattedDate: string;
  title: string;
  notes?: string;
  hasConflict: boolean;
  items: TimelineItem[];
}

export interface TripTimeline {
  tripId: number;
  tripName: string;
  destination: string;
  startDate: string;
  endDate: string;
  totalEvents: number;
  transportCount: number;
  stayCount: number;
  activityCount: number;
  mealCount: number;
  conflictCount: number;
  days: TimelineDay[];
}
