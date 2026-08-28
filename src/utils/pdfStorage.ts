import { getUserItem, setUserItem } from './userStorage';

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
  category: 'woodpile' | 'fire' | 'checkpoint' | 'inspection' | 'hazard' | 'boundary' | 'sample' | 'note';
  color: string;
  photos?: string[]; // compressed base64 images
  woodpileData?: {
    woodType?: string;
    lengthMeters?: number;
    heightMeters?: number;
    widthMeters?: number;
    stackFactor?: number;
    estimatedStereoM3?: number;
    estimatedSolidM3?: number;
    status?: 'empilhada' | 'medida' | 'carregada' | 'transportada';
  };
  createdAt: string;
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
  createdAt: string;
}

export interface PdfDocument {
  id: string;
  userId?: string;
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
  uploadedAt: string;
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

function sanitizeDocument(doc: any, fallbackUserId?: string): PdfDocument {
  if (!doc) throw new Error('Document is empty');
  return {
    id: doc.id || `doc-${Date.now()}`,
    userId: doc.userId || fallbackUserId || undefined,
    name: doc.name || 'Mapa sem Título',
    fileName: doc.fileName || 'documento.pdf',
    fileSize: doc.fileSize || '1 MB',
    dataUrls: Array.isArray(doc.dataUrls) ? doc.dataUrls : (doc.dataUrl ? [doc.dataUrl] : []),
    pageCount: typeof doc.pageCount === 'number' && doc.pageCount > 0 ? doc.pageCount : 1,
    currentPage: typeof doc.currentPage === 'number' ? Math.max(0, doc.currentPage) : 0,
    width: typeof doc.width === 'number' && doc.width > 0 ? doc.width : 1600,
    height: typeof doc.height === 'number' && doc.height > 0 ? doc.height : 1200,
    markers: Array.isArray(doc.markers) ? doc.markers.map((m: any) => ({
      id: m.id || `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      x: typeof m.x === 'number' && !isNaN(m.x) ? m.x : 0,
      y: typeof m.y === 'number' && !isNaN(m.y) ? m.y : 0,
      lat: typeof m.lat === 'number' && !isNaN(m.lat) ? m.lat : undefined,
      lng: typeof m.lng === 'number' && !isNaN(m.lng) ? m.lng : undefined,
      title: m.title || 'Ponto',
      notes: m.notes || '',
      category: m.category || 'checkpoint',
      color: m.color || '#0284c7',
      photos: Array.isArray(m.photos) ? m.photos : [],
      woodpileData: m.woodpileData ? {
        woodType: m.woodpileData.woodType || 'Eucalipto',
        lengthMeters: typeof m.woodpileData.lengthMeters === 'number' ? m.woodpileData.lengthMeters : Number(m.woodpileData.lengthMeters) || 0,
        heightMeters: typeof m.woodpileData.heightMeters === 'number' ? m.woodpileData.heightMeters : Number(m.woodpileData.heightMeters) || 0,
        widthMeters: typeof m.woodpileData.widthMeters === 'number' ? m.woodpileData.widthMeters : Number(m.woodpileData.widthMeters) || 1.0,
        stackFactor: typeof m.woodpileData.stackFactor === 'number' ? m.woodpileData.stackFactor : Number(m.woodpileData.stackFactor) || 0.67,
        estimatedStereoM3: typeof m.woodpileData.estimatedStereoM3 === 'number' ? m.woodpileData.estimatedStereoM3 : Number(m.woodpileData.estimatedStereoM3) || 0,
        estimatedSolidM3: typeof m.woodpileData.estimatedSolidM3 === 'number' ? m.woodpileData.estimatedSolidM3 : Number(m.woodpileData.estimatedSolidM3) || 0,
        status: m.woodpileData.status || 'empilhada',
      } : undefined,
      createdAt: m.createdAt || new Date().toLocaleTimeString('pt-BR'),
    })) : [],
    tracks: Array.isArray(doc.tracks) ? doc.tracks.map((t: any) => ({
      id: t.id || `trk-${Date.now()}`,
      name: t.name || 'Rota',
      points: Array.isArray(t.points) ? t.points.filter((p: any) => p && typeof p.x === 'number' && typeof p.y === 'number' && !isNaN(p.x) && !isNaN(p.y)) : [],
      color: t.color || '#0284c7',
      distance: t.distance,
      duration: t.duration,
      isRecorded: !!t.isRecorded,
      createdAt: t.createdAt || new Date().toLocaleTimeString('pt-BR'),
    })) : [],
    calibration: doc.calibration && typeof doc.calibration.isCalibrated === 'boolean' ? doc.calibration : {
      isCalibrated: false,
      ref1: { x: (doc.height || 1200) * 0.9, y: (doc.width || 1600) * 0.1, lat: -23.5420, lng: -46.6380 },
      ref2: { x: (doc.height || 1200) * 0.1, y: (doc.width || 1600) * 0.9, lat: -23.5540, lng: -46.6220 },
      scaleMetersPerPixel: 1,
    },
    uploadedAt: doc.uploadedAt || new Date().toLocaleDateString('pt-BR'),
  };
}

export async function getAllPdfDocuments(userId?: string): Promise<PdfDocument[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const rawDocs: any[] = request.result || [];
        const sanitized = rawDocs
          .map((d) => sanitizeDocument(d, userId))
          .filter((d) => !userId || d.userId === userId);
        resolve(sanitized.reverse());
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('IndexedDB read fallback:', e);
    // Fallback to user-scoped localStorage
    try {
      const saved = getUserItem<any[]>(userId, 'pdf_maps', []);
      if (Array.isArray(saved)) {
        return saved.map((d) => sanitizeDocument(d, userId)).filter((d) => !userId || d.userId === userId);
      }
    } catch {
      // ignore
    }
    return [];
  }
}

export async function savePdfDocument(doc: PdfDocument, userId?: string): Promise<void> {
  const sanitized = sanitizeDocument({
    ...doc,
    userId: doc.userId || userId,
  }, userId);

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(sanitized);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('IndexedDB save fallback:', e);
    try {
      const existing = await getAllPdfDocuments(userId);
      const next = [sanitized, ...existing.filter((d) => d.id !== sanitized.id)];
      setUserItem(userId, 'pdf_maps', next);
    } catch {
      // ignore
    }
  }
}

export async function deletePdfDocument(id: string, userId?: string): Promise<void> {
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
    try {
      const existing = await getAllPdfDocuments(userId);
      const next = existing.filter((d) => d.id !== id);
      setUserItem(userId, 'pdf_maps', next);
    } catch {
      // ignore
    }
  }
}

export async function clearUserPdfDocuments(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const doc = cursor.value;
          if (doc && doc.userId === userId) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('Failed to clear user PDF documents', e);
  }
}
