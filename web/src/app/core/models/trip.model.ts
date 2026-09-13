export type TripType = 'ADVENTURE' | 'FAMILY' | 'COUPLE' | 'FRIENDS' | 'SOLO';
export type TripStatus = 'PLANNING' | 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
export type TripRole = 'OWNER' | 'EDITOR' | 'VIEWER';
export type MemberStatus = 'PENDING' | 'ACTIVE' | 'DECLINED';

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
  userRole?: TripRole;
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
  role: TripRole;
  memberStatus: MemberStatus;
  joinedAt?: string;
}
