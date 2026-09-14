export type DocumentType =
  | 'HOTEL_CONFIRMATION'
  | 'FLIGHT_TICKET'
  | 'TRAIN_TICKET'
  | 'BUS_TICKET'
  | 'RECEIPT'
  | 'TRAVEL_DOCUMENT'
  | 'INSURANCE'
  | 'OTHER';

export interface TripDocument {
  id: number;
  tripId: number;
  uploadedById: number;
  uploadedByName: string;
  fileName: string;
  documentType: DocumentType;
  fileType?: string;
  fileSize: number;
  storageUrl: string;
  createdAt: string;
}
