export type BookingType = 'HOTEL' | 'TRANSPORT' | 'ACTIVITY';
export type TransportType = 'FLIGHT' | 'TRAIN' | 'BUS' | 'CAB' | 'OTHER';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export interface Booking {
  id: number;
  tripId: number;
  bookingType: BookingType;
  transportType?: TransportType;
  providerName: string;
  bookingReference?: string;
  departure?: string;
  arrival?: string;
  startDatetime?: string;
  endDatetime?: string;
  amount: number;
  status: BookingStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateBookingRequest {
  bookingType: BookingType;
  transportType?: TransportType;
  providerName: string;
  bookingReference?: string;
  departure?: string;
  arrival?: string;
  startDatetime?: string;
  endDatetime?: string;
  amount: number;
  status: BookingStatus;
  notes?: string;
}

export interface UpdateBookingRequest {
  bookingType: BookingType;
  transportType?: TransportType;
  providerName: string;
  bookingReference?: string;
  departure?: string;
  arrival?: string;
  startDatetime?: string;
  endDatetime?: string;
  amount: number;
  status?: BookingStatus;
  notes?: string;
}
