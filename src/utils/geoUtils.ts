import { GeoCoordinate } from '../types';

/**
 * Calculates Great-Circle distance between two coordinates in meters using Haversine formula
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates initial bearing (forward azimuth) from point 1 to point 2 in degrees (0-360)
 */
export function calculateBearingDegrees(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  const bearing = ((θ * 180) / Math.PI + 360) % 360;
  return bearing;
}

/**
 * Converts degrees into 16-point Compass Cardinal Direction
 */
export function bearingToCardinal(bearing: number): string {
  const directions = [
    'N', 'NNE', 'NE', 'ENE',
    'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW',
    'W', 'WNW', 'NW', 'NNW'
  ];
  const index = Math.round(bearing / 22.5) % 16;
  return directions[index];
}

/**
 * Converts Decimal Degrees to DMS (Degrees, Minutes, Seconds)
 */
export function formatToDMS(deg: number, isLatitude: boolean): string {
  const absolute = Math.abs(deg);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(2);

  const direction = isLatitude
    ? deg >= 0 ? 'N' : 'S'
    : deg >= 0 ? 'E' : 'W';

  return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
}

/**
 * Approximate conversion from Lat/Lng to UTM Coordinates & Zone
 */
export function latLngToUTM(lat: number, lng: number): { zone: string; easting: number; northing: number } {
  const zoneNumber = Math.floor((lng + 180) / 6) + 1;
  const hemisphere = lat >= 0 ? 'N' : 'S';
  
  // Approximate standard projection for quick field reference
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const centralMeridian = ((zoneNumber - 1) * 6 - 180 + 3) * (Math.PI / 180);
  
  const a = 6378137.0; // WGS84 major axis
  const k0 = 0.9996;
  const e2 = 0.00669438;
  
  const N = a / Math.sqrt(1 - e2 * Math.sin(latRad) * Math.sin(latRad));
  const T = Math.tan(latRad) * Math.tan(latRad);
  const C = (e2 / (1 - e2)) * Math.cos(latRad) * Math.cos(latRad);
  const A = Math.cos(latRad) * (lngRad - centralMeridian);
  
  const M = a * ((1 - e2 / 4 - 3 * e2 * e2 / 64) * latRad - (3 * e2 / 8 + 3 * e2 * e2 / 32) * Math.sin(2 * latRad) + (15 * e2 * e2 / 256) * Math.sin(4 * latRad));
  
  let easting = 500000 + k0 * N * (A + (1 - T + C) * Math.pow(A, 3) / 6);
  let northing = k0 * (M + N * Math.tan(latRad) * (Math.pow(A, 2) / 2 + (5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4) / 24));
  
  if (lat < 0) {
    northing += 10000000; // False Northing for Southern Hemisphere
  }

  return {
    zone: `${zoneNumber}${hemisphere}`,
    easting: Math.round(easting),
    northing: Math.round(northing),
  };
}

/**
 * Calculates Cross Track Error (XTE) in meters from current position to a route segment
 */
export function calculateCrossTrackError(
  currentLat: number,
  currentLon: number,
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number
): number {
  const d13 = calculateDistanceMeters(startLat, startLon, currentLat, currentLon) / 6371000;
  const θ13 = (calculateBearingDegrees(startLat, startLon, currentLat, currentLon) * Math.PI) / 180;
  const θ12 = (calculateBearingDegrees(startLat, startLon, endLat, endLon) * Math.PI) / 180;

  const dxt = Math.asin(Math.sin(d13) * Math.sin(θ13 - θ12)) * 6371000;
  return Math.round(dxt);
}

/**
 * Calculates polygon area in Hectares and Square Meters (spherical shoelace)
 */
export function calculatePolygonArea(coords: GeoCoordinate[]): { m2: number; hectares: number } {
  if (coords.length < 3) return { m2: 0, hectares: 0 };
  
  const R = 6378137; // Earth radius in meters
  let area = 0;

  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    const lat1 = (coords[i].lat * Math.PI) / 180;
    const lat2 = (coords[j].lat * Math.PI) / 180;
    const lon1 = (coords[i].lng * Math.PI) / 180;
    const lon2 = (coords[j].lng * Math.PI) / 180;
    area += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  area = Math.abs((area * R * R) / 2.0);
  const hectares = Number((area / 10000).toFixed(2));
  return { m2: Math.round(area), hectares };
}
