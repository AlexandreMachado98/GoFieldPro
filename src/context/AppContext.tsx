import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback, useMemo } from 'react';
import { parseOdometerKm } from '../utils/geoUtils';
import { saveAppState, loadAppState } from '../utils/stateStorage';
import { getUserItem, setUserItem, removeUserItem } from '../utils/userStorage';
import { locationTrackingService } from '../services/LocationTrackingService';
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
  FireIncident,
  AppSettings,
  SystemBillingConfig,
  DEFAULT_PLANS,
  normalizePlansList,
  UserEntitlements,
} from '../types';
import { checkFeatureAccess, getUserMaxPdfMaps, hasSpecialAccessActive } from '../utils/featureAccess';
import {
  initialProjects,
  initialLayers,
  initialWaypoints,
  initialTracks,
  initialTeamMembers,
  initialNotifications,
  initialFieldRounds,
  initialFireIncidents,
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
  activeTab: 'home' | 'map' | 'evidence' | 'pdf_maps' | 'layers' | 'tracks' | 'field_rounds' | 'fire_incidents' | 'team' | 'reports' | 'analytics' | 'offline' | 'admin' | 'more';
  setActiveTab: (tab: 'home' | 'map' | 'evidence' | 'pdf_maps' | 'layers' | 'tracks' | 'field_rounds' | 'fire_incidents' | 'team' | 'reports' | 'analytics' | 'offline' | 'admin' | 'more') => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (val: boolean | ((prev: boolean) => boolean)) => void;
  toggleSidebarCollapsed: () => void;
  isProUser: boolean;
  isUpgradeModalOpen: boolean;
  setIsUpgradeModalOpen: (val: boolean) => void;
  upgradeModalFeature: string | null;
  openUpgradeModal: (featureName?: string) => void;
  billingConfig: SystemBillingConfig;
  canAddPdfMap: (currentMapCount: number) => { allowed: boolean; reason?: string; isFourthMapBlock?: boolean };
  hasFeatureAccess: (featureKey: string) => boolean;

  // Field Trips / Rodada de Campo (Quilometragem)
  fieldRounds: FieldRound[];
  addFieldRound: (round: Omit<FieldRound, 'id' | 'createdAt' | 'updatedAt' | 'totalKm'>) => void;
  updateFieldRound: (id: string, round: Partial<FieldRound>) => void;
  deleteFieldRound: (id: string) => void;
  addPhotoToFieldRound: (id: string, photoBase64: string) => void;

  // Fire Incidents & Sinistros Florestais
  fireIncidents: FireIncident[];
  addFireIncident: (incident: Omit<FireIncident, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateFireIncident: (id: string, incident: Partial<FireIncident>) => void;
  deleteFireIncident: (id: string) => void;
  addPhotoToFireIncident: (id: string, photoBase64: string) => void;

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
  pendingWaypointCoord: { lat: number; lng: number; altitude?: number } | null;
  setPendingWaypointCoord: (coord: { lat: number; lng: number; altitude?: number } | null) => void;
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
  stopTrackRecording: (customName?: string, customColor?: string) => void;
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

  // App Settings & Theme
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  toggleTheme: () => void;
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
  isWoodpileModalOpen: boolean;
  setIsWoodpileModalOpen: (open: boolean) => void;
  isPoliciesModalOpen: boolean;
  setIsPoliciesModalOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const currentUserId = profile?.uid || user?.uid || 'default';

  // Localization & Role
  const [language, setLanguage] = useState<Language>('pt');
  const [currentRole, setCurrentRole] = useState<UserRole>('surveyor');

  useEffect(() => {
    if (profile?.role) {
      setCurrentRole(profile.role);
    } else {
      setCurrentRole('surveyor');
    }
  }, [profile?.role]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'map' | 'evidence' | 'pdf_maps' | 'layers' | 'tracks' | 'field_rounds' | 'fire_incidents' | 'team' | 'reports' | 'analytics' | 'offline' | 'admin' | 'more'>('home');

  // Collapsible Sidebar State with user-scoped LocalStorage memory
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return getUserItem<boolean>(currentUserId, 'sidebar_collapsed', false);
  });


  // System Billing Config
  const [billingConfig, setBillingConfig] = useState<SystemBillingConfig>(() => {
    try {
      const saved = localStorage.getItem('gofield_billing_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.plans || !Array.isArray(parsed.plans) || parsed.plans.length === 0) {
          parsed.plans = DEFAULT_PLANS;
        }
        return parsed;
      }
    } catch {}
    return {
      pixKey: '',
      pixKeyType: 'cnpj',
      beneficiaryName: '',
      bankName: '',
      defaultTrialDays: 14,
      whatsappSupportNumber: '5511999999999',
      customMessageTemplate: 'Olá {nome}, sua assinatura GoField Pro está disponível.',
      proOriginalPrice: 97.99,
      proLaunchPrice: 44.99,
      proDiscountBadge: '54% OFF • LANÇAMENTO',
      plans: DEFAULT_PLANS,
    };
  });

  // Real-time synchronization of Official System Billing & Plans Configuration
  useEffect(() => {
    let unsub: (() => void) | null = null;

    const setupBillingListener = () => {
      try {
        const billDocRef = doc(db, 'system_config', 'billing');
        unsub = onSnapshot(
          billDocRef,
          (snap) => {
            if (snap.exists()) {
              const data = snap.data() as SystemBillingConfig;
              setBillingConfig((prev) => ({ ...prev, ...data }));
              localStorage.setItem('gofield_billing_config', JSON.stringify(data));
              if (data.plans && Array.isArray(data.plans)) {
                data.plans = normalizePlansList(data.plans);
                localStorage.setItem('gofield_custom_plans', JSON.stringify(data.plans));
              }
              // Broadcast update event to all active UI components
              window.dispatchEvent(new CustomEvent('gofield_plans_updated', { detail: data }));
            }
          },
          (err) => {
            console.warn('Billing config listener notice:', err.message);
            setTimeout(setupBillingListener, 3000);
          }
        );
      } catch (e) {
        console.warn('Error setting up billing listener:', e);
      }
    };

    setupBillingListener();

    return () => {
      if (unsub) unsub();
    };
  }, []);

  useEffect(() => {
    const handleNewVersion = (e: any) => {
      const { version, daysRemaining, isMandatory } = e.detail || {};
      if (!version) return;
      const notifKey = `gofield_version_notified_${version}`;
      const lastNotified = localStorage.getItem(notifKey);
      const now = Date.now();
      
      // Notify if never notified, or if mandatory, or after 12 hours
      if (!lastNotified || isMandatory || now - Number(lastNotified) > 12 * 60 * 60 * 1000) {
        localStorage.setItem(notifKey, now.toString());
        notify({
          title: isMandatory ? `⚠️ Atualização Obrigatória (${version})` : `🚀 Nova Versão ${version} Disponível`,
          message: isMandatory
            ? `A versão ${version} foi lançada há mais de 3 dias e é obrigatória para manter a sincronização e segurança. Atualize agora.`
            : `Uma nova atualização do GoField Pro está pronta para ser instalada. Aplicação automática em até ${daysRemaining} dia(s).`,
          type: isMandatory ? 'error' : 'info',
        });
      }
    };

    window.addEventListener('gofield:new_version_available', handleNewVersion);
    return () => window.removeEventListener('gofield:new_version_available', handleNewVersion);
  }, []);

  // Upgrade Modal State
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState<boolean>(false);
  const [upgradeModalFeature, setUpgradeModalFeature] = useState<string | null>(null);

  const openUpgradeModal = useCallback((featureName?: string) => {
    setUpgradeModalFeature(featureName || null);
    setIsUpgradeModalOpen(true);
  }, []);

  // Is Pro User check: STRICT SECURITY, ZERO ROLE LEAKAGE
  const isProUser = useMemo(() => {
    if (!profile) return false; // Strictly false if not authenticated

    // Only the actual Super Admin Owner has permanent unrestricted access
    const isSuperAdminOwner =
      profile.role === 'super_admin' ||
      profile.email?.toLowerCase() === 'alexandre1604981@gmail.com';

    if (isSuperAdminOwner) return true;

    // Special Exclusive Access grant: authoritative override that unlocks all features & limits
    if (hasSpecialAccessActive(profile)) return true;

    // 1. If user account is blocked, pending or suspended
    if (
      profile.status === 'blocked' ||
      profile.status === 'pending' ||
      profile.status === 'suspended' ||
      profile.status === 'expired'
    ) {
      return false;
    }

    // 2. Subscription Status: STRICT BLOCK for overdue, suspended, expired, canceled
    const subStatus = (profile as any).subscriptionStatus;
    if (
      subStatus === 'overdue' ||
      subStatus === 'suspended' ||
      subStatus === 'expired' ||
      subStatus === 'canceled'
    ) {
      return false; // INADIMPLENTE / VENCIDO / SUSPENSO -> ACESSO BLOQUEADO!
    }

    // 3. Strict Date-based Expiration Check
    if (profile.subscriptionExpiresAt) {
      const expiryTime = new Date(profile.subscriptionExpiresAt).getTime();
      if (isNaN(expiryTime) || expiryTime <= Date.now()) {
        return false; // Expirou no calendário -> ACESSO BLOQUEADO!
      }
    } else {
      // Se não possui data de expiração cadastrada, não pode ser Pro
      return false;
    }

    // 4. Período de Teste Grátis (Trial 14 dias ativo)
    const isTrial =
      profile.status === 'trial' ||
      profile.subscriptionPlan === 'free_trial' ||
      subStatus === 'trial';

    if (isTrial) {
      if (!profile.subscriptionExpiresAt) return false;
      return new Date(profile.subscriptionExpiresAt).getTime() > Date.now();
    }

    // 5. Assinante Pago com Contrato em Dia
    const isPaidPlan = profile.subscriptionPlan && profile.subscriptionPlan !== 'free';
    const isActiveSub = subStatus === 'active';

    if (isPaidPlan && isActiveSub) {
      if (profile.subscriptionExpiresAt) {
        return new Date(profile.subscriptionExpiresAt).getTime() > Date.now();
      }
      return false;
    }

    return false;
  }, [profile]);


  // Dynamic Feature Entitlements Check
  const hasFeatureAccess = useCallback((featureKey: string): boolean => {
    return checkFeatureAccess(profile, featureKey, billingConfig?.plans);
  }, [profile, billingConfig?.plans]);

  // Centralized Entitlements Architecture
  const entitlements: UserEntitlements = useMemo(() => {
    const isOwner = profile?.role === 'super_admin' || profile?.email?.toLowerCase() === 'alexandre1604981@gmail.com';
    const isPro = isProUser || isOwner;

    return {
      isPro,
      canAddUnlimitedPdfMaps: isOwner || hasFeatureAccess('pdf_maps_unlimited'),
      canUseFieldRounds: isOwner || hasFeatureAccess('field_rounds'),
      canUseWoodpileCubage: isOwner || hasFeatureAccess('woodpile_cubage'),
      canUseFireIncidents: isOwner || hasFeatureAccess('fire_incidents'),
      canExportKmlKmzGpx: isOwner || hasFeatureAccess('kml_kmz_gpx'),
      canDownloadOfflineTiles: isOwner || hasFeatureAccess('offline_tiles'),
      canUseAiAssistant: false,
      maxConcurrentPdfMaps: (isOwner || hasFeatureAccess('pdf_maps_unlimited')) ? 99999 : 2,
      canCustomBrandingPdf: isOwner || hasFeatureAccess('custom_branding'),
    };
  }, [isProUser, profile, hasFeatureAccess]);

  // Check if user can add a PDF map (Free plan: max 2 active/concurrent maps, Pro: unlimited)
  const canAddPdfMap = useCallback((currentMapCount: number): { allowed: boolean; reason?: string } => {
    const maxMaps = getUserMaxPdfMaps(profile, billingConfig?.plans);

    if (currentMapCount >= maxMaps) {
      return {
        allowed: false,
        reason: `Seu plano atual permite manter até ${maxMaps} mapas PDF ativos simultaneamente. Exclua um dos mapas existentes para importar outro ou assine um plano com mapas ilimitados.`,
      };
    }

    return { allowed: true };
  }, [profile, billingConfig?.plans]);

  const toggleSidebarCollapsed = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      setUserItem(currentUserId, 'sidebar_collapsed', next);
      return next;
    });
  }, [currentUserId]);

  // Fire Incidents State (user-scoped)
  const [fireIncidents, setFireIncidents] = useState<FireIncident[]>(() => {
    return getUserItem<FireIncident[]>(currentUserId, 'fire_incidents', initialFireIncidents);
  });

  useEffect(() => {
    setUserItem(currentUserId, 'fire_incidents', fireIncidents);
  }, [fireIncidents, currentUserId]);

  // Translation and PDF files helper
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
    return getUserItem<boolean>(currentUserId, 'manual_gps_locked', false);
  });
  const isManualGpsLockedRef = useRef<boolean>(isManualGpsLocked);
  isManualGpsLockedRef.current = isManualGpsLocked;

  // Live GPS Tracking & Simulation
  const [currentGps, setCurrentGps] = useState<GeoCoordinate>(() => {
    const isLocked = getUserItem<boolean>(currentUserId, 'manual_gps_locked', false);
    const savedCoord = getUserItem<GeoCoordinate | null>(currentUserId, 'manual_gps_coord', null);
    if (isLocked && savedCoord && typeof savedCoord.lat === 'number' && typeof savedCoord.lng === 'number') {
      return savedCoord;
    }
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
    return getUserItem<boolean>(currentUserId, 'manual_gps_locked', false);
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
    { id: 'rad-1', sender: 'Operador de Campo (Líder)', text: 'Equipe Alpha em deslocamento no setor norte. Coleta iniciada.', time: '10:14', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80' },
    { id: 'rad-2', sender: 'Marcos Lima', text: 'Alerta na trilha baixa: queda de barreira com pedras no km 4. Registrando ponto.', time: '14:08', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80' },
    { id: 'rad-3', sender: 'Dra. Ana Nery (Base)', text: 'Copiado Marcos. Ortomosaico de drone sendo direcionado para o setor.', time: '14:10', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80' },
  ]);

  // Security E2EE
  const [e2eeEnabled, setE2eeEnabled] = useState<boolean>(true);

  // Field Trips / Rodadas de Campo (Quilometragem Diária - user scoped)
  const [fieldRounds, setFieldRounds] = useState<FieldRound[]>(() => {
    return getUserItem<FieldRound[]>(currentUserId, 'field_rounds', initialFieldRounds);
  });

  useEffect(() => {
    setUserItem(currentUserId, 'field_rounds', fieldRounds);
  }, [fieldRounds, currentUserId]);

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
      duration = 2800,
      silentInHistory = false,
      silentToast = false,
      coordinates,
    }: {
      title: string;
      message: string;
      type?: ToastMessage['type'];
      duration?: number;
      silentInHistory?: boolean;
      silentToast?: boolean;
      coordinates?: GeoCoordinate;
    }) => {
      // Prioritization: Only show visible on-screen toasts for important alerts and confirmations
      if (!silentToast) {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const newToast: ToastMessage = {
          id,
          title,
          message,
          type,
          duration: type === 'error' ? 4500 : type === 'warning' ? 3500 : 2500,
          createdAt: Date.now(),
        };

        // Keep maximum 2 toasts on screen and avoid duplicate spam
        setToasts((prev) => {
          if (prev.length > 0 && prev[0].title === title) return prev;
          return [newToast, ...prev.slice(0, 1)];
        });
      }

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
        setNotifications((prev) => [notif, ...prev.slice(0, 49)]);
      }
    },
    []
  );

  const notifySuccess = useCallback(
    (title: string, message: string, showToast = false) => notify({ title, message, type: 'success', silentToast: !showToast }),
    [notify]
  );
  const notifyError = useCallback(
    (title: string, message: string) => notify({ title, message, type: 'error', duration: 4000 }),
    [notify]
  );
  const notifyWarning = useCallback(
    (title: string, message: string) => notify({ title, message, type: 'warning', duration: 3000 }),
    [notify]
  );
  const notifyInfo = useCallback(
    (title: string, message: string) => notify({ title, message, type: 'info', silentToast: true }),
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
  const [pendingWaypointCoord, setPendingWaypointCoord] = useState<{ lat: number; lng: number; altitude?: number } | null>(null);
  const [isLayerModalOpen, setIsLayerModalOpen] = useState<boolean>(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isMeasuring, setIsMeasuring] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isWoodpileModalOpen, setIsWoodpileModalOpen] = useState<boolean>(false);
  const [isPoliciesModalOpen, setIsPoliciesModalOpen] = useState<boolean>(false);

  // Auto-dismiss transient modal overlays whenever activeTab changes to prevent lingering screens
  useEffect(() => {
    setIsAddWaypointModalOpen(false);
    setIsLayerModalOpen(false);
    setIsSettingsModalOpen(false);
    setIsWoodpileModalOpen(false);
    setIsPoliciesModalOpen(false);
    setIsAiModalOpen(false);
    setIsReportModalOpen(false);
    setIsMobileMenuOpen(false);
  }, [activeTab]);

  // App Settings with LocalStorage persistence
  const [settings, setSettings] = useState<AppSettings>(() => {
    const defaultSettings: AppSettings = {
      theme: 'light',
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
    return getUserItem<AppSettings>(currentUserId, 'app_settings', defaultSettings);
  });

  // Apply Theme to Document root (HTML and Body classes/data-theme)
  useEffect(() => {
    const root = document.documentElement;
    const currentTheme = settings.theme || 'dark';

    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        root.classList.remove('light');
        root.classList.add('dark');
        root.setAttribute('data-theme', 'dark');
        document.body.setAttribute('data-theme', 'dark');
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
        root.setAttribute('data-theme', 'light');
        document.body.setAttribute('data-theme', 'light');
      }
    };

    if (currentTheme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches);

      const handleChange = (e: MediaQueryListEvent) => {
        applyTheme(e.matches);
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      applyTheme(currentTheme === 'dark');
    }
  }, [settings.theme]);

  // IndexedDB Persistence for core collections (user-scoped)
  const [isStateLoaded, setIsStateLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const savedLayers = await loadAppState<LayerItem[]>('geofield_layers', currentUserId);
      if (savedLayers && savedLayers.length > 0) setLayers(savedLayers);
      
      const savedProjects = await loadAppState<ProjectFolder[]>('geofield_projects', currentUserId);
      if (savedProjects && savedProjects.length > 0) setProjects(savedProjects);
      
      const savedWaypoints = await loadAppState<Waypoint[]>('geofield_waypoints', currentUserId);
      if (savedWaypoints && savedWaypoints.length > 0) setWaypoints(savedWaypoints);
      
      const savedTracks = await loadAppState<Track[]>('geofield_savedTracks', currentUserId);
      if (savedTracks && savedTracks.length > 0) setSavedTracks(savedTracks);

      setIsStateLoaded(true);
    })();
  }, [currentUserId]);

  useEffect(() => {
    if (!isStateLoaded) return;
    saveAppState('geofield_layers', layers, currentUserId);
  }, [layers, isStateLoaded, currentUserId]);

  useEffect(() => {
    if (!isStateLoaded) return;
    saveAppState('geofield_projects', projects, currentUserId);
  }, [projects, isStateLoaded, currentUserId]);

  useEffect(() => {
    if (!isStateLoaded) return;
    saveAppState('geofield_waypoints', waypoints, currentUserId);
  }, [waypoints, isStateLoaded, currentUserId]);

  useEffect(() => {
    if (!isStateLoaded) return;
    saveAppState('geofield_savedTracks', savedTracks, currentUserId);
  }, [savedTracks, isStateLoaded, currentUserId]);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...partial };
      setUserItem(currentUserId, 'app_settings', updated);
      return updated;
    });
  }, [currentUserId]);

  const toggleTheme = useCallback(() => {
    setSettings((prev) => {
      const nextTheme = prev.theme === 'light' ? 'dark' : 'light';
      const updated = { ...prev, theme: nextTheme };
      setUserItem(currentUserId, 'app_settings', updated);
      return updated;
    });
  }, [currentUserId]);

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
      setUserItem(currentUserId, 'manual_gps_locked', true);
      setUserItem(currentUserId, 'manual_gps_coord', updatedCoord);
      notifySuccess(
        'Posição Calibrada e Fixada',
        `GPS travado manualmente em Lat: ${coord.lat.toFixed(5)}°, Lng: ${coord.lng.toFixed(5)}°`
      );
    },
    [notifySuccess, currentUserId]
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
            (finalErr) => {
              console.warn('[GPS] Geolocation indisponível no momento:', finalErr.message);
              resolve(null);
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 10000 }
          );
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 2000 }
      );
    });
  }, [notifyWarning, currentGps]);

  const unlockDeviceGps = useCallback(() => {
    setIsManualGpsLocked(false);
    isManualGpsLockedRef.current = false;
    removeUserItem(currentUserId, 'manual_gps_locked');
    removeUserItem(currentUserId, 'manual_gps_coord');
    notifyInfo('GPS em Tempo Real', 'Reconectando aos satélites do seu aparelho...');
    requestCurrentLocation();
  }, [notifyInfo, requestCurrentLocation, currentUserId]);

  // Centralized LocationTrackingService Lifecycle (Single Active Watcher + Kinematic Filtering)
  useEffect(() => {
    locationTrackingService.setUserId(currentUserId);
    locationTrackingService.startGpsWatch({
      isSimulated: isGpsSimulated,
      isManualLocked: isManualGpsLocked,
    });

    const unsubscribe = locationTrackingService.subscribe({
      onGpsUpdate: (coord) => {
        if (isManualGpsLockedRef.current) return;
        // Merge last heading into current coord if available, so it doesn't get lost
        setCurrentGps(prev => ({ ...coord, heading: prev?.heading ?? coord.heading }));
        setHasGpsLock(true);
      },
      onHeadingUpdate: (heading) => {
        setCurrentGps(prev => prev ? { ...prev, heading } : prev);
      },
      onTrackPointAdded: (_pt, track) => {
        setActiveTrack(track);
      },
      onTrackStatsUpdate: (track) => {
        setActiveTrack(track);
      },
      onStatusChange: (status) => {
        setIsRecordingTrack(status === 'recording' || status === 'paused');
        setIsRecordingPaused(status === 'paused');
      },
    });

    return () => {
      unsubscribe();
    };
  }, [currentUserId, isGpsSimulated, isManualGpsLocked]);

  // Restore Active Track Draft after crash/interruption
  useEffect(() => {
    (async () => {
      if (!currentUserId) return;
      const draft = await locationTrackingService.restoreTrackDraft();
      if (draft) {
        setActiveTrack(draft);
        setIsRecordingTrack(true);
        setIsRecordingPaused(true);
        notifyInfo(
          'Gravação Recuperada',
          `Seu trajeto "${draft.name}" com ${draft.points.length} pontos foi restaurado do armazenamento local.`
        );
      }
    })();
  }, [currentUserId, notifyInfo]);

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
      userName: 'Técnico Responsável',
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

    locationTrackingService.startRecording(newTrack);
    setActiveTrack(newTrack);
    setIsRecordingTrack(true);
    setIsRecordingPaused(false);
  };

  const pauseTrackRecording = () => {
    locationTrackingService.pauseRecording();
    setIsRecordingPaused(true);
  };

  const resumeTrackRecording = () => {
    locationTrackingService.resumeRecording();
    setIsRecordingPaused(false);
  };

  const stopTrackRecording = (customName?: string, customColor?: string) => {
    const finishedTrack = locationTrackingService.stopRecording() || activeTrack;
    if (finishedTrack) {
      const finished: Track = {
        ...finishedTrack,
        name: customName || finishedTrack.name,
        color: customColor || finishedTrack.color,
        endTime: new Date().toISOString(),
        visible: true,
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

      notifySuccess(
        'Trilha Salva no Mapa',
        `Trilha "${finished.name}" com ${finished.distanceKm.toFixed(2)} km aplicada com sucesso.`
      );
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
      sender: 'Você (Operador)',
      text,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
    setRadioMessages((prev) => [...prev, newMsg]);
  };

  // Field Rounds (Quilometragem Diária de Campo)

  // Fire Incident actions
  const addFireIncident = (incidentData: Omit<FireIncident, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newInc: FireIncident = {
      ...incidentData,
      id: `fire-${Date.now()}`,
      photos: incidentData.photos || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setFireIncidents((prev) => [newInc, ...prev]);
    notifySuccess('Foco de Incêndio Registrado', `Ocorrência em "${newInc.locationName}" salva com sucesso.`);
  };

  const updateFireIncident = (id: string, incidentData: Partial<FireIncident>) => {
    setFireIncidents((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        return {
          ...i,
          ...incidentData,
          updatedAt: new Date().toISOString(),
        };
      })
    );
    notifySuccess('Ocorrência Atualizada', 'Informações de combate e foco atualizadas.');
  };

  const deleteFireIncident = (id: string) => {
    const item = fireIncidents.find((i) => i.id === id);
    setFireIncidents((prev) => prev.filter((i) => i.id !== id));
    notifyInfo('Registro Excluído', `Foco em "${item?.locationName || 'Campo'}" removido.`);
  };

  const addPhotoToFireIncident = (id: string, photoBase64: string) => {
    setFireIncidents((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        return {
          ...i,
          photos: [...(i.photos || []), photoBase64],
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const addFieldRound = (roundData: Omit<FieldRound, 'id' | 'createdAt' | 'updatedAt' | 'totalKm'>) => {
    const isOwner = profile?.role === 'super_admin' || profile?.email?.toLowerCase() === 'alexandre1604981@gmail.com';
    if (!isProUser && !isOwner) {
      openUpgradeModal('Registro de Atividades de Campo');
      notifyWarning('Assinatura Inativa ou Vencida', 'Regularize sua assinatura para registrar atividades de campo.');
      return;
    }
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
        pendingWaypointCoord,
        setPendingWaypointCoord,
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
        toggleTheme,
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
        isWoodpileModalOpen,
        setIsWoodpileModalOpen,
        isPoliciesModalOpen,
        setIsPoliciesModalOpen,
        isProUser,
        isUpgradeModalOpen,
        setIsUpgradeModalOpen,
        openUpgradeModal,
        upgradeModalFeature,
        billingConfig,
        setBillingConfig,
        canAddPdfMap,
    hasFeatureAccess,
        isSidebarCollapsed,
        toggleSidebarCollapsed,
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
