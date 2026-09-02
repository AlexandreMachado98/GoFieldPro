import { GeoCalibration } from './pdfStorage';
import { create2PointCalibration } from './geoTransform';

/**
 * GeoPDF Parser for GoField Pro
 * Extracts ISO 32000 / OGC Geospatial PDF dictionary metadata
 * (e.g. from QGIS, ArcGIS, Global Mapper, AutoCAD Map 3D)
 */

export interface GeoPdfMetadata {
  isGeoPdf: boolean;
  gpts?: Array<{ lat: number; lng: number }>;
  lpts?: Array<{ x: number; y: number }>;
  datum?: string;
  projection?: string;
  calibration?: GeoCalibration;
}

/**
 * Scans a PDF ArrayBuffer for embedded geospatial dictionaries
 */
export async function parseGeoPdfMetadata(
  pdfBuffer: ArrayBuffer,
  pageWidth: number,
  pageHeight: number
): Promise<GeoPdfMetadata | null> {
  try {
    const bytes = new Uint8Array(pdfBuffer);
    
    // Convert buffer to binary string in chunks to keep memory low
    let text = '';
    const chunkSize = 65536;
    const maxSearchBytes = Math.min(bytes.length, 1024 * 1024 * 3); // search up to first 3MB
    for (let i = 0; i < maxSearchBytes; i += chunkSize) {
      const slice = bytes.subarray(i, Math.min(i + chunkSize, maxSearchBytes));
      text += String.fromCharCode.apply(null, Array.from(slice));
    }

    // Check for OGC / ISO GeoPDF signature
    const hasGeo = text.includes('/Measure') || text.includes('/LGIDict') || text.includes('/GPTS') || text.includes('/GEOGCS');
    if (!hasGeo) {
      return null;
    }

    // 1. Extract GPTS (Ground Points: [lat1 lng1 lat2 lng2 lat3 lng3 lat4 lng4])
    const gptsMatch = text.match(/\/GPTS\s*\[([^\]]+)\]/i);
    // 2. Extract LPTS (Line/Page Points: [x1 y1 x2 y2 x3 y3 x4 y4] normalized 0..1 or PDF points)
    const lptsMatch = text.match(/\/LPTS\s*\[([^\]]+)\]/i);

    if (gptsMatch && gptsMatch[1]) {
      const gptsNumbers = gptsMatch[1]
        .trim()
        .split(/\s+/)
        .map(Number)
        .filter((n) => !isNaN(n));

      let lptsNumbers: number[] = [];
      if (lptsMatch && lptsMatch[1]) {
        lptsNumbers = lptsMatch[1]
          .trim()
          .split(/\s+/)
          .map(Number)
          .filter((n) => !isNaN(n));
      }

      // We need at least 2 pairs of coordinates (4 numbers in GPTS)
      if (gptsNumbers.length >= 4) {
        const groundPoints: Array<{ lat: number; lng: number }> = [];
        for (let i = 0; i < gptsNumbers.length - 1; i += 2) {
          // In standard GeoPDF, GPTS is ordered [lat, lng]
          groundPoints.push({
            lat: gptsNumbers[i],
            lng: gptsNumbers[i + 1],
          });
        }

        // Compute sheet pixel coordinates
        const sheetPoints: Array<{ x: number; y: number }> = [];
        if (lptsNumbers.length >= groundPoints.length * 2) {
          for (let i = 0; i < lptsNumbers.length - 1; i += 2) {
            const rawX = lptsNumbers[i];
            const rawY = lptsNumbers[i + 1];

            // If coordinates are normalized 0..1
            const isNormalized = rawX <= 1.05 && rawY <= 1.05 && rawX >= 0 && rawY >= 0;
            const px = isNormalized ? rawY * pageHeight : rawY;
            const py = isNormalized ? rawX * pageWidth : rawX;
            sheetPoints.push({ x: px, y: py });
          }
        } else {
          // Default corner layout if LPTS omitted
          sheetPoints.push({ x: pageHeight * 0.9, y: pageWidth * 0.1 });
          sheetPoints.push({ x: pageHeight * 0.1, y: pageWidth * 0.9 });
        }

        if (groundPoints.length >= 2 && sheetPoints.length >= 2) {
          const pt1 = {
            x: sheetPoints[0].x,
            y: sheetPoints[0].y,
            lat: groundPoints[0].lat,
            lng: groundPoints[0].lng,
          };
          const pt2 = {
            x: sheetPoints[1].x,
            y: sheetPoints[1].y,
            lat: groundPoints[1].lat,
            lng: groundPoints[1].lng,
          };

          const cal = create2PointCalibration(pt1, pt2);
          cal.method = 'geopdf';
          cal.datum = text.includes('SIRGAS') ? 'SIRGAS 2000' : 'WGS84';

          return {
            isGeoPdf: true,
            gpts: groundPoints,
            lpts: sheetPoints,
            datum: cal.datum,
            calibration: cal,
          };
        }
      }
    }

    return null;
  } catch (err) {
    console.warn('[GeoPdfParser] Error reading GeoPDF metadata:', err);
    return null;
  }
}
