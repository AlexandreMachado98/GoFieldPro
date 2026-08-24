import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { saveAppState, loadAppState } from '../utils/stateStorage';
import {
  ProjectFolder,
  LayerItem,
  Waypoint,
  Track,
  TeamMember,
  FieldNotification,
  UserRole,
  Language,
  BasemapType,
  NavigationTarget,
  GeoCoordinate,
  OfflineSyncItem,
  PDFMapOverlay,
  KMLFeature,
  ToastMessage,
  ConfirmDialogConfig,
  FieldRound,
  AppSettings,
} from '../types';
import {
  initialProjects,
  initialLayers,
  initialWaypoints,
  initialTracks,
  initialTeamMembers,
  initialNotifications,
  initialFieldRounds,
} from '../data/mockData';
import { translations } from '../i18n/translations';
import {
  calculateDistanceMeters,
  calculateBearingDegrees,
  bearingToCardinal,
  calculateCrossTrackError,
} from '../utils/geoUtils';
import confetti from 'canvas-confetti';

interface AppContextType {
  // Localization & Role
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations['pt'];
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;

  // Active View Tab
  activeTab: 'home' | 'map' | 'pdf_maps' | 'layers' | 'tracks' | 'field_rounds' | 'team' | 'reports' | 'analytics' | 'offline';
  setActiveTab: (tab: 'home' | 'map' | 'pdf_maps' | 'layers' | 'tracks' | 'field_rounds' | 'team' | 'reports' | 'analytics' | 'offline') => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (isOpen: boolean) => void;

  // Field Trips / Rodada de Campo (Quilometragem)
  fieldRounds: FieldRound[];
  addFieldRound: (round: Omit<FieldRound, 'id' | 'createdAt' | 'updatedAt' | 'totalKm'>) => void;
  updateFieldRound: (id: string, round: Partial<FieldRound>) => void;
  deleteFieldRound: (id: string) => void;
  addPhotoToFieldRound: (id: string, photoBase64: string) => void;

  // Projects
  projects: ProjectFolder[];
  activeProject: ProjectFolder;
  setActiveProject: (proj: ProjectFolder) => void;
  createProject: (newProj: Omit<ProjectFolder, 'id' | 'createdAt' | 'updatedAt' | 'stats'>) => void;

  // Map Basemap & Center
  basemap: BasemapType;
  setBasemap: (base: BasemapType) => void;
  mapCenter: GeoCoordinate;
  setMapCenter: (coord: GeoCoordinate) => void;
  mapZoom: number;
  setMapZoom: (zoom: number) => void;

  // Layers & Maps (PDF / KML / KMZ)
  layers: LayerItem[];
  toggleLayerVisibility: (layerId: string) => void;
  setLayerOpacity: (layerId: string, opacity: number) => void;
  addLayer: (layer: LayerItem) => void;
  removeLayer: (layerId: string) => void;
  calibratePdfOverlay: (layerId: string, bounds: [[number, number], [number, number]]) => void;

  // Waypoints
  waypoints: Waypoint[];
  addWaypoint: (wp: Omit<Waypoint, 'id' | 'createdAt' | 'synced' | 'encrypted'>) => void;
  deleteWaypoint: (id: string) => void;
  updateWaypointStatus: (id: string, status: Waypoint['status']) => void;

  // Real-time GPS & Track Recording
  currentGps: GeoCoordinate;
  isGpsSimulated: boolean;
  hasGpsLock: boolean;
  isManualGpsLocked: boolean;
  setIsGpsSimulated: (sim: boolean) => void;
  requestCurrentLocation: () => Promise<GeoCoordinate | null>;
  setManualGpsLocation: (coord: GeoCoordinate) => void;
  unlockDeviceGps: () => void;
  isRecordingTrack: boolean;
  isRecordingPaused: boolean;
  activeTrack: Track | null;
  startTrackRecording: (name: string) => void;
  pauseTrackRecording: () => void;
  resumeTrackRecording: () => void;
  stopTrackRecording: () => void;
  savedTracks: Track[];

  // Navigation HUD
  navTarget: NavigationTarget | null;
  setNavTarget: (target: NavigationTarget | null) => void;
  navigateToWaypoint: (wp: Waypoint) => void;
  navigateToLayerFeature: (feat: KMLFeature) => void;
  cancelNavigation: () => void;
  cycleNextPoint: () => void;
  cyclePrevPoint: () => void;

  // Offline Mode & Sync Queue
  isOffline: boolean;
  setIsOffline: (offline: boolean) => void;
  offlineQueue: OfflineSyncItem[];
  isSyncing: boolean;
  triggerManualSync: () => Promise<void>;
  cachedStorageMB: number;

  // Remote Team & SOS
  teamMembers: TeamMember[];
  sosActive: boolean;
  triggerSosBeacon: () => void;
  cancelSosBeacon: () => void;
  radioMessages: { id: string; sender: string; text: string; time: string; avatar?: string }[];
  sendRadioMessage: (text: string) => void;

  // Security E2EE
  e2eeEnabled: boolean;
  setE2eeEnabled: (enabled: boolean) => void;

  // Notifications & Styled Toasts
  notifications: FieldNotification[];
  unreadNotificationsCount: number;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  clearAllNotifications: () => void;
  addNotification: (notif: Omit<FieldNotification, 'id' | 'timestamp' | 'read'>) => void;
  toasts: ToastMessage[];
  notify: (toast: {
    title: string;
    message: string;
    type?: ToastMessage['type'];
    duration?: number;
    silentInHistory?: boolean;
    coordinates?: GeoCoordinate;
  }) => void;
  notifySuccess: (title: string, message: string) => void;
  notifyError: (title: string, message: string) => void;
  notifyWarning: (title: string, message: string) => void;
  notifyInfo: (title: string, message: string) => void;
  dismissToast: (id: string) => void;

  // App Settings
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (open: boolean) => void;

  // Confirm Modal
  confirmDialog: ConfirmDialogConfig;
  showConfirm: (config: Omit<ConfirmDialogConfig, 'isOpen'>) => void;
  closeConfirm: () => void;

  // Modals & Panels
  isAiModalOpen: boolean;
  setIsAiModalOpen: (open: boolean) => void;
  isAddWaypointModalOpen: boolean;
  setIsAddWaypointModalOpen: (open: boolean) => void;
  isLayerModalOpen: boolean;
  setIsLayerModalOpen: (open: boolean) => void;
  isReportModalOpen: boolean;
  setIsReportModalOpen: (open: boolean) => void;
  isMeasuring: boolean;
  setIsMeasuring: (measuring: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Localization & Role
  const [language, setLanguage] = useState<Language>('pt');
  const [currentRole, setCurrentRole] = useState<UserRole>('super_admin');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'map' | 'pdf_maps' | 'layers' | 'tracks' | 'team' | 'reports' | 'analytics' | 'offline'>('home');

  // Translation helper
  const [pdfFiles, setPdfFiles] = useState<{ id: string, name: string, dataUrl: string, width?: number, height?: number }[]>([]);
  const addPdfFile = (pdf: { id: string, name: string, dataUrl: string, width?: number, height?: number }) => setPdfFiles(prev => [...prev, pdf]);
  const t = translations[language] || translations.pt;

  // Projects
  const [projects, setProjects] = useState<ProjectFolder[]>(initialProjects);
  const [activeProject, setActiveProject] = useState<ProjectFolder>(initialProjects[0]);

  // Basemap & Viewport
  const [basemap, setBasemap] = useState<BasemapType>('satellite');
  const [mapCenter, setMapCenter] = useState<GeoCoordinate>(initialProjects[0].centerCoordinate);
  const [mapZoom, setMapZoom] = useState<number>(initialProjects[0].zoomLevel);

  // Layers & Overlays
  const [layers, setLayers] = useState<LayerItem[]>(initialLayers);

  // Waypoints & Tracks
  const [waypoints, setWaypoints] = useState<Waypoint[]>(initialWaypoints);
  const [savedTracks, setSavedTracks] = useState<Track[]>(initialTracks);

  const [isManualGpsLocked, setIsManualGpsLocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem('geofield_manual_gps_locked') === 'true';
    } catch {
      return false;
    }
  });
  const isManualGpsLockedRef = useRef<boolean>(isManualGpsLocked);
  isManualGpsLockedRef.current = isManualGpsLocked;

  // Live GPS Tracking & Simulation
  const [currentGps, setCurrentGps] = useState<GeoCoordinate>(() => {
    try {
      const isLocked = localStorage.getItem('geofield_manual_gps_locked') === 'true';
      const savedCoord = localStorage.getItem('geofield_manual_gps_coord');
      if (isLocked && savedCoord) {
        const parsed = JSON.parse(savedCoord);
        if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          return parsed;
        }
      }
    } catch {}
    return {
      lat: -20.2541,
      lng: -46.5823,
      altitude: 1280,
      accuracy: 1.8,
      timestamp: Date.now(),
    };
  });
  const [isGpsSimulated, setIsGpsSimulated] = useState<boolean>(false);
  const [hasGpsLock, setHasGpsLock] = useState<boolean>(() => {
    try {
      return localStorage.getItem('geofield_manual_gps_locked') === 'true';
    } catch {
      return false;
    }
  });

  // Track Recording
  const [isRecordingTrack, setIsRecordingTrack] = useState<boolean>(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState<boolean>(false);
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);

  // Navigation Target HUD
  const [navTarget, setNavTarget] = useState<NavigationTarget | null>(null);

  // Offline Engine & Sync Queue
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [offlineQueue, setOfflineQueue] = useState<OfflineSyncItem[]>([
    {
      id: 'sync-01',
      entityType: 'waypoint',
      action: 'create',
      data: { name: 'Ponto CAN-04' },
      timestamp: Date.now() - 3600000,
      retryCount: 0,
      status: 'pending',
    },
  ]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [cachedStorageMB, setCachedStorageMB] = useState<number>(34.2);

  // Team & SOS
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(initialTeamMembers);
  const [sosActive, setSosActive] = useState<boolean>(false);
  const [radioMessages, setRadioMessages] = useState<{ id: string; sender: string; text: string; time: string; avatar?: string }[]>([
    { id: 'rad-1', sender: 'Carlos Silva (Líder)', text: 'Equipe Alpha chegando à nascente do São Francisco. Coleta iniciada.', time: '10:14', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80' },
    { id: 'rad-2', sender: 'Marcos Lima', text: 'Alerta na trilha baixa: queda de barreira com pedras no km 4. Registrando ponto.', time: '14:08', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80' },
    { id: 'rad-3', sender: 'Dra. Ana Nery (Base)', text: 'Copiado Marcos. Ortomosaico de drone sendo direcionado para o setor.', time: '14:10', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80' },
  ]);

  // Security E2EE
  const [e2eeEnabled, setE2eeEnabled] = useState<boolean>(true);

  // Field Trips / Rodadas de Campo (Quilometragem Diária)
  const [fieldRounds, setFieldRounds] = useState<FieldRound[]>(() => {
    try {
      const saved = localStorage.getItem('geofield_field_rounds');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Error reading saved field rounds from storage', e);
    }
    return initialFieldRounds;
  });

  useEffect(() => {
    try {
      localStorage.setItem('geofield_field_rounds', JSON.stringify(fieldRounds));
    } catch (e) {
      console.warn('Error persisting field rounds', e);
    }
  }, [fieldRounds]);

  // Notifications & Styled Toasts
  const [notifications, setNotifications] = useState<FieldNotification[]>(initialNotifications);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Global Confirmation Dialog Modal
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogConfig>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    ({
      title,
      message,
      type = 'info',
      duration = 4500,
      silentInHistory = false,
      coordinates,
    }: {
      title: string;
      message: string;
      type?: ToastMessage['type'];
      duration?: number;
      silentInHistory?: boolean;
      coordinates?: GeoCoordinate;
    }) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newToast: ToastMessage = {
        id,
        title,
        message,
        type,
        duration,
        createdAt: Date.now(),
      };

      setToasts((prev) => [newToast, ...prev.slice(0, 4)]);

      if (!silentInHistory) {
        const notif: FieldNotification = {
          id: `notif-${Date.now()}`,
          title,
          message,
          type,
          timestamp: new Date().toISOString(),
          read: false,
          coordinates,
        };
        setNotifications((prev) => [notif, ...prev]);
      }
    },
    []
  );

  const notifySuccess = useCallback(
    (title: string, message: string) => notify({ title, message, type: 'success' }),
    [notify]
  );
  const notifyError = useCallback(
    (title: string, message: string) => notify({ title, message, type: 'error', duration: 5500 }),
    [notify]
  );
  const notifyWarning = useCallback(
    (title: string, message: string) => notify({ title, message, type: 'warning' }),
    [notify]
  );
  const notifyInfo = useCallback(
    (title: string, message: string) => notify({ title, message, type: 'info' }),
    [notify]
  );

  const showConfirm = useCallback(
    (config: Omit<ConfirmDialogConfig, 'isOpen'>) => {
      setConfirmDialog({
        ...config,
        isOpen: true,
      });
    },
    []
  );

  const closeConfirm = useCallback(() => {
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // Modals
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [isAddWaypointModalOpen, setIsAddWaypointModalOpen] = useState<boolean>(false);
  const [isLayerModalOpen, setIsLayerModalOpen] = useState<boolean>(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isMeasuring, setIsMeasuring] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);

  // App Settings with LocalStorage persistence
  const [settings, setSettings] = useState<AppSettings>(() => {
    const defaultSettings: AppSettings = {
      coordinateFormat: 'DD',
      gpsAccuracyMode: 'high',
      gpsUpdateIntervalMs: 1000,
      trackMinDistanceMeters: 3,
      autoCenterGps: true,
      keepScreenAwake: false,
      defaultMarkerColor: '#0284c7',
      unitSystem: 'metric',
      pdfRenderQuality: 'normal',
      photoQuality: 'medium',
    };
    try {
      const saved = localStorage.getItem('gofield_app_settings');
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  // IndexedDB Persistence for core collections
  const [isStateLoaded, setIsStateLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const savedLayers = await loadAppState<LayerItem[]>('geofield_layers');
      if (savedLayers && savedLayers.length > 0) setLayers(savedLayers);
      
      const savedProjects = await loadAppState<ProjectFolder[]>('geofield_projects');
      if (savedProjects && savedProjects.length > 0) setProjects(savedProjects);
      
      const savedWaypoints = await loadAppState<Waypoint[]>('geofield_waypoints');
      if (savedWaypoints && savedWaypoints.length > 0) setWaypoints(savedWaypoints);
      
      const savedTracks = await loadAppState<Track[]>('geofield_savedTracks');
      if (savedTracks && savedTracks.length > 0) setSavedTracks(savedTracks);

      setIsStateLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!isStateLoaded) return;
    saveAppState('geofield_layers', layers);
  }, [layers, isStateLoaded]);

  useEffect(() => {
    if (!isStateLoaded) return;
    saveAppState('geofield_projects', projects);
  }, [projects, isStateLoaded]);

  useEffect(() => {
    if (!isStateLoaded) return;
    saveAppState('geofield_waypoints', waypoints);
  }, [waypoints, isStateLoaded]);

  useEffect(() => {
    if (!isStateLoaded) return;
    saveAppState('geofield_savedTracks', savedTracks);
  }, [savedTracks, isStateLoaded]);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...partial };
      try {
        localStorage.setItem('gofield_app_settings', JSON.stringify(updated));
      } catch (e) {
        console.warn('Error saving settings', e);
      }
      return updated;
    });
  }, []);

  // Update map viewport when active project changes
  useEffect(() => {
    setMapCenter(activeProject.centerCoordinate);
    setMapZoom(activeProject.zoomLevel);
  }, [activeProject]);

  // Real or Simulated GPS Position loop
  const setManualGpsLocation = useCallback(
    (coord: GeoCoordinate) => {
      const updatedCoord: GeoCoordinate = {
        lat: coord.lat,
        lng: coord.lng,
        altitude: coord.altitude || 1250,
        accuracy: coord.accuracy || 1.0,
        timestamp: Date.now(),
      };
      setCurrentGps(updatedCoord);
      setHasGpsLock(true);
      setIsManualGpsLocked(true);
      isManualGpsLockedRef.current = true;
      try {
        localStorage.setItem('geofield_manual_gps_locked', 'true');
        localStorage.setItem('geofield_manual_gps_coord', JSON.stringify(updatedCoord));
      } catch (e) {
        console.warn('Failed to save manual GPS to localStorage', e);
      }
      notifySuccess(
        'Posição Calibrada e Fixada',
        `GPS travado manualmente em Lat: ${coord.lat.toFixed(5)}°, Lng: ${coord.lng.toFixed(5)}°`
      );
    },
    [notifySuccess]
  );

  const requestCurrentLocation = useCallback(async (): Promise<GeoCoordinate | null> => {
    if (!navigator.geolocation) {
      notifyWarning('GPS Não Suportado', 'Geolocalização não é suportada neste navegador.');
      return null;
    }

    // If manual GPS is locked, return the user's calibrated coordinate
    if (isManualGpsLockedRef.current) {
      return currentGps;
    }

    return new Promise((resolve) => {
      // 1. First try High Accuracy (GNSS/GPS sensor)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (isManualGpsLockedRef.current) return;
          const coord: GeoCoordinate = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            altitude: pos.coords.altitude || 1250,
            accuracy: +(pos.coords.accuracy || 2.5).toFixed(1),
            timestamp: Date.now(),
          };
          setCurrentGps(coord);
          setHasGpsLock(true);
          resolve(coord);
        },
        (err) => {
          console.warn('High accuracy location failed, attempting standard accuracy:', err);
          // 2. Fallback to Standard Accuracy (Cell tower / Wi-Fi)
          navigator.geolocation.getCurrentPosition(
            (fallbackPos) => {
              if (isManualGpsLockedRef.current) return;
              const coord: GeoCoordinate = {
                lat: fallbackPos.coords.latitude,
                lng: fallbackPos.coords.longitude,
                altitude: fallbackPos.coords.altitude || 1250,
                accuracy: +(fallbackPos.coords.accuracy || 10.0).toFixed(1),
                timestamp: Date.now(),
              };
              setCurrentGps(coord);
              setHasGpsLock(true);
              resolve(coord);
            },
            async (finalErr) => {
              console.warn('Standard geolocation error, trying IP fallback:', finalErr);
              if (isManualGpsLockedRef.current) return;
              try {
                // 3. Fallback to IP Geolocation API if browser GPS is blocked/unsupported on desktop
                const res = await fetch('https://ipwho.is/');
                if (res.ok) {
                  const data = await res.json();
                  if (data && data.success && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
                    if (isManualGpsLockedRef.current) return;
                    const coord: GeoCoordinate = {
                      lat: data.latitude,
                      lng: data.longitude,
                      altitude: 700,
                      accuracy: 1500,
                      timestamp: Date.now(),
                    };
                    setCurrentGps(coord);
                    setHasGpsLock(true);
                    resolve(coord);
                    return;
                  }
                }
              } catch (ipErr) {
                console.warn('IP fallback failed:', ipErr);
              }
              resolve(null);
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
          );
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });
  }, [notifyWarning, currentGps]);

  const unlockDeviceGps = useCallback(() => {
    setIsManualGpsLocked(false);
    isManualGpsLockedRef.current = false;
    try {
      localStorage.removeItem('geofield_manual_gps_locked');
      localStorage.removeItem('geofield_manual_gps_coord');
    } catch {}
    notifyInfo('GPS em Tempo Real', 'Reconectando aos satélites do seu aparelho...');
    requestCurrentLocation();
  }, [notifyInfo, requestCurrentLocation]);

  useEffect(() => {
    let watchId: number | null = null;

    if (!isGpsSimulated && navigator.geolocation) {
      // 1. Kickstart immediately if not manually locked
      if (!isManualGpsLockedRef.current) {
        requestCurrentLocation();
      }

      // 2. Continuous watch position with auto-reconnect fallback
      const startWatch = (highAccuracy: boolean) => {
        return navigator.geolocation.watchPosition(
          (pos) => {
            // If the user locked their position manually, do NOT overwrite it!
            if (isManualGpsLockedRef.current) return;

            setCurrentGps({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              altitude: pos.coords.altitude || 1250,
              accuracy: +(pos.coords.accuracy || 2.0).toFixed(1),
              timestamp: Date.now(),
            });
            setHasGpsLock(true);
          },
          (err) => {
            console.warn(`Geolocation watcher warning (highAccuracy=${highAccuracy}):`, err);
            if (highAccuracy && watchId !== null && !isManualGpsLockedRef.current) {
              navigator.geolocation.clearWatch(watchId);
              watchId = startWatch(false);
            }
          },
          { enableHighAccuracy: highAccuracy, timeout: 15000, maximumAge: highAccuracy ? 2000 : 10000 }
        );
      };

      watchId = startWatch(true);
    } else if (isGpsSimulated) {
      // Gentle field surveyor wander simulation around active project
      const interval = setInterval(() => {
        if (isManualGpsLockedRef.current) return;

        setCurrentGps((prev) => {
          const deltaLat = (Math.random() - 0.5) * 0.00015;
          const deltaLng = (Math.random() - 0.5) * 0.00015;
          const newCoord: GeoCoordinate = {
            lat: prev.lat + deltaLat,
            lng: prev.lng + deltaLng,
            altitude: Math.round((prev.altitude || 1280) + (Math.random() - 0.5) * 2),
            accuracy: +(1.2 + Math.random() * 0.8).toFixed(1),
            timestamp: Date.now(),
          };

          // If recording track, append point
          if (isRecordingTrack && !isRecordingPaused && activeTrack) {
            setActiveTrack((curr) => {
              if (!curr) return null;
              const newPoints = [
                ...curr.points,
                {
                  lat: newCoord.lat,
                  lng: newCoord.lng,
                  altitude: newCoord.altitude || 1280,
                  speed: +(3.6 + Math.random() * 1.5).toFixed(1),
                  timestamp: Date.now(),
                },
              ];
              const distInc = calculateDistanceMeters(
                curr.points[curr.points.length - 1]?.lat || newCoord.lat,
                curr.points[curr.points.length - 1]?.lng || newCoord.lng,
                newCoord.lat,
                newCoord.lng
              ) / 1000;
              return {
                ...curr,
                points: newPoints,
                distanceKm: +(curr.distanceKm + distInc).toFixed(3),
                durationSeconds: curr.durationSeconds + 2,
              };
            });
          }

          return newCoord;
        });
      }, 3000);

      return () => clearInterval(interval);
    }

    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isGpsSimulated, isRecordingTrack, isRecordingPaused, activeTrack, requestCurrentLocation]);

  // Recalculate Navigation Target HUD metrics whenever GPS updates
  useEffect(() => {
    if (!navTarget) return;
    const dist = calculateDistanceMeters(currentGps.lat, currentGps.lng, navTarget.lat, navTarget.lng);
    const bearing = calculateBearingDegrees(currentGps.lat, currentGps.lng, navTarget.lat, navTarget.lng);
    const cardinal = bearingToCardinal(bearing);
    const etaMin = Math.max(1, Math.round(dist / (4000 / 60))); // assuming 4 km/h walking speed
    const xte = calculateCrossTrackError(
      currentGps.lat,
      currentGps.lng,
      currentGps.lat - 0.002,
      currentGps.lng - 0.002,
      navTarget.lat,
      navTarget.lng
    );

    setNavTarget((prev) =>
      prev
        ? {
            ...prev,
            distanceMeters: Math.round(dist),
            bearingDegrees: Math.round(bearing),
            azimuthString: `${Math.round(bearing)}° ${cardinal}`,
            estimatedTimeArrivalMin: etaMin,
            crossTrackErrorMeters: xte,
          }
        : null
    );
  }, [currentGps.lat, currentGps.lng]);

  // Layer Operations
  const toggleLayerVisibility = (layerId: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l))
    );
  };

  const setLayerOpacity = (layerId: string, opacity: number) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, opacity } : l))
    );
  };

  const addLayer = (layer: LayerItem) => {
    setLayers((prev) => [layer, ...prev]);
    addNotification({
      title: 'Nova Camada Importada',
      message: `Camada "${layer.name}" (${layer.type.toUpperCase()}) pronta para uso em campo.`,
      type: 'sync',
    });
  };

  const removeLayer = (layerId: string) => {
    const layerToRemove = layers.find((l) => l.id === layerId);
    setLayers((prev) => prev.filter((l) => l.id !== layerId));
    notifyInfo('Camada Removida', `A camada "${layerToRemove?.name || 'selecionada'}" foi descarregada.`);
  };

  const calibratePdfOverlay = (layerId: string, bounds: [[number, number], [number, number]]) => {
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id === layerId && l.pdfData) {
          return {
            ...l,
            pdfData: {
              ...l.pdfData,
              bounds,
              georeferenced: true,
            },
          };
        }
        return l;
      })
    );
  };

  // Waypoint Operations
  const addWaypoint = (wpData: Omit<Waypoint, 'id' | 'createdAt' | 'synced' | 'encrypted'>) => {
    const newId = `wp-${Date.now()}`;
    const newWaypoint: Waypoint = {
      ...wpData,
      id: newId,
      createdAt: new Date().toISOString(),
      synced: !isOffline,
      encrypted: e2eeEnabled,
      signatureHash: `SHA256-${Math.random().toString(36).substring(2, 12)}`,
    };

    setWaypoints((prev) => [newWaypoint, ...prev]);

    // If offline, push to sync queue
    if (isOffline) {
      setOfflineQueue((prev) => [
        {
          id: `queue-${Date.now()}`,
          entityType: 'waypoint',
          action: 'create',
          data: newWaypoint,
          timestamp: Date.now(),
          retryCount: 0,
          status: 'pending',
        },
        ...prev,
      ]);
    }

    addNotification({
      title: 'Ponto Registrado com Sucesso',
      message: `Ponto ${newWaypoint.code} (${newWaypoint.name}) registrado no projeto.`,
      type: 'geofence',
      coordinates: { lat: newWaypoint.lat, lng: newWaypoint.lng },
    });
  };

  const deleteWaypoint = (id: string) => {
    const wp = waypoints.find((w) => w.id === id);
    setWaypoints((prev) => prev.filter((w) => w.id !== id));
    notifyInfo('Ponto Excluído', `Ponto ${wp?.code || ''} removido com sucesso.`);
  };

  const updateWaypointStatus = (id: string, status: Waypoint['status']) => {
    setWaypoints((prev) =>
      prev.map((w) => (w.id === id ? { ...w, status } : w))
    );
  };

  // Track Recording Operations
  const startTrackRecording = (name: string) => {
    const trackId = `track-${Date.now()}`;
    const newTrack: Track = {
      id: trackId,
      projectId: activeProject.id,
      name: name || `Trilha de Campo ${new Date().toLocaleTimeString('pt-BR')}`,
      userId: 'user-01',
      userName: 'Carlos Silva (Líder)',
      startTime: new Date().toISOString(),
      points: [
        {
          lat: currentGps.lat,
          lng: currentGps.lng,
          altitude: currentGps.altitude || 1280,
          speed: 3.5,
          timestamp: Date.now(),
        },
      ],
      distanceKm: 0,
      durationSeconds: 0,
      avgSpeedKmh: 3.8,
      maxSpeedKmh: 4.5,
      elevationGainM: 0,
      elevationLossM: 0,
      color: '#0284c7',
      visible: true,
      synced: !isOffline,
      tags: ['Operação de Campo', 'Rastreio Tempo Real'],
    };

    setActiveTrack(newTrack);
    setIsRecordingTrack(true);
    setIsRecordingPaused(false);
  };

  const pauseTrackRecording = () => {
    setIsRecordingPaused(true);
  };

  const resumeTrackRecording = () => {
    setIsRecordingPaused(false);
  };

  const stopTrackRecording = () => {
    if (activeTrack) {
      const finished: Track = {
        ...activeTrack,
        endTime: new Date().toISOString(),
        synced: !isOffline,
      };
      setSavedTracks((prev) => [finished, ...prev]);

      if (isOffline) {
        setOfflineQueue((prev) => [
          {
            id: `queue-track-${Date.now()}`,
            entityType: 'track',
            action: 'create',
            data: finished,
            timestamp: Date.now(),
            retryCount: 0,
            status: 'pending',
          },
          ...prev,
        ]);
      }

      addNotification({
        title: 'Trilha Concluída e Gravada',
        message: `Trilha "${finished.name}" salva com ${finished.distanceKm.toFixed(2)} km de percurso.`,
        type: 'sync',
      });
    }
    setActiveTrack(null);
    setIsRecordingTrack(false);
    setIsRecordingPaused(false);
  };

  // Navigation Target Operations
  const navigateToWaypoint = (wp: Waypoint) => {
    const dist = calculateDistanceMeters(currentGps.lat, currentGps.lng, wp.lat, wp.lng);
    const bearing = calculateBearingDegrees(currentGps.lat, currentGps.lng, wp.lat, wp.lng);
    const cardinal = bearingToCardinal(bearing);
    const etaMin = Math.max(1, Math.round(dist / (4000 / 60)));

    setNavTarget({
      id: wp.id,
      name: `${wp.code} - ${wp.name}`,
      lat: wp.lat,
      lng: wp.lng,
      altitude: wp.altitude,
      category: wp.category,
      distanceMeters: Math.round(dist),
      bearingDegrees: Math.round(bearing),
      azimuthString: `${Math.round(bearing)}° ${cardinal}`,
      estimatedTimeArrivalMin: etaMin,
      crossTrackErrorMeters: 0,
    });

    setActiveTab('map');
  };

  const navigateToLayerFeature = (feat: KMLFeature) => {
    let targetLat = 0;
    let targetLng = 0;

    if (feat.type === 'Point' && !Array.isArray(feat.coordinates)) {
      targetLat = feat.coordinates.lat;
      targetLng = feat.coordinates.lng;
    } else if (Array.isArray(feat.coordinates) && feat.coordinates.length > 0) {
      targetLat = feat.coordinates[0].lat;
      targetLng = feat.coordinates[0].lng;
    }

    const dist = calculateDistanceMeters(currentGps.lat, currentGps.lng, targetLat, targetLng);
    const bearing = calculateBearingDegrees(currentGps.lat, currentGps.lng, targetLat, targetLng);
    const cardinal = bearingToCardinal(bearing);

    setNavTarget({
      id: feat.id,
      name: feat.name,
      lat: targetLat,
      lng: targetLng,
      distanceMeters: Math.round(dist),
      bearingDegrees: Math.round(bearing),
      azimuthString: `${Math.round(bearing)}° ${cardinal}`,
      estimatedTimeArrivalMin: Math.max(1, Math.round(dist / (4000 / 60))),
      crossTrackErrorMeters: 0,
    });

    setActiveTab('map');
  };

  const cancelNavigation = () => {
    setNavTarget(null);
  };

  const cycleNextPoint = () => {
    if (waypoints.length === 0) return;
    const currIndex = waypoints.findIndex((w) => w.id === navTarget?.id);
    const nextIndex = (currIndex + 1) % waypoints.length;
    navigateToWaypoint(waypoints[nextIndex]);
  };

  const cyclePrevPoint = () => {
    if (waypoints.length === 0) return;
    const currIndex = waypoints.findIndex((w) => w.id === navTarget?.id);
    const prevIndex = (currIndex - 1 + waypoints.length) % waypoints.length;
    navigateToWaypoint(waypoints[prevIndex]);
  };

  // Projects Operations
  const createProject = (newProjData: Omit<ProjectFolder, 'id' | 'createdAt' | 'updatedAt' | 'stats'>) => {
    const newProj: ProjectFolder = {
      ...newProjData,
      id: `proj-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stats: {
        waypointsCount: 0,
        tracksCount: 0,
        layersCount: 0,
        areaCoveredHectares: 0,
        teamMembersCount: 1,
      },
    };
    setProjects((prev) => [newProj, ...prev]);
    setActiveProject(newProj);
    addNotification({
      title: 'Novo Projeto Criado',
      message: `Pasta de projeto "${newProj.name}" configurada com chaves de permissão.`,
      type: 'security',
    });
  };

  // Offline Sync Trigger
  const triggerManualSync = async () => {
    setIsSyncing(true);
    await new Promise((res) => setTimeout(res, 1800));

    setOfflineQueue([]);
    setWaypoints((prev) => prev.map((w) => ({ ...w, synced: true })));
    setSavedTracks((prev) => prev.map((t) => ({ ...t, synced: true })));
    setIsSyncing(false);

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#0284c7', '#10b981', '#f59e0b'],
    });

    addNotification({
      title: 'Sincronização em Nuvem Concluída',
      message: 'Todos os registros de campo, fotos e trilhas estão protegidos e salvos na nuvem corporativa.',
      type: 'sync',
    });
  };

  // Remote Team SOS Trigger
  const triggerSosBeacon = () => {
    setSosActive(true);
    addNotification({
      title: 'EMERGÊNCIA SOS EMITIDA!',
      message: `Alerta transmitido com coordenadas de alta precisão (${currentGps.lat.toFixed(5)}, ${currentGps.lng.toFixed(5)}). Central e equipes notificadas via rádio/satélite.`,
      type: 'sos',
      coordinates: currentGps,
    });
  };

  const cancelSosBeacon = () => {
    setSosActive(false);
  };

  const sendRadioMessage = (text: string) => {
    if (!text.trim()) return;
    const newMsg = {
      id: `rad-${Date.now()}`,
      sender: 'Carlos Silva (Você)',
      text,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
    setRadioMessages((prev) => [...prev, newMsg]);
  };

  // Field Rounds (Quilometragem Diária de Campo)
  const addFieldRound = (roundData: Omit<FieldRound, 'id' | 'createdAt' | 'updatedAt' | 'totalKm'>) => {
    const finalKmNum = Number(roundData.finalKm) || 0;
    const initKmNum = Number(roundData.initialKm) || 0;
    const totalKm = finalKmNum > 0 ? Math.max(0, finalKmNum - initKmNum) : 0;

    const newRound: FieldRound = {
      ...roundData,
      id: `round-${Date.now()}`,
      initialKm: initKmNum,
      finalKm: finalKmNum,
      totalKm,
      photos: roundData.photos || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setFieldRounds((prev) => [newRound, ...prev]);
    notifySuccess(
      'Rodada de Campo Registrada',
      `Visita a "${newRound.locationName}" (${newRound.totalKm > 0 ? `${newRound.totalKm} KM` : 'Em andamento'}) salva com sucesso.`
    );
  };

  const updateFieldRound = (id: string, roundData: Partial<FieldRound>) => {
    setFieldRounds((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, ...roundData, updatedAt: new Date().toISOString() };
        if (updated.finalKm && updated.initialKm) {
          updated.totalKm = Math.max(0, Number(updated.finalKm) - Number(updated.initialKm));
        }
        return updated;
      })
    );
    notifySuccess('Rodada Atualizada', 'Informações de deslocamento atualizadas.');
  };

  const deleteFieldRound = (id: string) => {
    const roundToDelete = fieldRounds.find((r) => r.id === id);
    setFieldRounds((prev) => prev.filter((r) => r.id !== id));
    notifyInfo('Registro Removido', `Rodada de "${roundToDelete?.locationName || 'Campo'}" excluída.`);
  };

  const addPhotoToFieldRound = (id: string, photoBase64: string) => {
    setFieldRounds((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        return {
          ...r,
          photos: [...(r.photos || []), photoBase64],
          updatedAt: new Date().toISOString(),
        };
      })
    );
    notifySuccess('Foto Vinculada', 'Imagem anexada à rodada de campo.');
  };

  // Notification actions
  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true }))
    );
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const addNotification = (notifData: Omit<FieldNotification, 'id' | 'timestamp' | 'read'>) => {
    notify({
      title: notifData.title,
      message: notifData.message,
      type: notifData.type as ToastMessage['type'],
      coordinates: notifData.coordinates,
    });
  };

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

  return (
    <AppContext.Provider
      value={{
        pdfFiles,
        addPdfFile,
        language,
        setLanguage,
        t,
        currentRole,
        setCurrentRole,
        isMobileMenuOpen,
        setIsMobileMenuOpen,
        activeTab,
        setActiveTab,
        fieldRounds,
        addFieldRound,
        updateFieldRound,
        deleteFieldRound,
        addPhotoToFieldRound,
        projects,
        activeProject,
        setActiveProject,
        createProject,
        basemap,
        setBasemap,
        mapCenter,
        setMapCenter,
        mapZoom,
        setMapZoom,
        layers,
        toggleLayerVisibility,
        setLayerOpacity,
        addLayer,
        removeLayer,
        calibratePdfOverlay,
        waypoints,
        addWaypoint,
        deleteWaypoint,
        updateWaypointStatus,
        currentGps,
        isGpsSimulated,
        hasGpsLock,
        isManualGpsLocked,
        setIsGpsSimulated,
        requestCurrentLocation,
        setManualGpsLocation,
        unlockDeviceGps,
        isRecordingTrack,
        isRecordingPaused,
        activeTrack,
        startTrackRecording,
        pauseTrackRecording,
        resumeTrackRecording,
        stopTrackRecording,
        savedTracks,
        navTarget,
        setNavTarget,
        navigateToWaypoint,
        navigateToLayerFeature,
        cancelNavigation,
        cycleNextPoint,
        cyclePrevPoint,
        isOffline,
        setIsOffline,
        offlineQueue,
        isSyncing,
        triggerManualSync,
        cachedStorageMB,
        teamMembers,
        sosActive,
        triggerSosBeacon,
        cancelSosBeacon,
        radioMessages,
        sendRadioMessage,
        e2eeEnabled,
        setE2eeEnabled,
        notifications,
        unreadNotificationsCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        clearAllNotifications,
        addNotification,
        settings,
        updateSettings,
        isSettingsModalOpen,
        setIsSettingsModalOpen,
        toasts,
        notify,
        notifySuccess,
        notifyError,
        notifyWarning,
        notifyInfo,
        dismissToast,
        confirmDialog,
        showConfirm,
        closeConfirm,
        isAiModalOpen,
        setIsAiModalOpen,
        isAddWaypointModalOpen,
        setIsAddWaypointModalOpen,
        isLayerModalOpen,
        setIsLayerModalOpen,
        isReportModalOpen,
        setIsReportModalOpen,
        isMeasuring,
        setIsMeasuring,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
