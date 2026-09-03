import { Geolocation } from '@capacitor/geolocation';
import { GeoCoordinate, Track, TrackPoint } from '../types';
import { validateAndProcessGpsReading, GPS_CONFIG } from '../utils/gpsEngine';
import { calculateDistanceMeters } from '../utils/geoUtils';
import { saveActiveTrackDraft, clearActiveTrackDraft, loadActiveTrackDraft } from '../utils/stateStorage';

export type TrackingStatus = 'idle' | 'tracking' | 'recording' | 'paused';

export interface LocationTrackingCallbacks {
  onGpsUpdate?: (coord: GeoCoordinate) => void;
  onHeadingUpdate?: (heading: number) => void;
  onTrackPointAdded?: (point: TrackPoint, totalTrack: Track) => void;
  onTrackStatsUpdate?: (track: Track) => void;
  onStatusChange?: (status: TrackingStatus) => void;
  onError?: (error: Error | GeolocationPositionError) => void;
}

class LocationTrackingService {
  private static instance: LocationTrackingService | null = null;

  private watchId: number | null = null;
  private simInterval: number | null = null;
  private durationTimer: number | null = null;
  private checkpointTimer: number | null = null;

  private currentStatus: TrackingStatus = 'idle';
  private currentUserId: string | null = null;

  private lastValidCoord: GeoCoordinate | null = null;
  private lastHeading: number | null = null;
  private activeTrack: Track | null = null;
  private isSimulated: boolean = false;
  private isManualLocked: boolean = false;

  private listeners: Set<LocationTrackingCallbacks> = new Set();
  private pointsSinceLastCheckpoint: number = 0;

  private constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
    if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientationabsolute', this.handleDeviceOrientation.bind(this), true);
      window.addEventListener('deviceorientation', this.handleDeviceOrientation.bind(this), true);
    }
  }

  private handleDeviceOrientation(event: DeviceOrientationEvent) {
    let heading = null;
    const ev = event as any;
    if (ev.webkitCompassHeading !== undefined) {
      heading = ev.webkitCompassHeading;
    } else if (ev.alpha !== null) {
      // Convert standard alpha (0 is East or varying) to compass heading (0 is North) if absolute
      heading = 360 - ev.alpha;
    }
    if (heading !== null) {
      this.lastHeading = heading;
      for (const l of this.listeners) {
        try {
          l.onHeadingUpdate?.(heading);
        } catch (err) { }
      }
    }
  }

  public static getInstance(): LocationTrackingService {
    if (!LocationTrackingService.instance) {
      LocationTrackingService.instance = new LocationTrackingService();
    }
    return LocationTrackingService.instance;
  }

  public getLastCoord(): GeoCoordinate | null {
    return this.lastValidCoord;
  }

  public getLastHeading(): number | null {
    return this.lastHeading;
  }

  public setUserId(userId: string | null) {
    this.currentUserId = userId;
  }

  public subscribe(callbacks: LocationTrackingCallbacks): () => void {
    this.listeners.add(callbacks);
    if (this.lastValidCoord && callbacks.onGpsUpdate) {
      callbacks.onGpsUpdate(this.lastValidCoord);
    }
    if (this.lastHeading !== null && callbacks.onHeadingUpdate) {
      callbacks.onHeadingUpdate(this.lastHeading);
    }
    if (this.activeTrack && callbacks.onTrackStatsUpdate) {
      callbacks.onTrackStatsUpdate(this.activeTrack);
    }
    if (callbacks.onStatusChange) {
      callbacks.onStatusChange(this.currentStatus);
    }

    return () => {
      this.listeners.delete(callbacks);
    };
  }

  private notifyGps(coord: GeoCoordinate) {
    for (const l of this.listeners) {
      try {
        l.onGpsUpdate?.(coord);
      } catch (err) {
        console.error('[LocationTrackingService] Listener onGpsUpdate error:', err);
      }
    }
  }

  private notifyPointAdded(point: TrackPoint, track: Track) {
    for (const l of this.listeners) {
      try {
        l.onTrackPointAdded?.(point, track);
      } catch (err) {
        console.error('[LocationTrackingService] Listener onTrackPointAdded error:', err);
      }
    }
  }

  private notifyTrackStats(track: Track) {
    for (const l of this.listeners) {
      try {
        l.onTrackStatsUpdate?.(track);
      } catch (err) {
        console.error('[LocationTrackingService] Listener onTrackStatsUpdate error:', err);
      }
    }
  }

  private notifyStatus(status: TrackingStatus) {
    this.currentStatus = status;
    for (const l of this.listeners) {
      try {
        l.onStatusChange?.(status);
      } catch (err) {
        console.error('[LocationTrackingService] Listener onStatusChange error:', err);
      }
    }
  }

  public async startGpsWatch(options: { isSimulated?: boolean; isManualLocked?: boolean } = {}) {
    this.isSimulated = !!options.isSimulated;
    this.isManualLocked = !!options.isManualLocked;

    if (this.isManualLocked) {
      return;
    }

    if (this.isSimulated) {
      this.stopHardwareWatch();
      this.startSimulationWatch();
      return;
    }

    this.stopSimulationWatch();

    if (this.watchId !== null) {
      return;
    }

    // Explicit native permission request for Capacitor Android/iOS
    try {
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted') {
        const req = await Geolocation.requestPermissions();
        if (req.location !== 'granted') {
          console.warn('[LocationTrackingService] Permissão de GPS negada pelo usuário.');
          return;
        }
      }
    } catch (permError) {
      console.warn('[LocationTrackingService] Erro ao checar permissões nativas (possivelmente rodando em desktop):', permError);
    }

    try {
      this.watchId = await Geolocation.watchPosition(
        GPS_CONFIG.WATCH_OPTIONS,
        (pos, err) => {
          if (err) {
            console.warn('[LocationTrackingService] Native geolocation error:', err);
            return;
          }
          if (pos) {
            this.handleRawPosition(pos as GeolocationPosition);
          }
        }
      ) as unknown as number;

      if (this.currentStatus === 'idle') {
        this.notifyStatus('tracking');
      }
    } catch (e) {
      console.error('[LocationTrackingService] Failed to start native watchPosition:', e);
    }
  }

  private handleRawPosition(rawPos: GeolocationPosition) {
    if (this.isManualLocked) return;

    const validation = validateAndProcessGpsReading(
      rawPos,
      this.lastValidCoord,
      { isSimulated: this.isSimulated, isRecordingTrack: this.currentStatus === 'recording' }
    );

    if (!validation.accepted) {
      return;
    }

    this.lastValidCoord = validation.coordinate;
    this.notifyGps(validation.coordinate);

    if (this.currentStatus === 'recording' && this.activeTrack) {
      this.appendPointToActiveTrack(validation.coordinate);
    }
  }

  private appendPointToActiveTrack(coord: GeoCoordinate) {
    if (!this.activeTrack) return;

    if (coord.accuracy && coord.accuracy > 35) {
      return;
    }

    const points = this.activeTrack.points;
    const lastPoint = points.length > 0 ? points[points.length - 1] : null;

    if (lastPoint) {
      const distFromLastMeters = calculateDistanceMeters(
        lastPoint.lat,
        lastPoint.lng,
        coord.lat,
        coord.lng
      );

      const moveThreshold = Math.max(2.5, (coord.accuracy || 3) * 0.35);
      if (distFromLastMeters < moveThreshold) {
        return;
      }

      const timeDeltaSec = Math.max(0.2, (coord.timestamp - lastPoint.timestamp) / 1000);
      const impliedSpeedMs = distFromLastMeters / timeDeltaSec;
      if (impliedSpeedMs > GPS_CONFIG.MAX_PLAUSIBLE_SPEED_MS) {
        console.warn(`[LocationTrackingService] Implausible track point jump: ${distFromLastMeters.toFixed(1)}m in ${timeDeltaSec.toFixed(1)}s. Rejected.`);
        return;
      }

      const distIncKm = distFromLastMeters / 1000;
      const newTotalKm = +(this.activeTrack.distanceKm + distIncKm).toFixed(3);

      const altDiff = (coord.altitude || 1250) - (lastPoint.altitude || 1250);
      const elevationGainM = altDiff > 0 ? this.activeTrack.elevationGainM + Math.round(altDiff) : this.activeTrack.elevationGainM;
      const elevationLossM = altDiff < 0 ? this.activeTrack.elevationLossM + Math.round(Math.abs(altDiff)) : this.activeTrack.elevationLossM;

      const newPoint: TrackPoint = {
        lat: coord.lat,
        lng: coord.lng,
        altitude: coord.altitude || 1250,
        speed: coord.speed || 0,
        timestamp: coord.timestamp || Date.now(),
      };

      this.activeTrack = {
        ...this.activeTrack,
        points: [...this.activeTrack.points, newPoint],
        distanceKm: newTotalKm,
        elevationGainM,
        elevationLossM,
      };

      this.notifyPointAdded(newPoint, this.activeTrack);
    } else {
      const firstPoint: TrackPoint = {
        lat: coord.lat,
        lng: coord.lng,
        altitude: coord.altitude || 1250,
        speed: coord.speed || 0,
        timestamp: coord.timestamp || Date.now(),
      };

      this.activeTrack = {
        ...this.activeTrack,
        points: [firstPoint],
      };

      this.notifyPointAdded(firstPoint, this.activeTrack);
    }

    this.pointsSinceLastCheckpoint++;
    if (this.pointsSinceLastCheckpoint >= 10) {
      this.persistActiveTrackCheckpoint();
    }
  }

  public startRecording(initialTrack: Track) {
    this.activeTrack = initialTrack;
    this.pointsSinceLastCheckpoint = 0;
    this.notifyStatus('recording');
    this.startDurationTimer();
    this.startPeriodicCheckpointTimer();

    if (this.lastValidCoord) {
      this.appendPointToActiveTrack(this.lastValidCoord);
    }

    this.persistActiveTrackCheckpoint();
  }

  public pauseRecording() {
    if (this.currentStatus !== 'recording') return;
    this.notifyStatus('paused');
    this.stopDurationTimer();
    this.persistActiveTrackCheckpoint();
  }

  public resumeRecording() {
    if (this.currentStatus !== 'paused') return;
    this.notifyStatus('recording');
    this.startDurationTimer();
  }

  public stopRecording(): Track | null {
    const finishedTrack = this.activeTrack;
    this.activeTrack = null;
    this.pointsSinceLastCheckpoint = 0;
    this.stopDurationTimer();
    this.stopPeriodicCheckpointTimer();
    this.notifyStatus(this.watchId !== null ? 'tracking' : 'idle');

    clearActiveTrackDraft(this.currentUserId);

    return finishedTrack;
  }

  public getActiveTrack(): Track | null {
    return this.activeTrack;
  }

  public getStatus(): TrackingStatus {
    return this.currentStatus;
  }

  public getLastValidCoordinate(): GeoCoordinate | null {
    return this.lastValidCoord;
  }

  public async restoreTrackDraft(): Promise<Track | null> {
    const draft = await loadActiveTrackDraft<Track>(this.currentUserId);
    if (draft && draft.points && draft.points.length > 0) {
      this.activeTrack = draft;
      this.notifyStatus('paused');
      this.notifyTrackStats(draft);
      return draft;
    }
    return null;
  }

  private startDurationTimer() {
    this.stopDurationTimer();
    this.durationTimer = window.setInterval(() => {
      if (this.currentStatus === 'recording' && this.activeTrack) {
        const newDuration = this.activeTrack.durationSeconds + 1;
        const avgSpeed = newDuration > 0 && this.activeTrack.distanceKm > 0
          ? +((this.activeTrack.distanceKm / (newDuration / 3600))).toFixed(1)
          : this.activeTrack.avgSpeedKmh;

        this.activeTrack = {
          ...this.activeTrack,
          durationSeconds: newDuration,
          avgSpeedKmh: avgSpeed,
        };

        this.notifyTrackStats(this.activeTrack);
      }
    }, 1000);
  }

  private stopDurationTimer() {
    if (this.durationTimer !== null) {
      clearInterval(this.durationTimer);
      this.durationTimer = null;
    }
  }

  private startPeriodicCheckpointTimer() {
    this.stopPeriodicCheckpointTimer();
    this.checkpointTimer = window.setInterval(() => {
      if (this.activeTrack) {
        this.persistActiveTrackCheckpoint();
      }
    }, 15000);
  }

  private stopPeriodicCheckpointTimer() {
    if (this.checkpointTimer !== null) {
      clearInterval(this.checkpointTimer);
      this.checkpointTimer = null;
    }
  }

  private async persistActiveTrackCheckpoint() {
    if (!this.activeTrack) return;
    this.pointsSinceLastCheckpoint = 0;
    try {
      await saveActiveTrackDraft(this.activeTrack, this.currentUserId);
    } catch (e) {
      console.warn('[LocationTrackingService] Checkpoint save error:', e);
    }
  }

  private startSimulationWatch() {
    this.stopSimulationWatch();
    let simLat = this.lastValidCoord?.lat || -23.5505;
    let simLng = this.lastValidCoord?.lng || -46.6333;

    this.simInterval = window.setInterval(() => {
      if (this.isManualLocked || (typeof document !== 'undefined' && document.visibilityState === 'hidden' && this.currentStatus !== 'recording')) {
        return;
      }

      simLat += (Math.random() - 0.48) * 0.0001;
      simLng += (Math.random() - 0.48) * 0.0001;

      const simCoord: GeoCoordinate = {
        lat: simLat,
        lng: simLng,
        altitude: Math.round(1280 + (Math.random() - 0.5) * 4),
        accuracy: +(1.5 + Math.random() * 1.5).toFixed(1),
        speed: +(3.5 + Math.random() * 2.0).toFixed(1),
        timestamp: Date.now(),
        isSimulated: true,
      };

      this.lastValidCoord = simCoord;
      this.notifyGps(simCoord);

      if (this.currentStatus === 'recording' && this.activeTrack) {
        this.appendPointToActiveTrack(simCoord);
      }
    }, 2000);
  }

  private stopSimulationWatch() {
    if (this.simInterval !== null) {
      clearInterval(this.simInterval);
      this.simInterval = null;
    }
  }

  private stopHardwareWatch() {
    if (this.watchId !== null) {
      Geolocation.clearWatch({ id: this.watchId as unknown as string }).catch(console.error);
      this.watchId = null;
    }
  }

  public stopAll() {
    this.stopHardwareWatch();
    this.stopSimulationWatch();
    this.stopDurationTimer();
    this.stopPeriodicCheckpointTimer();
    this.notifyStatus('idle');
  }

  private handleVisibilityChange = () => {
    if (typeof document === 'undefined') return;
    if (document.visibilityState === 'hidden') {
      if (this.currentStatus !== 'recording') {
        this.stopHardwareWatch();
        this.stopSimulationWatch();
      }
    } else if (document.visibilityState === 'visible') {
      if (this.watchId === null && !this.isSimulated && !this.isManualLocked) {
        this.startGpsWatch({ isSimulated: this.isSimulated, isManualLocked: this.isManualLocked });
      }
    }
  };
}

export const locationTrackingService = LocationTrackingService.getInstance();
