import { PdfDocument, GeoCalibration } from './pdfStorage';
import { calculateDistanceMeters, calculateBearingDegrees, bearingToCardinal } from './geoUtils';

// Default reference coordinates for demo maps or uncalibrated documents (SIRGAS 2000 / WGS84)
const DEFAULT_REF = {
  northLat: -23.5420,
  southLat: -23.5540,
  westLng: -46.6380,
  eastLng: -46.6220,
};

/**
 * Ensures a document has a valid calibration structure or generates a default bounding box
 */
export function getDocumentCalibration(doc: PdfDocument | null | undefined): GeoCalibration {
  if (!doc) {
    return {
      isCalibrated: false,
      ref1: { x: 1020, y: 240, lat: DEFAULT_REF.northLat, lng: DEFAULT_REF.westLng },
      ref2: { x: 180, y: 1360, lat: DEFAULT_REF.southLat, lng: DEFAULT_REF.eastLng },
      scaleMetersPerPixel: 0.85,
    };
  }

  if (doc.calibration && doc.calibration.isCalibrated && doc.calibration.ref1 && doc.calibration.ref2) {
    return doc.calibration;
  }

  const h = doc.height && !isNaN(doc.height) ? doc.height : 1200;
  const w = doc.width && !isNaN(doc.width) ? doc.width : 1600;

  return {
    isCalibrated: false,
    ref1: { x: h * 0.85, y: w * 0.15, lat: DEFAULT_REF.northLat, lng: DEFAULT_REF.westLng },
    ref2: { x: h * 0.15, y: w * 0.85, lat: DEFAULT_REF.southLat, lng: DEFAULT_REF.eastLng },
    scaleMetersPerPixel: 0.85,
  };
}

/**
 * Calibrates a document around the user's current GPS position
 */
export function createCenteredCalibration(
  doc: PdfDocument | null | undefined,
  centerLat: number,
  centerLng: number,
  scaleMetersPerPixel = 0.75
): GeoCalibration {
  const safeLat = typeof centerLat === 'number' && !isNaN(centerLat) ? centerLat : DEFAULT_REF.northLat;
  const safeLng = typeof centerLng === 'number' && !isNaN(centerLng) ? centerLng : DEFAULT_REF.westLng;
  const safeScale = typeof scaleMetersPerPixel === 'number' && !isNaN(scaleMetersPerPixel) && scaleMetersPerPixel > 0 ? scaleMetersPerPixel : 0.75;

  const h = doc?.height && !isNaN(doc.height) ? doc.height : 1200;
  const w = doc?.width && !isNaN(doc.width) ? doc.width : 1600;

  // 1 degree latitude ~ 111,320 meters
  const degPerMeterLat = 1 / 111320;
  const cosLat = Math.cos((safeLat * Math.PI) / 180);
  // 1 degree longitude ~ 111,320 * cos(lat) meters
  const degPerMeterLng = 1 / (111320 * (Math.abs(cosLat) > 0.01 ? cosLat : 1));

  const halfHeightMeters = (h / 2) * safeScale;
  const halfWidthMeters = (w / 2) * safeScale;

  const northLat = safeLat + halfHeightMeters * degPerMeterLat;
  const southLat = safeLat - halfHeightMeters * degPerMeterLat;
  const westLng = safeLng - halfWidthMeters * degPerMeterLng;
  const eastLng = safeLng + halfWidthMeters * degPerMeterLng;

  return {
    isCalibrated: true,
    ref1: { x: h * 0.9, y: w * 0.1, lat: northLat, lng: westLng },
    ref2: { x: h * 0.1, y: w * 0.9, lat: southLat, lng: eastLng },
    scaleMetersPerPixel: safeScale,
  };
}

/**
 * Converts PDF Pixel Coordinates (x: vertical Leaflet lat, y: horizontal Leaflet lng) to WGS84 (Lat, Lng)
 */
export function pdfToGps(x: number, y: number, doc: PdfDocument | null | undefined): { lat: number; lng: number } {
  if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) {
    return { lat: DEFAULT_REF.northLat, lng: DEFAULT_REF.westLng };
  }

  const cal = getDocumentCalibration(doc);
  const { ref1, ref2 } = cal;

  // Linear interpolation with safeguards against 0 division
  const dx = (ref2.x - ref1.x) || 1;
  const dy = (ref2.y - ref1.y) || 1;

  const latRatio = (x - ref1.x) / dx;
  const lngRatio = (y - ref1.y) / dy;

  const lat = ref1.lat + latRatio * (ref2.lat - ref1.lat);
  const lng = ref1.lng + lngRatio * (ref2.lng - ref1.lng);

  return {
    lat: isNaN(lat) ? DEFAULT_REF.northLat : lat,
    lng: isNaN(lng) ? DEFAULT_REF.westLng : lng,
  };
}

/**
 * Converts WGS84 (Lat, Lng) to PDF Pixel Coordinates (x: vertical Leaflet lat, y: horizontal Leaflet lng)
 */
export function gpsToPdf(lat: number, lng: number, doc: PdfDocument | null | undefined): { x: number; y: number; isInside: boolean } {
  const h = doc?.height && !isNaN(doc.height) ? doc.height : 1200;
  const w = doc?.width && !isNaN(doc.width) ? doc.width : 1600;

  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    return { x: h / 2, y: w / 2, isInside: true };
  }

  const cal = getDocumentCalibration(doc);
  const { ref1, ref2 } = cal;

  const dLat = (ref2.lat - ref1.lat) || 0.0001;
  const dLng = (ref2.lng - ref1.lng) || 0.0001;

  const latRatio = (lat - ref1.lat) / dLat;
  const lngRatio = (lng - ref1.lng) / dLng;

  const x = ref1.x + latRatio * (ref2.x - ref1.x);
  const y = ref1.y + lngRatio * (ref2.y - ref1.y);

  const safeX = isNaN(x) ? h / 2 : x;
  const safeY = isNaN(y) ? w / 2 : y;
  const isInside = safeX >= 0 && safeX <= h && safeY >= 0 && safeY <= w;

  return { x: safeX, y: safeY, isInside };
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
    targetLat = computed.lat;
    targetLng = computed.lng;
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
