export type UserRole = 'super_admin' | 'field_lead' | 'surveyor' | 'auditor';
export type UserStatus = 'pending' | 'active' | 'blocked';

export type SubscriptionPlanType = 'free' | 'free_trial' | 'pro_mensal' | 'equipe_mensal' | 'florestal_corporativo' | 'personalizado';
export type SubscriptionStatusType = 'active' | 'trial' | 'overdue' | 'suspended' | 'canceled';
export type PaymentMethodType = 'pix' | 'boleto' | 'cartao' | 'transferencia' | 'cortesia';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  avatar: string;
  company?: string;
  companyCnpj?: string;
  phone?: string;
  requestedRole?: UserRole;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;

  // Commercial & Subscription Fields
  subscriptionPlan?: SubscriptionPlanType;
  subscriptionStatus?: SubscriptionStatusType;
  subscriptionExpiresAt?: string; // ISO Date String
  subscriptionValue?: number; // Valor mensal em BRL ex: 290
  paymentMethod?: PaymentMethodType;
  billingNotes?: string;
  maxUsersAllowed?: number;
  lastPaymentDate?: string;
}

export interface PromoCoupon {
  id: string;
  code: string;
  discountPercent?: number;
  discountFixed?: number;
  validUntil: string;
  maxUses: number;
  usedCount: number;
  active: boolean;
  notes?: string;
}

export interface PlanItemConfig {
  id: string;
  name: string;
  tag: string;
  originalPrice: number; // Preço inteiro cheio (riscado)
  price: number; // Preço promocional com desconto
  discountBadge?: string; // Ex: '54% OFF' ou 'Preço Promocional'
  billingPeriod: string; // '/mês' ou '/ano'
  features: string[];
  highlight?: boolean;
  activeInShowcase?: boolean;
  description?: string;
}

export const DEFAULT_PLANS: PlanItemConfig[] = [
  {
    id: 'pro',
    name: 'Plano Profissional',
    tag: 'Individual',
    originalPrice: 149,
    price: 97,
    discountBadge: '35% OFF',
    billingPeriod: '/mês',
    features: [
      '1 Operador de Campo',
      'Mapas PDF e GPS Ilimitados',
      'Medição de Pilha de Madeira (m³)',
      'Relatórios Técnicos em PDF com Fotos',
    ],
    highlight: false,
    activeInShowcase: true,
  },
  {
    id: 'equipe',
    name: 'Plano Equipe',
    tag: 'Mais Popular',
    originalPrice: 390,
    price: 289,
    discountBadge: 'Economize R$ 101/mês',
    billingPeriod: '/mês',
    features: [
      'Até 5 Técnicos de Campo',
      'Painel de Gestão da Frota & Odômetro',
      'Cubagem Florestal e Laudos em Lote',
      'Backup e Sincronização em Nuvem',
    ],
    highlight: true,
    activeInShowcase: true,
  },
  {
    id: 'florestal',
    name: 'Florestal & Usinas',
    tag: 'Corporativo',
    originalPrice: 950,
    price: 690,
    discountBadge: '27% OFF',
    billingPeriod: '/mês',
    features: [
      '15 a 30 Operadores simultâneos',
      'Logotipo da Empresa nos Laudos PDF',
      'Contratos e Faturamento PJ',
      'Treinamento e Suporte VIP Prioritário',
    ],
    highlight: false,
    activeInShowcase: true,
  },
];


export interface SystemBillingConfig {
  pixKey: string;
  pixKeyType: 'cnpj' | 'email' | 'phone' | 'random';
  beneficiaryName: string;
  bankName: string;
  defaultTrialDays: number;
  whatsappSupportNumber: string;
  customMessageTemplate: string;
  plans?: PlanItemConfig[];
  proOriginalPrice?: number;
  proLaunchPrice?: number;
  proDiscountBadge?: string;
  asaasApiKey?: string;
  asaasEnvironment?: 'sandbox' | 'production';
  asaasWebhookSecret?: string;
  asaasWalletId?: string;
}


export type Language = 'pt' | 'en' | 'es';

export type BasemapType = 'satellite' | 'topo' | 'osm' | 'dark' | 'hybrid';

export type GpsQualityLevel = 'excellent' | 'good' | 'moderate' | 'low' | 'poor' | 'invalid';
export type GpsMovementState = 'stationary' | 'walking' | 'vehicle';

export interface GeoCoordinate {
  lat: number;
  lng: number;
  altitude?: number;
  accuracy?: number;
  speed?: number; // Velocidade em km/h
  heading?: number; // Rumo / Direção em graus (0 - 360)
  timestamp?: number;
  quality?: GpsQualityLevel;
  movementState?: GpsMovementState;
  isSimulated?: boolean;
  isStale?: boolean;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface CalibrationPoint {
  id: string;
  pixelX: number; // 0 to 1 relative or pixel
  pixelY: number;
  geoLat: number;
  geoLng: number;
}

export interface PDFMapOverlay {
  id: string;
  name: string;
  fileName: string;
  fileSize: string;
  url?: string;
  bounds: [[number, number], [number, number]]; // Leaflet LatLngBoundsExpression: [[south, west], [north, east]]
  opacity: number;
  visible: boolean;
  scale: string; // e.g. "1:50.000"
  datum: string; // e.g. "SIRGAS 2000 / WGS 84"
  pageCount: number;
  currentPage: number;
  georeferenced: boolean;
  calibrationPoints?: CalibrationPoint[];
  rotation?: number;
  previewUrl?: string;
  description?: string;
  uploadedAt: string;
}

export interface KMLFeature {
  id: string;
  name: string;
  description?: string;
  type: 'Point' | 'LineString' | 'Polygon';
  coordinates: GeoCoordinate[] | GeoCoordinate;
  color?: string;
  fillColor?: string;
  strokeWidth?: number;
  properties?: Record<string, any>;
  layerId: string;
  photos?: string[];
}

export interface LayerItem {
  id: string;
  name: string;
  type: 'pdf' | 'kml' | 'kmz' | 'geojson' | 'vector' | 'raster';
  visible: boolean;
  opacity: number;
  itemCount?: number;
  color: string;
  category: 'ambient' | 'infrastructure' | 'boundaries' | 'hazard' | 'topography' | 'custom';
  fileData?: any;
  features?: KMLFeature[];
  pdfData?: PDFMapOverlay;
  isOfflineCached: boolean;
  cacheSizeMB?: number;
}

export interface Waypoint {
  id: string;
  projectId: string;
  name: string;
  code: string;
  category: 'inspection' | 'hazard' | 'geodesic' | 'fauna_flora' | 'soil_sample' | 'infrastructure' | 'obstacle' | 'checkpoint' | 'fire' | 'woodpile';
  lat: number;
  lng: number;
  altitude: number;
  accuracy: number;
  createdAt: string;
  createdBy: string;
  creatorAvatar?: string;
  notes: string;
  status: 'pending' | 'verified' | 'alert' | 'archived';
  photos: string[];
  attributes: Record<string, string | number | boolean>;
  synced: boolean;
  encrypted: boolean;
  signatureHash?: string;
}

export interface TrackPoint {
  lat: number;
  lng: number;
  altitude: number;
  speed: number; // km/h
  timestamp: number;
}

export interface Track {
  id: string;
  projectId: string;
  name: string;
  userId: string;
  userName: string;
  startTime: string;
  endTime?: string;
  points: TrackPoint[];
  distanceKm: number;
  durationSeconds: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  elevationGainM: number;
  elevationLossM: number;
  color: string;
  visible: boolean;
  synced: boolean;
  tags: string[];
}

export interface TeamMember {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
  email: string;
  status: 'online' | 'in_field' | 'sos' | 'offline';
  batteryLevel: number;
  signalStrength: 'high' | 'medium' | 'low' | 'satellite';
  lastLocation: GeoCoordinate;
  lastUpdate: string;
  currentTask?: string;
  activeTrackId?: string;
  assignedProjectIds: string[];
}

export interface ProjectFolder {
  id: string;
  name: string;
  description: string;
  parentId?: string | null;
  createdAt: string;
  updatedAt: string;
  locationName: string;
  centerCoordinate: GeoCoordinate;
  zoomLevel: number;
  tags: string[];
  encryptionEnabled: boolean;
  stats: {
    waypointsCount: number;
    tracksCount: number;
    layersCount: number;
    areaCoveredHectares: number;
    teamMembersCount: number;
  };
  permissions: {
    super_admin: boolean;
    field_lead: boolean;
    surveyor: boolean;
    auditor: boolean;
  };
}

export interface FieldNotification {
  id: string;
  title: string;
  message: string;
  type: 'sos' | 'sync' | 'geofence' | 'task' | 'security' | 'success' | 'info' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
  coordinates?: GeoCoordinate;
  senderName?: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error' | 'sync' | 'geofence' | 'sos' | 'task' | 'security';
  duration?: number;
  createdAt: number;
}

export interface ConfirmDialogConfig {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel?: () => void;
}

export interface OfflineSyncItem {
  id: string;
  entityType: 'waypoint' | 'track' | 'layer' | 'report';
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'completed' | 'error';
  errorMessage?: string;
}

export interface NavigationTarget {
  id: string;
  name: string;
  lat: number;
  lng: number;
  altitude?: number;
  category?: string;
  distanceMeters: number;
  bearingDegrees: number;
  azimuthString: string;
  estimatedTimeArrivalMin: number;
  crossTrackErrorMeters: number;
}

export interface FieldRound {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  locationName: string; // Local / Fazenda / Obra / Cliente visitado
  initialKm: number;
  finalKm: number;
  totalKm: number;
  technicianName: string;
  vehiclePlate?: string;
  purpose?: string;
  notes?: string;
  photos: string[];
  status: 'em_andamento' | 'finalizada';
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  theme?: 'dark' | 'light' | 'auto';
  coordinateFormat: 'DD' | 'DMS' | 'UTM' | 'SIRGAS';
  gpsAccuracyMode: 'high' | 'balanced' | 'power_save';
  gpsUpdateIntervalMs: number;
  trackMinDistanceMeters: number;
  autoCenterGps: boolean;
  keepScreenAwake: boolean;
  defaultMarkerColor: string;
  unitSystem: 'metric' | 'nautical' | 'imperial';
  pdfRenderQuality: 'normal' | 'high';
  photoQuality: 'high' | 'medium' | 'low';
}

export type MeasurementPointType = 'standard' | 'stop' | 'hazard' | 'woodpile';

export interface MeasurementPoint {
  id: string;
  lat: number;
  lng: number;
  pdfX?: number;
  pdfY?: number;
  altitude?: number;
  type: MeasurementPointType;
  label: string;
  notes?: string;
  photos: string[];
  woodpileData?: {
    woodType?: string;
    lengthMeters?: number;
    heightMeters?: number;
    widthMeters?: number;
    stackFactor?: number;
    estimatedStereoM3?: number;
    estimatedSolidM3?: number;
  };
  timestamp: number;
}

export interface MeasurementSession {
  id: string;
  name: string;
  points: MeasurementPoint[];
  totalDistanceMeters: number;
  segmentDistancesMeters: number[];
  createdAt: string;
  technicianName: string;
  projectName: string;
}

export type FireIncidentType = 
  | 'foco_ativo' 
  | 'area_queimada' 
  | 'queima_controlada' 
  | 'sinistro_florestal' 
  | 'principio_incendio';

export type FireIncidentStatus = 
  | 'em_combate' 
  | 'controlado' 
  | 'extinto' 
  | 'monitoramento';

export type FireSeverity = 
  | 'baixa' 
  | 'media' 
  | 'alta' 
  | 'critica';

export interface FireIncident {
  id: string;
  title: string;
  locationName: string; // Ex: Fazenda Santa Maria - Talhão 12
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  type: FireIncidentType;
  status: FireIncidentStatus;
  severity: FireSeverity;
  lat: number;
  lng: number;
  altitude?: number;
  utm?: { easting: number; northing: number; zone: number };
  estimatedAreaHectares?: number;
  windSpeedKmh?: number;
  windDirection?: string;
  temperatureC?: number;
  relativeHumidity?: number;
  resourcesMobilized?: string[];
  combatTeamNotes?: string;
  probableCause?: string;
  technicianName: string;
  photos: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}



