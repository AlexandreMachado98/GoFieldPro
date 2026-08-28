import { GeoCoordinate } from '../types';

/**
 * Centralized Configuration Constants for GPS Engine
 */
export const GPS_CONFIG = {
  // Accuracy Quality Thresholds in Meters
  ACCURACY_EXCELLENT: 10, // <= 10m: Excellent geodetic fix
  ACCURACY_GOOD: 25,      // <= 25m: Good for field surveys
  ACCURACY_MODERATE: 50,  // <= 50m: Acceptable for general area overview
  ACCURACY_LOW: 100,      // <= 100m: Degraded / Weak signal
  // > 100m is considered Poor / Highly Inaccurate

  // Physical Movement Limits (meters / second)
  MAX_WALKING_SPEED_MS: 3.5,    // ~12.6 km/h
  MAX_VEHICLE_SPEED_MS: 50.0,   // 180 km/h (Maximum realistic vehicle speed on field/road)
  MAX_PLAUSIBLE_SPEED_MS: 60.0, // 216 km/h (Absolute threshold above which displacement is flagged as GPS Jump/Drift)

  // Deadband & Filtering Thresholds
  STATIONARY_SPEED_THRESHOLD_MS: 0.3, // Speed < 0.3 m/s (~1 km/h) is considered stationary
  STATIONARY_DISTANCE_DEADBAND_M: 0.6, // Displacements < 0.6m while stationary are filtered out
  MIN_TIME_BETWEEN_READINGS_MS: 300,  // Discard sub-300ms duplicate hardware pulses

  // Signal Freshness & Stale Timeout
  STALE_SIGNAL_TIMEOUT_MS: 12000, // If no new valid reading arrives within 12s, signal is marked Stale

  // Marker Interpolation (Exponential Smoothing Alpha: 0 to 1)
  // Higher = more responsive, Lower = smoother presentation
  SMOOTHING_FACTOR_ACTIVE: 0.65,
  SMOOTHING_FACTOR_STATIONARY: 0.25,

  // Hardware Geolocation API Options
  WATCH_OPTIONS: {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 2000,
  },
  FALLBACK_OPTIONS: {
    enableHighAccuracy: false,
    timeout: 10000,
    maximumAge: 15000,
  },
};

export type GpsQualityLevel = 'excellent' | 'good' | 'moderate' | 'low' | 'poor' | 'invalid';
export type GpsMovementState = 'stationary' | 'walking' | 'vehicle';

export interface GpsValidationResult {
  accepted: boolean;
  reason?: string;
  coordinate: GeoCoordinate;
  quality: GpsQualityLevel;
  movementState: GpsMovementState;
  calculatedSpeedMs: number;
  calculatedBearingDeg: number;
}

/**
 * Calculates Haversine distance in meters between two geodetic coordinates
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's mean radius in meters
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
 * Computes forward azimuth / bearing in degrees (0 - 360) from point A to point B
 */
export function calculateBearingDegrees(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = Math.atan2(y, x);
  const bearing = ((theta * 180) / Math.PI + 360) % 360;
  return +bearing.toFixed(1);
}

/**
 * Classifies GPS accuracy into a qualitative metric
 */
export function classifyGpsAccuracy(accuracyMeters?: number): GpsQualityLevel {
  if (accuracyMeters === undefined || accuracyMeters === null || isNaN(accuracyMeters) || accuracyMeters <= 0) {
    return 'invalid';
  }
  if (accuracyMeters <= GPS_CONFIG.ACCURACY_EXCELLENT) return 'excellent';
  if (accuracyMeters <= GPS_CONFIG.ACCURACY_GOOD) return 'good';
  if (accuracyMeters <= GPS_CONFIG.ACCURACY_MODERATE) return 'moderate';
  if (accuracyMeters <= GPS_CONFIG.ACCURACY_LOW) return 'low';
  return 'poor';
}

/**
 * Validates coordinate numbers and bounds sanity
 */
export function isCoordinateValid(lat: number, lng: number): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false; // Null Island rejection
  return true;
}

/**
 * Strict Physical Plausibility & Anti-Drift Filter
 * Rejects unnatural GPS teleportation jumps while seamlessly preserving vehicle velocities
 */
export function validateAndProcessGpsReading(
  rawPos: GeolocationPosition,
  lastValidCoord: GeoCoordinate | null,
  options?: { isSimulated?: boolean; isRecordingTrack?: boolean }
): GpsValidationResult {
  const lat = rawPos.coords.latitude;
  const lng = rawPos.coords.longitude;
  const accuracy = +(rawPos.coords.accuracy || 10).toFixed(1);
  const altitude = rawPos.coords.altitude !== null ? +rawPos.coords.altitude.toFixed(1) : 1250;
  const rawSpeedMs = rawPos.coords.speed !== null && rawPos.coords.speed >= 0 ? rawPos.coords.speed : null;
  const rawHeading = rawPos.coords.heading !== null && !isNaN(rawPos.coords.heading) ? rawPos.coords.heading : null;
  const timestamp = rawPos.timestamp || Date.now();

  // 1. Basic Geodetic Bounds Check
  if (!isCoordinateValid(lat, lng)) {
    return {
      accepted: false,
      reason: 'Coordenadas fora dos limites geodésicos válidos (-90 a 90, -180 a 180).',
      coordinate: lastValidCoord || { lat: -23.5505, lng: -46.6333, accuracy: 100, timestamp },
      quality: 'invalid',
      movementState: 'stationary',
      calculatedSpeedMs: 0,
      calculatedBearingDeg: 0,
    };
  }

  const quality = classifyGpsAccuracy(accuracy);

  // If this is the very first reading, accept it unless accuracy is overwhelmingly degraded (> 300m)
  if (!lastValidCoord) {
    const isFirstFixAcceptable = accuracy <= 250;
    const finalCoord: GeoCoordinate = {
      lat,
      lng,
      altitude,
      accuracy,
      speed: rawSpeedMs !== null ? +(rawSpeedMs * 3.6).toFixed(1) : 0,
      heading: rawHeading !== null ? +rawHeading.toFixed(1) : 0,
      timestamp,
      quality,
      isSimulated: !!options?.isSimulated,
    };

    return {
      accepted: isFirstFixAcceptable,
      reason: isFirstFixAcceptable ? undefined : 'Primeira leitura do GPS com precisão muito degradada (>250m).',
      coordinate: finalCoord,
      quality,
      movementState: 'stationary',
      calculatedSpeedMs: rawSpeedMs || 0,
      calculatedBearingDeg: rawHeading || 0,
    };
  }

  // 2. Temporal Validation (Prevent stale / out-of-order timestamps)
  const deltaTimeSeconds = (timestamp - (lastValidCoord.timestamp || timestamp)) / 1000;
  if (deltaTimeSeconds < 0) {
    return {
      accepted: false,
      reason: 'Leitura com timestamp anterior à última posição registrada.',
      coordinate: lastValidCoord,
      quality: lastValidCoord.quality || 'moderate',
      movementState: 'stationary',
      calculatedSpeedMs: 0,
      calculatedBearingDeg: lastValidCoord.heading || 0,
    };
  }

  // 3. Kinematic Distance & Implicit Speed Analysis
  const distanceMeters = calculateHaversineDistanceMeters(
    lastValidCoord.lat,
    lastValidCoord.lng,
    lat,
    lng
  );

  const effectiveDeltaTime = Math.max(deltaTimeSeconds, 0.2); // Avoid division by zero
  const calculatedSpeedMs = distanceMeters / effectiveDeltaTime;

  // 4. Anti-Drift / Teleportation Jump Filter
  // If implied velocity exceeds physical limit (216 km/h = 60 m/s) AND accuracy is not ultra-precise:
  if (calculatedSpeedMs > GPS_CONFIG.MAX_PLAUSIBLE_SPEED_MS && accuracy > 15) {
    console.warn(
      `[GPS Engine] Salto espúrio rejeitado: deslocamento de ${distanceMeters.toFixed(1)}m em ${effectiveDeltaTime.toFixed(1)}s (vel: ${(calculatedSpeedMs * 3.6).toFixed(0)} km/h, precisão: ±${accuracy}m)`
    );

    return {
      accepted: false,
      reason: `Salto repentino de posição detectado (${(calculatedSpeedMs * 3.6).toFixed(0)} km/h com precisão ±${accuracy}m). Posição anterior preservada.`,
      coordinate: lastValidCoord,
      quality: 'poor',
      movementState: (lastValidCoord.speed || 0) > 15 ? 'vehicle' : 'stationary',
      calculatedSpeedMs: (lastValidCoord.speed || 0) / 3.6,
      calculatedBearingDeg: lastValidCoord.heading || 0,
    };
  }

  // 5. Stationary Deadband Check (Power & Noise Filter)
  // If position jitter is < 0.6m while stationary and delta time is small, keep last coordinate
  const currentSpeedMs = rawSpeedMs !== null ? rawSpeedMs : calculatedSpeedMs;
  if (
    distanceMeters < GPS_CONFIG.STATIONARY_DISTANCE_DEADBAND_M &&
    currentSpeedMs < GPS_CONFIG.STATIONARY_SPEED_THRESHOLD_MS &&
    deltaTimeSeconds < 3 &&
    !options?.isRecordingTrack
  ) {
    return {
      accepted: true,
      coordinate: {
        ...lastValidCoord,
        accuracy: Math.min(lastValidCoord.accuracy || accuracy, accuracy),
        timestamp,
      },
      quality,
      movementState: 'stationary',
      calculatedSpeedMs: 0,
      calculatedBearingDeg: lastValidCoord.heading || 0,
    };
  }

  // 6. Movement State & Bearing Determination
  let movementState: GpsMovementState = 'stationary';
  if (currentSpeedMs > GPS_CONFIG.MAX_WALKING_SPEED_MS) {
    movementState = 'vehicle';
  } else if (currentSpeedMs > GPS_CONFIG.STATIONARY_SPEED_THRESHOLD_MS) {
    movementState = 'walking';
  }

  const calculatedBearing =
    distanceMeters > 1.0
      ? calculateBearingDegrees(lastValidCoord.lat, lastValidCoord.lng, lat, lng)
      : rawHeading !== null
      ? rawHeading
      : lastValidCoord.heading || 0;

  const finalSpeedKmH = +(currentSpeedMs * 3.6).toFixed(1);

  const finalCoord: GeoCoordinate = {
    lat,
    lng,
    altitude,
    accuracy,
    speed: finalSpeedKmH,
    heading: rawHeading !== null ? +rawHeading.toFixed(1) : calculatedBearing,
    timestamp,
    quality,
    isSimulated: !!options?.isSimulated,
  };

  return {
    accepted: true,
    coordinate: finalCoord,
    quality,
    movementState,
    calculatedSpeedMs: currentSpeedMs,
    calculatedBearingDeg: finalCoord.heading || 0,
  };
}

/**
 * Visual Marker Smoothing Filter (Weighted Exponential Smoothing)
 * Smooths the UI presentation marker without altering the authentic underlying geodetic coordinate
 */
export function smoothMarkerPosition(
  currentSmoothed: { lat: number; lng: number } | null,
  targetRaw: { lat: number; lng: number },
  movementState: GpsMovementState = 'walking'
): { lat: number; lng: number } {
  if (!currentSmoothed) {
    return { lat: targetRaw.lat, lng: targetRaw.lng };
  }

  const alpha =
    movementState === 'stationary'
      ? GPS_CONFIG.SMOOTHING_FACTOR_STATIONARY
      : GPS_CONFIG.SMOOTHING_FACTOR_ACTIVE;

  const smoothedLat = currentSmoothed.lat + alpha * (targetRaw.lat - currentSmoothed.lat);
  const smoothedLng = currentSmoothed.lng + alpha * (targetRaw.lng - currentSmoothed.lng);

  return {
    lat: +smoothedLat.toFixed(7),
    lng: +smoothedLng.toFixed(7),
  };
}

/**
 * Human-readable Portuguese label for GPS Signal Quality
 */
export function getGpsQualityLabel(quality: GpsQualityLevel): {
  label: string;
  badgeClass: string;
  dotColor: string;
} {
  switch (quality) {
    case 'excellent':
      return {
        label: 'Excelente (Submétrica)',
        badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        dotColor: 'bg-emerald-400',
      };
    case 'good':
      return {
        label: 'Boa (Campo Confiável)',
        badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
        dotColor: 'bg-sky-400',
      };
    case 'moderate':
      return {
        label: 'Moderada (Atenção)',
        badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        dotColor: 'bg-amber-400',
      };
    case 'low':
      return {
        label: 'Baixa Precisão',
        badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
        dotColor: 'bg-orange-400',
      };
    case 'poor':
    case 'invalid':
    default:
      return {
        label: 'Sinal Fraco / Indisponível',
        badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        dotColor: 'bg-rose-400',
      };
  }
}
