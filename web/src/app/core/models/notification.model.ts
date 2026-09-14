export type NotificationType =
  | 'TRIP_REMINDER'
  | 'MEMBER_ADDED'
  | 'MEMBER_REMOVED'
  | 'EXPENSE_ADDED'
  | 'ITINERARY_UPDATED'
  | 'BOOKING_REMINDER'
  | 'DOCUMENT_ADDED'
  | 'GENERAL';

export interface TripNotification {
  id: number;
  tripId: number | null;
  recipientId: number;
  title: string;
  message: string | null;
  type: NotificationType;
  read: boolean;
  createdAt: string;
}

export interface UnreadNotificationCount {
  count: number;
}
