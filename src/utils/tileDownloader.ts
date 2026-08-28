/**
 * Real Offline Map Tile Downloader and Local Cache Manager (IndexedDB / Cache API)
 */

const TILE_DB_NAME = 'geofield_offline_tiles_db';
const TILE_DB_VERSION = 1;
const TILE_STORE_NAME = 'map_tiles';

function openTileDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(TILE_DB_NAME, TILE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TILE_STORE_NAME)) {
        db.createObjectStore(TILE_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Converts Geodetic Lat/Lng to Slippy Map Tile Coordinates (X, Y, Z)
 */
export function latLngToTileXY(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const latRad = (lat * Math.PI) / 180;
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

/**
 * Calculates all tile X/Y coordinates covering a bounding box at a given zoom level
 */
export function getTileGridForBounds(
  north: number,
  south: number,
  east: number,
  west: number,
  zoom: number
): Array<{ z: number; x: number; y: number }> {
  const topLeft = latLngToTileXY(north, west, zoom);
  const bottomRight = latLngToTileXY(south, east, zoom);

  const minX = Math.min(topLeft.x, bottomRight.x);
  const maxX = Math.max(topLeft.x, bottomRight.x);
  const minY = Math.min(topLeft.y, bottomRight.y);
  const maxY = Math.max(topLeft.y, bottomRight.y);

  const tiles: Array<{ z: number; x: number; y: number }> = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      tiles.push({ z: zoom, x, y });
    }
  }
  return tiles;
}

/**
 * Downloads a raster map tile and stores its Blob in IndexedDB
 */
export async function downloadAndCacheTile(
  url: string,
  key: string,
  db: IDBDatabase
): Promise<boolean> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return false;
    const blob = await response.blob();

    return new Promise((resolve) => {
      const tx = db.transaction(TILE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(TILE_STORE_NAME);
      const req = store.put(blob, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch (err) {
    return false;
  }
}

/**
 * Retrieves a cached tile Blob from IndexedDB by its key (e.g. "osm_15_1234_5678")
 */
export async function getCachedTileBlob(key: string): Promise<Blob | null> {
  try {
    const db = await openTileDB();
    return new Promise((resolve) => {
      const tx = db.transaction(TILE_STORE_NAME, 'readonly');
      const store = tx.objectStore(TILE_STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Downloads a full geographic bounding box for offline use with progress callback
 */
export async function downloadOfflineMapPack(
  centerLat: number,
  centerLng: number,
  radiusKm: number,
  minZoom: number = 14,
  maxZoom: number = 16,
  tileUrlTemplate: string = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  tilePrefix: string = 'osm',
  onProgress?: (percent: number, downloadedCount: number, totalCount: number) => void
): Promise<{ success: boolean; totalTiles: number; sizeBytesApprox: number }> {
  try {
    const db = await openTileDB();

    // Approximate bounding box degrees from radiusKm
    const latDelta = radiusKm / 111.0;
    const lngDelta = radiusKm / (111.0 * Math.cos((centerLat * Math.PI) / 180));

    const north = centerLat + latDelta;
    const south = centerLat - latDelta;
    const east = centerLng + lngDelta;
    const west = centerLng - lngDelta;

    const allTiles: Array<{ z: number; x: number; y: number }> = [];
    for (let z = minZoom; z <= maxZoom; z++) {
      const tilesForZoom = getTileGridForBounds(north, south, east, west, z);
      allTiles.push(...tilesForZoom);
    }

    const totalCount = allTiles.length;
    let downloadedCount = 0;

    // Concurrency pool (up to 4 parallel downloads to respect server limits)
    const BATCH_SIZE = 4;
    for (let i = 0; i < allTiles.length; i += BATCH_SIZE) {
      const batch = allTiles.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (tile) => {
          const url = tileUrlTemplate
            .replace('{z}', String(tile.z))
            .replace('{x}', String(tile.x))
            .replace('{y}', String(tile.y));
          const key = `${tilePrefix}_${tile.z}_${tile.x}_${tile.y}`;
          await downloadAndCacheTile(url, key, db);
          downloadedCount++;
        })
      );

      if (onProgress) {
        const percent = Math.min(100, Math.round((downloadedCount / totalCount) * 100));
        onProgress(percent, downloadedCount, totalCount);
      }
    }

    return {
      success: true,
      totalTiles: downloadedCount,
      sizeBytesApprox: downloadedCount * 25000, // ~25 KB average tile size
    };
  } catch (err) {
    console.error('[TileDownloader] Error downloading offline tiles:', err);
    return { success: false, totalTiles: 0, sizeBytesApprox: 0 };
  }
}
