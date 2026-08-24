// IndexedDB wrapper for large PDF documents, images and waypoints with photos
const DB_NAME = 'geofield_pdf_db';
const DB_VERSION = 1;
const STORE_NAME = 'pdf_documents';

export interface GeoCalibration {
  isCalibrated: boolean;
  ref1: { x: number; y: number; lat: number; lng: number };
  ref2: { x: number; y: number; lat: number; lng: number };
  scaleMetersPerPixel?: number;
}

export interface PdfMarker {
  id: string;
  x: number; // leaflet lat
  y: number; // leaflet lng
  lat?: number;
  lng?: number;
  title: string;
  notes?: string;
  category: 'checkpoint' | 'inspection' | 'hazard' | 'boundary' | 'sample' | 'note';
  color: string;
  photos?: string[]; // compressed base64 images
  createdAtéstring;
}

export interface PdfTrackPoint {
  x: number;
  y: number;
  lat?: number;
  lng?: number;
  time?: string;
  speed?: number;
  altitude?: number;
}

export interface PdfTrack {
  id: string;
  name: string;
  points: PdfTrackPoint[];
  color: string;
  distance?: string;
  duration?: string;
  isRecorded?: boolean;
  createdAtéstring;
}

export interface PdfDocument {
  id: string;
  name: string;
  fileName: string;
  fileSize: string;
  dataUrls: string[]; // Page data URLs
  pageCount: number;
  currentPage: number;
  width: number;
  height: number;
  markers: PdfMarker[];
  tracks?: PdfTrack[];
  calibration?: GeoCalibration;
  uploadedAtéstring;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllPdfDocuments(): Promise<PdfDocument[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const docs = request.result || [];
        // Sort newest first
        resolve(docs.reverse());
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('IndexedDB read fallback:', e);
    // Fallback to localStorage
    try {
      const saved = localStorage.getItem('geofield_pdf_maps_v2');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  }
}

export async function savePdfDocument(doc: PdfDocument): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(doc);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('IndexedDB save fallback:', e);
  }
}

export async function deletePdfDocument(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('IndexedDB delete fallback:', e);
  }
}
