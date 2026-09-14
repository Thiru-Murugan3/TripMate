export type InvitationType = 'EMAIL' | 'MOBILE' | 'LINK';
export type InvitationStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED';
export type InvitationRole = 'EDITOR' | 'VIEWER';

export interface CreateInvitationRequest {
  email?: string;
  mobileNumber?: string;
  role: InvitationRole;
  type: InvitationType;
}

export interface TripInvitation {
  id: number;
  tripId: number;
  tripName: string;
  inviterId: number;
  inviterName: string;
  inviteeEmail?: string | null;
  inviteeMobile?: string | null;
  role: InvitationRole;
  status: InvitationStatus;
  type: InvitationType;
  inviteLink?: string | null;
  expiresAt: string;
  createdAt: string;
}
