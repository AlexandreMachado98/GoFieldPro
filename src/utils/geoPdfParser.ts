import { GeoCalibration } from './pdfStorage';
import { create2PointCalibration } from './geoTransform';
import { utmToLatLng } from './geoUtils';

/**
 * GeoPDF Parser for GoField Pro (Commercial Grade)
 * Extracts ISO 32000 / Adobe Geospatial PDF and TerraGo OGC 08-139 dictionary metadata
 * Output from QGIS, ArcGIS, Global Mapper, AutoCAD Map 3D, IBGE topographic charts, etc.
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
 * Decodes buffer chunks safely using fast native TextDecoder
 */
function decodeBufferFast(buffer: ArrayBuffer, maxBytes = 40 * 1024 * 1024): string {
  try {
    const decoder = new TextDecoder('latin1');
    const bytes = new Uint8Array(buffer);
    if (bytes.length <= maxBytes) {
      return decoder.decode(bytes);
    }

    // For very large files (e.g. > 40MB), inspect first 10MB + last 20MB (where xref/dictionaries reside)
    const headSize = 10 * 1024 * 1024;
    const tailSize = 20 * 1024 * 1024;
    const headText = decoder.decode(bytes.subarray(0, headSize));
    const tailText = decoder.decode(bytes.subarray(bytes.length - tailSize));
    return headText + '\n' + tailText;
  } catch (err) {
    console.warn('[GeoPdfParser] Fast buffer decoding fallback:', err);
    return '';
  }
}

/**
 * Parses numbers from a PDF array string like "[ -23.5 46.2 ... ]"
 */
function parsePdfNumberArray(str: string): number[] {
  if (!str) return [];
  return str
    .replace(/[\[\]]/g, ' ')
    .trim()
    .split(/[\s,]+/)
    .map((s) => parseFloat(s))
    .filter((n) => !isNaN(n));
}

/**
 * Extracts UTM Zone number and hemisphere from WKT / Projection string
 */
function extractUtmZoneFromText(text: string): { zone: number; isSouth: boolean } {
  let zone = 23; // Default Brazilian central zone
  let isSouth = true;

  // Search for UTM zone patterns (e.g. "UTM zone 23S", "UTM_Zone_22_South", "EPSG:31983", "EPSG:32723")
  const zoneMatch = text.match(/zone\s*(\d{1,2})\s*([NS])?/i) || text.match(/zone_(\d{1,2})/i);
  if (zoneMatch && zoneMatch[1]) {
    const parsedZone = parseInt(zoneMatch[1], 10);
    if (parsedZone >= 1 && parsedZone <= 60) {
      zone = parsedZone;
    }
    if (zoneMatch[2]) {
      isSouth = zoneMatch[2].toUpperCase() === 'S';
    }
  }

  // EPSG codes: 31981=21S, 31982=22S, 31983=23S, 31984=24S, 31985=25S
  const epsgMatch = text.match(/3198(\d)/) || text.match(/327(\d{2})/);
  if (epsgMatch && epsgMatch[1]) {
    if (epsgMatch[0].startsWith('3198')) {
      zone = 20 + parseInt(epsgMatch[1], 10);
      isSouth = true;
    } else if (epsgMatch[0].startsWith('327')) {
      zone = parseInt(epsgMatch[1], 10);
      isSouth = true;
    }
  }

  return { zone, isSouth };
}

/**
 * Scans a PDF ArrayBuffer for embedded geospatial dictionaries (ISO 32000 & TerraGo)
 */
export async function parseGeoPdfMetadata(
  pdfBuffer: ArrayBuffer,
  pageWidth: number,
  pageHeight: number
): Promise<GeoPdfMetadata | null> {
  try {
    const text = decodeBufferFast(pdfBuffer);
    if (!text) return null;

    // Check for OGC / ISO GeoPDF signatures
    const hasIsoGeo = text.includes('/Measure') || text.includes('/GPTS') || text.includes('/VP');
    const hasTerraGo = text.includes('/LGIDict') || text.includes('/CTM') || text.includes('/Neatline');

    if (!hasIsoGeo && !hasTerraGo) {
      return null;
    }

    console.log('[GeoPdfParser] Geospatial PDF signature detected. Extracting coordinate reference system...');

    const { zone: detectedZone, isSouth: detectedIsSouth } = extractUtmZoneFromText(text);

    // =========================================================================
    // 1. ISO 32000 / Adobe Geospatial Extension (/GPTS and /LPTS)
    // =========================================================================
    const gptsMatch = text.match(/\/GPTS\s*\[([\s\S]*?)\]/i);
    const lptsMatch = text.match(/\/LPTS\s*\[([\s\S]*?)\]/i);
    const bboxMatch = text.match(/\/BBox\s*\[([\s\S]*?)\]/i);

    if (gptsMatch && gptsMatch[1]) {
      const gptsNumbers = parsePdfNumberArray(gptsMatch[1]);
      const lptsNumbers = lptsMatch && lptsMatch[1] ? parsePdfNumberArray(lptsMatch[1]) : [];
      const bboxNumbers = bboxMatch && bboxMatch[1] ? parsePdfNumberArray(bboxMatch[1]) : [];

      if (gptsNumbers.length >= 4) {
        // Detect if coordinates are projected in UTM (numbers > 180 or > 1000)
        const isProjectedUtm = gptsNumbers.some((n) => Math.abs(n) > 180);

        const groundPoints: Array<{ lat: number; lng: number }> = [];
        for (let i = 0; i < gptsNumbers.length - 1; i += 2) {
          const val1 = gptsNumbers[i];
          const val2 = gptsNumbers[i + 1];

          if (isProjectedUtm) {
            // In UTM, coordinates are Easting (~100k-900k) and Northing (~1M-10M)
            const easting = val1 < val2 ? val1 : val2;
            const northing = val1 < val2 ? val2 : val1;
            const geo = utmToLatLng(easting, northing, detectedZone, detectedIsSouth);
            groundPoints.push(geo);
          } else {
            // In Geographic Lat/Lng: check order (Lat, Lng vs Lng, Lat)
            let lat = val1;
            let lng = val2;
            if (Math.abs(val1) > 90 && Math.abs(val2) <= 90) {
              lng = val1;
              lat = val2;
            } else if (Math.abs(val1) > Math.abs(val2) && val1 < -30 && val2 < 0 && val2 > -35) {
              lng = val1;
              lat = val2;
            }
            groundPoints.push({ lat: +lat.toFixed(7), lng: +lng.toFixed(7) });
          }
        }

        // Map sheet pixel coordinates (Leaflet CRS.Simple: x is vertical 0..height, y is horizontal 0..width)
        const sheetPoints: Array<{ x: number; y: number }> = [];
        if (lptsNumbers.length >= groundPoints.length * 2) {
          for (let i = 0; i < lptsNumbers.length - 1; i += 2) {
            const rawPx = lptsNumbers[i];
            const rawPy = lptsNumbers[i + 1];

            // Normalize if 0..1, otherwise scale from PDF points
            const isNorm = rawPx <= 1.05 && rawPy <= 1.05 && rawPx >= 0 && rawPy >= 0;
            const px = isNorm ? (1 - rawPy) * pageHeight : rawPy;
            const py = isNorm ? rawPx * pageWidth : rawPx;
            sheetPoints.push({ x: +px.toFixed(1), y: +py.toFixed(1) });
          }
        } else if (bboxNumbers.length === 4) {
          sheetPoints.push({ x: +(pageHeight * 0.95).toFixed(1), y: +(pageWidth * 0.05).toFixed(1) });
          sheetPoints.push({ x: +(pageHeight * 0.05).toFixed(1), y: +(pageWidth * 0.95).toFixed(1) });
        } else {
          sheetPoints.push({ x: +(pageHeight * 0.9).toFixed(1), y: +(pageWidth * 0.1).toFixed(1) });
          sheetPoints.push({ x: +(pageHeight * 0.1).toFixed(1), y: +(pageWidth * 0.9).toFixed(1) });
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

          console.log(`[GeoPdfParser] ✅ ISO 32000 GeoPDF Calibrated Successfully! Datum: ${cal.datum}`);

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

    // =========================================================================
    // 2. TerraGo / OGC 08-139 (/LGIDict & /CTM /Neatline)
    // =========================================================================
    if (hasTerraGo) {
      const neatlineMatch = text.match(/\/Neatline\s*\[([\s\S]*?)\]/i);

      if (neatlineMatch && neatlineMatch[1]) {
        const neatlineNumbers = parsePdfNumberArray(neatlineMatch[1]);
        if (neatlineNumbers.length >= 4) {
          const isProjectedUtm = neatlineNumbers.some((n) => Math.abs(n) > 180);
          const points: Array<{ lat: number; lng: number }> = [];

          for (let i = 0; i < neatlineNumbers.length - 1; i += 2) {
            const v1 = neatlineNumbers[i];
            const v2 = neatlineNumbers[i + 1];
            if (isProjectedUtm) {
              const easting = v1 < v2 ? v1 : v2;
              const northing = v1 < v2 ? v2 : v1;
              points.push(utmToLatLng(easting, northing, detectedZone, detectedIsSouth));
            } else {
              points.push({ lat: v2, lng: v1 });
            }
          }

          if (points.length >= 2) {
            const cal = create2PointCalibration(
              { x: pageHeight * 0.9, y: pageWidth * 0.1, lat: points[0].lat, lng: points[0].lng },
              { x: pageHeight * 0.1, y: pageWidth * 0.9, lat: points[1].lat, lng: points[1].lng }
            );
            cal.method = 'geopdf';
            cal.datum = 'WGS84';

            console.log('[GeoPdfParser] ✅ TerraGo OGC 08-139 GeoPDF Calibrated Successfully!');

            return {
              isGeoPdf: true,
              gpts: points,
              datum: 'WGS84',
              calibration: cal,
            };
          }
        }
      }
    }

    return null;
  } catch (err) {
    console.warn('[GeoPdfParser] Error reading GeoPDF metadata:', err);
    return null;
  }
}
