import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  DocumentType,
  TripDocument
} from '../../../core/models/document.model';
import { DocumentService } from '../../../core/services/document.service';

@Component({
  selector: 'app-document-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="documents-page">
      <div class="documents-toolbar">
        <div>
          <span class="eyebrow">DOCUMENTS</span>
          <h2>Trip Documents</h2>
          <p>Keep tickets, confirmations, receipts and travel documents together.</p>
        </div>

        <button
          *ngIf="canEdit"
          type="button"
          class="btn primary"
          (click)="openUploadModal()"
        >
          <span class="material-symbols-outlined">upload_file</span>
          Upload Document
        </button>
      </div>

      <div class="document-controls">
        <label class="search-box">
          <span class="material-symbols-outlined">search</span>
          <input
            [(ngModel)]="searchTerm"
            [ngModelOptions]="{ standalone: true }"
            placeholder="Search documents..."
            aria-label="Search documents"
          />
        </label>

        <select
          [(ngModel)]="typeFilter"
          [ngModelOptions]="{ standalone: true }"
          aria-label="Filter document type"
        >
          <option value="ALL">All Types</option>
          <option *ngFor="let type of documentTypes" [value]="type">
            {{ formatDocumentType(type) }}
          </option>
        </select>

        <button
          *ngIf="searchTerm || typeFilter !== 'ALL'"
          type="button"
          class="clear-filter"
          (click)="clearFilters()"
        >
          Clear
        </button>
      </div>

      <div *ngIf="isLoading" class="state-card">
        <div class="spinner"></div>
        <span>Loading documents...</span>
      </div>

      <div *ngIf="!isLoading && loadError" class="state-card error">
        <span class="material-symbols-outlined">error</span>
        <div>
          <strong>Unable to load documents</strong>
          <p>{{ loadError }}</p>
        </div>
        <button type="button" class="btn secondary" (click)="loadDocuments()">Retry</button>
      </div>

      <ng-container *ngIf="!isLoading && !loadError">
        <div class="document-summary">
          <article>
            <span>Documents</span>
            <strong>{{ documents.length }}</strong>
          </article>
          <article>
            <span>Showing</span>
            <strong>{{ filteredDocuments.length }}</strong>
          </article>
          <article>
            <span>Total Size</span>
            <strong>{{ formatFileSize(totalFileSize) }}</strong>
          </article>
        </div>

        <div *ngIf="documents.length === 0" class="empty-state">
          <span class="material-symbols-outlined">folder_open</span>
          <h3>No documents uploaded yet</h3>
          <p>Upload tickets, hotel confirmations, receipts or other trip files.</p>
          <button
            *ngIf="canEdit"
            type="button"
            class="btn primary"
            (click)="openUploadModal()"
          >
            Upload First Document
          </button>
        </div>

        <div
          *ngIf="documents.length > 0 && filteredDocuments.length === 0"
          class="empty-state"
        >
          <span class="material-symbols-outlined">search_off</span>
          <h3>No matching documents</h3>
          <p>Try another file name or document type.</p>
          <button type="button" class="btn secondary" (click)="clearFilters()">
            Reset Filters
          </button>
        </div>

        <div *ngIf="filteredDocuments.length > 0" class="documents-grid">
          <article *ngFor="let document of filteredDocuments" class="document-card">
            <div class="document-card-top">
              <div class="file-icon">
                <span class="material-symbols-outlined">{{ fileIcon(document) }}</span>
              </div>

              <div class="document-info">
                <h3 title="{{ document.fileName }}">{{ document.fileName }}</h3>
                <span class="type-pill">
                  {{ formatDocumentType(document.documentType) }}
                </span>
              </div>
            </div>

            <div class="document-meta">
              <span>
                <span class="material-symbols-outlined">description</span>
                {{ displayFileType(document) }} · {{ formatFileSize(document.fileSize) }}
              </span>
              <span>
                <span class="material-symbols-outlined">person</span>
                {{ document.uploadedByName }}
              </span>
              <span>
                <span class="material-symbols-outlined">schedule</span>
                {{ formatDateTime(document.createdAt) }}
              </span>
            </div>

            <div class="document-actions">
              <button
                type="button"
                class="view-btn"
                [disabled]="viewingDocumentId === document.id"
                (click)="viewDocument(document)"
              >
                <span class="material-symbols-outlined">visibility</span>
                {{ viewingDocumentId === document.id ? 'Opening...' : 'View' }}
              </button>

              <button
                *ngIf="canEdit"
                type="button"
                class="delete-btn"
                [disabled]="deletingDocumentId === document.id"
                (click)="deleteDocument(document)"
              >
                <span class="material-symbols-outlined">delete</span>
                {{ deletingDocumentId === document.id ? 'Deleting...' : 'Delete' }}
              </button>
            </div>
          </article>
        </div>
      </ng-container>

      <div *ngIf="showUploadModal" class="modal-backdrop">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3>Upload Document</h3>
              <p>Select a trip file and document type.</p>
            </div>
            <button
              type="button"
              class="close-btn"
              (click)="closeUploadModal()"
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <div *ngIf="uploadError" class="form-error">{{ uploadError }}</div>

          <label class="field">
            <span>Document Type *</span>
            <select
              [(ngModel)]="selectedDocumentType"
              [ngModelOptions]="{ standalone: true }"
            >
              <option *ngFor="let type of documentTypes" [value]="type">
                {{ formatDocumentType(type) }}
              </option>
            </select>
          </label>

          <label class="file-drop">
            <input
              #fileInput
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.txt"
              (change)="onFileSelected($event)"
            />
            <span class="material-symbols-outlined">cloud_upload</span>
            <strong>{{ selectedFile ? 'Change File' : 'Choose File' }}</strong>
            <small>PDF, JPG, PNG, DOC, DOCX or TXT · Maximum 10 MB</small>
          </label>

          <div *ngIf="selectedFile" class="selected-file">
            <div class="selected-file-icon">
              <span class="material-symbols-outlined">description</span>
            </div>
            <div>
              <strong>{{ selectedFile.name }}</strong>
              <span>{{ formatFileSize(selectedFile.size) }}</span>
            </div>
            <button
              type="button"
              title="Remove selected file"
              (click)="clearSelectedFile(fileInput)"
            >
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <div class="modal-actions">
            <button
              type="button"
              class="btn secondary"
              (click)="closeUploadModal()"
            >
              Cancel
            </button>
            <button
              type="button"
              class="btn primary"
              [disabled]="!selectedFile || isUploading"
              (click)="uploadDocument()"
            >
              <span class="material-symbols-outlined">upload</span>
              {{ isUploading ? 'Uploading...' : 'Upload' }}
            </button>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    :host { display:block; }
    .documents-page { color:#0f172a; }
    .documents-toolbar { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; margin-bottom:1rem; }
    .documents-toolbar h2 { margin:.15rem 0 .25rem; font-size:1.15rem; }
    .documents-toolbar p { margin:0; color:#64748b; font-size:.82rem; }
    .eyebrow { color:#2563eb; font-size:.66rem; font-weight:850; letter-spacing:.08em; }
    .btn { display:inline-flex; align-items:center; justify-content:center; gap:.35rem; padding:.62rem .9rem; border:0; border-radius:9px; font-weight:800; cursor:pointer; }
    .btn.primary { color:#fff; background:#2563eb; }
    .btn.secondary { color:#334155; background:#e2e8f0; }
    .btn:disabled { opacity:.55; cursor:not-allowed; }

    .document-controls { display:flex; align-items:center; gap:.65rem; margin-bottom:1rem; }
    .search-box { display:flex; align-items:center; gap:.45rem; flex:1; min-width:0; padding:.58rem .7rem; border:1px solid #cbd5e1; border-radius:10px; background:#fff; }
    .search-box .material-symbols-outlined { color:#94a3b8; font-size:1rem; }
    .search-box input { width:100%; min-width:0; border:0; outline:0; color:#0f172a; font:inherit; }
    .document-controls select { min-width:210px; padding:.62rem .7rem; border:1px solid #cbd5e1; border-radius:10px; color:#334155; background:#fff; }
    .clear-filter { border:0; color:#2563eb; background:transparent; font-weight:800; cursor:pointer; }

    .document-summary { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.75rem; margin-bottom:1rem; }
    .document-summary article { padding:.85rem 1rem; border:1px solid #e2e8f0; border-radius:12px; background:#fff; }
    .document-summary span { display:block; color:#64748b; font-size:.66rem; font-weight:850; text-transform:uppercase; }
    .document-summary strong { display:block; margin-top:.32rem; font-size:1.02rem; }

    .documents-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.85rem; }
    .document-card { padding:1rem; border:1px solid #e2e8f0; border-radius:14px; background:#fff; box-shadow:0 5px 18px rgba(15,23,42,.035); }
    .document-card-top { display:flex; align-items:flex-start; gap:.75rem; }
    .file-icon { display:grid; place-items:center; width:44px; height:44px; min-width:44px; border-radius:11px; color:#2563eb; background:#eff6ff; }
    .file-icon .material-symbols-outlined { font-size:1.35rem; }
    .document-info { min-width:0; }
    .document-info h3 { overflow:hidden; margin:0 0 .35rem; font-size:.88rem; text-overflow:ellipsis; white-space:nowrap; }
    .type-pill { display:inline-flex; padding:.2rem .43rem; border-radius:999px; color:#475569; background:#f1f5f9; font-size:.59rem; font-weight:850; }

    .document-meta { display:flex; flex-direction:column; gap:.42rem; margin-top:.85rem; padding-top:.75rem; border-top:1px solid #f1f5f9; }
    .document-meta > span { display:flex; align-items:center; gap:.3rem; color:#64748b; font-size:.68rem; }
    .document-meta .material-symbols-outlined { color:#94a3b8; font-size:.88rem; }
    .document-actions { display:flex; gap:.5rem; margin-top:.85rem; }
    .view-btn,.delete-btn { display:inline-flex; align-items:center; justify-content:center; gap:.3rem; flex:1; padding:.5rem .65rem; border:0; border-radius:8px; font-size:.68rem; font-weight:800; cursor:pointer; }
    .view-btn { color:#1d4ed8; background:#eff6ff; }
    .delete-btn { color:#b91c1c; background:#fef2f2; }
    .view-btn:disabled,.delete-btn:disabled { opacity:.5; cursor:not-allowed; }
    .view-btn .material-symbols-outlined,.delete-btn .material-symbols-outlined { font-size:.95rem; }

    .empty-state,.state-card { display:flex; align-items:center; justify-content:center; gap:.75rem; min-height:220px; padding:1rem; border:1px solid #e2e8f0; border-radius:14px; background:#fff; text-align:center; }
    .empty-state { flex-direction:column; }
    .empty-state > .material-symbols-outlined { color:#93c5fd; font-size:2.7rem; }
    .empty-state h3 { margin:0; }
    .empty-state p { margin:0 0 .4rem; color:#64748b; font-size:.78rem; }
    .state-card.error { color:#b91c1c; }
    .state-card.error p { margin:.15rem 0 0; color:#64748b; }
    .spinner { width:28px; height:28px; border:3px solid #dbeafe; border-top-color:#2563eb; border-radius:50%; animation:spin .75s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }

    .modal-backdrop { position:fixed; inset:0; z-index:3000; display:flex; align-items:center; justify-content:center; padding:1rem; background:rgba(15,23,42,.62); backdrop-filter:blur(5px); }
    .modal { width:min(100%,560px); max-height:92vh; overflow:auto; padding:1.35rem; border-radius:16px; background:#fff; box-shadow:0 22px 50px rgba(15,23,42,.22); }
    .modal-header { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; margin-bottom:1rem; }
    .modal-header h3 { margin:0; }
    .modal-header p { margin:.2rem 0 0; color:#64748b; font-size:.78rem; }
    .close-btn { border:0; color:#64748b; background:transparent; font-size:1.7rem; cursor:pointer; }
    .form-error { margin-bottom:.8rem; padding:.7rem .8rem; border-radius:8px; color:#b91c1c; background:#fee2e2; font-size:.78rem; }
    .field { display:flex; flex-direction:column; gap:.3rem; margin-bottom:.85rem; color:#334155; font-size:.75rem; font-weight:750; }
    .field select { width:100%; box-sizing:border-box; padding:.65rem .72rem; border:1px solid #cbd5e1; border-radius:8px; color:#0f172a; background:#fff; font:inherit; font-weight:500; }

    .file-drop { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:150px; padding:1rem; border:1.5px dashed #93c5fd; border-radius:12px; color:#475569; background:#f8fbff; text-align:center; cursor:pointer; }
    .file-drop input { display:none; }
    .file-drop > .material-symbols-outlined { color:#2563eb; font-size:2rem; }
    .file-drop strong { margin-top:.3rem; color:#1d4ed8; font-size:.78rem; }
    .file-drop small { margin-top:.25rem; color:#94a3b8; font-size:.65rem; }

    .selected-file { display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:.65rem; margin-top:.75rem; padding:.7rem .8rem; border-radius:10px; background:#f8fafc; }
    .selected-file-icon { display:grid; place-items:center; width:34px; height:34px; border-radius:8px; color:#2563eb; background:#dbeafe; }
    .selected-file > div:nth-child(2) { display:flex; min-width:0; flex-direction:column; }
    .selected-file strong { overflow:hidden; font-size:.72rem; text-overflow:ellipsis; white-space:nowrap; }
    .selected-file span { color:#64748b; font-size:.64rem; }
    .selected-file button { border:0; color:#64748b; background:transparent; cursor:pointer; }
    .selected-file button .material-symbols-outlined { font-size:1rem; }

    .modal-actions { display:flex; justify-content:flex-end; gap:.6rem; margin-top:1rem; }

    @media(max-width:720px) {
      .documents-toolbar { align-items:stretch; flex-direction:column; }
      .documents-toolbar .btn { width:100%; }
      .document-controls { align-items:stretch; flex-direction:column; }
      .document-controls select { width:100%; min-width:0; }
      .document-summary { grid-template-columns:1fr; }
      .documents-grid { grid-template-columns:1fr; }
    }
  `]
})
export class DocumentManagerComponent implements OnInit, OnChanges {
  private readonly documentService = inject(DocumentService);

  @Input({ required: true }) tripId = 0;
  @Input() canEdit = false;
  @Input() openRequest = 0;
  @Output() documentsChanged = new EventEmitter<void>();

  documents: TripDocument[] = [];
  searchTerm = '';
  typeFilter: 'ALL' | DocumentType = 'ALL';

  isLoading = true;
  loadError = '';
  showUploadModal = false;
  selectedFile: File | null = null;
  selectedDocumentType: DocumentType = 'OTHER';
  uploadError = '';
  isUploading = false;
  deletingDocumentId: number | null = null;
  viewingDocumentId: number | null = null;

  readonly documentTypes: DocumentType[] = [
    'HOTEL_CONFIRMATION',
    'FLIGHT_TICKET',
    'TRAIN_TICKET',
    'BUS_TICKET',
    'RECEIPT',
    'TRAVEL_DOCUMENT',
    'INSURANCE',
    'OTHER'
  ];

  readonly allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'txt'];
  readonly maxFileSize = 10 * 1024 * 1024;

  ngOnInit(): void {
    this.loadDocuments();
    if (this.openRequest > 0 && this.canEdit) {
      queueMicrotask(() => this.openUploadModal());
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tripId'] && !changes['tripId'].firstChange && this.tripId > 0) {
      this.loadDocuments();
    }

    if (
      changes['openRequest'] &&
      !changes['openRequest'].firstChange &&
      this.openRequest > 0 &&
      this.canEdit
    ) {
      this.openUploadModal();
    }
  }

  get filteredDocuments(): TripDocument[] {
    const query = this.searchTerm.trim().toLowerCase();

    return this.documents.filter((document) => {
      const typeMatch =
        this.typeFilter === 'ALL' || document.documentType === this.typeFilter;
      const searchMatch =
        !query ||
        document.fileName.toLowerCase().includes(query) ||
        document.uploadedByName.toLowerCase().includes(query) ||
        this.formatDocumentType(document.documentType).toLowerCase().includes(query);

      return typeMatch && searchMatch;
    });
  }

  get totalFileSize(): number {
    return this.documents.reduce(
      (total, document) => total + Number(document.fileSize || 0),
      0
    );
  }

  loadDocuments(): void {
    if (!this.tripId) return;

    this.isLoading = true;
    this.loadError = '';

    this.documentService.getDocuments(this.tripId).subscribe({
      next: (documents) => {
        this.documents = documents ?? [];
        this.isLoading = false;
      },
      error: (err) => {
        this.documents = [];
        this.loadError = err?.error?.message || 'Please try again.';
        this.isLoading = false;
      }
    });
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.typeFilter = 'ALL';
  }

  openUploadModal(): void {
    if (!this.canEdit) return;

    this.selectedFile = null;
    this.selectedDocumentType = 'OTHER';
    this.uploadError = '';
    this.showUploadModal = true;
  }

  closeUploadModal(): void {
    if (this.isUploading) return;

    this.showUploadModal = false;
    this.selectedFile = null;
    this.uploadError = '';
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.uploadError = '';

    if (!file) {
      this.selectedFile = null;
      return;
    }

    const extension = this.fileExtension(file.name);
    if (!this.allowedExtensions.includes(extension)) {
      this.selectedFile = null;
      input.value = '';
      this.uploadError = 'File type not allowed. Use PDF, JPG, PNG, DOC, DOCX or TXT.';
      return;
    }

    if (file.size > this.maxFileSize) {
      this.selectedFile = null;
      input.value = '';
      this.uploadError = 'File is larger than the 10 MB maximum.';
      return;
    }

    this.selectedFile = file;
  }

  clearSelectedFile(input: HTMLInputElement): void {
    this.selectedFile = null;
    this.uploadError = '';
    input.value = '';
  }

  uploadDocument(): void {
    if (!this.canEdit || !this.selectedFile || this.isUploading) return;

    this.isUploading = true;
    this.uploadError = '';

    this.documentService.uploadDocument(
      this.tripId,
      this.selectedFile,
      this.selectedDocumentType
    ).subscribe({
      next: () => {
        this.isUploading = false;
        this.showUploadModal = false;
        this.selectedFile = null;
        this.reloadAfterChange();
      },
      error: (err) => {
        this.isUploading = false;
        this.uploadError = err?.error?.message || 'Unable to upload document.';
      }
    });
  }

  viewDocument(document: TripDocument): void {
    if (this.viewingDocumentId !== null) return;

    const previewWindow = window.open('', '_blank');
    this.viewingDocumentId = document.id;
    this.loadError = '';

    this.documentService.getDocumentContent(this.tripId, document.id).subscribe({
      next: (blob) => {
        this.viewingDocumentId = null;
        const objectUrl = URL.createObjectURL(blob);

        if (previewWindow) {
          previewWindow.opener = null;
          previewWindow.location.href = objectUrl;
        } else {
          const link = window.document.createElement('a');
          link.href = objectUrl;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.click();
        }

        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      },
      error: (err) => {
        this.viewingDocumentId = null;
        if (previewWindow) previewWindow.close();
        this.loadError = err?.error?.message || 'Unable to open document.';
      }
    });
  }

  deleteDocument(document: TripDocument): void {
    if (!this.canEdit || this.deletingDocumentId !== null) return;

    if (!window.confirm(`Delete "${document.fileName}"?`)) {
      return;
    }

    this.deletingDocumentId = document.id;
    this.documentService.deleteDocument(this.tripId, document.id).subscribe({
      next: () => {
        this.deletingDocumentId = null;
        this.reloadAfterChange();
      },
      error: (err) => {
        this.deletingDocumentId = null;
        this.loadError = err?.error?.message || 'Unable to delete document.';
      }
    });
  }

  formatDocumentType(type: DocumentType): string {
    return type
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  displayFileType(document: TripDocument): string {
    const extension = this.fileExtension(document.fileName);
    if (extension) return extension.toUpperCase();
    if (document.fileType) return document.fileType;
    return 'FILE';
  }

  fileIcon(document: TripDocument): string {
    const extension = this.fileExtension(document.fileName);
    if (extension === 'pdf') return 'picture_as_pdf';
    if (['jpg', 'jpeg', 'png'].includes(extension)) return 'image';
    if (['doc', 'docx'].includes(extension)) return 'article';
    if (extension === 'txt') return 'text_snippet';
    return 'description';
  }

  formatFileSize(bytes: number): string {
    const size = Number(bytes || 0);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  formatDateTime(value: string): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private fileExtension(name: string): string {
    const parts = name.toLowerCase().split('.');
    return parts.length > 1 ? parts.pop() || '' : '';
  }

  private reloadAfterChange(): void {
    this.documentService.getDocuments(this.tripId).subscribe({
      next: (documents) => {
        this.documents = documents ?? [];
        this.documentsChanged.emit();
      },
      error: () => {
        this.loadDocuments();
        this.documentsChanged.emit();
      }
    });
  }
}
