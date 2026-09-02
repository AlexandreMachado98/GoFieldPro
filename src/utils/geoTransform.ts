import { PdfDocument, GeoCalibration } from './pdfStorage';
import { calculateDistanceMeters, calculateBearingDegrees, bearingToCardinal } from './geoUtils';

/**
 * High-Precision Cartographic Transformation Engine for GoField Pro
 * 
 * Supports:
 * - 2-Point Ground Control Point (GCP) Conformal Similarity Transformation (Scale, Rotation, Translation)
 * - Neatline Bounding Box Calibration (North, South, East, West)
 * - Centered Anchor with real cartographic scale and rotation
 * - Zero fallback to hardcoded fake coordinates (avoids projecting users into São Paulo)
 */

export interface GpsToPdfResult {
  x: number;
  y: number;
  isInside: boolean;
  isCalibrated: boolean;
}

/**
 * Checks if a document has valid, genuine georeferencing calibration
 */
export function isDocumentCalibrated(doc: { calibration?: GeoCalibration } | null | undefined): boolean {
  if (!doc || !doc.calibration) return false;
  const cal = doc.calibration;
  if (!cal.isCalibrated) return false;
  if (!cal.ref1 || !cal.ref2) return false;

  // STRICT REJECTION: Reject legacy auto-anchored calibrations that were created automatically on file upload
  // A document is ONLY validly calibrated if calibrated by GCP, Neatline/Bounds, GeoPDF, or an explicit User Anchor!
  if (cal.method === 'centered' || !cal.method) {
    return false;
  }

  // Detect legacy São Paulo hardcoded default (-23.542, -46.638) and invalidate it
  const isLegacyFakeSp = (
    Math.abs(cal.ref1.lat - (-23.5420)) < 0.005 &&
    Math.abs(cal.ref1.lng - (-46.6380)) < 0.005
  );
  if (isLegacyFakeSp) return false;

  // Must have valid non-NaN coordinates
  if (isNaN(cal.ref1.lat) || isNaN(cal.ref1.lng) || isNaN(cal.ref2.lat) || isNaN(cal.ref2.lng)) return false;
  if (isNaN(cal.ref1.x) || isNaN(cal.ref1.y) || isNaN(cal.ref2.x) || isNaN(cal.ref2.y)) return false;

  // Must have non-zero distance between reference points
  const dLat = Math.abs(cal.ref2.lat - cal.ref1.lat);
  const dLng = Math.abs(cal.ref2.lng - cal.ref1.lng);
  const dPixel = Math.hypot(cal.ref2.x - cal.ref1.x, cal.ref2.y - cal.ref1.y);

  return (dLat > 0.00001 || dLng > 0.00001) && dPixel > 10;
}

/**
 * Returns document calibration or a clean uncalibrated sentinel
 */
export function getDocumentCalibration(doc: PdfDocument | null | undefined): GeoCalibration {
  if (doc && isDocumentCalibrated(doc)) {
    return doc.calibration!;
  }

  const h = doc?.height && !isNaN(doc.height) && doc.height > 0 ? doc.height : 1200;
  const w = doc?.width && !isNaN(doc.width) && doc.width > 0 ? doc.width : 1600;

  return {
    isCalibrated: false,
    ref1: { x: h * 0.9, y: w * 0.1, lat: NaN, lng: NaN },
    ref2: { x: h * 0.1, y: w * 0.9, lat: NaN, lng: NaN },
    scaleMetersPerPixel: 0.85,
  };
}

/**
 * Calibrates a document around a central coordinate with a specified scale and rotation
 */
export function createCenteredCalibration(
  doc: { width?: number; height?: number; calibration?: GeoCalibration } | null | undefined,
  centerLat: number,
  centerLng: number,
  scaleMetersPerPixel = 0.75,
  rotationDeg = 0
): GeoCalibration {
  if (typeof centerLat !== 'number' || typeof centerLng !== 'number' || isNaN(centerLat) || isNaN(centerLng)) {
    throw new Error('Coordenadas de centro inválidas para calibração.');
  }

  const safeScale = typeof scaleMetersPerPixel === 'number' && !isNaN(scaleMetersPerPixel) && scaleMetersPerPixel > 0
    ? scaleMetersPerPixel
    : 0.75;

  const h = doc?.height && !isNaN(doc.height) && doc.height > 0 ? doc.height : 1200;
  const w = doc?.width && !isNaN(doc.width) && doc.width > 0 ? doc.width : 1600;

  // WGS84 Geodetic ellipsoidal meters per degree
  const latRad = (centerLat * Math.PI) / 180;
  const metersPerDegLat = 111132.92 - 559.82 * Math.cos(2 * latRad) + 1.175 * Math.cos(4 * latRad);
  const metersPerDegLng = 111412.84 * Math.cos(latRad) - 93.5 * Math.cos(3 * latRad);

  const degPerMeterLat = 1 / Math.max(1000, metersPerDegLat);
  const degPerMeterLng = 1 / Math.max(1000, Math.abs(metersPerDegLng));

  // Offset in meters from center for Top-Left (x: 90% h, y: 10% w)
  // Leaflet CRS.Simple: x is vertical (lat, 0 to h), y is horizontal (lng, 0 to w)
  const dyTopLeftMeters = (h * 0.4) * safeScale; // North
  const dxTopLeftMeters = -(w * 0.4) * safeScale; // West

  // Offset in meters from center for Bottom-Right (x: 10% h, y: 90% w)
  const dyBottomRightMeters = -(h * 0.4) * safeScale; // South
  const dxBottomRightMeters = (w * 0.4) * safeScale; // East

  // Apply rotation if present
  const rotRad = (rotationDeg * Math.PI) / 180;
  const cosR = Math.cos(rotRad);
  const sinR = Math.sin(rotRad);

  // Rotate Top-Left vector
  const rDxTL = dxTopLeftMeters * cosR - dyTopLeftMeters * sinR;
  const rDyTL = dxTopLeftMeters * sinR + dyTopLeftMeters * cosR;

  // Rotate Bottom-Right vector
  const rDxBR = dxBottomRightMeters * cosR - dyBottomRightMeters * sinR;
  const rDyBR = dxBottomRightMeters * sinR + dyBottomRightMeters * cosR;

  const ref1Lat = centerLat + rDyTL * degPerMeterLat;
  const ref1Lng = centerLng + rDxTL * degPerMeterLng;

  const ref2Lat = centerLat + rDyBR * degPerMeterLat;
  const ref2Lng = centerLng + rDxBR * degPerMeterLng;

  return {
    isCalibrated: true,
    ref1: { x: +(h * 0.9).toFixed(1), y: +(w * 0.1).toFixed(1), lat: +ref1Lat.toFixed(7), lng: +ref1Lng.toFixed(7) },
    ref2: { x: +(h * 0.1).toFixed(1), y: +(w * 0.9).toFixed(1), lat: +ref2Lat.toFixed(7), lng: +ref2Lng.toFixed(7) },
    scaleMetersPerPixel: safeScale,
    rotationDeg,
    method: 'centered',
  };
}

/**
 * Creates calibration from 2 Ground Control Points (GCP 1 and GCP 2)
 */
export function create2PointCalibration(
  pt1: { x: number; y: number; lat: number; lng: number },
  pt2: { x: number; y: number; lat: number; lng: number },
  nominalScale?: string
): GeoCalibration {
  if (isNaN(pt1.lat) || isNaN(pt1.lng) || isNaN(pt2.lat) || isNaN(pt2.lng)) {
    throw new Error('Coordenadas geográficas dos pontos de controle são inválidas.');
  }
  if (isNaN(pt1.x) || isNaN(pt1.y) || isNaN(pt2.x) || isNaN(pt2.y)) {
    throw new Error('Coordenadas da folha PDF dos pontos de controle são inválidas.');
  }

  const pixelDist = Math.hypot(pt2.x - pt1.x, pt2.y - pt1.y);
  if (pixelDist < 10) {
    throw new Error('Os pontos de controle devem estar separados por uma distância maior na folha.');
  }

  const realDistMeters = calculateDistanceMeters(pt1.lat, pt1.lng, pt2.lat, pt2.lng);
  const scaleMetersPerPixel = realDistMeters > 0 ? +(realDistMeters / pixelDist).toFixed(4) : 0.75;

  return {
    isCalibrated: true,
    ref1: { x: +pt1.x.toFixed(1), y: +pt1.y.toFixed(1), lat: +pt1.lat.toFixed(7), lng: +pt1.lng.toFixed(7) },
    ref2: { x: +pt2.x.toFixed(1), y: +pt2.y.toFixed(1), lat: +pt2.lat.toFixed(7), lng: +pt2.lng.toFixed(7) },
    scaleMetersPerPixel,
    nominalScale,
    method: 'gcp_2pt',
  };
}

/**
 * Creates calibration from Neatline Bounding Box (North, South, West, East)
 */
export function createBoundingBoxCalibration(
  doc: { width?: number; height?: number } | null | undefined,
  bounds: { northLat: number; southLat: number; westLng: number; eastLng: number }
): GeoCalibration {
  const { northLat, southLat, westLng, eastLng } = bounds;
  if (isNaN(northLat) || isNaN(southLat) || isNaN(westLng) || isNaN(eastLng)) {
    throw new Error('Coordenadas da moldura inválidas.');
  }

  const h = doc?.height && !isNaN(doc.height) && doc.height > 0 ? doc.height : 1200;
  const w = doc?.width && !isNaN(doc.width) && doc.width > 0 ? doc.width : 1600;

  const realDistHeight = calculateDistanceMeters(southLat, (westLng + eastLng) / 2, northLat, (westLng + eastLng) / 2);
  const scaleMetersPerPixel = realDistHeight > 0 ? +(realDistHeight / h).toFixed(4) : 0.75;

  return {
    isCalibrated: true,
    ref1: { x: h, y: 0, lat: +northLat.toFixed(7), lng: +westLng.toFixed(7) },
    ref2: { x: 0, y: w, lat: +southLat.toFixed(7), lng: +eastLng.toFixed(7) },
    scaleMetersPerPixel,
    method: 'gcp_4pt',
  };
}

/**
 * Converts WGS84 (Lat, Lng) to PDF Pixel Coordinates (x: Leaflet lat, y: Leaflet lng)
 */
export function gpsToPdf(
  lat: number,
  lng: number,
  doc: { width?: number; height?: number; calibration?: GeoCalibration } | null | undefined
): GpsToPdfResult {
  const h = doc?.height && !isNaN(doc.height) && doc.height > 0 ? doc.height : 1200;
  const w = doc?.width && !isNaN(doc.width) && doc.width > 0 ? doc.width : 1600;

  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    return { x: h / 2, y: w / 2, isInside: false, isCalibrated: false };
  }

  if (!doc || !isDocumentCalibrated(doc)) {
    return { x: h / 2, y: w / 2, isInside: false, isCalibrated: false };
  }

  const cal = doc.calibration!;
  const { ref1, ref2 } = cal;

  // Check if points have rotation
  const dLat = ref2.lat - ref1.lat;
  const dLng = ref2.lng - ref1.lng;
  const dx = ref2.x - ref1.x;
  const dy = ref2.y - ref1.y;

  // Mid-latitude ellipsoidal meters per degree
  const midLat = (ref1.lat + ref2.lat) / 2;
  const latRad = (midLat * Math.PI) / 180;
  const metersPerDegLat = 111132.92 - 559.82 * Math.cos(2 * latRad) + 1.175 * Math.cos(4 * latRad);
  const metersPerDegLng = (111412.84 * Math.cos(latRad) - 93.5 * Math.cos(3 * latRad)) || 111320;

  // Real world metric delta between ref1 and ref2
  const dNorthM = dLat * metersPerDegLat;
  const dEastM = dLng * metersPerDegLng;
  const refMetricDistSq = dNorthM * dNorthM + dEastM * dEastM;

  if (refMetricDistSq < 1) {
    return { x: h / 2, y: w / 2, isInside: false, isCalibrated: false };
  }

  // Real world metric delta from ref1 to target point
  const pNorthM = (lat - ref1.lat) * metersPerDegLat;
  const pEastM = (lng - ref1.lng) * metersPerDegLng;

  // Conformal Similarity Transformation (Scale + Rotation + Translation)
  const dot = (pNorthM * dNorthM + pEastM * dEastM) / refMetricDistSq;
  const cross = (pEastM * dNorthM - pNorthM * dEastM) / refMetricDistSq;

  // In Leaflet CRS.Simple:
  // dx is change in vertical (x), dy is change in horizontal (y)
  // Perpendicular vector to (dx, dy) rotated +90° is (-dy, dx)
  const x = ref1.x + dot * dx + cross * (-dy);
  const y = ref1.y + dot * dy + cross * dx;

  const safeX = isNaN(x) ? h / 2 : +x.toFixed(1);
  const safeY = isNaN(y) ? w / 2 : +y.toFixed(1);
  
  // Strict bounds check: point must fall strictly within the PDF page dimensions [0, h] and [0, w]
  const isInside = safeX >= 0 && safeX <= h && safeY >= 0 && safeY <= w;

  return { x: safeX, y: safeY, isInside, isCalibrated: true };
}

/**
 * Converts PDF Pixel Coordinates (x: Leaflet lat, y: Leaflet lng) to WGS84 (Lat, Lng)
 */
export function pdfToGps(
  x: number,
  y: number,
  doc: { width?: number; height?: number; calibration?: GeoCalibration } | null | undefined
): { lat: number; lng: number; isCalibrated: boolean } {
  if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) {
    return { lat: 0, lng: 0, isCalibrated: false };
  }

  if (!doc || !isDocumentCalibrated(doc)) {
    return { lat: 0, lng: 0, isCalibrated: false };
  }

  const cal = doc.calibration!;
  const { ref1, ref2 } = cal;

  const dx = ref2.x - ref1.x;
  const dy = ref2.y - ref1.y;
  const pixelDistSq = dx * dx + dy * dy;

  if (pixelDistSq < 1) {
    return { lat: ref1.lat, lng: ref1.lng, isCalibrated: true };
  }

  const midLat = (ref1.lat + ref2.lat) / 2;
  const latRad = (midLat * Math.PI) / 180;
  const metersPerDegLat = 111132.92 - 559.82 * Math.cos(2 * latRad) + 1.175 * Math.cos(4 * latRad);
  const metersPerDegLng = (111412.84 * Math.cos(latRad) - 93.5 * Math.cos(3 * latRad)) || 111320;

  const dNorthM = (ref2.lat - ref1.lat) * metersPerDegLat;
  const dEastM = (ref2.lng - ref1.lng) * metersPerDegLng;

  // Inverse Conformal Transformation
  const px = x - ref1.x;
  const py = y - ref1.y;

  const dot = (px * dx + py * dy) / pixelDistSq;
  const cross = (py * dx - px * dy) / pixelDistSq;

  const pNorthM = dot * dNorthM - cross * dEastM;
  const pEastM = dot * dEastM + cross * dNorthM;

  const lat = ref1.lat + pNorthM / metersPerDegLat;
  const lng = ref1.lng + pEastM / metersPerDegLng;

  return {
    lat: isNaN(lat) ? ref1.lat : +lat.toFixed(7),
    lng: isNaN(lng) ? ref1.lng : +lng.toFixed(7),
    isCalibrated: true,
  };
}

/**
 * Calculates distance and bearing between user's current GPS position and a target PDF marker
 */
export function calculateNavigationToMarker(
  userGps: { lat: number; lng: number } | null | undefined,
  marker: { x: number; y: number; lat?: number; lng?: number } | null | undefined,
  doc: PdfDocument | null | undefined
): {
  distanceMeters: number;
  formattedDistance: string;
  bearingDegrees: number;
  cardinal: string;
} {
  if (!userGps || !marker) {
    return {
      distanceMeters: 0,
      formattedDistance: '0 m',
      bearingDegrees: 0,
      cardinal: 'N',
    };
  }

  let targetLat = marker.lat;
  let targetLng = marker.lng;

  if (targetLat === undefined || targetLng === undefined || isNaN(targetLat) || isNaN(targetLng)) {
    const computed = pdfToGps(marker.x, marker.y, doc);
    if (computed.isCalibrated) {
      targetLat = computed.lat;
      targetLng = computed.lng;
    } else {
      return {
        distanceMeters: 0,
        formattedDistance: 'Planta não calibrada',
        bearingDegrees: 0,
        cardinal: 'N',
      };
    }
  }

  const distanceMeters = calculateDistanceMeters(
    userGps.lat,
    userGps.lng,
    targetLat,
    targetLng
  );

  const bearingDegrees = calculateBearingDegrees(
    userGps.lat,
    userGps.lng,
    targetLat,
    targetLng
  );

  const cardinal = bearingToCardinal(bearingDegrees);

  const formattedDistance =
    distanceMeters >= 1000
      ? `${(distanceMeters / 1000).toFixed(2)} km`
      : `${Math.round(distanceMeters)} m`;

  return {
    distanceMeters,
    formattedDistance,
    bearingDegrees,
    cardinal,
  };
}
