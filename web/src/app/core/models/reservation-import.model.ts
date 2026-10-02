import { BookingImportDraft } from './booking.model';

export type ReservationEmailImportStatus = 'NEEDS_REVIEW' | 'FAILED' | 'IMPORTED' | 'DISMISSED';

export interface ReservationImportAddress {
  forwardingAddress: string;
  receivingConfigured: boolean;
  setupMessage: string;
}

export interface ReservationEmailImport {
  id: number;
  senderAddress?: string;
  recipientAddress: string;
  subject?: string;
  attachmentCount: number;
  status: ReservationEmailImportStatus;
  errorMessage?: string;
  receivedAt: string;
  tripId?: number;
  bookingId?: number;
  draft?: BookingImportDraft;
}

export interface ReservationImportSelection {
  importId: number;
  draft: BookingImportDraft;
}
