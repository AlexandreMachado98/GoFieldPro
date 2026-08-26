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
  if (
    typeof lat1 !== 'number' ||
    typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lon2 !== 'number' ||
    isNaN(lat1) ||
    isNaN(lon1) ||
    isNaN(lat2) ||
    isNaN(lon2)
  ) {
    return 0;
  }

  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(Math.max(0, Math.min(1, a))), Math.sqrt(Math.max(0, Math.min(1, 1 - a))));
  const dist = R * c;
  return isNaN(dist) ? 0 : dist;
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
  if (
    typeof lat1 !== 'number' ||
    typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lon2 !== 'number' ||
    isNaN(lat1) ||
    isNaN(lon1) ||
    isNaN(lat2) ||
    isNaN(lon2)
  ) {
    return 0;
  }

  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  const bearing = ((θ * 180) / Math.PI + 360) % 360;
  return isNaN(bearing) ? 0 : bearing;
}

/**
 * Converts degrees into 16-point Compass Cardinal Direction
 */
export function bearingToCardinal(bearing: number): string {
  if (typeof bearing !== 'number' || isNaN(bearing)) return 'N';
  const directions = [
    'N', 'NNE', 'NE', 'ENE',
    'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW',
    'W', 'WNW', 'NW', 'NNW'
  ];
  const index = Math.round(((bearing % 360) + 360) % 360 / 22.5) % 16;
  return directions[index] || 'N';
}

/**
 * Converts Decimal Degrees to DMS (Degrees, Minutes, Seconds)
 */
export function formatToDMS(deg: number, isLatitude: boolean): string {
  if (typeof deg !== 'number' || isNaN(deg)) {
    return `00° 00' 00.00" ${isLatitude ? 'S' : 'W'}`;
  }
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
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    isNaN(lat) ||
    isNaN(lng)
  ) {
    return { zone: '23S', easting: 0, northing: 0 };
  }

  const zoneNumber = Math.max(1, Math.min(60, Math.floor((lng + 180) / 6) + 1));
  const hemisphere = lat >= 0 ? 'N' : 'S';
  
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
    easting: isNaN(easting) ? 0 : Math.round(easting),
    northing: isNaN(northing) ? 0 : Math.round(northing),
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
  return isNaN(dxt) ? 0 : Math.round(dxt);
}

/**
 * Calculates polygon area in Hectares and Square Meters (spherical shoelace)
 */
export function calculatePolygonArea(coords: GeoCoordinate[]): { m2: number; hectares: number } {
  if (!coords || !Array.isArray(coords)) return { m2: 0, hectares: 0 };
  const valid = coords.filter((c) => c && typeof c.lat === 'number' && typeof c.lng === 'number' && !isNaN(c.lat) && !isNaN(c.lng));
  if (valid.length < 3) return { m2: 0, hectares: 0 };
  
  const R = 6378137; // Earth radius in meters
  let area = 0;

  for (let i = 0; i < valid.length; i++) {
    const j = (i + 1) % valid.length;
    const lat1 = (valid[i].lat * Math.PI) / 180;
    const lat2 = (valid[j].lat * Math.PI) / 180;
    const lon1 = (valid[i].lng * Math.PI) / 180;
    const lon2 = (valid[j].lng * Math.PI) / 180;
    area += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  area = Math.abs((area * R * R) / 2.0);
  if (isNaN(area)) return { m2: 0, hectares: 0 };
  const hectares = Number((area / 10000).toFixed(2));
  return { m2: Math.round(area), hectares: isNaN(hectares) ? 0 : hectares };
}

/**
 * Safely parses odometer string or number into clean whole integer KM:
 * Handles "123.450", "123450", "123,450", "123450.5", "0.159", etc.
 */
export function parseOdometerKm(val: string | number | undefined | null): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') {
    if (isNaN(val) || val <= 0) return 0;
    return Math.round(val);
  }
  
  const clean = String(val).trim();
  if (!clean) return 0;

  let normalized = clean;
  // If string contains dots (e.g. 123.450 or 5.200)
  if (normalized.includes('.')) {
    normalized = normalized.replace(/\./g, '');
  }
  if (normalized.includes(',')) {
    normalized = normalized.replace(/,/g, '.');
  }

  const num = parseFloat(normalized);
  return isNaN(num) || num <= 0 ? 0 : Math.round(num);
}

/**
 * Formats distance always in whole Kilometers (KM) with clean integer format without decimals:
 * e.g. "159 KM", "2.450 KM", "0 KM"
 */
export function formatFieldDistance(km: number | undefined | null): { value: string; unit: string; full: string } {
  if (km === undefined || km === null || isNaN(km) || km <= 0) {
    return { value: '0', unit: 'KM', full: '0 KM' };
  }

  const wholeKm = Math.round(km);
  const formatted = wholeKm.toLocaleString('pt-BR');

  return {
    value: formatted,
    unit: 'KM',
    full: `${formatted} KM`,
  };
}
