export interface PDFDocumentEntity {
  id: string;
  name: string;
  size: number;
  type: string;
  createdAt: number;
  data: ArrayBuffer; // Stored in IndexedDB
}

export interface PDFMetadata {
  id: string;
  name: string;
  size: number;
  createdAt: number;
  previewUrl?: string;
}

export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  DOCUMENTS = 'DOCUMENTS',
  MERGE = 'MERGE',
  ROTATE = 'ROTATE',
  SPLIT = 'SPLIT',
  AI_ASSISTANT = 'AI_ASSISTANT',
  WEB_SEARCH = 'WEB_SEARCH',
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}