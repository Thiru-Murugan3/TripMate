export type BookingType = 'HOTEL' | 'TRANSPORT' | 'ACTIVITY';
export type TransportType = 'CAR' | 'BIKE' | 'BUS' | 'TRAIN' | 'FLIGHT' | 'TAXI' | 'AUTO' | 'METRO' | 'RENTAL_CAR' | 'OTHER';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
export type BookingSource = 'EXTERNAL_MANUAL' | 'TRIPMATE_SANDBOX' | 'TRIPMATE_PROVIDER';
export type PaymentStatus = 'NOT_REQUIRED' | 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

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
  bookingSource?: BookingSource;
  paymentStatus?: PaymentStatus;
  currency?: string;
  travelerName?: string;
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


export interface BookingSearchRequest {
  bookingType: BookingType;
  transportType?: TransportType;
  origin?: string;
  destination: string;
  startDate: string;
  endDate?: string;
  travelers: number;
}

export interface BookingOffer {
  offerId: string;
  bookingType: BookingType;
  transportType?: TransportType;
  providerName: string;
  title: string;
  departure?: string;
  arrival?: string;
  startDatetime?: string;
  endDatetime?: string;
  amount: number;
  currency: string;
  refundable: boolean;
}

export interface BookingSearchResponse {
  providerMode: string;
  liveBookingEnabled: boolean;
  disclaimer: string;
  offers: BookingOffer[];
}

export interface BookNowRequest {
  offerId: string;
  travelerName: string;
  travelerEmail: string;
  travelerMobile?: string;
  paymentMethod: string;
}

export interface BookNowResponse {
  booking: Booking;
  providerMode: string;
  liveBookingEnabled: boolean;
  paymentStatus: PaymentStatus;
  message: string;
}
