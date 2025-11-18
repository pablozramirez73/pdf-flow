import { PDFDocumentEntity, PDFMetadata } from '../types';

const DB_NAME = 'PDFFlowDB';
const STORE_NAME = 'documents';
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const dbService = {
  async saveDocument(file: File): Promise<PDFMetadata> {
    const db = await openDB();
    const arrayBuffer = await file.arrayBuffer();
    
    const doc: PDFDocumentEntity = {
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type: file.type,
      createdAt: Date.now(),
      data: arrayBuffer,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(doc);

      request.onsuccess = () => {
        const { data, ...metadata } = doc;
        resolve(metadata);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async getAllMetadata(): Promise<PDFMetadata[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const docs = request.result as PDFDocumentEntity[];
        // Return only metadata, exclude heavy data buffer to keep UI light
        const metadata = docs.map(({ data, ...meta }) => meta)
                             .sort((a, b) => b.createdAt - a.createdAt);
        resolve(metadata);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async getDocument(id: string): Promise<PDFDocumentEntity | undefined> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async deleteDocument(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
};