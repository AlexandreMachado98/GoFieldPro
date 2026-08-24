import { PdfDocument, GeoCalibration } from './pdfStorage';
import { calculateDistanceMeters, calculateBearingDegrees, bearingToCardinal } from './geoUtils';

// Default reference coordinates for demo maps or uncalibrated documents (Fazenda Monte Verde, SP - SIRGAS 2000)
const DEFAULT_REF = {
  northLat: -23.5420,
  southLat: -23.5540,
  westLng: -46.6380,
  eastLng: -46.6220,
};

/**
 * Ensures a document has a valid calibration structure or generates a default bounding box
 */
export function getDocumentCalibration(doc: PdfDocument): GeoCalibration {
  if (doc.calibration && doc.calibration.isCalibrated) {
    return doc.calibration;
  }

  const h = doc.height || 1200;
  const w = doc.width || 1600;

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
  doc: PdfDocument,
  centerLat: number,
  centerLng: number,
  scaleMetersPerPixel = 0.75
): GeoCalibration {
  const h = doc.height || 1200;
  const w = doc.width || 1600;

  // 1 degree latitude ~ 111,320 meters
  const degPerMeterLat = 1 / 111320;
  // 1 degree longitude ~ 111,320 * cos(lat) meters
  const degPerMeterLng = 1 / (111320 * Math.cos((centerLat * Math.PI) / 180));

  const halfHeightMeters = (h / 2) * scaleMetersPerPixel;
  const halfWidthMeters = (w / 2) * scaleMetersPerPixel;

  const northLat = centerLat + halfHeightMeters * degPerMeterLat;
  const southLat = centerLat - halfHeightMeters * degPerMeterLat;
  const westLng = centerLng - halfWidthMeters * degPerMeterLng;
  const eastLng = centerLng + halfWidthMeters * degPerMeterLng;

  return {
    isCalibrated: true,
    ref1: { x: h * 0.9, y: w * 0.1, lat: northLat, lng: westLng },
    ref2: { x: h * 0.1, y: w * 0.9, lat: southLat, lng: eastLng },
    scaleMetersPerPixel,
  };
}

/**
 * Converts PDF Pixel Coordinates (x: vertical Leaflet lat, y: horizontal Leaflet lng) to WGS84 (Lat, Lng)
 */
export function pdfToGps(x: number, y: number, doc: PdfDocument): { lat: number; lng: number } {
  const cal = getDocumentCalibration(doc);
  const { ref1, ref2 } = cal;

  // Linear interpolation with safeguards
  const dx = ref2.x - ref1.x || 1;
  const dy = ref2.y - ref1.y || 1;

  const latRatio = (x - ref1.x) / dx;
  const lngRatio = (y - ref1.y) / dy;

  const lat = ref1.lat + latRatio * (ref2.lat - ref1.lat);
  const lng = ref1.lng + lngRatio * (ref2.lng - ref1.lng);

  return { lat, lng };
}

/**
 * Converts WGS84 (Lat, Lng) to PDF Pixel Coordinates (x: vertical Leaflet lat, y: horizontal Leaflet lng)
 */
export function gpsToPdf(lat: number, lng: number, doc: PdfDocument): { x: number; y: number; isInside: boolean } {
  const cal = getDocumentCalibration(doc);
  const { ref1, ref2 } = cal;

  const dLat = ref2.lat - ref1.lat || 0.0001;
  const dLng = ref2.lng - ref1.lng || 0.0001;

  const latRatio = (lat - ref1.lat) / dLat;
  const lngRatio = (lng - ref1.lng) / dLng;

  const x = ref1.x + latRatio * (ref2.x - ref1.x);
  const y = ref1.y + lngRatio * (ref2.y - ref1.y);

  const h = doc.height || 1200;
  const w = doc.width || 1600;

  const isInside = x >= 0 && x <= h && y >= 0 && y <= w;

  return { x, y, isInside };
}

/**
 * Calculates distance and bearing between user's current GPS position and a target PDF marker
 */
export function calculateNavigationToMarker(
  userGps: { lat: number; lng: number },
  marker: { x: number; y: number; lat?: number; lng?: number },
  doc: PdfDocument
): {
  distanceMeters: number;
  formattedDistance: string;
  bearingDegrees: number;
  cardinal: string;
} {
  let targetLat = marker.lat;
  let targetLng = marker.lng;

  if (targetLat === undefined || targetLng === undefined) {
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
