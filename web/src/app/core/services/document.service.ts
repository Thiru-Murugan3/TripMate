import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { DocumentType, TripDocument } from '../models/document.model';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private readonly baseUrl = `${environment.apiUrl}/trips`;

  constructor(private http: HttpClient) {}

  getDocuments(tripId: number): Observable<TripDocument[]> {
    return this.http.get<TripDocument[]>(
      `${this.baseUrl}/${tripId}/documents`
    );
  }

  getDocumentById(
    tripId: number,
    documentId: number
  ): Observable<TripDocument> {
    return this.http.get<TripDocument>(
      `${this.baseUrl}/${tripId}/documents/${documentId}`
    );
  }

  uploadDocument(
    tripId: number,
    file: File,
    documentType: DocumentType
  ): Observable<TripDocument> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);

    return this.http.post<TripDocument>(
      `${this.baseUrl}/${tripId}/documents`,
      formData
    );
  }

  getDocumentContent(
    tripId: number,
    documentId: number
  ): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/${tripId}/documents/${documentId}/content`,
      { responseType: 'blob' }
    );
  }

  deleteDocument(
    tripId: number,
    documentId: number
  ): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.baseUrl}/${tripId}/documents/${documentId}`
    );
  }
}
