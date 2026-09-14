export type TripType = 'ADVENTURE' | 'FAMILY' | 'COUPLE' | 'FRIENDS' | 'SOLO';
export type TripStatus = 'PLANNED' | 'UPCOMING' | 'CONFIRMED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
export type TripRole = 'OWNER' | 'EDITOR' | 'VIEWER';
export type MemberStatus = 'ACTIVE' | 'REMOVED';

export interface Trip {
  id: number;
  name: string;
  destination: string;
  tripType: TripType;
  startDate: string;
  endDate: string;
  travelerCount: number;
  budget: number;
  description?: string;
  coverImageUrl?: string;
  status: TripStatus;
  ownerId: number;
  ownerName: string;
  userRole: TripRole;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTripRequest {
  name: string;
  destination: string;
  tripType: TripType;
  startDate: string;
  endDate: string;
  travelerCount: number;
  budget: number;
  description?: string;
  coverImageUrl?: string;
}

export interface UpdateTripRequest {
  name: string;
  destination: string;
  tripType: TripType;
  startDate: string;
  endDate: string;
  travelerCount: number;
  budget: number;
  description?: string;
  coverImageUrl?: string;
  status?: TripStatus;
}

export interface TripMember {
  id: number;
  tripId: number;
  userId: number;
  userName: string;
  userEmail: string;
  userMobile?: string;
  role: TripRole;
  memberStatus: MemberStatus;
  joinedAt?: string;
}


export interface TripDashboardActivity {
  activity: string;
  date: string;
  time?: string;
}

export interface TripDashboardBooking {
  bookingType: 'HOTEL' | 'TRANSPORT' | 'ACTIVITY';
  providerName: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
}

export interface TripDashboard {
  tripId: number;
  tripName: string;
  destination: string;
  startDate: string;
  endDate: string;
  tripType: TripType;
  travelerCount: number;
  budget: number;
  totalExpenses: number;
  remainingBudget: number;
  budgetUtilizationPercentage: number;
  upcomingActivities: TripDashboardActivity[];
  bookings: TripDashboardBooking[];
  documentCount: number;
  memberCount: number;
}
