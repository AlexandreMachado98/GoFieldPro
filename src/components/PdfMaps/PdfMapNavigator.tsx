import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  UploadCloud, DownloadCloud, 
  FileText, 
  Trash2, 
  ZoomIn, 
  ZoomOut, 
  MapPin, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Check, 
  AlertTriangle, 
  Maximize2,
  Minimize2,
  Activity,
  Navigation,
  MousePointer,
  Camera,
  Image as ImageIcon,
  Play,
  Pause,
  Square,
  X,
  Layers,
  Sparkles,
  Eye,
  Footprints, List,
  FolderOpen,
  Undo2,
  Share2,
  Crosshair,
  LocateFixed,
  Sliders,
  Ruler,
  Lock,
  ArrowLeft,
  EyeOff,
  SlidersHorizontal
} from 'lucide-react';
import { BottomSheet } from '../Common/BottomSheet';
import L from 'leaflet';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'leaflet/dist/leaflet.css';
import { 
  PdfDocument,
  GeoCalibration, 
  PdfMarker, 
  PdfTrack, 
  PdfPolygon,
  PdfTrackPoint,
  getAllPdfDocuments,
  savePdfDocument,
  deletePdfDocument
} from '../../utils/pdfStorage';
import { useAuth } from '../../context/AuthContext';
import { getUserRawItem, setUserItem } from '../../utils/userStorage';
import { 
  gpsToPdf, 
  pdfToGps, 
  createCenteredCalibration, 
  create2PointCalibration,
  createBoundingBoxCalibration,
  isDocumentCalibrated,
  calculateNavigationToMarker
} from '../../utils/geoTransform';
import { parseGeoPdfMetadata } from '../../utils/geoPdfParser';
import { calculateDistanceMeters, calculatePolygonArea } from '../../utils/geoUtils';
import { parseKMLString, parseKMZFile } from '../../utils/kmlParser';
import { KMLFeature, GeoCoordinate } from '../../types';
import { MeasurementPoint, MeasurementPointType } from '../../types';
import { MeasurementControlBar } from '../Map/MeasurementControlBar';
import { MapToolsController } from '../Map/MapToolsController';
import { PointDetailModal } from '../Map/PointDetailModal';
import { MeasurementSummaryModal } from '../Map/MeasurementSummaryModal';
import { PdfExportModal } from './PdfExportModal';

// Configure PDF.js worker safely
if (typeof window !== 'undefined') {
  try {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker || `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '6.2.108'}/build/pdf.worker.min.mjs`;
    }
  } catch (err) {
    console.warn('PDF.js worker setup fallback:', err);
  }
}

export const WoodpileIcon: React.FC<{ className?: string; size?: number }> = ({ className = 'w-5 h-5', size }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Bottom Left Log */}
    <circle cx="7" cy="16" r="3.5" fill="currentColor" fillOpacity="0.25" />
    <circle cx="7" cy="16" r="1.2" />
    {/* Bottom Right Log */}
    <circle cx="17" cy="16" r="3.5" fill="currentColor" fillOpacity="0.25" />
    <circle cx="17" cy="16" r="1.2" />
    {/* Top Center Log */}
    <circle cx="12" cy="7.5" r="3.5" fill="currentColor" fillOpacity="0.35" />
    <circle cx="12" cy="7.5" r="1.2" />
    {/* Supporting Stack Base Line */}
    <path d="M3 21h18" />
  </svg>
);

const CATEGORIES = [
  { id: 'woodpile', label: 'Pilha de Madeira', color: '#d97706', icon: '🪵' },
  { id: 'checkpoint', label: 'Ponto de Navegação', color: '#0284c7', icon: '📍' },
  { id: 'inspection', label: 'Inspeção / Vistoria', color: '#10b981', icon: '🔍' },
  { id: 'hazard', label: 'Obstáculo / Risco', color: '#ef4444', icon: '⚠️' },
  { id: 'boundary', label: 'Marco / Vértice', color: '#8b5cf6', icon: '🚩' },
  { id: 'sample', label: 'Amostra / Solo', color: '#ec4899', icon: '🧪' },
  { id: 'note', label: 'Anotação Geral', color: '#f59e0b', icon: '📝' },
] as const;

// Compress image file to lightweight Base64 to save storage and keep UI fast
const compressImageFile = (file: File, maxDim = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = typeof window !== 'undefined' ? document.createElement('img') : new (window as any).Image();
        img.onload = () => {
          try {
            let { width, height } = img;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, width);
            canvas.height = Math.max(1, height);
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(e.target?.result as string);
              return;
            }
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', quality));
          } catch (err) {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = () => reject(new Error('Falha ao processar foto'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Falha ao ler arquivo de foto'));
      reader.readAsDataURL(file);
    } catch (err) {
      reject(err);
    }
  });
};

export const PdfMapNavigator: React.FC = () => {
  const { user, profile } = useAuth();
  const currentUserId = profile?.uid || user?.uid || '';

  const {
    addPdfFile,
    currentGps,
    requestCurrentLocation,
    notifySuccess,
    notifyError,
    isProUser,
    openUpgradeModal,
    canAddPdfMap,
    notifyWarning,
    notifyInfo,
    showConfirm,
    setActiveTab,
    setNavTarget,
  } = useApp();
  
  // Storage state
  const [documents, setDocuments] = useState<PdfDocument[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [isMapsListOpen, setIsMapsListOpen] = useState<boolean>(false);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);

  // Tools mode: 'pan', 'add_point', 'draw_track', 'record_track', 'measure', 'woodpile'
  const [activeTool, setActiveTool] = useState<'pan' | 'add_point' | 'draw_track' | 'record_track' | 'measure' | 'woodpile'>('pan');

  // Retractable Tools Panel (Starts CLOSED to avoid screen clutter, like GPS map)
  const [isToolsPanelOpen, setIsToolsPanelOpen] = useState<boolean>(false);
  const [isMapInteracting, setIsMapInteracting] = useState<boolean>(false);

  // Woodpile Specific Submode & Form State
  const [woodpileSubMode, setWoodpileSubMode] = useState<'point' | 'measure'>('point');
  const [woodType, setWoodType] = useState<string>('Eucalipto');
  const [woodpileLength, setWoodpileLength] = useState<string>('');
  const [woodpileHeight, setWoodpileHeight] = useState<string>('');
  const [woodpileWidth, setWoodpileWidth] = useState<string>('1.0');
  const [woodpileStackFactor, setWoodpileStackFactor] = useState<string>('0.67');
  const [woodpileStatus, setWoodpileStatus] = useState<'empilhada' | 'medida' | 'carregada' | 'transportada'>('empilhada');

  // Measurement state on PDF sheet
  const [measurementPoints, setMeasurementPoints] = useState<MeasurementPoint[]>([]);
  const [currentMeasureType, setCurrentMeasureType] = useState<MeasurementPointType>('standard');
  const [selectedMeasurePointForEdit, setSelectedMeasurePointForEdit] = useState<{
    point: MeasurementPoint;
    index: number;
  } | null>(null);
  const [isMeasureSummaryOpen, setIsMeasureSummaryOpen] = useState(false);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Drawer / Bottom sheet for map list
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Manual track drawing
  const [currentTrackPoints, setCurrentTrackPoints] = useState<PdfTrackPoint[]>([]);
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [trackName, setTrackName] = useState('');
  const [trackColor, setTrackColor] = useState('#0284c7');

  // Live Track Recording
  const [isRecordingLive, setIsRecordingLive] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [recordedPoints, setRecordedPoints] = useState<PdfTrackPoint[]>([]);
  const [recordDuration, setRecordDuration] = useState(0);
  const recordTimerRef = useRef<number | null>(null);

  // PDF processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Marker creation modal
  const [pendingMarkerPos, setPendingMarkerPos] = useState<{ x: number; y: number } | null>(null);
  const [markerTitle, setMarkerTitle] = useState('');
  const [markerNotes, setMarkerNotes] = useState('');
  const [markerCategory, setMarkerCategory] = useState<PdfMarker['category']>('checkpoint');
  const [markerPhotos, setMarkerPhotos] = useState<string[]>([]);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  
  // Selected marker details modal
  const [selectedMarker, setSelectedMarker] = useState<PdfMarker | null>(null);
  const [activeLightboxPhoto, setActiveLightboxPhoto] = useState<string | null>(null);

  // Target navigation in PDF
  const [activeNavPoint, setActiveNavPoint] = useState<PdfMarker | null>(null);

  // Real-time GPS Location & Compass state
  const [isGpsActive, setIsGpsActive] = useState(false);
  const [userGps, setUserGps] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    speed: number | null;
    altitude: number | null;
    heading: number | null;
    timestamp: number;
  } | null>(null);

  // Export Modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Calibration Modal state (Multi-method: GPS anchor, 2-point GCP, neatline bounds)
  const [isCalibrationModalOpen, setIsCalibrationModalOpen] = useState(false);
  const [calibTab, setCalibTab] = useState<'gps_anchor' | 'gcp_2pt' | 'bounds'>('gps_anchor');
  const [calibScale, setCalibScale] = useState(0.85);
  const [calibRotation, setCalibRotation] = useState<number>(0);
  const [calibNominalScale, setCalibNominalScale] = useState<string>('1:10.000');
  const [calibCenterLat, setCalibCenterLat] = useState<string>('');
  const [calibCenterLng, setCalibCenterLng] = useState<string>('');
  const [gcpPt1, setGcpPt1] = useState<{ x: number; y: number; lat: string; lng: string }>({ x: 0, y: 0, lat: '', lng: '' });
  const [gcpPt2, setGcpPt2] = useState<{ x: number; y: number; lat: string; lng: string }>({ x: 0, y: 0, lat: '', lng: '' });
  const [boundsNorth, setBoundsNorth] = useState<string>('');
  const [boundsSouth, setBoundsSouth] = useState<string>('');
  const [boundsWest, setBoundsWest] = useState<string>('');
  const [boundsEast, setBoundsEast] = useState<string>('');
  const [isSelectingGcpOnMap, setIsSelectingGcpOnMap] = useState<1 | 2 | null>(null);
  const isSelectingGcpOnMapRef = useRef<1 | 2 | null>(null);
  isSelectingGcpOnMapRef.current = isSelectingGcpOnMap;
  const [distanceToMapKm, setDistanceToMapKm] = useState<number | null>(null);
  const [isUserInsideMap, setIsUserInsideMap] = useState<boolean>(true);

  // Save Live Recorded Route Modal state
  const [isSaveRecordedModalOpen, setIsSaveRecordedModalOpen] = useState(false);
  const [recordedRouteName, setRecordedRouteName] = useState('');
  const [recordedRouteColor, setRecordedRouteColor] = useState('#ef4444');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const markerPhotoInputRef = useRef<HTMLInputElement>(null);
  const markerCameraInputRef = useRef<HTMLInputElement>(null);
  const editPhotoInputRef = useRef<HTMLInputElement>(null);
  const importKmlInputRef = useRef<HTMLInputElement>(null);

  // High-Precision KML/KMZ Import Handler
  const handleImportKml = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeDoc) return;

    setIsDrawerOpen(false);
    setIsProcessing(true);
    setProcessingProgress('Lendo e descompactando arquivo KML/KMZ...');

    await new Promise((resolve) => setTimeout(resolve, 150));

    try {
      let features: KMLFeature[] = [];
      let parseStats: any = null;

      if (file.name.toLowerCase().endsWith('.kmz')) {
        const res = await parseKMZFile(file);
        features = res.features;
        parseStats = res.stats;
      } else {
        const text = await file.text();
        features = parseKMLString(text);
      }

      if (!features || features.length === 0) {
        notifyWarning(
          'Nenhum Elemento Geográfico',
          'Não foi possível encontrar pontos, linhas ou polígonos válidos com coordenadas geográficas no arquivo.'
        );
        return;
      }

      setProcessingProgress(`Projetando ${features.length} geometrias na folha do mapa...`);
      await new Promise((resolve) => setTimeout(resolve, 80));

      // 1. Calculate Geographical Bounding Box of all imported coordinates (WGS84)
      let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
      let hasValidCoords = false;

      features.forEach((feat) => {
        if (feat.type === 'Point' && !Array.isArray(feat.coordinates)) {
          const coord = feat.coordinates as GeoCoordinate;
          if (coord && typeof coord.lat === 'number' && typeof coord.lng === 'number' && !isNaN(coord.lat) && !isNaN(coord.lng)) {
            minLat = Math.min(minLat, coord.lat);
            maxLat = Math.max(maxLat, coord.lat);
            minLng = Math.min(minLng, coord.lng);
            maxLng = Math.max(maxLng, coord.lng);
            hasValidCoords = true;
          }
        } else if ((feat.type === 'LineString' || feat.type === 'Polygon') && Array.isArray(feat.coordinates)) {
          (feat.coordinates as GeoCoordinate[]).forEach((coord) => {
            if (coord && typeof coord.lat === 'number' && typeof coord.lng === 'number' && !isNaN(coord.lat) && !isNaN(coord.lng)) {
              minLat = Math.min(minLat, coord.lat);
              maxLat = Math.max(maxLat, coord.lat);
              minLng = Math.min(minLng, coord.lng);
              maxLng = Math.max(maxLng, coord.lng);
              hasValidCoords = true;
            }
          });
        }
      });

      const h = activeDoc.height && !isNaN(activeDoc.height) ? activeDoc.height : 1200;
      const w = activeDoc.width && !isNaN(activeDoc.width) ? activeDoc.width : 1600;

      // 2. SMART CALIBRATION: Preserve existing calibration if calibrated, or auto-anchor if uncalibrated
      let effectiveCalibration: GeoCalibration;
      const isAlreadyCalibrated = !!(activeDoc.calibration && activeDoc.calibration.isCalibrated);

      if (isAlreadyCalibrated) {
        // PRESERVE the map's calibrated coordinate system
        effectiveCalibration = activeDoc.calibration!;
      } else if (hasValidCoords) {
        // Auto-anchor uncalibrated sheet to KML bounds with 8% padding
        const latSpan = Math.abs(maxLat - minLat) || 0.005;
        const lngSpan = Math.abs(maxLng - minLng) || 0.005;
        const latPad = latSpan * 0.08;
        const lngPad = lngSpan * 0.08;

        effectiveCalibration = {
          isCalibrated: true,
          ref1: { x: h * 0.92, y: w * 0.08, lat: maxLat + latPad, lng: minLng - lngPad },
          ref2: { x: h * 0.08, y: w * 0.92, lat: minLat - latPad, lng: maxLng + lngPad },
          scaleMetersPerPixel: 1,
        };
      } else {
        effectiveCalibration = activeDoc.calibration || {
          isCalibrated: false,
          ref1: { x: h * 0.9, y: w * 0.1, lat: -23.5420, lng: -46.6380 },
          ref2: { x: h * 0.1, y: w * 0.9, lat: -23.5540, lng: -46.6220 },
        };
      }

      const tempDoc: PdfDocument = {
        ...activeDoc,
        calibration: effectiveCalibration,
      };

      let newMarkers: PdfMarker[] = [...(activeDoc.markers || [])];
      let newTracks: PdfTrack[] = [...(activeDoc.tracks || [])];
      let newPolygons: PdfPolygon[] = [...(activeDoc.polygons || [])];

      let markersAdded = 0;
      let tracksAdded = 0;
      let polygonsAdded = 0;

      features.forEach((feat) => {
        // POINT
        if (feat.type === 'Point' && !Array.isArray(feat.coordinates)) {
          const coord = feat.coordinates as GeoCoordinate;
          if (coord && typeof coord.lat === 'number' && typeof coord.lng === 'number' && !isNaN(coord.lat) && !isNaN(coord.lng)) {
            const pdfCoord = gpsToPdf(coord.lat, coord.lng, tempDoc);

            if (!isNaN(pdfCoord.x) && !isNaN(pdfCoord.y)) {
              newMarkers.push({
                id: `kml-pt-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
                x: pdfCoord.x,
                y: pdfCoord.y,
                lat: coord.lat,
                lng: coord.lng,
                title: feat.name || 'Ponto Importado',
                notes: feat.description || '',
                category: 'checkpoint',
                color: feat.color || '#10b981',
                createdAt: new Date().toISOString(),
                photos: feat.photos || [],
              });
              markersAdded++;
            }
          }
        }
        // LINESTRING
        else if (feat.type === 'LineString' && Array.isArray(feat.coordinates)) {
          const coords = feat.coordinates as GeoCoordinate[];
          const pts = coords
            .filter((c) => c && typeof c.lat === 'number' && typeof c.lng === 'number' && !isNaN(c.lat) && !isNaN(c.lng))
            .map((c) => {
              const pc = gpsToPdf(c.lat, c.lng, tempDoc);
              return { x: pc.x, y: pc.y, lat: c.lat, lng: c.lng, altitude: c.altitude };
            })
            .filter((p) => !isNaN(p.x) && !isNaN(p.y));

          if (pts.length > 1) {
            newTracks.push({
              id: `kml-trk-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
              name: feat.name || 'Trilha Importada',
              points: pts,
              color: feat.color || '#0284c7',
              createdAt: new Date().toISOString(),
              isRecorded: false,
            });
            tracksAdded++;
          }
        }
        // POLYGON
        else if (feat.type === 'Polygon' && Array.isArray(feat.coordinates)) {
          const coords = feat.coordinates as GeoCoordinate[];
          const pts = coords
            .filter((c) => c && typeof c.lat === 'number' && typeof c.lng === 'number' && !isNaN(c.lat) && !isNaN(c.lng))
            .map((c) => {
              const pc = gpsToPdf(c.lat, c.lng, tempDoc);
              return { x: pc.x, y: pc.y, lat: c.lat, lng: c.lng, altitude: c.altitude };
            })
            .filter((p) => !isNaN(p.x) && !isNaN(p.y));

          if (pts.length >= 3) {
            const areaResult = calculatePolygonArea(coords);

            newPolygons.push({
              id: `kml-poly-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
              name: feat.name || 'Polígono / Área Mapeada',
              points: pts,
              color: feat.color || '#10b981',
              fillColor: feat.fillColor || feat.color || '#10b981',
              fillOpacity: typeof feat.properties?.fillOpacity === 'number' ? feat.properties.fillOpacity : 0.25,
              strokeWidth: typeof feat.strokeWidth === 'number' ? feat.strokeWidth : 2.5,
              areaHa: areaResult.hectares,
              notes: feat.description || '',
              folder: feat.properties?.folder || '',
              createdAt: new Date().toISOString(),
            });
            polygonsAdded++;
          }
        }
      });

      const updatedDoc: PdfDocument = {
        ...activeDoc,
        calibration: effectiveCalibration,
        markers: newMarkers,
        tracks: newTracks,
        polygons: newPolygons,
      };

      updateDocumentInStore(updatedDoc);

      notifySuccess(
        'KML/KMZ Importado com Precisão',
        `Sucesso! ${markersAdded} pontos, ${tracksAdded} linhas e ${polygonsAdded} polígonos/talhões foram projetados perfeitamente no seu mapa PDF.`
      );
    } catch (err: any) {
      console.error('Error importing KML/KMZ:', err);
      notifyError('Falha na Importação', err.message || 'Não foi possível ler as coordenadas do arquivo KML/KMZ fornecido.');
    } finally {
      setIsProcessing(false);
      setProcessingProgress('');
      if (e.target) e.target.value = '';
    }
  };

    const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const imageOverlayRef = useRef<L.ImageOverlay | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const tracksLayerRef = useRef<L.LayerGroup | null>(null);
  const polygonsLayerRef = useRef<L.LayerGroup | null>(null);
  const measureLayerRef = useRef<L.LayerGroup | null>(null);
  const activeDrawPolylineRef = useRef<L.Polyline | null>(null);
  const liveRecordPolylineRef = useRef<L.Polyline | null>(null);
  const targetGuideLineRef = useRef<L.Polyline | null>(null);
  const approachLineRef = useRef<L.Polyline | null>(null);
  const gpsUserMarkerRef = useRef<L.Marker | null>(null);
  const gpsAccuracyCircleRef = useRef<L.CircleMarker | null>(null);
  const gpsWatchIdRef = useRef<number | null>(null);
  const lastLoadedDocPageRef = useRef<string>('');

  // Critical State Refs to prevent stale closures and React race conditions
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

  const woodpileSubModeRef = useRef(woodpileSubMode);
  woodpileSubModeRef.current = woodpileSubMode;

  const currentMeasureTypeRef = useRef(currentMeasureType);
  currentMeasureTypeRef.current = currentMeasureType;

  const documentsRef = useRef<PdfDocument[]>(documents);
  documentsRef.current = documents;

  const activeDocIdRef = useRef<string | null>(activeDocId);
  activeDocIdRef.current = activeDocId;

  const measurementPointsRef = useRef<MeasurementPoint[]>(measurementPoints);
  measurementPointsRef.current = measurementPoints;

  // Active Document Helper
  const activeDoc = useMemo(() => {
    return documents.find((d) => d.id === activeDocId) || null;
  }, [documents, activeDocId]);

  // Persist updated doc into IndexedDB asynchronously with safety
  const updateDocumentInStore = useCallback((updatedDoc: PdfDocument) => {
    try {
      const cleanDoc: PdfDocument = {
        ...updatedDoc,
        userId: updatedDoc.userId || currentUserId,
        markers: Array.isArray(updatedDoc.markers) ? updatedDoc.markers : [],
        tracks: Array.isArray(updatedDoc.tracks) ? updatedDoc.tracks : [],
      };
      setDocuments((prev) => prev.map((d) => (d.id === cleanDoc.id ? cleanDoc : d)));
      savePdfDocument(cleanDoc, currentUserId).catch((e) => console.warn('Failed to persist doc', e));
    } catch (err) {
      console.error('Error updating document in store:', err);
    }
  }, [currentUserId]);

  // Initialize Map safely
  const initializeMap = useCallback(() => {
    const container = mapContainerRef.current;
    if (!container) return;
    if (mapInstanceRef.current) return;

    try {
      if ((container as any)._leaflet_id) {
        delete (container as any)._leaflet_id;
      }

      const map = L.map(container, {
        crs: L.CRS.Simple,
        minZoom: -4,
        maxZoom: 5,
        zoomSnap: 0.25,
        zoomDelta: 0.5,
        wheelPxPerZoomLevel: 60,
        zoomControl: false,
        attributionControl: false,
        touchZoom: true,
        dragging: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
      });

      mapInstanceRef.current = map;


      const tracksGroup = L.layerGroup().addTo(map);
      tracksLayerRef.current = tracksGroup;

      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;

      const measureGroup = L.layerGroup().addTo(map);
      measureLayerRef.current = measureGroup;

      // Listen to user map interaction (drag, zoom, pan) to reduce opacity of overlay controls
      map.on('movestart zoomstart dragstart', () => {
        setIsMapInteracting(true);
      });
      map.on('moveend zoomend dragend', () => {
        setIsMapInteracting(false);
      });

      // Click listener uses activeToolRef and state refs to prevent crashes & stale closures
      map.on('click', (e: L.LeafletMouseEvent) => {
        try {
          if (!e || !e.latlng) return;
          const lat = e.latlng.lat;
          const lng = e.latlng.lng;
          if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) return;

          const currentTool = activeToolRef.current;
          const currentDocs = documentsRef.current;
          const currentDocId = activeDocIdRef.current;
          const currentDoc = currentDocs.find((d) => d.id === currentDocId);

          if (isSelectingGcpOnMapRef.current === 1) {
            setGcpPt1((prev) => ({ ...prev, x: +lat.toFixed(1), y: +lng.toFixed(1) }));
            setIsSelectingGcpOnMap(null);
            setIsCalibrationModalOpen(true);
            notifySuccess('Ponto 1 Marcado na Folha', `Posição do Ponto 1 definida: [${lat.toFixed(0)}, ${lng.toFixed(0)}]`);
            return;
          }
          if (isSelectingGcpOnMapRef.current === 2) {
            setGcpPt2((prev) => ({ ...prev, x: +lat.toFixed(1), y: +lng.toFixed(1) }));
            setIsSelectingGcpOnMap(null);
            setIsCalibrationModalOpen(true);
            notifySuccess('Ponto 2 Marcado na Folha', `Posição do Ponto 2 definida: [${lat.toFixed(0)}, ${lng.toFixed(0)}]`);
            return;
          }

          if (currentTool === 'add_point') {
            setPendingMarkerPos({ x: lat, y: lng });
            setMarkerTitle(`Ponto ${Date.now().toString().slice(-4)}`);
            setMarkerNotes('');
            setMarkerPhotos([]);
            setSelectedMarker(null);
          } else if (currentTool === 'draw_track') {
            setCurrentTrackPoints((prev) => [...prev, { x: lat, y: lng }]);
          } else if (currentTool === 'record_track') {
            setRecordedPoints((prev) => [
              ...prev,
              { x: lat, y: lng, time: new Date().toLocaleTimeString('pt-BR') }
            ]);
          } else if (currentTool === 'measure') {
            const pts = measurementPointsRef.current;
            const coords = currentDoc
              ? pdfToGps(lat, lng, currentDoc)
              : { lat: -23.542, lng: -46.638 };

            const type = currentMeasureTypeRef.current || 'standard';
            const ptIndex = pts.length;
            let label = `Ponto ${ptIndex + 1}`;
            if (type === 'stop') {
              const stopsSoFar = pts.filter((p) => p.type === 'stop').length;
              label = `Parada ${stopsSoFar + 1}`;
            } else if (type === 'hazard') {
              const hazardsSoFar = pts.filter((p) => p.type === 'hazard').length;
              label = `Atenção ${hazardsSoFar + 1}`;
            }

            const newPt: MeasurementPoint = {
              id: `pdf-meas-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              lat: coords.lat,
              lng: coords.lng,
              pdfX: lat,
              pdfY: lng,
              altitude: 1280,
              type,
              label,
              notes: '',
              photos: [],
              timestamp: Date.now(),
            };

            setMeasurementPoints((prev) => [...prev, newPt]);
          } else if (currentTool === 'woodpile') {
            if (woodpileSubModeRef.current === 'measure') {
              // Measure woodpile
              const pts = measurementPointsRef.current;
              const coords = currentDoc
                ? pdfToGps(lat, lng, currentDoc)
                : { lat: -23.542, lng: -46.638 };

              const ptIndex = pts.length;
              const label = `Pilha ${ptIndex + 1}`;

              const newPt: MeasurementPoint = {
                id: `pdf-woodpile-meas-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                lat: coords.lat,
                lng: coords.lng,
                pdfX: lat,
                pdfY: lng,
                altitude: 1280,
                type: 'woodpile',
                label,
                notes: 'Ponto de medição de pilha de madeira',
                photos: [],
                timestamp: Date.now(),
              };

              setMeasurementPoints((prev) => [...prev, newPt]);
            } else {
              // Point woodpile
              const existingWoodpiles = currentDoc?.markers?.filter((m) => m.category === 'woodpile').length || 0;
              setPendingMarkerPos({ x: lat, y: lng });
              setMarkerTitle(`Pilha de Madeira #${existingWoodpiles + 1}`);
              setMarkerCategory('woodpile');
              setMarkerNotes('');
              setMarkerPhotos([]);
              setWoodType('Eucalipto');
              setWoodpileLength('');
              setWoodpileHeight('');
              setWoodpileWidth('1.0');
              setWoodpileStackFactor('0.67');
              setWoodpileStatus('empilhada');
              setSelectedMarker(null);
            }
          }
        } catch (err) {
          console.error('Error handling map click:', err);
        }
      });
    } catch (err) {
      console.warn('Map initialization error:', err);
    }
  }, [notifySuccess]);

  // Initialize Map on mount
  useEffect(() => {
    initializeMap();

    const container = mapContainerRef.current;
    let resizeObserver: ResizeObserver | null = null;
    if (container && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.invalidateSize();
          } catch {
            // ignore
          }
        }
      });
      resizeObserver.observe(container);
    }

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {
          // ignore
        }
        mapInstanceRef.current = null;
        imageOverlayRef.current = null;
        markersLayerRef.current = null;
        tracksLayerRef.current = null;
        polygonsLayerRef.current = null;
        measureLayerRef.current = null;
      }
    };
  }, [initializeMap]);

  // Load documents from IndexedDB on mount (user-scoped)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rawDocs = await getAllPdfDocuments(currentUserId);
        // Automatically sanitize and cleanse any legacy auto-anchored fake calibrations from previous versions
        const docs = await Promise.all(
          rawDocs.map(async (doc) => {
            if (doc.calibration && doc.calibration.isCalibrated) {
              if (doc.calibration.method === 'centered' || !doc.calibration.method) {
                const cleanedDoc: PdfDocument = {
                  ...doc,
                  calibration: {
                    isCalibrated: false,
                    ref1: { x: doc.height * 0.9, y: doc.width * 0.1, lat: NaN, lng: NaN },
                    ref2: { x: doc.height * 0.1, y: doc.width * 0.9, lat: NaN, lng: NaN },
                    scaleMetersPerPixel: 0.75,
                  },
                };
                try {
                  await savePdfDocument(cleanedDoc, currentUserId);
                } catch (err) {
                  console.warn('Failed to persist cleaned calibration:', err);
                }
                return cleanedDoc;
              }
            }
            return doc;
          })
        );

        if (mounted) {
          if (docs.length > 0) {
            setDocuments(docs);
            const requested = getUserRawItem(currentUserId, 'selected_pdf_id', '');
            const exists = docs.some((d) => d.id === requested);
            if (requested && exists) {
              setActiveDocId(requested);
            } else {
              setActiveDocId(docs[0].id);
            }
          } else {
            setDocuments([]);
            setActiveDocId(null);
          }
        }
      } catch (e) {
        console.error('Failed to load PDF documents', e);
      } finally {
        if (mounted) setIsLoadingDocs(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [currentUserId]);

  // Timer for live track recording
  useEffect(() => {
    if (isRecordingLive && !isRecordingPaused) {
      recordTimerRef.current = window.setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
      }
    }
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, [isRecordingLive, isRecordingPaused]);

  // Handle Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (mapInstanceRef.current) {
        setTimeout(() => mapInstanceRef.current?.invalidateSize(), 200);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Update Image Overlay when active doc or page changes
  useEffect(() => {
    initializeMap();

    const map = mapInstanceRef.current;
    if (!map) return;

    if (!activeDoc) {
      if (imageOverlayRef.current) {
        map.removeLayer(imageOverlayRef.current);
        imageOverlayRef.current = null;
      }
      if (markersLayerRef.current) markersLayerRef.current.clearLayers();
      if (polygonsLayerRef.current) polygonsLayerRef.current.clearLayers();
      if (tracksLayerRef.current) tracksLayerRef.current.clearLayers();
      lastLoadedDocPageRef.current = '';
      return;
    }

    const pageIdx = activeDoc.currentPage || 0;
    const currentDataUrl = activeDoc.dataUrls[pageIdx] || activeDoc.dataUrls[0];
    if (!currentDataUrl) {
      console.warn('PDF image data is missing or corrupted.');
      return;
    }

    const docPageKey = `${activeDoc.id}_p${pageIdx}`;

    if (lastLoadedDocPageRef.current !== docPageKey) {
      lastLoadedDocPageRef.current = docPageKey;

      const h = activeDoc.height && !isNaN(activeDoc.height) ? activeDoc.height : 1000;
      const w = activeDoc.width && !isNaN(activeDoc.width) ? activeDoc.width : 1000;
      const bounds = L.latLngBounds([[0, 0], [h, w]]);

      if (imageOverlayRef.current) {
        map.removeLayer(imageOverlayRef.current);
        imageOverlayRef.current = null;
      }

      if (currentDataUrl) {
        try {
          imageOverlayRef.current = L.imageOverlay(currentDataUrl, bounds).addTo(map);
          map.fitBounds(bounds, { padding: [15, 15] });
          // Allow zooming out freely so user can view their GPS position approaching the sheet from afar
          const baseZoom = map.getBoundsZoom(bounds);
          map.setMinZoom(isFinite(baseZoom) ? Math.min(-5, baseZoom - 5) : -6);
        } catch (err) {
          console.warn('Error loading image overlay:', err);
        }
      }

      // If document is not calibrated, strictly ensure no GPS markers exist on sheet
      if (!isDocumentCalibrated(activeDoc)) {
        if (gpsUserMarkerRef.current) {
          try { map.removeLayer(gpsUserMarkerRef.current); } catch {}
          gpsUserMarkerRef.current = null;
        }
        if (gpsAccuracyCircleRef.current) {
          try { map.removeLayer(gpsAccuracyCircleRef.current); } catch {}
          gpsAccuracyCircleRef.current = null;
        }
      }

      const timer = setTimeout(() => {
        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.invalidateSize();
          } catch {
            // ignore
          }
        }
      }, 120);

      return () => clearTimeout(timer);
    }
  }, [activeDocId, activeDoc?.currentPage, initializeMap, activeDoc]);

  // Render Markers safely on Map
  useEffect(() => {
    if (!markersLayerRef.current || !activeDoc) return;
    
    try {
      markersLayerRef.current.clearLayers();
      const hMax = (activeDoc.height && !isNaN(activeDoc.height) ? activeDoc.height : 1200) + 100;
      const wMax = (activeDoc.width && !isNaN(activeDoc.width) ? activeDoc.width : 1600) + 100;
      const markers = (Array.isArray(activeDoc.markers) ? activeDoc.markers : []).filter(
        m => typeof m.x === 'number' && typeof m.y === 'number' && !isNaN(m.x) && !isNaN(m.y) && m.x >= -100 && m.x <= hMax && m.y >= -100 && m.y <= wMax
      );

      markers.forEach((marker) => {
        if (!marker || typeof marker.x !== 'number' || typeof marker.y !== 'number' || isNaN(marker.x) || isNaN(marker.y)) {
          return;
        }

        const isWoodpile = marker.category === 'woodpile';
        const categoryObj = CATEGORIES.find((c) => c.id === marker.category) || CATEGORIES[0];
        const isTarget = activeNavPoint?.id === marker.id;
        const hasPhotos = Array.isArray(marker.photos) && marker.photos.length > 0;
        const color = isWoodpile ? '#d97706' : (marker.color || categoryObj.color);
        
        const pinHtml = isWoodpile ? `
          <div class="tactical-pin-wrap">
            <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
              <div style="
                width: ${isTarget ? '36px' : '30px'};
                height: ${isTarget ? '36px' : '30px'};
                border-radius: 8px;
                background: linear-gradient(135deg, #d97706, #92400e);
                border: 2px solid #ffffff;
                box-shadow: 0 4px 14px rgba(217,119,6,0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                ${isTarget ? 'animation: bounce 1.5s infinite;' : ''}
              ">
                <span style="font-size: 15px; line-height: 1;">🪵</span>
              </div>
              <div style="
                margin-top: 2px;
                background: rgba(15,23,42,0.95);
                color: #fbbf24;
                font-size: 9px;
                font-weight: 800;
                padding: 1.5px 5px;
                border-radius: 4px;
                border: 1px solid rgba(245,158,11,0.6);
                white-space: nowrap;
                box-shadow: 0 2px 5px rgba(0,0,0,0.6);
              ">
                ${marker.title || 'Pilha'}
                ${marker.woodpileData?.estimatedStereoM3 ? ` (${marker.woodpileData.estimatedStereoM3.toFixed(1)} st)` : ''}
              </div>
              ${hasPhotos ? `
                <div style="
                  margin-top: 1px;
                  background: rgba(15,23,42,0.9);
                  color: #38bdf8;
                  font-size: 8px;
                  font-weight: 700;
                  padding: 0 3px;
                  border-radius: 3px;
                  border: 1px solid rgba(56,189,248,0.4);
                  white-space: nowrap;
                ">📷 ${marker.photos!.length}</div>
              ` : ''}
            </div>
          </div>
        ` : `
          <div class="tactical-pin-wrap">
            <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
              <div style="
                width: ${isTarget ? '32px' : '26px'};
                height: ${isTarget ? '32px' : '26px'};
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg);
                background-color: ${color};
                border: 2px solid #ffffff;
                box-shadow: 0 4px 12px rgba(0,0,0,0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                ${isTarget ? 'animation: bounce 1.5s infinite;' : ''}
              ">
                <div style="
                  transform: rotate(45deg);
                  color: #ffffff;
                  font-size: 11px;
                  font-weight: 900;
                  line-height: 1;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                ">
                  ${isTarget ? '🎯' : (categoryObj as any).icon || '📍'}
                </div>
              </div>
              ${hasPhotos ? `
                <div style="
                  margin-top: 2px;
                  background: rgba(15,23,42,0.9);
                  color: #38bdf8;
                  font-size: 9px;
                  font-weight: 700;
                  padding: 1px 4px;
                  border-radius: 4px;
                  border: 1px solid rgba(56,189,248,0.4);
                  white-space: nowrap;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.4);
                ">📷 ${marker.photos!.length}</div>
              ` : ''}
            </div>
          </div>
        `;

        const divIcon = L.divIcon({
          className: 'custom-pdf-pin',
          html: pinHtml,
          iconSize: [26, 32],
          iconAnchor: [13, 32],
        });

        const leafletMarker = L.marker([marker.x, marker.y], { icon: divIcon });
        
        leafletMarker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          setSelectedMarker(marker);
          setPendingMarkerPos(null);
        });

        leafletMarker.addTo(markersLayerRef.current!);
      });
    } catch (err) {
      console.warn('Error rendering markers:', err);
    }
  }, [activeDoc?.markers, activeNavPoint, activeDoc]);

  // Render Saved Polygons / Field Boundaries safely on Leaflet Map
  useEffect(() => {
    if (!polygonsLayerRef.current || !activeDoc) return;

    try {
      polygonsLayerRef.current.clearLayers();
      const polygons = Array.isArray(activeDoc.polygons) ? activeDoc.polygons : [];

      polygons.forEach((poly) => {
        if (!poly || !Array.isArray(poly.points)) return;
        const validPoints = poly.points.filter(
          (p) => p && typeof p.x === 'number' && typeof p.y === 'number' && !isNaN(p.x) && !isNaN(p.y)
        );

        if (validPoints.length >= 3) {
          const latLngs = validPoints.map((p) => [p.x, p.y] as [number, number]);
          const polygonLayer = L.polygon(latLngs, {
            color: poly.color || '#10b981',
            fillColor: poly.fillColor || poly.color || '#10b981',
            fillOpacity: typeof poly.fillOpacity === 'number' ? poly.fillOpacity : 0.25,
            weight: typeof poly.strokeWidth === 'number' ? poly.strokeWidth : 2.5,
            lineJoin: 'round',
          });

          polygonLayer.bindPopup(`
            <div style="font-family: sans-serif; padding: 4px; min-width: 150px;">
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background-color: ${poly.fillColor || poly.color || '#10b981'};"></span>
                <b style="color: #0f172a; font-size: 13px;">${poly.name || 'Polígono'}</b>
              </div>
              <div style="font-size: 11px; color: #475569; line-height: 1.4;">
                ${poly.folder ? `<b>Camada:</b> ${poly.folder}<br/>` : ''}
                ${poly.areaHa ? `<b>Área:</b> ${poly.areaHa} ha<br/>` : ''}
                <b>Vértices:</b> ${validPoints.length} pontos<br/>
                ${poly.notes ? `<div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #e2e8f0; color: #334155;">${poly.notes}</div>` : ''}
              </div>
            </div>
          `);

          polygonLayer.addTo(polygonsLayerRef.current!);
        }
      });
    } catch (err) {
      console.warn('Error rendering polygons:', err);
    }
  }, [activeDoc?.polygons, activeDoc]);

  // Render Saved Tracks safely on Map
  useEffect(() => {
    if (!tracksLayerRef.current || !activeDoc) return;
    
    try {
      tracksLayerRef.current.clearLayers();
      const tracks = Array.isArray(activeDoc.tracks) ? activeDoc.tracks : [];

      tracks.forEach((track) => {
        if (!track || !Array.isArray(track.points)) return;
        const validPoints = track.points.filter((p) => p && typeof p.x === 'number' && typeof p.y === 'number' && !isNaN(p.x) && !isNaN(p.y));
        if (validPoints.length > 1) {
          const latLngs = validPoints.map((p) => [p.x, p.y] as [number, number]);
          const line = L.polyline(latLngs, {
            color: track.color || '#0284c7',
            weight: 4,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round',
            dashArray: track.isRecorded ? '6, 6' : undefined,
          });

          line.bindPopup(`
            <div style="font-family: sans-serif; padding: 4px;">
              <b style="color: #0f172a; font-size: 13px;">${track.name || 'Rota'}</b>
              <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                ${track.isRecorded ? '🔴 Trilha Gravada' : '✏️ Rota Traçada'}<br/>
                Pontos: ${validPoints.length}<br/>
                Data: ${track.createdAt || ''}
              </div>
            </div>
          `);

          line.addTo(tracksLayerRef.current!);
        }
      });
    } catch (err) {
      console.warn('Error rendering tracks:', err);
    }
  }, [activeDoc?.tracks, activeDoc]);

  // Calculate total measurement distance safely
  const totalMeasureDistanceMeters = useMemo(() => {
    if (!measurementPoints || measurementPoints.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < measurementPoints.length; i++) {
      const p1 = measurementPoints[i - 1];
      const p2 = measurementPoints[i];
      if (p1 && p2 && !isNaN(p1.lat) && !isNaN(p1.lng) && !isNaN(p2.lat) && !isNaN(p2.lng)) {
        total += calculateDistanceMeters(p1.lat, p1.lng, p2.lat, p2.lng);
      }
    }
    return isNaN(total) ? 0 : total;
  }, [measurementPoints]);

  // Add GPS point to PDF measurement safely
  const handleAddGpsToPdfMeasurement = () => {
    if (!activeDoc) return;
    const gpsLat = userGps?.lat || currentGps?.lat;
    const gpsLng = userGps?.lng || currentGps?.lng;
    if (typeof gpsLat !== 'number' || typeof gpsLng !== 'number' || isNaN(gpsLat) || isNaN(gpsLng)) {
      notifyWarning('GPS Não Detectado', 'Ative o GPS para marcar sua coordenada na folha.');
      return;
    }

    try {
      const pdfPos = gpsToPdf(gpsLat, gpsLng, activeDoc);
      const type = currentMeasureType;
      const ptIndex = measurementPoints.length;
      let label = `Ponto GPS ${ptIndex + 1}`;
      if (type === 'stop') label = `Parada GPS ${ptIndex + 1}`;
      if (type === 'hazard') label = `Atenção GPS ${ptIndex + 1}`;

      const newPt: MeasurementPoint = {
        id: `pdf-meas-gps-${Date.now()}`,
        lat: gpsLat,
        lng: gpsLng,
        pdfX: pdfPos.x,
        pdfY: pdfPos.y,
        altitude: userGps?.altitude || currentGps?.altitude || 1280,
        type,
        label,
        notes: 'Marcado via GPS na folha PDF',
        photos: [],
        timestamp: Date.now(),
      };

      setMeasurementPoints((prev) => [...prev, newPt]);
      notifyInfo('Ponto Adicionado', `Coordenada GPS (${gpsLat.toFixed(5)}°, ${gpsLng.toFixed(5)}°) inserida.`);
    } catch (err) {
      console.error('Error adding GPS to measurement:', err);
    }
  };

  // Close measurement loop safely on PDF map
  const handleCloseLoopPdf = () => {
    if (measurementPoints.length < 2) return;
    const startPt = measurementPoints[0];
    const isAlreadyClosed =
      measurementPoints.length >= 3 &&
      measurementPoints[0].lat === measurementPoints[measurementPoints.length - 1].lat &&
      measurementPoints[0].lng === measurementPoints[measurementPoints.length - 1].lng;

    if (isAlreadyClosed) {
      notifyInfo('Perímetro Fechado', 'A medição já está fechada no ponto inicial.');
      return;
    }

    const closePt: MeasurementPoint = {
      id: `pdf-meas-close-${Date.now()}`,
      lat: startPt.lat,
      lng: startPt.lng,
      pdfX: startPt.pdfX,
      pdfY: startPt.pdfY,
      altitude: startPt.altitude,
      type: 'stop',
      label: `Fechamento (${startPt.label || 'Ponto 1'})`,
      notes: 'Ponto final conectado exatamente ao início para fechamento de perímetro',
      photos: [],
      timestamp: Date.now(),
    };

    setMeasurementPoints((prev) => [...prev, closePt]);
    notifySuccess('Perímetro Fechado', 'Traçado conectado com precisão ao ponto inicial.');
  };

  // Render Measurement Overlay safely on PDF Map
  useEffect(() => {
    if (!measureLayerRef.current) return;
    const group = measureLayerRef.current;

    try {
      group.clearLayers();
      if (!measurementPoints || measurementPoints.length === 0) return;

      const isClosed =
        measurementPoints.length >= 3 &&
        measurementPoints[0].lat === measurementPoints[measurementPoints.length - 1].lat &&
        measurementPoints[0].lng === measurementPoints[measurementPoints.length - 1].lng;

      const validPts = measurementPoints.filter(
        (p) => p && typeof p.pdfX === 'number' && typeof p.pdfY === 'number' && !isNaN(p.pdfX) && !isNaN(p.pdfY)
      );

      // Draw Polyline along (pdfX, pdfY)
      if (validPts.length > 1) {
        const latLngs = validPts.map((p) => [p.pdfX!, p.pdfY!] as [number, number]);

        const isAllWoodpile = validPts.every((p) => p.type === 'woodpile');
        const polylineColor = isAllWoodpile ? '#d97706' : (isClosed ? '#10b981' : '#e11d48');

        L.polyline(latLngs, {
          color: polylineColor,
          weight: 4,
          dashArray: isClosed ? undefined : '6, 6',
          opacity: 0.95,
        }).addTo(group);

        // Segment distance badges
        for (let i = 1; i < validPts.length; i++) {
          const p1 = validPts[i - 1];
          const p2 = validPts[i];
          if (p1.pdfX !== undefined && p1.pdfY !== undefined && p2.pdfX !== undefined && p2.pdfY !== undefined) {
            const segDist = calculateDistanceMeters(p1.lat, p1.lng, p2.lat, p2.lng);
            const segFormatted =
              segDist >= 1000 ? `${(segDist / 1000).toFixed(2)} km` : `${Math.round(segDist)} m`;
            const midX = (p1.pdfX + p2.pdfX) / 2;
            const midY = (p1.pdfY + p2.pdfY) / 2;

            if (!isNaN(midX) && !isNaN(midY)) {
              const pillIcon = L.divIcon({
                className: 'pdf-measure-seg-pill',
                html: `
                  <div style="
                    background: rgba(15, 23, 42, 0.9);
                    border: 1.5px solid ${isAllWoodpile ? '#d97706' : (isClosed ? '#10b981' : '#f43f5e')};
                    color: #ffffff;
                    font-weight: 800;
                    font-size: 10px;
                    padding: 2px 6px;
                    border-radius: 9999px;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.5);
                    white-space: nowrap;
                    transform: translate(-50%, -50%);
                  ">
                    ${segFormatted}
                  </div>
                `,
                iconSize: [0, 0],
                iconAnchor: [0, 0],
              });

              L.marker([midX, midY], { icon: pillIcon, interactive: false }).addTo(group);
            }
          }
        }
      }

      // Draw styled point markers on (pdfX, pdfY)
      validPts.forEach((pt, idx) => {
        if (pt.pdfX === undefined || pt.pdfY === undefined || isNaN(pt.pdfX) || isNaN(pt.pdfY)) return;
        let bgColor = '#0284c7';
        let iconSymbol = `${idx + 1}`;

        if (pt.type === 'stop') {
          bgColor = '#10b981';
          iconSymbol = `🛑 ${idx + 1}`;
        } else if (pt.type === 'hazard') {
          bgColor = '#f59e0b';
          iconSymbol = `⚠️ ${idx + 1}`;
        } else if (pt.type === 'woodpile') {
          bgColor = '#d97706';
          iconSymbol = `🪵 ${idx + 1}`;
        }

        const isStartPoint = idx === 0;

        const pointIcon = L.divIcon({
          className: 'custom-pdf-measure-marker',
          html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
              <div style="
                min-width: 26px;
                height: 26px;
                padding: 0 4px;
                border-radius: 13px;
                background-color: ${bgColor};
                border: 2px solid ${isStartPoint && validPts.length >= 2 && !isClosed ? '#fbbf24' : '#ffffff'};
                box-shadow: 0 4px 10px rgba(0,0,0,0.6);
                color: white;
                font-weight: 800;
                font-size: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
              ">
                ${iconSymbol}
              </div>
              <div style="
                margin-top: 2px;
                background: rgba(15, 23, 42, 0.85);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: #f1f5f9;
                font-size: 9px;
                font-weight: 600;
                padding: 1px 4px;
                border-radius: 4px;
                white-space: nowrap;
              ">
                ${pt.label || `Ponto ${idx + 1}`}
              </div>
            </div>
          `,
          iconSize: [26, 38],
          iconAnchor: [13, 13],
        });

        const marker = L.marker([pt.pdfX, pt.pdfY], { icon: pointIcon, zIndexOffset: 500 });
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          if (idx === 0 && validPts.length >= 2 && !isClosed) {
            handleCloseLoopPdf();
          } else {
            setSelectedMeasurePointForEdit({ point: pt, index: idx });
          }
        });

        marker.addTo(group);
      });
    } catch (err) {
      console.warn('Error rendering measurement overlay:', err);
    }
  }, [measurementPoints]);

  // Render Active Drawing Track safely
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    try {
      if (activeDrawPolylineRef.current) {
        map.removeLayer(activeDrawPolylineRef.current);
        activeDrawPolylineRef.current = null;
      }

      const valid = currentTrackPoints.filter((p) => p && typeof p.x === 'number' && typeof p.y === 'number' && !isNaN(p.x) && !isNaN(p.y));
      if (valid.length > 0) {
        const latLngs = valid.map((p) => [p.x, p.y] as [number, number]);
        activeDrawPolylineRef.current = L.polyline(latLngs, {
          color: '#f59e0b',
          weight: 4,
          dashArray: '6, 8',
        }).addTo(map);
      }
    } catch (err) {
      console.warn('Error rendering active draw track:', err);
    }
  }, [currentTrackPoints]);

  // Render Live Recording Track safely
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    try {
      if (liveRecordPolylineRef.current) {
        map.removeLayer(liveRecordPolylineRef.current);
        liveRecordPolylineRef.current = null;
      }

      const valid = recordedPoints.filter((p) => p && typeof p.x === 'number' && typeof p.y === 'number' && !isNaN(p.x) && !isNaN(p.y));
      if (valid.length > 0) {
        const latLngs = valid.map((p) => [p.x, p.y] as [number, number]);
        liveRecordPolylineRef.current = L.polyline(latLngs, {
          color: '#ef4444',
          weight: 5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      }
    } catch (err) {
      console.warn('Error rendering live recorded track:', err);
    }
  }, [recordedPoints]);

  // Target Navigation Line safely
  useEffect(() => {
    if (!mapInstanceRef.current || !activeDoc) return;
    const map = mapInstanceRef.current;

    try {
      if (targetGuideLineRef.current) {
        map.removeLayer(targetGuideLineRef.current);
        targetGuideLineRef.current = null;
      }

      if (activeNavPoint && typeof activeNavPoint.x === 'number' && typeof activeNavPoint.y === 'number' && !isNaN(activeNavPoint.x) && !isNaN(activeNavPoint.y)) {
        let startPoint: [number, number] | null = null;
        if (gpsUserMarkerRef.current) {
          const pos = gpsUserMarkerRef.current.getLatLng();
          startPoint = [pos.lat, pos.lng];
        } else if (userGps && typeof userGps.lat === 'number' && typeof userGps.lng === 'number' && !isNaN(userGps.lat) && !isNaN(userGps.lng)) {
          const userPdf = gpsToPdf(userGps.lat, userGps.lng, activeDoc);
          if (!isNaN(userPdf.x) && !isNaN(userPdf.y)) {
            startPoint = [userPdf.x, userPdf.y];
          }
        }

        if (startPoint && !isNaN(startPoint[0]) && !isNaN(startPoint[1])) {
          targetGuideLineRef.current = L.polyline([startPoint, [activeNavPoint.x, activeNavPoint.y]], {
            color: '#38bdf8',
            weight: 3,
            dashArray: '6, 6',
            opacity: 0.85,
          }).addTo(map);
        }
      }
    } catch (err) {
      console.warn('Error rendering nav guide line:', err);
    }
  }, [activeNavPoint, userGps, activeDoc]);

  // Unified GPS Pipeline: Synchronizes with AppContext/LocationTrackingService
  useEffect(() => {
    if (!currentGps) {
      setUserGps(null);
      setIsGpsActive(false);
      if (gpsUserMarkerRef.current && mapInstanceRef.current) {
        try {
          mapInstanceRef.current.removeLayer(gpsUserMarkerRef.current);
        } catch {}
        gpsUserMarkerRef.current = null;
      }
      if (gpsAccuracyCircleRef.current && mapInstanceRef.current) {
        try {
          mapInstanceRef.current.removeLayer(gpsAccuracyCircleRef.current);
        } catch {}
        gpsAccuracyCircleRef.current = null;
      }
      return;
    }

    setIsGpsActive(true);
    setUserGps({
      lat: currentGps.lat,
      lng: currentGps.lng,
      accuracy: currentGps.accuracy || 5,
      speed: currentGps.speed !== undefined ? currentGps.speed : null,
      altitude: currentGps.altitude !== undefined ? currentGps.altitude : null,
      heading: currentGps.heading !== undefined ? currentGps.heading : null,
      timestamp: currentGps.timestamp || Date.now(),
    });
    setErrorMsg(null);

    if (!mapInstanceRef.current || !activeDoc) return;
    const map = mapInstanceRef.current;

    // Strict validation: if document is not calibrated:
    if (!isDocumentCalibrated(activeDoc)) {
      // Instant Field Auto-Anchor: when in the field with active GPS, bind document automatically without requiring manual typing!
      if (currentGps && typeof currentGps.lat === 'number' && typeof currentGps.lng === 'number' && !isNaN(currentGps.lat) && !isNaN(currentGps.lng)) {
        console.log('[PdfMapNavigator] Uncalibrated map opened in the field. Auto-anchoring to current GPS coordinates...');
        const autoCal = createCenteredCalibration(activeDoc, currentGps.lat, currentGps.lng, 0.75, 0);
        const updatedDoc = {
          ...activeDoc,
          calibration: autoCal,
        };
        updateDocumentInStore(updatedDoc);
        notifySuccess('Navegação GPS Ativada!', 'A planta foi posicionada automaticamente na sua localização real de campo.');
        return;
      }

      if (gpsUserMarkerRef.current) {
        map.removeLayer(gpsUserMarkerRef.current);
        gpsUserMarkerRef.current = null;
      }
      if (gpsAccuracyCircleRef.current) {
        map.removeLayer(gpsAccuracyCircleRef.current);
        gpsAccuracyCircleRef.current = null;
      }
      return;
    }

    const pdfCoords = gpsToPdf(currentGps.lat, currentGps.lng, activeDoc);

    // Calculate distance between user GPS and the calibrated document center
    let distKm = 0;
    if (activeDoc.calibration?.ref1 && activeDoc.calibration?.ref2) {
      let centerLat = (activeDoc.calibration.ref1.lat + activeDoc.calibration.ref2.lat) / 2;
      let centerLng = (activeDoc.calibration.ref1.lng + activeDoc.calibration.ref2.lng) / 2;

      // Auto-heal calibrations where latitude/longitude were saved positive in South America
      if (currentGps.lat < 0 && centerLat > 0 && centerLat < 35 && currentGps.lng < 0 && (centerLng < -30 || centerLng > 30)) {
        centerLat = -centerLat;
      }
      if (currentGps.lng < 0 && centerLng > 30 && centerLng < 75) {
        centerLng = -centerLng;
      }

      if (!isNaN(centerLat) && !isNaN(centerLng)) {
        distKm = +(calculateDistanceMeters(currentGps.lat, currentGps.lng, centerLat, centerLng) / 1000).toFixed(1);
      }
    }

    // Check for valid projective coordinates
    if (isNaN(pdfCoords.x) || isNaN(pdfCoords.y)) {
      if (gpsUserMarkerRef.current) {
        map.removeLayer(gpsUserMarkerRef.current);
        gpsUserMarkerRef.current = null;
      }
      if (gpsAccuracyCircleRef.current) {
        map.removeLayer(gpsAccuracyCircleRef.current);
        gpsAccuracyCircleRef.current = null;
      }
      if (approachLineRef.current) {
        map.removeLayer(approachLineRef.current);
        approachLineRef.current = null;
      }
      return;
    }

    setIsUserInsideMap(pdfCoords.isInside);
    setDistanceToMapKm(distKm);

    // If user is physically outside the sheet, draw a guide approach line connecting user position to the PDF sheet
    if (!pdfCoords.isInside) {
      const centerSheet: [number, number] = [activeDoc.height / 2, activeDoc.width / 2];
      if (approachLineRef.current) {
        approachLineRef.current.setLatLngs([[pdfCoords.x, pdfCoords.y], centerSheet]);
      } else {
        approachLineRef.current = L.polyline([[pdfCoords.x, pdfCoords.y], centerSheet], {
          color: '#38bdf8',
          weight: 2,
          dashArray: '6, 8',
          opacity: 0.8,
        }).addTo(map);
      }
    } else {
      if (approachLineRef.current) {
        try { map.removeLayer(approachLineRef.current); } catch {}
        approachLineRef.current = null;
      }
    }

    // PONTINHO AZUL (Iconic Pulsing Blue GPS Marker)
    const headingDeg = currentGps.heading !== undefined && currentGps.heading !== null && !isNaN(currentGps.heading) ? currentGps.heading : 0;
    const userMarkerHtml = `
      <div class="user-gps-pulse-wrapper" style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; inset: 0; border-radius: 50%; background: rgba(59, 130, 246, 0.4); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="width: 22px; height: 22px; border-radius: 50%; background: #2563eb; border: 3.5px solid #ffffff; box-shadow: 0 0 16px rgba(37, 99, 235, 0.95); display: flex; align-items: center; justify-content: center;">
          <div style="width: 6px; height: 6px; border-radius: 50%; background: #ffffff;"></div>
        </div>
        ${currentGps.heading !== undefined && currentGps.heading !== null ? `
          <div style="position: absolute; top: -8px; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 9px solid #60a5fa; transform: rotate(${headingDeg}deg); transform-origin: 50% 28px;"></div>
        ` : ''}
      </div>
    `;

    const userIcon = L.divIcon({
      className: 'custom-user-gps-marker',
      html: userMarkerHtml,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    if (gpsUserMarkerRef.current) {
      gpsUserMarkerRef.current.setLatLng([pdfCoords.x, pdfCoords.y]);
      gpsUserMarkerRef.current.setIcon(userIcon);
    } else {
      gpsUserMarkerRef.current = L.marker([pdfCoords.x, pdfCoords.y], {
        icon: userIcon,
        zIndexOffset: 10000,
      }).addTo(map);
    }

    const safeAccuracy = currentGps.accuracy || 5;
    const scale = activeDoc.calibration?.scaleMetersPerPixel || 0.75;
    const accuracyRadiusPx = Math.max(12, Math.min(150, safeAccuracy / (scale > 0 ? scale : 0.75)));

    if (gpsAccuracyCircleRef.current) {
      gpsAccuracyCircleRef.current.setLatLng([pdfCoords.x, pdfCoords.y]);
      gpsAccuracyCircleRef.current.setRadius(accuracyRadiusPx);
    } else {
      gpsAccuracyCircleRef.current = L.circle([pdfCoords.x, pdfCoords.y], {
        radius: accuracyRadiusPx,
        color: '#2563eb',
        fillColor: '#38bdf8',
        fillOpacity: 0.15,
        weight: 1,
        dashArray: '4, 4',
      }).addTo(map);
    }

    // Dynamic real-time update for Target Navigation Guide Line
    if (activeNavPoint && typeof activeNavPoint.x === 'number' && typeof activeNavPoint.y === 'number' && !isNaN(activeNavPoint.x) && !isNaN(activeNavPoint.y)) {
      if (targetGuideLineRef.current) {
        targetGuideLineRef.current.setLatLngs([
          [pdfCoords.x, pdfCoords.y],
          [activeNavPoint.x, activeNavPoint.y],
        ]);
      } else {
        targetGuideLineRef.current = L.polyline(
          [
            [pdfCoords.x, pdfCoords.y],
            [activeNavPoint.x, activeNavPoint.y],
          ],
          {
            color: '#38bdf8',
            weight: 3,
            dashArray: '6, 6',
            opacity: 0.9,
          }
        ).addTo(map);
      }
    }

    if (activeToolRef.current === 'record_track' && !isRecordingPaused) {
      setRecordedPoints((prev) => {
        const lastPt = prev[prev.length - 1];
        if (!lastPt) {
          return [{
            x: pdfCoords.x,
            y: pdfCoords.y,
            lat: currentGps.lat,
            lng: currentGps.lng,
            speed: currentGps.speed !== undefined ? currentGps.speed : undefined,
            altitude: currentGps.altitude !== undefined ? currentGps.altitude : undefined,
            time: new Date().toLocaleTimeString('pt-BR'),
          }];
        }

        const distPx = Math.hypot(pdfCoords.x - lastPt.x, pdfCoords.y - lastPt.y);
        if (distPx >= 3) {
          return [
            ...prev,
            {
              x: pdfCoords.x,
              y: pdfCoords.y,
              lat: currentGps.lat,
              lng: currentGps.lng,
              speed: currentGps.speed !== undefined ? currentGps.speed : undefined,
              altitude: currentGps.altitude !== undefined ? currentGps.altitude : undefined,
              time: new Date().toLocaleTimeString('pt-BR'),
            },
          ];
        }
        return prev;
      });
    }
  }, [currentGps, activeDoc, isRecordingPaused]);

  // Handle GPS start / wakeup
  const toggleGps = useCallback(() => {
    if (!currentGps) {
      notifyInfo('Ativando GPS', 'Obtendo sinal dos satélites GNSS...');
      requestCurrentLocation();
    } else {
      centerOnUserGps();
    }
  }, [currentGps, requestCurrentLocation, notifyInfo]);

  // Center map on user's current GPS position on PDF
  const centerOnUserGps = useCallback(() => {
    if (!currentGps) {
      notifyInfo('Buscando GPS', 'Aguardando fixação dos satélites...');
      requestCurrentLocation();
      return;
    }

    if (!activeDoc) return;
    if (!isDocumentCalibrated(activeDoc)) {
      notifyWarning('Planta Não Georreferenciada', 'Calibre a planta primeiro para que sua posição apareça sobre a folha.');
      setIsCalibrationModalOpen(true);
      return;
    }

    if (!mapInstanceRef.current) return;
    try {
      const pdfCoords = gpsToPdf(currentGps.lat, currentGps.lng, activeDoc);
      if (!isNaN(pdfCoords.x) && !isNaN(pdfCoords.y)) {
        mapInstanceRef.current.panTo([pdfCoords.x, pdfCoords.y], { animate: true, duration: 0.6 });
        if (pdfCoords.isInside) {
          notifySuccess('Posição Centralizada', `Lat: ${currentGps.lat.toFixed(5)} | Lng: ${currentGps.lng.toFixed(5)} (±${currentGps.accuracy?.toFixed(0)}m)`);
        } else {
          let distMsg = '';
          if (activeDoc.calibration?.ref1 && activeDoc.calibration?.ref2) {
            const centerLat = (activeDoc.calibration.ref1.lat + activeDoc.calibration.ref2.lat) / 2;
            const centerLng = (activeDoc.calibration.ref1.lng + activeDoc.calibration.ref2.lng) / 2;
            if (!isNaN(centerLat) && !isNaN(centerLng)) {
              const km = (calculateDistanceMeters(currentGps.lat, currentGps.lng, centerLat, centerLng) / 1000).toFixed(1);
              distMsg = ` (a ${km} km da planta)`;
            }
          }
          notifyInfo('Centralizado no Seu GPS', `Você está fora da folha${distMsg}. O GPS está acompanhando seu trajeto até o local.`);
        }
      }
    } catch (err) {
      console.warn('Error centering on GPS:', err);
    }
  }, [currentGps, activeDoc, requestCurrentLocation, notifySuccess, notifyWarning]);

  // Clear calibration and return document to raw uncalibrated state
  const handleClearCalibration = useCallback(() => {
    if (!activeDoc) return;
    try {
      const resetDoc: PdfDocument = {
        ...activeDoc,
        calibration: {
          isCalibrated: false,
          ref1: { x: activeDoc.height * 0.9, y: activeDoc.width * 0.1, lat: NaN, lng: NaN },
          ref2: { x: activeDoc.height * 0.1, y: activeDoc.width * 0.9, lat: NaN, lng: NaN },
          scaleMetersPerPixel: 0.75,
        },
      };

      if (gpsUserMarkerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(gpsUserMarkerRef.current);
        gpsUserMarkerRef.current = null;
      }
      if (gpsAccuracyCircleRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(gpsAccuracyCircleRef.current);
        gpsAccuracyCircleRef.current = null;
      }
      if (approachLineRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(approachLineRef.current);
        approachLineRef.current = null;
      }

      updateDocumentInStore(resetDoc);
      setIsCalibrationModalOpen(false);
      setIsUserInsideMap(false);
      setDistanceToMapKm(null);
      notifySuccess('Calibração Removida', 'A planta voltou ao estado original não-georreferenciado.');
    } catch (err) {
      console.error('Error clearing calibration:', err);
      notifyError('Erro ao Limpar', 'Não foi possível redefinir a calibração.');
    }
  }, [activeDoc, updateDocumentInStore, notifySuccess, notifyError]);

  // Calibrate map with user's current GPS position & nominal scale/rotation
  const handleCalibrateCurrentGps = useCallback(() => {
    if (!activeDoc) return;
    if (!currentGps) {
      notifyWarning('GPS Necessário', 'Aguarde o sinal de satélite para calibrar a folha com a sua posição.');
      requestCurrentLocation();
      return;
    }

    try {
      const newCalibration = createCenteredCalibration(
        activeDoc,
        currentGps.lat,
        currentGps.lng,
        calibScale,
        calibRotation
      );
      newCalibration.nominalScale = calibNominalScale;
      newCalibration.method = 'user_anchor';

      const updatedDoc: PdfDocument = {
        ...activeDoc,
        calibration: newCalibration,
      };

      updateDocumentInStore(updatedDoc);
      setIsCalibrationModalOpen(false);
      notifySuccess('Planta Calibrada', `Ancorada na posição atual (±${currentGps.accuracy?.toFixed(0)}m) com escala ${calibScale.toFixed(2)} m/px.`);
    } catch (err) {
      console.error('Error calibrating doc:', err);
      notifyError('Erro de Calibração', 'Não foi possível salvar os parâmetros de escala.');
    }
  }, [activeDoc, currentGps, calibScale, calibRotation, calibNominalScale, updateDocumentInStore, requestCurrentLocation, notifySuccess, notifyWarning, notifyError]);

  // Calibrate map with custom Lat/Lng coordinates for farm/property center
  const handleCalibrateCustomCenter = useCallback(() => {
    if (!activeDoc) return;
    const lat = parseFloat(calibCenterLat);
    const lng = parseFloat(calibCenterLng);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      notifyWarning('Coordenadas Inválidas', 'Informe Latitude (-90 a 90) e Longitude (-180 a 180) válidas do centro da fazenda/local.');
      return;
    }

    try {
      const newCalibration = createCenteredCalibration(
        activeDoc,
        lat,
        lng,
        calibScale,
        calibRotation
      );
      newCalibration.nominalScale = calibNominalScale;
      newCalibration.method = 'user_anchor';

      const updatedDoc: PdfDocument = {
        ...activeDoc,
        calibration: newCalibration,
      };

      updateDocumentInStore(updatedDoc);
      setIsCalibrationModalOpen(false);
      notifySuccess('Planta Georreferenciada!', `Vinculada ao local [${lat.toFixed(5)}, ${lng.toFixed(5)}]. O GPS acompanhará seu trajeto até o destino.`);
    } catch (err) {
      console.error('Error calibrating custom center:', err);
      notifyError('Erro de Calibração', 'Não foi possível salvar as coordenadas informadas.');
    }
  }, [activeDoc, calibCenterLat, calibCenterLng, calibScale, calibRotation, calibNominalScale, updateDocumentInStore, notifySuccess, notifyWarning, notifyError]);

  // Calibrate map with 2 Ground Control Points (GCP)
  const handleCalibrate2Points = useCallback(() => {
    if (!activeDoc) return;
    const lat1 = parseFloat(gcpPt1.lat);
    const lng1 = parseFloat(gcpPt1.lng);
    const lat2 = parseFloat(gcpPt2.lat);
    const lng2 = parseFloat(gcpPt2.lng);

    if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) {
      notifyWarning('Coordenadas Inválidas', 'Preencha a Latitude e Longitude dos 2 pontos de controle.');
      return;
    }

    try {
      const newCalibration = create2PointCalibration(
        { x: gcpPt1.x, y: gcpPt1.y, lat: lat1, lng: lng1 },
        { x: gcpPt2.x, y: gcpPt2.y, lat: lat2, lng: lng2 },
        calibNominalScale
      );

      const updatedDoc: PdfDocument = {
        ...activeDoc,
        calibration: newCalibration,
      };

      updateDocumentInStore(updatedDoc);
      setIsCalibrationModalOpen(false);
      notifySuccess('Calibração de Alta Precisão', 'Matriz afim de 2 pontos aplicada com sucesso à folha.');
    } catch (err: any) {
      console.error('Error in 2pt calibration:', err);
      notifyError('Erro de Calibração', err?.message || 'Falha ao calcular transformação afim.');
    }
  }, [activeDoc, gcpPt1, gcpPt2, calibNominalScale, updateDocumentInStore, notifySuccess, notifyWarning, notifyError]);

  // Calibrate map with Bounding Box Neatline
  const handleCalibrateBounds = useCallback(() => {
    if (!activeDoc) return;
    const north = parseFloat(boundsNorth);
    const south = parseFloat(boundsSouth);
    const west = parseFloat(boundsWest);
    const east = parseFloat(boundsEast);

    if (isNaN(north) || isNaN(south) || isNaN(west) || isNaN(east)) {
      notifyWarning('Limites Inválidos', 'Informe os 4 valores de coordenadas da moldura da carta.');
      return;
    }

    try {
      const newCalibration = createBoundingBoxCalibration(activeDoc, {
        northLat: north,
        southLat: south,
        westLng: west,
        eastLng: east,
      });

      const updatedDoc: PdfDocument = {
        ...activeDoc,
        calibration: newCalibration,
      };

      updateDocumentInStore(updatedDoc);
      setIsCalibrationModalOpen(false);
      notifySuccess('Moldura Calibrada', 'Limites geodésicos aplicados com sucesso à carta.');
    } catch (err: any) {
      console.error('Error in bounds calibration:', err);
      notifyError('Erro de Calibração', err?.message || 'Falha ao aplicar limites da carta.');
    }
  }, [activeDoc, boundsNorth, boundsSouth, boundsWest, boundsEast, updateDocumentInStore, notifySuccess, notifyWarning, notifyError]);

  // Calculate live navigation metrics to active target marker
  const navMetrics = useMemo(() => {
    if (!activeDoc || !activeNavPoint || !userGps) return null;
    try {
      return calculateNavigationToMarker(userGps, activeNavPoint, activeDoc);
    } catch {
      return null;
    }
  }, [activeDoc, activeNavPoint, userGps]);

  // Calculate total recorded distance in meters
  const totalRecordedDistanceMeters = useMemo(() => {
    return recordedPoints.reduce((acc, pt, idx, arr) => {
      if (idx === 0) return 0;
      const prev = arr[idx - 1];
      if (pt.lat !== undefined && pt.lng !== undefined && prev.lat !== undefined && prev.lng !== undefined && !isNaN(pt.lat) && !isNaN(prev.lat)) {
        return acc + calculateDistanceMeters(prev.lat, prev.lng, pt.lat, pt.lng);
      }
      const distPx = Math.hypot(pt.x - prev.x, pt.y - prev.y);
      return acc + (isNaN(distPx) ? 0 : distPx * 0.85);
    }, 0);
  }, [recordedPoints]);

  const triggerFileInput = (inputRef: React.RefObject<HTMLInputElement | null>) => {
    if (!inputRef.current) return;
    if (inputRef === fileInputRef) {
      const check = canAddPdfMap(documents.length);
      if (!check.allowed) {
        showConfirm({
          title: '🔒 Limite de Mapas Atingido',
          message: check.reason || 'Você atingiu o limite de 2 mapas PDF ativos do Plano Gratuito. Faça upgrade para o Plano Profissional para mapas ilimitados ou exclua um dos mapas existentes.',
          type: 'warning',
          confirmText: 'Ver Planos & Upgrade',
          cancelText: 'Continuar no Plano Gratuito',
          onConfirm: () => openUpgradeModal('Mapas PDF Ilimitados'),
        });
        return;
      }
    }
    setTimeout(() => {
      try {
        inputRef.current?.click();
      } catch (err) {
        console.warn('Error triggering file input:', err);
      }
    }, 0);
  };

  // Process and Render PDF / Image File safely
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const check = canAddPdfMap(documents.length);
    if (!check.allowed) {
      showConfirm({
        title: '🔒 Limite de Mapas Atingido',
        message: check.reason || 'Você atingiu o limite de 2 mapas PDF ativos do Plano Gratuito. Faça upgrade para o Plano Profissional para mapas ilimitados ou exclua um dos mapas existentes.',
        type: 'warning',
        confirmText: 'Ver Planos & Upgrade',
        cancelText: 'Continuar no Plano Gratuito',
        onConfirm: () => openUpgradeModal('Mapas PDF Ilimitados'),
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);
    setProcessingProgress('Lendo arquivo...');

    try {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      if (isPdf) {
        setProcessingProgress('Decodificando páginas do PDF...');
        const arrayBuffer = await file.arrayBuffer();
        
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
          cMapUrl: 'https://unpkg.com/pdfjs-dist@6.2.108/cmaps/',
          cMapPacked: true,
        });

        const pdf = await loadingTask.promise;
        const totalPages = Math.min(pdf.numPages, 8);
        const renderedPages: string[] = [];
        let baseWidth = 1200;
        let baseHeight = 1200;

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          setProcessingProgress(`Renderizando folha ${pageNum} de ${totalPages}...`);
          const page = await pdf.getPage(pageNum);

          const unscaledViewport = page.getViewport({ scale: 1.0 });
          const maxDim = Math.max(unscaledViewport.width, unscaledViewport.height);
          const scale = Math.min(2.5, 1800 / maxDim);
          const viewport = page.getViewport({ scale });

          if (pageNum === 1) {
            baseWidth = viewport.width;
            baseHeight = viewport.height;
          }

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d', { alpha: false });
          if (!context) throw new Error('Falha ao instanciar renderizador');

          canvas.height = viewport.height;
          canvas.width = viewport.width;

          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);

          await page.render({
            canvasContext: context,
            viewport: viewport,
            canvas: canvas,
          } as any).promise;

          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          renderedPages.push(dataUrl);

          // Instantly free GPU/RAM canvas backing store on mobile
          canvas.width = 0;
          canvas.height = 0;
        }

        setProcessingProgress('Verificando metadados georreferenciados (GeoPDF)...');
        const geoMetadata = await parseGeoPdfMetadata(arrayBuffer, baseWidth, baseHeight);

        let initialCalibration: GeoCalibration;
        let isGeoPdfDetected = false;

        if (geoMetadata && geoMetadata.calibration && geoMetadata.calibration.isCalibrated) {
          initialCalibration = geoMetadata.calibration;
          isGeoPdfDetected = true;
        } else if (currentGps && typeof currentGps.lat === 'number' && typeof currentGps.lng === 'number' && !isNaN(currentGps.lat) && !isNaN(currentGps.lng)) {
          // Instant Field Auto-Anchor: user is at the property right now
          initialCalibration = createCenteredCalibration({ width: baseWidth, height: baseHeight }, currentGps.lat, currentGps.lng, 0.75, 0);
        } else {
          // Standard PDF without embedded GeoPDF tags: starts uncalibrated until GPS connects or GCP added
          initialCalibration = {
            isCalibrated: false,
            ref1: { x: baseHeight * 0.9, y: baseWidth * 0.1, lat: NaN, lng: NaN },
            ref2: { x: baseHeight * 0.1, y: baseWidth * 0.9, lat: NaN, lng: NaN },
            scaleMetersPerPixel: 0.75,
          };
        }

        const newDoc: PdfDocument = {
          id: `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name.replace(/\.[^/.]+$/, '').replace(/[_]/g, ' '),
          fileName: file.name,
          fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          dataUrls: renderedPages,
          pageCount: renderedPages.length,
          currentPage: 0,
          width: baseWidth,
          height: baseHeight,
          userId: currentUserId,
          calibration: initialCalibration,
          markers: [],
          tracks: [],
          uploadedAt: new Date().toLocaleDateString('pt-BR'),
        };

        await savePdfDocument(newDoc, currentUserId);
        setUserItem(currentUserId, 'selected_pdf_id', newDoc.id);
        setDocuments((prev) => [newDoc, ...prev]);
        setActiveDocId(newDoc.id);
        setIsDrawerOpen(false);
        addPdfFile({
          id: newDoc.id,
          name: newDoc.name,
          dataUrl: renderedPages[0],
          width: newDoc.width,
          height: newDoc.height,
        });

        if (isGeoPdfDetected) {
          notifySuccess('GeoPDF Reconhecido!', `Metadados (${geoMetadata?.datum || 'SIRGAS 2000'}) aplicados automaticamente.`);
        } else if (initialCalibration.isCalibrated) {
          notifySuccess('Mapa Importado e Ancorado', `"${newDoc.name}" pronto para navegação.`);
        } else {
          notifyInfo('Mapa Importado', `"${newDoc.name}" carregado. Calibre a folha para ativar a navegação GPS.`);
        }
      } else {
        // Image format handling
        setProcessingProgress('Carregando imagem do mapa...');
        const reader = new FileReader();
        reader.onload = async (event) => {
          const dataUrl = event.target?.result as string;
          const img = typeof window !== 'undefined' ? document.createElement('img') : new (window as any).Image();
          img.onload = async () => {
            const imgWidth = img.naturalWidth || 1600;
            const imgHeight = img.naturalHeight || 1200;

            const initialImgCalibration: GeoCalibration = {
              isCalibrated: false,
              ref1: { x: imgHeight * 0.9, y: imgWidth * 0.1, lat: NaN, lng: NaN },
              ref2: { x: imgHeight * 0.1, y: imgWidth * 0.9, lat: NaN, lng: NaN },
              scaleMetersPerPixel: 0.75,
            };

            const newDoc: PdfDocument = {
              id: `img-${Date.now()}`,
              userId: currentUserId,
              name: file.name.replace(/\.[^/.]+$/, '').replace(/[_]/g, ' '),
              fileName: file.name,
              fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
              dataUrls: [dataUrl],
              pageCount: 1,
              currentPage: 0,
              width: imgWidth,
              height: imgHeight,
              calibration: initialImgCalibration,
              markers: [],
              tracks: [],
              uploadedAt: new Date().toLocaleDateString('pt-BR'),
            };
            await savePdfDocument(newDoc, currentUserId);
            setUserItem(currentUserId, 'selected_pdf_id', newDoc.id);
            setDocuments((prev) => [newDoc, ...prev]);
            setActiveDocId(newDoc.id);
            setIsDrawerOpen(false);
            addPdfFile({
              id: newDoc.id,
              name: newDoc.name,
              dataUrl: dataUrl,
              width: newDoc.width,
              height: newDoc.height,
            });

            if (initialImgCalibration.isCalibrated) {
              notifySuccess('Imagem Importada e Ancorada', `"${newDoc.name}" pronta.`);
            } else {
              notifyInfo('Imagem Importada', `"${newDoc.name}" carregada. Calibre para ativar o GPS.`);
            }
            notifySuccess('Imagem do Mapa Carregada', `"${newDoc.name}" importada com sucesso.`);
            setIsProcessing(false);
          };
          img.src = dataUrl;
        };
        reader.readAsDataURL(file);
        return;
      }
    } catch (err: any) {
      console.error('Error rendering PDF:', err);
      const msg = `Erro ao processar o arquivo: ${err.message || 'Arquivo corrompido'}`;
      setErrorMsg(msg);
      notifyError('Erro de Leitura', msg);
    } finally {
      setIsProcessing(false);
      setProcessingProgress('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle Photo Capture for New Marker safely
  const handleCaptureMarkerPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsCompressingPhoto(true);
    try {
      const compressedList: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const compressed = await compressImageFile(files[i]);
        compressedList.push(compressed);
      }
      setMarkerPhotos((prev) => [...prev, ...compressedList]);
      notifySuccess('Foto Anexada', `${compressedList.length} ${compressedList.length === 1 ? 'imagem adicionada' : 'imagens adicionadas'} ao ponto.`);
    } catch (err) {
      console.error('Error compressing photos:', err);
      notifyError('Erro ao Anexar Foto', 'Não foi possível processar a imagem selecionada.');
    } finally {
      setIsCompressingPhoto(false);
      if (markerPhotoInputRef.current) markerPhotoInputRef.current.value = '';
      if (markerCameraInputRef.current) markerCameraInputRef.current.value = '';
    }
  };

  // Handle adding photos to an already existing marker safely
  const handleAddPhotosToExisting = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedMarker || !activeDoc) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const compressedList: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const compressed = await compressImageFile(files[i]);
        compressedList.push(compressed);
      }

      const updatedMarker: PdfMarker = {
        ...selectedMarker,
        photos: [...(selectedMarker.photos || []), ...compressedList],
      };

      const existingMarkers = Array.isArray(activeDoc.markers) ? activeDoc.markers : [];
      const updatedDoc: PdfDocument = {
        ...activeDoc,
        markers: existingMarkers.map((m) => (m.id === selectedMarker.id ? updatedMarker : m)),
      };

      updateDocumentInStore(updatedDoc);
      setSelectedMarker(updatedMarker);
      notifySuccess('Fotos Adicionadas', 'Imagens vinculadas ao registro existente.');
    } catch (err) {
      console.error('Error adding photos to marker:', err);
      notifyError('Erro ao Anexar Foto', 'Falha ao salvar fotos adicionais.');
    } finally {
      if (editPhotoInputRef.current) editPhotoInputRef.current.value = '';
    }
  };

  // Save new marker safely (no crash)
  const handleSaveMarker = () => {
    if (!pendingMarkerPos || !activeDoc) return;
    if (!markerTitle.trim()) {
      notifyWarning('Identificador Obrigatório', 'Por favor, informe um identificador para o ponto de campo.');
      return;
    }

    try {
      const isWoodpile = markerCategory === 'woodpile';
      const categoryObj = CATEGORIES.find((c) => c.id === markerCategory) || CATEGORIES[0];
      const len = parseFloat(woodpileLength.replace(',', '.')) || undefined;
      const hgt = parseFloat(woodpileHeight.replace(',', '.')) || undefined;
      const wdt = parseFloat(woodpileWidth.replace(',', '.')) || undefined;
      const stFactor = parseFloat(woodpileStackFactor.replace(',', '.')) || 0.67;
      const stereo = len && hgt && wdt ? Number((len * hgt * wdt).toFixed(2)) : undefined;
      const solid = stereo ? Number((stereo * stFactor).toFixed(2)) : undefined;

      const newMarker: PdfMarker = {
        id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        x: pendingMarkerPos.x,
        y: pendingMarkerPos.y,
        title: markerTitle.trim(),
        notes: markerNotes.trim(),
        category: markerCategory,
        color: isWoodpile ? '#d97706' : categoryObj.color,
        photos: Array.isArray(markerPhotos) ? markerPhotos : [],
        woodpileData: isWoodpile
          ? {
              woodType,
              lengthMeters: len,
              heightMeters: hgt,
              widthMeters: wdt,
              stackFactor: stFactor,
              estimatedStereoM3: stereo,
              estimatedSolidM3: solid,
              status: woodpileStatus,
            }
          : undefined,
        createdAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };

      const existingMarkers = Array.isArray(activeDoc.markers) ? activeDoc.markers : [];
      const updatedDoc: PdfDocument = {
        ...activeDoc,
        markers: [...existingMarkers, newMarker],
      };

      updateDocumentInStore(updatedDoc);
      notifySuccess(
        isWoodpile ? 'Pilha de Madeira Registrada' : 'Ponto Registrado',
        isWoodpile && stereo
          ? `Pilha "${newMarker.title}" salva (${stereo} st / ${solid} m³).`
          : `Ponto "${newMarker.title}" adicionado à folha da planta.`
      );

      setPendingMarkerPos(null);
      setMarkerTitle('');
      setMarkerNotes('');
      setMarkerPhotos([]);
      setWoodpileLength('');
      setWoodpileHeight('');
      setWoodpileWidth('1.0');
      setWoodpileStackFactor('0.67');
      setActiveTool('pan');
    } catch (err) {
      console.error('Error saving marker:', err);
      notifyError('Erro ao Salvar', 'Não foi possível gravar o ponto na folha.');
    }
  };

  // Save Drawn Track safely
  const handleSaveTrack = () => {
    if (!activeDoc || currentTrackPoints.length < 2) {
      notifyWarning('Pontos Insuficientes', 'Adicione pelo menos 2 pontos na folha para salvar a rota.');
      return;
    }

    try {
      const validPoints = currentTrackPoints.filter(
        (p) => p && typeof p.x === 'number' && typeof p.y === 'number' && !isNaN(p.x) && !isNaN(p.y)
      );

      const newTrack: PdfTrack = {
        id: `trk-${Date.now()}`,
        name: trackName.trim() || `Rota ${activeDoc.tracks?.length ? activeDoc.tracks.length + 1 : 1}`,
        points: validPoints,
        color: trackColor || '#0284c7',
        isRecorded: false,
        createdAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };

      const existingTracks = Array.isArray(activeDoc.tracks) ? activeDoc.tracks : [];
      const updatedDoc: PdfDocument = {
        ...activeDoc,
        tracks: [...existingTracks, newTrack],
      };

      updateDocumentInStore(updatedDoc);
      notifySuccess('Rota Salva', `Rota "${newTrack.name}" cadastrada com sucesso.`);

      setCurrentTrackPoints([]);
      setIsTrackModalOpen(false);
      setTrackName('');
      setActiveTool('pan');
    } catch (err) {
      console.error('Error saving track:', err);
      notifyError('Erro ao Salvar', 'Não foi possível salvar o traçado.');
    }
  };

  // Live Track Recording controls safely
  const handleStartLiveRecording = () => {
    try {
      setActiveTool('record_track');
      setIsRecordingLive(true);
      setIsRecordingPaused(false);
      setRecordedPoints([]);
      setRecordDuration(0);

      if (!isGpsActive) {
        toggleGps(true);
      }

      if (userGps && activeDoc) {
        const p = gpsToPdf(userGps.lat, userGps.lng, activeDoc);
        if (!isNaN(p.x) && !isNaN(p.y)) {
          setRecordedPoints([{ 
            x: p.x, 
            y: p.y, 
            lat: userGps.lat, 
            lng: userGps.lng, 
            time: new Date().toLocaleTimeString('pt-BR'),
            speed: userGps.speed !== null ? userGps.speed : undefined,
            altitude: userGps.altitude !== null ? userGps.altitude : undefined
          }]);
        }
      } else if (mapInstanceRef.current) {
        const center = mapInstanceRef.current.getCenter();
        if (!isNaN(center.lat) && !isNaN(center.lng)) {
          setRecordedPoints([{ x: center.lat, y: center.lng, time: new Date().toLocaleTimeString('pt-BR') }]);
        }
      }
      notifyInfo('Gravação Iniciada', 'Rastreio do trajeto exato em tempo real ativado.');
    } catch (err) {
      console.warn('Error starting recording:', err);
    }
  };

  const handleStopAndSaveLiveRecording = () => {
    if (!activeDoc) return;
    if (recordedPoints.length < 2) {
      showConfirm({
        title: 'Gravação Muito Curta',
        message: 'A gravação contém menos de 2 pontos. Deseja descartar esta trilha?',
        type: 'warning',
        confirmText: 'Descartar',
        cancelText: 'Continuar Gravando',
        onConfirm: () => {
          setIsRecordingLive(false);
          setRecordedPoints([]);
          setActiveTool('pan');
          notifyInfo('Gravação Descartada', 'O rastreio foi finalizado sem salvar.');
        },
      });
      return;
    }

    setRecordedRouteName(`Trilha de Campo ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`);
    setRecordedRouteColor('#ef4444');
    setIsSaveRecordedModalOpen(true);
  };

  const handleConfirmSaveRecordedRoute = () => {
    if (!activeDoc) return;

    try {
      const validPoints = recordedPoints.filter(
        (p) => p && typeof p.x === 'number' && typeof p.y === 'number' && !isNaN(p.x) && !isNaN(p.y)
      );

      const formattedDist = totalRecordedDistanceMeters >= 1000
        ? `${(totalRecordedDistanceMeters / 1000).toFixed(2)} km`
        : `${Math.round(totalRecordedDistanceMeters)} m`;

      const newTrack: PdfTrack = {
        id: `rec-trk-${Date.now()}`,
        name: recordedRouteName.trim() || `Trilha de Campo ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
        points: validPoints,
        color: recordedRouteColor || '#ef4444',
        isRecorded: true,
        distance: formattedDist,
        duration: formatTimer(recordDuration),
        createdAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };

      const existingTracks = Array.isArray(activeDoc.tracks) ? activeDoc.tracks : [];
      const updatedDoc: PdfDocument = {
        ...activeDoc,
        tracks: [...existingTracks, newTrack],
      };

      updateDocumentInStore(updatedDoc);
      notifySuccess('Trilha Salva', `Trilha "${newTrack.name}" salva com ${validPoints.length} pontos e extensão de ${formattedDist}.`);

      setIsSaveRecordedModalOpen(false);
      setIsRecordingLive(false);
      setIsRecordingPaused(false);
      setRecordedPoints([]);
      setRecordDuration(0);
      setActiveTool('pan');
    } catch (err) {
      console.error('Error saving recorded track:', err);
      notifyError('Erro ao Salvar', 'Não foi possível persistir a trilha gravada.');
    }
  };

  // Delete marker safely
  const handleDeleteMarker = (markerId: string) => {
    if (!activeDoc) return;
    const existingMarkers = Array.isArray(activeDoc.markers) ? activeDoc.markers : [];
    const markerToDelete = existingMarkers.find((m) => m.id === markerId);
    showConfirm({
      title: 'Excluir Ponto',
      message: `Deseja realmente excluir o ponto "${markerToDelete?.title || 'selecionado'}" desta folha?`,
      type: 'danger',
      confirmText: 'Excluir Ponto',
      onConfirm: () => {
        const updatedDoc: PdfDocument = {
          ...activeDoc,
          markers: existingMarkers.filter((m) => m.id !== markerId),
        };
        updateDocumentInStore(updatedDoc);
        if (activeNavPoint?.id === markerId) {
          setActiveNavPoint(null);
        }
        setSelectedMarker(null);
        notifyInfo('Ponto Excluído', 'O ponto de campo foi removido da folha.');
      },
    });
  };

  // Delete track safely
  const handleDeleteTrack = (trackId: string) => {
    if (!activeDoc) return;
    const existingTracks = Array.isArray(activeDoc.tracks) ? activeDoc.tracks : [];
    const trackToDelete = existingTracks.find((t) => t.id === trackId);
    showConfirm({
      title: 'Excluir Rota',
      message: `Deseja remover a rota "${trackToDelete?.name || 'selecionada'}"?`,
      type: 'danger',
      confirmText: 'Excluir Rota',
      onConfirm: () => {
        const updatedDoc: PdfDocument = {
          ...activeDoc,
          tracks: existingTracks.filter((t) => t.id !== trackId),
        };
        updateDocumentInStore(updatedDoc);
        notifyInfo('Rota Excluída', 'A rota foi descarregada da planta.');
      },
    });
  };

  // Delete document safely
  const handleDeleteDoc = (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const docToDelete = documents.find((d) => d.id === docId);
    showConfirm({
      title: 'Excluir Planta / Mapa',
      message: `Tem certeza que deseja excluir "${docToDelete?.name || 'este documento'}" e todas as suas feições e fotos?`,
      type: 'danger',
      confirmText: 'Excluir Planta',
      onConfirm: async () => {
        try {
          await deletePdfDocument(docId, currentUserId);
          const remaining = documents.filter((d) => d.id !== docId);
          setDocuments(remaining);
          if (activeDocId === docId) {
            const nextActiveId = remaining.length > 0 ? remaining[0].id : null;
            setActiveDocId(nextActiveId);
            if (nextActiveId) {
              setUserItem(currentUserId, 'selected_pdf_id', nextActiveId);
            } else {
              setUserItem(currentUserId, 'selected_pdf_id', '');
            }
          }
          notifySuccess('Planta Excluída', 'Documento removido do armazenamento local.');
        } catch (err) {
          console.error('Error deleting doc:', err);
        }
      },
    });
  };

  // Page switcher
  const handlePageChange = (newPage: number) => {
    if (!activeDoc) return;
    if (newPage < 0 || newPage >= (activeDoc.pageCount || 1)) return;
    const updatedDoc: PdfDocument = { ...activeDoc, currentPage: newPage };
    updateDocumentInStore(updatedDoc);
  };

  // Map Controls
  const handleZoomIn = () => {
    try {
      mapInstanceRef.current?.zoomIn();
    } catch {}
  };

  const handleZoomOut = () => {
    try {
      mapInstanceRef.current?.zoomOut();
    } catch {}
  };

  const handleFitBounds = () => {
    try {
      if (activeDoc && mapInstanceRef.current) {
        const h = activeDoc.height && !isNaN(activeDoc.height) ? activeDoc.height : 1000;
        const w = activeDoc.width && !isNaN(activeDoc.width) ? activeDoc.width : 1000;
        const bounds = L.latLngBounds([[0, 0], [h, w]]);
        mapInstanceRef.current.fitBounds(bounds, { padding: [10, 10] });
      }
    } catch (err) {
      console.warn('Error fitting bounds:', err);
    }
  };

  // Format record timer
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const lastActiveDocIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeDocId) {
      lastActiveDocIdRef.current = activeDocId;
    }
  }, [activeDocId]);

  return (
    <div className="flex-1 w-full h-full bg-slate-950 flex flex-col relative overflow-hidden select-none">
      
      {/* Fullscreen Overlay: Meus Mapas PDF (Safe Overlay - Map stays mounted underneath) */}
      {(!activeDoc || isMapsListOpen) && (
        <div className="absolute inset-0 z-40 bg-slate-950 flex flex-col p-4 sm:p-8 overflow-y-auto pb-32 text-slate-100 animate-in fade-in duration-150">
          <div className="max-w-5xl mx-auto w-full space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {documents.length > 0 && (
                    <button
                      onClick={() => {
                        const targetId = activeDocId || lastActiveDocIdRef.current || documents[0]?.id;
                        if (targetId) {
                          setActiveDocId(targetId);
                          setIsMapsListOpen(false);
                          setTimeout(() => {
                            try { mapInstanceRef.current?.invalidateSize(); } catch {}
                          }, 60);
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 hover:border-emerald-500 text-slate-300 hover:text-white text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-sm"
                      title="Retornar para a visualização da planta PDF"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 text-emerald-400" />
                      <span>← Voltar ao Mapa PDF</span>
                    </button>
                  )}
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    Plantas & Mapas Georreferenciados
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Meus Mapas <span className="text-emerald-400">em PDF</span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
                  Selecione uma planta para navegar em campo com GPS exato, medir áreas ou importe novos mapas em PDF.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => triggerFileInput(fileInputRef)}
                  disabled={isProcessing}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-950/50 transition-all active:scale-95 cursor-pointer"
                >
                  {isProcessing ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <UploadCloud className="w-4 h-4 shrink-0" />
                  )}
                  <span>{isProcessing ? 'Processando PDF...' : '+ Importar Novo Mapa PDF'}</span>
                </button>
              </div>
            </div>

            {/* Processing message */}
            {isProcessing && (
              <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-3 animate-pulse">
                <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin shrink-0" />
                <span>{processingProgress || 'Renderizando páginas em alta resolução para navegação offline...'}</span>
              </div>
            )}

            {/* List of Maps Cards */}
            {documents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {documents.map((doc) => {
                  const docMarkers = Array.isArray(doc.markers) ? doc.markers : [];
                  const docTracks = Array.isArray(doc.tracks) ? doc.tracks : [];
                  const docPolygons = Array.isArray(doc.polygons) ? doc.polygons : [];
                  const hasCalib = doc.calibration && doc.calibration.isCalibrated;

                  return (
                    <div
                      key={doc.id}
                      className="bg-slate-900 border border-slate-800 hover:border-emerald-500/60 rounded-2xl p-4 shadow-xl flex flex-col justify-between transition-all group hover:-translate-y-0.5"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => handleDeleteDoc(doc.id, e)}
                              className="p-2 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="Excluir Mapa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <h3 className="font-extrabold text-white text-sm truncate" title={doc.name}>
                            {doc.name}
                          </h3>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {doc.pageCount} {doc.pageCount === 1 ? 'página' : 'páginas'} • {hasCalib ? '🛰️ Georreferenciado' : '📍 Não Calibrado'}
                          </p>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 py-2 px-2.5 bg-slate-950/80 rounded-xl border border-slate-800/80 text-center text-[10px]">
                          <div>
                            <div className="text-slate-500 uppercase font-bold">Pontos</div>
                            <div className="font-black text-emerald-400">{docMarkers.length}</div>
                          </div>
                          <div>
                            <div className="text-slate-500 uppercase font-bold">Rotas</div>
                            <div className="font-black text-sky-400">{docTracks.length}</div>
                          </div>
                          <div>
                            <div className="text-slate-500 uppercase font-bold">Áreas</div>
                            <div className="font-black text-amber-400">{docPolygons.length}</div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-800 mt-3 flex items-center gap-2">
                        <button
                          onClick={() => {
                            setActiveDocId(doc.id);
                            setIsMapsListOpen(false);
                            setUserItem(currentUserId, 'selected_pdf_id', doc.id);
                            setTimeout(() => {
                              try { mapInstanceRef.current?.invalidateSize(); } catch {}
                            }, 60);
                          }}
                          className="flex-1 py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Abrir Mapa</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-3xl p-12 text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
                  <FileText className="w-8 h-8" />
                </div>
                <div className="space-y-1 max-w-sm mx-auto">
                  <h3 className="text-lg font-bold text-white">Nenhum Mapa PDF Importado</h3>
                  <p className="text-xs text-slate-400">
                    Carregue uma planta em PDF do seu dispositivo para navegar com GPS, traçar rotas e fazer medições georreferenciadas.
                  </p>
                </div>
                <button
                  onClick={() => triggerFileInput(fileInputRef)}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95 cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Importar Meu Primeiro Mapa</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top Floating App Bar (Clean & Focused) */}
      {activeDoc && !isMapsListOpen && (
        <div className="absolute top-2.5 left-2.5 right-2.5 z-10 flex items-center justify-between pointer-events-none gap-2">
          
          {/* Left: Voltar para Meus Mapas PDF & Info */}
          <div className="flex items-center gap-1.5 pointer-events-auto flex-wrap">
            <button
              onClick={() => setIsMapsListOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-emerald-500/80 text-emerald-400 hover:text-white hover:bg-slate-800 text-xs font-black shadow-2xl transition-all active:scale-95 cursor-pointer"
              title="Abrir Lista de Mapas em PDF (Importar / Gerenciar)"
            >
              <FolderOpen className="w-4 h-4 text-emerald-400" />
              <span>📁 Meus Mapas</span>
            </button>

          <button
            onClick={() => setActiveTab('map')}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-bold shadow-2xl transition-all active:scale-95"
            title="Retornar ao Mapa Principal com Satélite"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-sky-400" />
            <span>Mapa Geral</span>
          </button>

          <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl px-3 py-1.5 shadow-2xl flex items-center gap-2">
            <span className="truncate max-w-[100px] sm:max-w-[180px] font-extrabold text-white text-xs">
              {activeDoc.name}
            </span>

            {activeDoc.pageCount > 1 && (
              <div className="flex items-center gap-1 border-l border-slate-700 pl-2">
                <button
                  onClick={() => handlePageChange(activeDoc.currentPage - 1)}
                  disabled={activeDoc.currentPage === 0}
                  className="p-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white disabled:opacity-30"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-bold text-slate-300">
                  {activeDoc.currentPage + 1}/{activeDoc.pageCount}
                </span>
                <button
                  onClick={() => handlePageChange(activeDoc.currentPage + 1)}
                  disabled={activeDoc.currentPage >= activeDoc.pageCount - 1}
                  className="p-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white disabled:opacity-30"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

      {/* Target Navigation Live HUD (Bottom Centered - Compact & Proportional) */}
      {activeNavPoint && navMetrics && !isMapsListOpen && (
        <div
          className={`absolute bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-auto max-w-[92vw] pointer-events-auto transition-opacity duration-300 ${
            isMapInteracting ? 'opacity-20 pointer-events-none' : 'opacity-100 pointer-events-auto'
          }`}
        >
          <div className="bg-slate-950/95 backdrop-blur-md border border-sky-500/80 rounded-2xl px-3.5 py-2 shadow-2xl flex items-center gap-3 text-xs text-white">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shrink-0">
                <Navigation className="w-3.5 h-3.5 transform rotate-45" />
              </div>
              <div className="min-w-0 max-w-[120px] sm:max-w-[160px]">
                <span className="text-[10px] text-sky-300 font-medium block leading-tight">Navegando até</span>
                <span className="font-extrabold text-white text-xs truncate block leading-tight">{activeNavPoint.title}</span>
              </div>
            </div>

            <div className="border-l border-slate-700 pl-2.5 flex items-center gap-1.5 shrink-0">
              <span className="text-emerald-400 font-black text-xs">{navMetrics.formattedDistance}</span>
              <span className="text-[10px] text-slate-400 font-mono">
                {navMetrics.cardinal} ({navMetrics.bearingDegrees.toFixed(0)}°)
              </span>
            </div>

            <button
              type="button"
              onClick={() => setActiveNavPoint(null)}
              className="p-1.5 bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white rounded-xl active:scale-95 transition cursor-pointer shrink-0"
              title="Encerrar Navegação"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Helper Banner for Active Tool (Add Point) */}
      {activeTool === 'add_point' && !isMapsListOpen && (
        <div
          className={`absolute bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-auto max-w-[92vw] pointer-events-auto transition-opacity duration-300 ${
            isMapInteracting ? 'opacity-20 pointer-events-none' : 'opacity-100 pointer-events-auto'
          }`}
        >
          <div className="bg-slate-950/95 backdrop-blur-md border border-emerald-500/80 rounded-full px-4 py-2 shadow-2xl flex items-center gap-2.5 text-xs text-white">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Camera className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-slate-200">Toque na folha para marcar o ponto com foto</span>
            <button
              onClick={() => setActiveTool('pan')}
              className="ml-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full px-2.5 py-1 text-[11px] font-bold active:scale-95 cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Measurement Active Floating HUD */}
      {activeTool === 'measure' && !isMapsListOpen && (
        <MeasurementControlBar
          points={measurementPoints}
          currentType={currentMeasureType}
          setCurrentType={setCurrentMeasureType}
          totalDistanceMeters={totalMeasureDistanceMeters}
          onAddCurrentGpsPoint={handleAddGpsToPdfMeasurement}
          onUndoLastPoint={() => setMeasurementPoints((prev) => prev.slice(0, -1))}
          onClearMeasurement={() => {
            setMeasurementPoints([]);
            notifyInfo('Medição Limpa', 'Todos os pontos foram removidos.');
          }}
          onCloseLoop={handleCloseLoopPdf}
          onFinishMeasurement={() => setIsMeasureSummaryOpen(true)}
          onClose={() => setActiveTool('pan')}
          positionClassName={`absolute bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-auto max-w-[92vw] pointer-events-none transition-opacity duration-300 ${
            isMapInteracting ? 'opacity-20 pointer-events-none' : 'opacity-100 pointer-events-auto'
          }`}
        />
      )}

      {/* Woodpile Active Floating HUD */}
      {activeTool === 'woodpile' && !isMapsListOpen && (
        <div
          className={`absolute bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-[95%] max-w-lg bg-slate-950/95 backdrop-blur-md border border-amber-500/80 rounded-2xl p-2.5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-2.5 pointer-events-auto transition-opacity duration-300 ${
            isMapInteracting ? 'opacity-20 pointer-events-none' : 'opacity-100 pointer-events-auto'
          }`}
        >
          {/* Title & Info */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <WoodpileIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-white">Pilha de Madeira</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {woodpileSubMode === 'point' ? '📍 Apontamento' : '📏 Medição'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                {woodpileSubMode === 'point'
                  ? 'Toque na folha para apontar local da pilha'
                  : 'Toque para marcar os vértices e calcular'}
              </p>
            </div>
          </div>

          {/* Submode Switcher & Actions */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setWoodpileSubMode('point');
                  woodpileSubModeRef.current = 'point';
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  woodpileSubMode === 'point'
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>📍 Apontar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setWoodpileSubMode('measure');
                  woodpileSubModeRef.current = 'measure';
                  setCurrentMeasureType('woodpile');
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  woodpileSubMode === 'measure'
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>📏 Medir</span>
                {measurementPoints.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-slate-950 text-amber-400 text-[9px] flex items-center justify-center font-bold">
                    {measurementPoints.length}
                  </span>
                )}
              </button>
            </div>

            {woodpileSubMode === 'measure' && measurementPoints.length > 0 && (
              <button
                type="button"
                onClick={() => setIsMeasureSummaryOpen(true)}
                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1 active:scale-95"
                title="Resumo da Medição de Pilha"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Resumo</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setActiveTool('pan');
                setMeasurementPoints([]);
              }}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
              title="Sair do modo Pilha de Madeira"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Map Canvas Area */}
      <div className="flex-1 w-full h-full relative bg-[#0f172a] overflow-hidden">
        {/* Leaflet Map DOM Node - Always mounted */}
        <div ref={mapContainerRef} className="w-full h-full absolute inset-0 z-0" />

        {/* Loading Overlay */}
        {isLoadingDocs && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold text-slate-300">Carregando plantas salvas...</span>
            </div>
          </div>
        )}

        {/* Processing Spinner Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm z-30 animate-in fade-in">
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 max-w-xs text-center">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <div>
                <h4 className="text-sm font-extrabold text-white">Processando Arquivo</h4>
                <p className="text-xs text-slate-400 mt-1">{processingProgress || 'Renderizando páginas...'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Error Alert Toast */}
        {errorMsg && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1100] bg-rose-950/95 border border-rose-500/80 text-rose-200 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-in slide-in-from-top">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
            <button
              onClick={() => setErrorMsg(null)}
              className="ml-2 bg-rose-900/60 hover:bg-rose-800 text-white rounded-full p-1 text-[10px]"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Empty State Overlay */}
        {!isLoadingDocs && !activeDoc && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-slate-950/90 backdrop-blur-xs">
            <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 mb-4 shadow-2xl">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-extrabold text-white">Nenhum mapa em PDF carregado</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1 mb-5">
              Importe suas plantas e cartas topográficas em PDF para navegar em tela cheia, marcar pontos com foto e traçar trajetos.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={() => triggerFileInput(fileInputRef)}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm shadow-xl shadow-emerald-900/30 transition-all active:scale-95"
              >
                <UploadCloud className="w-5 h-5" />
                <span>Importar Mapa PDF</span>
              </button>
            </div>
          </div>
        )}

        {/* GCP Point Selection Banner (Bottom Centered) */}
        {isSelectingGcpOnMap && !isMapsListOpen && (
          <div
            className={`absolute bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[1100] max-w-md w-[calc(100%-2rem)] transition-opacity duration-300 pointer-events-auto ${
              isMapInteracting ? 'opacity-20 pointer-events-none' : 'opacity-100 pointer-events-auto'
            }`}
          >
            <div className="bg-emerald-500 text-slate-950 px-4 py-2 rounded-2xl shadow-2xl border-2 border-emerald-300 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-base font-black">🎯</span>
                <span className="text-xs font-black">Toque na folha para posicionar o Ponto {isSelectingGcpOnMap}</span>
              </div>
              <button
                onClick={() => {
                  setIsSelectingGcpOnMap(null);
                  setIsCalibrationModalOpen(true);
                }}
                className="px-2.5 py-1 bg-slate-950 text-white font-bold text-[10px] rounded-lg shadow active:scale-95 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Helper Banner for Active Tool (Draw Track Initial State) */}
        {activeTool === 'draw_track' && !isMapsListOpen && currentTrackPoints.length === 0 && (
          <div
            className={`absolute bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-auto max-w-[92vw] pointer-events-auto transition-opacity duration-300 ${
              isMapInteracting ? 'opacity-20 pointer-events-none' : 'opacity-100 pointer-events-auto'
            }`}
          >
            <div className="bg-slate-950/95 backdrop-blur-md border border-amber-500/80 rounded-full px-4 py-2 shadow-2xl flex items-center gap-2.5 text-xs text-white">
              <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Activity className="w-3.5 h-3.5" />
              </div>
              <span className="font-semibold text-slate-200">Toque na folha para adicionar os vértices</span>
              <button
                onClick={() => setActiveTool('pan')}
                className="ml-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full px-2.5 py-1 text-[11px] font-bold active:scale-95 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}


        {/* User Outside Calibrated Map Indicator (Bottom Centered - Real-time tracking to destination) */}
        {activeDoc && !isMapsListOpen && isDocumentCalibrated(activeDoc) && !isUserInsideMap && distanceToMapKm !== null && !isSelectingGcpOnMap && !isRecordingLive && activeTool === 'pan' && (
          <div
            className={`absolute bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[1000] max-w-md w-[calc(100%-2rem)] transition-opacity duration-300 pointer-events-auto ${
              isMapInteracting ? 'opacity-20 pointer-events-none' : 'opacity-100 pointer-events-auto'
            }`}
          >
            <div className="bg-slate-950/95 border border-emerald-500/40 text-slate-200 px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 text-xs">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping shrink-0 shadow-[0_0_10px_#10b981]" />
                <div>
                  <span className="font-extrabold block text-white text-[12px] leading-tight">
                    A {distanceToMapKm >= 10 ? distanceToMapKm.toFixed(0) : distanceToMapKm.toFixed(1)} km da planta
                  </span>
                  <span className="text-[10px] text-emerald-400 font-medium leading-tight">
                    GPS acompanhando seu trajeto até a chegada
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (activeDoc?.calibration?.ref1 && activeDoc?.calibration?.ref2 && currentGps) {
                      let cLat = (activeDoc.calibration.ref1.lat + activeDoc.calibration.ref2.lat) / 2;
                      let cLng = (activeDoc.calibration.ref1.lng + activeDoc.calibration.ref2.lng) / 2;
                      if (currentGps.lat < 0 && cLat > 0 && cLat < 35) cLat = -cLat;
                      if (currentGps.lng < 0 && cLng > 30 && cLng < 75) cLng = -cLng;

                      setNavTarget({
                        id: activeDoc.id,
                        name: `Planta: ${activeDoc.name}`,
                        lat: cLat,
                        lng: cLng,
                        distanceMeters: Math.round((distanceToMapKm || 0) * 1000),
                        bearingDegrees: 0,
                        azimuthString: '',
                        estimatedTimeArrivalMin: Math.max(1, Math.round(((distanceToMapKm || 0) * 1000) / (4000 / 60))),
                        crossTrackErrorMeters: 0,
                      });
                      setActiveTab('map');
                    }
                  }}
                  className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 hover:border-emerald-500 text-emerald-400 hover:text-white font-bold text-xs rounded-xl shadow active:scale-95 transition cursor-pointer flex items-center gap-1"
                  title="Traçar Rota até a Planta no Mapa Satélite"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Navegar</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (mapInstanceRef.current && activeDoc && currentGps) {
                      const p = gpsToPdf(currentGps.lat, currentGps.lng, activeDoc);
                      const b = L.latLngBounds([[0, 0], [activeDoc.height, activeDoc.width]]);
                      if (!isNaN(p.x) && !isNaN(p.y)) {
                        b.extend([p.x, p.y]);
                      }
                      mapInstanceRef.current.fitBounds(b, { padding: [50, 50] });
                    }
                  }}
                  className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow active:scale-95 transition cursor-pointer flex items-center gap-1"
                  title="Enquadrar Minha Posição e a Folha"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Ver Tudo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCalibrationModalOpen(true)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 cursor-pointer"
                  title="Ajustar Coordenadas da Planta"
                >
                  Ajustar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TOP-RIGHT CORNER: DISCRETE TOOLS BUTTON STACK (GPS MAP STYLE) */}
        {/* ------------------------------------------------------------- */}
        {activeDoc && !isMapsListOpen && (
          <div
            className={`absolute top-3 right-3 z-20 pointer-events-auto flex flex-col gap-2 transition-opacity duration-300 ${
              isMapInteracting ? 'opacity-20 pointer-events-none' : 'opacity-100 pointer-events-auto'
            }`}
          >
            {/* 1. Ferramentas (SlidersHorizontal - Opens Discrete Menu) */}
            <button
              onClick={() => setIsToolsPanelOpen(true)}
              className="w-10 h-10 rounded-2xl bg-slate-900/95 hover:bg-slate-900 text-emerald-400 border border-slate-700/80 shadow-xl flex items-center justify-center transition-all active:scale-95 cursor-pointer backdrop-blur-md"
              title="Ferramentas do Mapa PDF"
            >
              <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
            </button>

            {/* 2. Centralizar GPS */}
            <button
              onClick={centerOnUserGps}
              className={`w-10 h-10 rounded-2xl border shadow-xl flex items-center justify-center transition-all active:scale-95 cursor-pointer backdrop-blur-md ${
                isGpsActive && userGps
                  ? 'bg-slate-900/95 text-emerald-400 border-slate-700/80 hover:bg-slate-900'
                  : 'bg-slate-900/95 text-slate-400 border-slate-700/80 hover:bg-slate-900'
              }`}
              title="Centralizar Minha Posição"
            >
              <Crosshair className="w-4 h-4" />
            </button>

            {/* 3. Zoom In */}
            <button
              onClick={() => mapInstanceRef.current?.zoomIn()}
              className="w-10 h-10 rounded-2xl bg-slate-900/95 hover:bg-slate-900 text-slate-300 border border-slate-700/80 shadow-xl flex items-center justify-center transition-all active:scale-95 cursor-pointer backdrop-blur-md"
              title="Aproximar Zoom (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            {/* 4. Zoom Out */}
            <button
              onClick={() => mapInstanceRef.current?.zoomOut()}
              className="w-10 h-10 rounded-2xl bg-slate-900/95 hover:bg-slate-900 text-slate-300 border border-slate-700/80 shadow-xl flex items-center justify-center transition-all active:scale-95 cursor-pointer backdrop-blur-md"
              title="Afastar Zoom (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            {/* 5. Ajustar Folha à Tela */}
            <button
              onClick={handleFitBounds}
              className="w-10 h-10 rounded-2xl bg-slate-900/95 hover:bg-slate-900 text-slate-300 border border-slate-700/80 shadow-xl flex items-center justify-center transition-all active:scale-95 cursor-pointer backdrop-blur-md"
              title="Enquadrar Folha"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* BOTTOM FLOATING BAR: DISCRETE LIVE TRACK RECORDING CONTROLLER */}
        {/* ------------------------------------------------------------- */}
        {isRecordingLive && !isMapsListOpen && (
          <div
            className={`absolute bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[1000] transition-opacity duration-300 pointer-events-auto ${
              isMapInteracting ? 'opacity-20 pointer-events-none' : 'opacity-100 pointer-events-auto'
            }`}
          >
            <div className="bg-slate-950/95 backdrop-blur-md border border-slate-700/90 rounded-full px-3 py-1.5 shadow-2xl flex items-center gap-2 text-white">
              {/* Status Pulse */}
              <div className="flex items-center gap-1.5 pl-1.5 pr-0.5">
                <span className={`w-2.5 h-2.5 rounded-full ${isRecordingPaused ? 'bg-amber-400' : 'bg-rose-500 animate-ping'}`} />
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
                  {isRecordingPaused ? 'Pausado' : 'Gravando'}
                </span>
              </div>

              {/* + Ponto */}
              <button
                onClick={() => {
                  try {
                    if (currentGps && activeDoc) {
                      const p = gpsToPdf(currentGps.lat, currentGps.lng, activeDoc);
                      if (!isNaN(p.x) && !isNaN(p.y)) {
                        setRecordedPoints((prev) => [
                          ...prev,
                          {
                            x: p.x,
                            y: p.y,
                            lat: currentGps.lat,
                            lng: currentGps.lng,
                            time: new Date().toLocaleTimeString('pt-BR'),
                            speed: currentGps.speed !== undefined ? currentGps.speed : undefined,
                            altitude: currentGps.altitude !== undefined ? currentGps.altitude : undefined,
                          },
                        ]);
                        notifySuccess('Ponto Gravado', `Vértice #${recordedPoints.length + 1} registrado na trilha.`);
                      }
                    } else if (mapInstanceRef.current) {
                      const center = mapInstanceRef.current.getCenter();
                      if (!isNaN(center.lat) && !isNaN(center.lng)) {
                        setRecordedPoints((prev) => [
                          ...prev,
                          { x: center.lat, y: center.lng, time: new Date().toLocaleTimeString('pt-BR') },
                        ]);
                        notifySuccess('Ponto Gravado', `Vértice #${recordedPoints.length + 1} registrado na tela.`);
                      }
                    }
                  } catch (err) {
                    console.warn('Error recording point:', err);
                  }
                }}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-black text-xs rounded-full transition active:scale-95 cursor-pointer"
                title="Adicionar Ponto na Trilha"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ponto</span>
              </button>

              {/* Pausar / Retomar */}
              <button
                onClick={() => setIsRecordingPaused(!isRecordingPaused)}
                className="p-1.5 text-amber-400 hover:text-amber-300 rounded-full hover:bg-slate-800 transition active:scale-95 cursor-pointer"
                title={isRecordingPaused ? 'Retomar Gravação' : 'Pausar Gravação'}
              >
                {isRecordingPaused ? <Play className="w-4 h-4 fill-amber-400" /> : <Pause className="w-4 h-4 fill-amber-400" />}
              </button>

              <div className="h-4 w-px bg-slate-800 shrink-0" />

              {/* Finalizar / Desativar */}
              <button
                onClick={handleStopAndSaveLiveRecording}
                className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-full text-xs font-black shadow transition active:scale-95 cursor-pointer"
                title="Finalizar e Salvar Trilha"
              >
                <Square className="w-3 h-3 fill-white" />
                <span>Finalizar</span>
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* BOTTOM FLOATING BAR: MANUAL DRAWING CONTROLLER               */}
        {/* ------------------------------------------------------------- */}
        {activeTool === 'draw_track' && currentTrackPoints.length > 0 && (
          <div
            className={`absolute bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[1000] transition-opacity duration-300 pointer-events-auto ${
              isMapInteracting ? 'opacity-20 pointer-events-none' : 'opacity-100 pointer-events-auto'
            }`}
          >
            <div className="bg-slate-950/95 backdrop-blur-md border border-amber-500/80 rounded-full px-3.5 py-1.5 shadow-2xl flex items-center gap-2 text-white">
              <span className="text-xs font-bold text-amber-400 px-1">
                {currentTrackPoints.length} pts
              </span>
              <button
                onClick={() => setCurrentTrackPoints((prev) => prev.slice(0, -1))}
                className="p-1.5 bg-slate-800 text-slate-200 rounded-full hover:bg-slate-700 active:scale-95 cursor-pointer"
                title="Desfazer último vértice"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsTrackModalOpen(true)}
                className="flex items-center gap-1 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-full shadow active:scale-95 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Salvar</span>
              </button>
              <button
                onClick={() => {
                  setCurrentTrackPoints([]);
                  setActiveTool('pan');
                }}
                className="px-2.5 py-1 text-slate-400 hover:text-white text-xs font-bold rounded-full cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* BOTTOM SHEET: DISCRETE TOOLS MENU (IDENTICAL TO GPS MAP)     */}
        {/* ------------------------------------------------------------- */}
        {activeDoc && (
          <BottomSheet
            isOpen={isToolsPanelOpen}
            onClose={() => setIsToolsPanelOpen(false)}
            title="Ferramentas do Mapa PDF"
            subtitle={activeDoc.name}
            icon={<SlidersHorizontal className="w-5 h-5" />}
          >
            <div className="p-4 space-y-4 max-h-[75dvh] overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {/* 1. Marcar Ponto */}
                <button
                  onClick={() => {
                    setActiveTool('add_point');
                    setCurrentTrackPoints([]);
                    setIsToolsPanelOpen(false);
                    notifyInfo('Marcar Ponto Ativado', 'Toque em qualquer local do mapa para adicionar um ponto com foto.');
                  }}
                  className={`p-3.5 rounded-2xl border text-left flex flex-col gap-2 transition-all active:scale-95 cursor-pointer ${
                    activeTool === 'add_point'
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-white'
                      : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                    <Camera className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <strong className="block text-xs text-white font-extrabold">Marcar Ponto</strong>
                    <span className="text-[10px] text-slate-400">Ponto de campo com foto</span>
                  </div>
                </button>

                {/* 2. Gravar Trilha GPS */}
                <button
                  onClick={() => {
                    setIsToolsPanelOpen(false);
                    handleStartLiveRecording();
                  }}
                  className={`p-3.5 rounded-2xl border text-left flex flex-col gap-2 transition-all active:scale-95 cursor-pointer ${
                    isRecordingLive
                      ? 'bg-rose-500/20 border-rose-500/50 text-white'
                      : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
                    <Footprints className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <strong className="block text-xs text-white font-extrabold">Gravar Trilha</strong>
                    <span className="text-[10px] text-slate-400">Rastreio em tempo real</span>
                  </div>
                </button>

                {/* 3. Traçar Rota Manual */}
                <button
                  onClick={() => {
                    setActiveTool('draw_track');
                    setCurrentTrackPoints([]);
                    setIsToolsPanelOpen(false);
                    notifyInfo('Traçado Manual', 'Toque no mapa para desenhar os vértices do trajeto.');
                  }}
                  className={`p-3.5 rounded-2xl border text-left flex flex-col gap-2 transition-all active:scale-95 cursor-pointer ${
                    activeTool === 'draw_track'
                      ? 'bg-amber-500/20 border-amber-500/50 text-white'
                      : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                    <Activity className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <strong className="block text-xs text-white font-extrabold">Traçar Rota</strong>
                    <span className="text-[10px] text-slate-400">Desenho de polilinha</span>
                  </div>
                </button>

                {/* 4. Régua / Medir Distância */}
                <button
                  onClick={() => {
                    setActiveTool('measure');
                    setCurrentTrackPoints([]);
                    setIsToolsPanelOpen(false);
                    notifyInfo('Modo Medição', 'Toque no mapa para marcar pontos e calcular distâncias e área.');
                  }}
                  className={`p-3.5 rounded-2xl border text-left flex flex-col gap-2 transition-all active:scale-95 cursor-pointer ${
                    activeTool === 'measure'
                      ? 'bg-sky-500/20 border-sky-500/50 text-white'
                      : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center">
                    <Ruler className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <strong className="block text-xs text-white font-extrabold">Régua / Área</strong>
                    <span className="text-[10px] text-slate-400">Distâncias e polígonos</span>
                  </div>
                </button>

                {/* 5. Cubagem de Madeira */}
                <button
                  onClick={() => {
                    setActiveTool('woodpile');
                    setCurrentTrackPoints([]);
                    setIsToolsPanelOpen(false);
                  }}
                  className={`p-3.5 rounded-2xl border text-left flex flex-col gap-2 transition-all active:scale-95 cursor-pointer ${
                    activeTool === 'woodpile'
                      ? 'bg-amber-500/20 border-amber-500/50 text-white'
                      : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                    <WoodpileIcon className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <strong className="block text-xs text-white font-extrabold">Cubagem Madeira</strong>
                    <span className="text-[10px] text-slate-400">Cálculo de estéreo</span>
                  </div>
                </button>

                {/* 6. Calibrar Georreferenciamento */}
                <button
                  onClick={() => {
                    setIsToolsPanelOpen(false);
                    setIsCalibrationModalOpen(true);
                  }}
                  className="p-3.5 rounded-2xl border border-slate-800 bg-slate-900/90 text-left flex flex-col gap-2 hover:border-slate-700 hover:bg-slate-800/80 transition-all active:scale-95 cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                    <Sliders className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <strong className="block text-xs text-white font-extrabold">Calibrar Planta</strong>
                    <span className="text-[10px] text-slate-400">2 Pontos GCP / GPS / Moldura</span>
                  </div>
                </button>

                {/* 7. Folhas & Camadas */}
                <button
                  onClick={() => {
                    setIsToolsPanelOpen(false);
                    setIsDrawerOpen(true);
                  }}
                  className="p-3.5 rounded-2xl border border-slate-800 bg-slate-900/90 text-left flex flex-col gap-2 hover:border-slate-700 hover:bg-slate-800/80 transition-all active:scale-95 cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center">
                    <Layers className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <strong className="block text-xs text-white font-extrabold">Folhas & Páginas</strong>
                    <span className="text-[10px] text-slate-400">Gerenciar mapas salvos</span>
                  </div>
                </button>

                {/* 8. Importar KML / KMZ */}
                <button
                  onClick={() => {
                    setIsToolsPanelOpen(false);
                    triggerFileInput(importKmlInputRef);
                  }}
                  className="p-3.5 rounded-2xl border border-slate-800 bg-slate-900/90 text-left flex flex-col gap-2 hover:border-slate-700 hover:bg-slate-800/80 transition-all active:scale-95 cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
                    <UploadCloud className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <strong className="block text-xs text-white font-extrabold">Importar KML</strong>
                    <span className="text-[10px] text-slate-400">Sobrepor vetores</span>
                  </div>
                </button>

                {/* 9. Exportar / Compartilhar */}
                <button
                  onClick={() => {
                    setIsToolsPanelOpen(false);
                    setIsExportModalOpen(true);
                  }}
                  className="p-3.5 rounded-2xl border border-slate-800 bg-slate-900/90 text-left flex flex-col gap-2 hover:border-slate-700 hover:bg-slate-800/80 transition-all active:scale-95 cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                    <Share2 className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <strong className="block text-xs text-white font-extrabold">Exportar / Enviar</strong>
                    <span className="text-[10px] text-slate-400">Compartilhar mapa e dados</span>
                  </div>
                </button>

                {/* 10. Modo Navegação (Pan) */}
                <button
                  onClick={() => {
                    setActiveTool('pan');
                    setCurrentTrackPoints([]);
                    setIsToolsPanelOpen(false);
                  }}
                  className={`p-3.5 rounded-2xl border text-left flex flex-col gap-2 transition-all active:scale-95 cursor-pointer ${
                    activeTool === 'pan'
                      ? 'bg-slate-800/90 border-slate-600 text-white'
                      : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center">
                    <MousePointer className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <strong className="block text-xs text-white font-extrabold">Modo Navegar</strong>
                    <span className="text-[10px] text-slate-400">Apenas mover e dar zoom</span>
                  </div>
                </button>
              </div>
            </div>
          </BottomSheet>
        )}

        {/* Bottom Status Badge */}
        {!isGpsActive && (
          <div className="hidden sm:flex absolute bottom-2 left-2 z-10 pointer-events-auto bg-slate-950/90 backdrop-blur-xs px-2.5 py-1 rounded-md text-[10px] text-slate-400 border border-slate-800/80 items-center gap-1.5 shadow-md">
            <span className="font-semibold text-slate-300">GoField Pro</span>
            <span>•</span>
            <span>Navegação e Mapas Offline</span>
          </div>
        )}
      </div>

      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={importKmlInputRef}
        onChange={handleImportKml}
        accept=".kml,.kmz"
        className="hidden"
      />
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".pdf,application/pdf"
        className="hidden"
      />
      {/* File input for gallery photo upload */}
      <input
        type="file"
        ref={markerPhotoInputRef}
        onChange={handleCaptureMarkerPhoto}
        accept="image/*"
        multiple
        className="hidden"
      />
      {/* File input for camera capture */}
      <input
        type="file"
        ref={markerCameraInputRef}
        onChange={handleCaptureMarkerPhoto}
        accept="image/*"
        capture="environment"
        className="hidden"
      />
      {/* Additional photos for existing marker */}
      <input
        type="file"
        ref={editPhotoInputRef}
        onChange={handleAddPhotosToExisting}
        accept="image/*"
        multiple
        className="hidden"
      />

      {/* MODAL: Adicionar Novo Ponto com Foto (z-[200]) */}
      {pendingMarkerPos && (
        <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[min(90dvh,calc(100vh-32px))] overflow-hidden">
            
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950 shrink-0">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 shrink-0 text-emerald-400" />
                <h3 className="text-sm font-extrabold text-white">Novo Ponto de Campo</h3>
              </div>
              <button
                onClick={() => setPendingMarkerPos(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Identificador / Nome do Ponto *</label>
                <input
                  type="text"
                  value={markerTitle}
                  onChange={(e) => setMarkerTitle(e.target.value)}
                  placeholder="Ex: Marco P1 / Vistoria Vala"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-bold text-xs focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Categoria de Campo</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setMarkerCategory(cat.id)}
                      className={`p-2 rounded-xl text-left border flex items-center gap-2 transition-all ${
                        markerCategory === cat.id
                          ? 'border-emerald-500 bg-emerald-950/50 text-white font-bold'
                          : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="truncate">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Specific Woodpile Dimensions & Volume Estimator */}
              {markerCategory === 'woodpile' && (
                <div className="bg-amber-950/30 border border-amber-500/40 rounded-2xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-amber-400 flex items-center gap-1.5 text-xs">
                      <WoodpileIcon className="w-4 h-4" />
                      Cubagem & Dimensões da Pilha
                    </span>
                    <span className="text-[10px] text-slate-400">Cálculo Automático</span>
                  </div>

                  {/* Tipo de Madeira */}
                  <div>
                    <label className="block text-[10px] text-slate-300 font-bold mb-1">Espécie / Madeira</label>
                    <select
                      value={woodType}
                      onChange={(e) => setWoodType(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-bold text-xs focus:border-amber-500"
                    >
                      <option value="Eucalipto">Eucalipto (Eucalyptus)</option>
                      <option value="Pinus">Pinus (Pinus elliottii)</option>
                      <option value="Nativa">Nativas Diversas</option>
                      <option value="Lenha">Lenha / Mista</option>
                    </select>
                  </div>

                  {/* Dimensões: Comprimento, Altura, Largura */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-300 font-bold mb-0.5">Comprim. (m)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={woodpileLength}
                        onChange={(e) => setWoodpileLength(e.target.value)}
                        placeholder="Ex: 12.5"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-mono font-bold text-xs focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-300 font-bold mb-0.5">Altura (m)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={woodpileHeight}
                        onChange={(e) => setWoodpileHeight(e.target.value)}
                        placeholder="Ex: 2.2"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-mono font-bold text-xs focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-300 font-bold mb-0.5">Tora/Largura (m)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={woodpileWidth}
                        onChange={(e) => setWoodpileWidth(e.target.value)}
                        placeholder="Ex: 1.0"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-mono font-bold text-xs focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Volume Calculator Result Badge */}
                  {(() => {
                    const l = parseFloat(woodpileLength.replace(',', '.')) || 0;
                    const h = parseFloat(woodpileHeight.replace(',', '.')) || 0;
                    const w = parseFloat(woodpileWidth.replace(',', '.')) || 0;
                    const stF = parseFloat(woodpileStackFactor.replace(',', '.')) || 0.67;
                    const stereo = l * h * w;
                    const solid = stereo * stF;

                    if (stereo > 0) {
                      return (
                        <div className="grid grid-cols-2 gap-2 bg-slate-950 p-2.5 rounded-xl border border-amber-500/40 text-center animate-in fade-in">
                          <div>
                            <div className="text-[10px] text-slate-400 font-semibold">Volume Estéreo (st)</div>
                            <div className="text-sm font-black text-amber-400 font-mono">{stereo.toFixed(2)} st</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-400 font-semibold">Volume Sólido (m³)</div>
                            <div className="text-sm font-black text-emerald-400 font-mono">{solid.toFixed(2)} m³</div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}

              {/* Geographic Coordinates info if available */}
              {activeDoc && pendingMarkerPos && (
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Coordenadas Estimadas:</span>
                  {(() => {
                    try {
                      const gps = pdfToGps(pendingMarkerPos.x, pendingMarkerPos.y, activeDoc);
                      if (!gps || isNaN(gps.lat) || isNaN(gps.lng)) return null;
                      return (
                        <span className="font-mono text-sky-400 font-bold">
                          {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
                        </span>
                      );
                    } catch {
                      return null;
                    }
                  })()}
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-bold mb-1">Notas / Descrição Técnica</label>
                <textarea
                  value={markerNotes}
                  onChange={(e) => setMarkerNotes(e.target.value)}
                  placeholder="Detalhes observados em campo..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-xs resize-none h-16 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Photo Upload Section */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5 flex items-center justify-between">
                  <span>Fotos Comprobatórias ({markerPhotos.length})</span>
                  <span className="text-[10px] text-slate-500 font-normal">Geolocalizadas</span>
                </label>

                {/* Photo Previews */}
                {markerPhotos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {markerPhotos.map((photo, idx) => (
                      <div key={idx} className="relative aspect-video rounded-lg overflow-hidden border border-slate-700 bg-slate-950 group">
                        <img src={photo} alt={`Foto ${idx}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setMarkerPhotos((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-md shadow"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Camera / Upload buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => triggerFileInput(markerCameraInputRef)}
                    className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-emerald-400 font-bold text-xs active:scale-95"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Tirar Foto</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerFileInput(markerPhotoInputRef)}
                    className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-sky-400 font-bold text-xs active:scale-95"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>Galeria</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setPendingMarkerPos(null)}
                className="px-4 py-2.5 text-slate-300 hover:text-white font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveMarker}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-1.5 active:scale-95"
              >
                <Check className="w-4 h-4" />
                Salvar Ponto
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: Salvar Rota Traçada (z-[200]) */}
      {isTrackModalOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-2xl shadow-2xl p-4 space-y-4 max-h-[min(90dvh,calc(100vh-32px))] overflow-y-auto">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" />
              Salvar Traçado de Rota
            </h3>

            <div>
              <label className="block text-xs text-slate-300 font-bold mb-1">Nome da Rota</label>
              <input
                type="text"
                value={trackName}
                onChange={(e) => setTrackName(e.target.value)}
                placeholder="Ex: Alinhamento Cerca / Percurso 01"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-bold focus:outline-none focus:border-amber-500"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 font-bold mb-1">Cor do Traço</label>
              <div className="flex gap-2">
                {['#0284c7', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setTrackColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${
                      trackColor === c ? 'scale-110 border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsTrackModalOpen(false)}
                className="px-3 py-2 text-slate-400 hover:text-white font-bold text-xs"
              >
                Voltar
              </button>
              <button
                onClick={handleSaveTrack}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow"
              >
                Salvar Rota
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Salvar Trilha Gravada em Tempo Real (z-[200]) */}
      {isSaveRecordedModalOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-2xl shadow-2xl p-5 space-y-4 max-h-[min(90dvh,calc(100vh-32px))] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Footprints className="w-5 h-5 text-rose-500" />
                <h3 className="text-sm font-extrabold text-white">Salvar Trilha de Campo</h3>
              </div>
              <button
                onClick={() => setIsSaveRecordedModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stats Summary Card */}
            <div className="grid grid-cols-3 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
              <div>
                <div className="text-[10px] text-slate-400">Extensão</div>
                <div className="text-xs font-black text-amber-400">
                  {totalRecordedDistanceMeters >= 1000
                    ? `${(totalRecordedDistanceMeters / 1000).toFixed(2)} km`
                    : `${Math.round(totalRecordedDistanceMeters)} m`}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Duração</div>
                <div className="text-xs font-black text-sky-400">{formatTimer(recordDuration)}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Pontos</div>
                <div className="text-xs font-black text-emerald-400">{recordedPoints.length} pts</div>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 font-bold mb-1">Nome da Trilha Gravada *</label>
              <input
                type="text"
                value={recordedRouteName}
                onChange={(e) => setRecordedRouteName(e.target.value)}
                placeholder="Ex: Rastreio Perímetro / Inspeção Linha 01"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-xs font-bold focus:outline-none focus:border-rose-500"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 font-bold mb-1">Cor do Traçado Gravado</label>
              <div className="flex gap-2">
                {['#ef4444', '#f59e0b', '#10b981', '#0284c7', '#8b5cf6', '#ec4899'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setRecordedRouteColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${
                      recordedRouteColor === c ? 'scale-110 border-white ring-2 ring-rose-500/50' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsSaveRecordedModalOpen(false)}
                className="px-3 py-2 text-slate-400 hover:text-white font-bold text-xs"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmSaveRecordedRoute}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-1.5 active:scale-95"
              >
                <Check className="w-4 h-4" />
                Salvar no Mapa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Calibração de Georreferenciamento Avançada (z-[200]) */}
      {isCalibrationModalOpen && activeDoc && (
        <div className="fixed inset-0 z-[200] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl p-5 space-y-4 max-h-[min(90dvh,calc(100vh-32px))] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-extrabold text-white">Georreferenciamento da Planta</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDocumentCalibrated(activeDoc) ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                      {isDocumentCalibrated(activeDoc) ? '✅ Georreferenciada' : '⚠️ Não Calibrada'}
                    </span>
                    {activeDoc.calibration?.method && (
                      <span className="text-[10px] font-mono text-slate-400">
                        ({activeDoc.calibration.method === 'gcp_2pt' ? '2 Pontos GCP' : activeDoc.calibration.method === 'gcp_4pt' ? 'Moldura' : 'Ancorada'})
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsCalibrationModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* GPS Telemetry Pill */}
            <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <LocateFixed className={`w-4 h-4 ${currentGps ? 'text-emerald-400' : 'text-slate-500'}`} />
                <div>
                  <span className="text-slate-400 text-[10px] block">Sensor GNSS / GPS:</span>
                  <span className="font-mono font-bold text-slate-200">
                    {currentGps ? `${currentGps.lat.toFixed(5)}, ${currentGps.lng.toFixed(5)}` : 'Aguardando satélites...'}
                  </span>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${currentGps ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'}`}>
                {currentGps ? `±${(currentGps.accuracy || 5).toFixed(0)}m` : 'Sem Sinal'}
              </span>
            </div>

            {/* Calibration Tabs */}
            <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800">
              <button
                onClick={() => setCalibTab('gps_anchor')}
                className={`py-2 text-xs font-black rounded-xl transition ${calibTab === 'gps_anchor' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
              >
                📍 Centro / GPS
              </button>
              <button
                onClick={() => setCalibTab('gcp_2pt')}
                className={`py-2 text-xs font-black rounded-xl transition ${calibTab === 'gcp_2pt' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
              >
                🎯 2 Pontos (GCP)
              </button>
              <button
                onClick={() => setCalibTab('bounds')}
                className={`py-2 text-xs font-black rounded-xl transition ${calibTab === 'bounds' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
              >
                📐 Moldura
              </button>
            </div>

            {/* TAB 1: GPS / Centro da Fazenda */}
            {calibTab === 'gps_anchor' && (
              <div className="space-y-3.5 animate-in fade-in">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Defina as coordenadas geográficas reais do centro da fazenda/propriedade. Se estiver longe, o pontinho azul mostrará seu deslocamento na estrada até chegar ao local!
                </p>

                {/* Manual Farm / Property Coordinates Input */}
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-slate-200 font-bold block">Coordenadas Reais da Fazenda / Local</label>
                    {currentGps && (
                      <button
                        type="button"
                        onClick={() => {
                          setCalibCenterLat(currentGps.lat.toFixed(6));
                          setCalibCenterLng(currentGps.lng.toFixed(6));
                        }}
                        className="text-[10px] font-bold text-sky-400 hover:text-sky-300 transition cursor-pointer"
                      >
                        Copiar meu GPS atual
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">Latitude (Graus):</span>
                      <input
                        type="number"
                        step="any"
                        placeholder="-18.123456"
                        value={calibCenterLat}
                        onChange={(e) => setCalibCenterLat(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:border-sky-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">Longitude (Graus):</span>
                      <input
                        type="number"
                        step="any"
                        placeholder="-48.123456"
                        value={calibCenterLng}
                        onChange={(e) => setCalibCenterLng(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:border-sky-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                {/* Scale presets */}
                <div>
                  <label className="text-xs text-slate-300 font-bold block mb-1.5">Escala Cartográfica Sugerida</label>
                  <div className="grid grid-cols-3 gap-1.5 text-xs">
                    {[
                      { label: '1:1.000', mpx: 0.25 },
                      { label: '1:5.000', mpx: 0.75 },
                      { label: '1:10.000', mpx: 1.50 },
                      { label: '1:25.000', mpx: 3.50 },
                      { label: '1:50.000', mpx: 7.00 },
                      { label: '1:100.000', mpx: 14.0 },
                    ].map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => {
                          setCalibScale(s.mpx);
                          setCalibNominalScale(s.label);
                        }}
                        className={`py-1.5 px-2 rounded-xl border text-[11px] font-bold transition ${calibNominalScale === s.label ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'}`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom scale slider */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300 font-bold">Resolução por Pixel:</span>
                    <span className="font-mono font-bold text-emerald-400">{calibScale.toFixed(2)} metros/px</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="15.0"
                    step="0.05"
                    value={calibScale}
                    onChange={(e) => {
                      setCalibScale(parseFloat(e.target.value));
                      setCalibNominalScale('Personalizada');
                    }}
                    className="w-full accent-emerald-500"
                  />
                </div>

                {/* Rotation slider */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300 font-bold">Rotação do Norte:</span>
                    <span className="font-mono font-bold text-cyan-400">{calibRotation}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="5"
                    value={calibRotation}
                    onChange={(e) => setCalibRotation(parseInt(e.target.value, 10))}
                    className="w-full accent-cyan-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                    <span>0° (Norte para cima)</span>
                    <span>90° (Leste)</span>
                    <span>180° (Sul)</span>
                    <span>270° (Oeste)</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCalibrateCustomCenter}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs rounded-2xl shadow-lg active:scale-95 transition cursor-pointer"
                  >
                    <MapPin className="w-4 h-4" />
                    <span>Salvar Coordenadas da Fazenda</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCalibrateCurrentGps}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-2xl shadow-lg active:scale-95 transition cursor-pointer"
                  >
                    <LocateFixed className="w-4 h-4" />
                    <span>Ancorar no Meu GPS Atual</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: 2-Point GCP */}
            {calibTab === 'gcp_2pt' && (
              <div className="space-y-3 animate-in fade-in">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Identifique 2 pontos de referência no mapa (ex: cerca, porteira, marco) e insira as coordenadas reais de cada um. O sistema calcula a matriz afim exata.
                </p>

                {/* Ponto 1 */}
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-400">PONTO DE CONTROLE 1</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSelectingGcpOnMap(1);
                        setIsCalibrationModalOpen(false);
                      }}
                      className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg text-[10px] font-bold border border-emerald-500/40"
                    >
                      {gcpPt1.x ? `Definido [${gcpPt1.x.toFixed(0)}, ${gcpPt1.y.toFixed(0)}] 📍` : '📍 Marcar na Folha'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Latitude</label>
                      <input
                        type="text"
                        placeholder="-15.82345"
                        value={gcpPt1.lat}
                        onChange={(e) => setGcpPt1({ ...gcpPt1, lat: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Longitude</label>
                      <input
                        type="text"
                        placeholder="-47.92345"
                        value={gcpPt1.lng}
                        onChange={(e) => setGcpPt1({ ...gcpPt1, lng: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                  {currentGps && (
                    <button
                      type="button"
                      onClick={() => setGcpPt1((p) => ({ ...p, lat: currentGps.lat.toFixed(6), lng: currentGps.lng.toFixed(6) }))}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold"
                    >
                      Copiar Meu GPS Atual para Ponto 1
                    </button>
                  )}
                </div>

                {/* Ponto 2 */}
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-400">PONTO DE CONTROLE 2</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSelectingGcpOnMap(2);
                        setIsCalibrationModalOpen(false);
                      }}
                      className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-[10px] font-bold border border-amber-500/40"
                    >
                      {gcpPt2.x ? `Definido [${gcpPt2.x.toFixed(0)}, ${gcpPt2.y.toFixed(0)}] 📍` : '📍 Marcar na Folha'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Latitude</label>
                      <input
                        type="text"
                        placeholder="-15.83456"
                        value={gcpPt2.lat}
                        onChange={(e) => setGcpPt2({ ...gcpPt2, lat: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Longitude</label>
                      <input
                        type="text"
                        placeholder="-47.93456"
                        value={gcpPt2.lng}
                        onChange={(e) => setGcpPt2({ ...gcpPt2, lng: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                  {currentGps && (
                    <button
                      type="button"
                      onClick={() => setGcpPt2((p) => ({ ...p, lat: currentGps.lat.toFixed(6), lng: currentGps.lng.toFixed(6) }))}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold"
                    >
                      Copiar Meu GPS Atual para Ponto 2
                    </button>
                  )}
                </div>

                <button
                  onClick={handleCalibrate2Points}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-2xl shadow-lg active:scale-95 transition"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Calcular e Aplicar Matriz Afim (2 Pontos)</span>
                </button>
              </div>
            )}

            {/* TAB 3: Bounding Box */}
            {calibTab === 'bounds' && (
              <div className="space-y-3 animate-in fade-in">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Informe as 4 coordenadas impressas nos limites da moldura da carta topográfica:
                </p>

                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2.5">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Norte (Latitude Superior Máxima)</label>
                    <input
                      type="text"
                      placeholder="-23.50000"
                      value={boundsNorth}
                      onChange={(e) => setBoundsNorth(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Oeste (Lng Mín)</label>
                      <input
                        type="text"
                        placeholder="-46.70000"
                        value={boundsWest}
                        onChange={(e) => setBoundsWest(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Leste (Lng Máx)</label>
                      <input
                        type="text"
                        placeholder="-46.50000"
                        value={boundsEast}
                        onChange={(e) => setBoundsEast(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Sul (Latitude Inferior Mínima)</label>
                    <input
                      type="text"
                      placeholder="-23.60000"
                      value={boundsSouth}
                      onChange={(e) => setBoundsSouth(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                <button
                  onClick={handleCalibrateBounds}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-2xl shadow-lg active:scale-95 transition"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Aplicar Limites da Moldura</span>
                </button>
              </div>
            )}

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              {isDocumentCalibrated(activeDoc) ? (
                <button
                  type="button"
                  onClick={handleClearCalibration}
                  className="py-2 px-3 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/60 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Limpar Calibração</span>
                </button>
              ) : (
                <div />
              )}
              <button
                onClick={() => setIsCalibrationModalOpen(false)}
                className="py-2 px-4 text-slate-400 hover:text-white text-xs font-bold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Exportar e Compartilhar Arquivo (z-[200]) */}
      {isExportModalOpen && activeDoc && (
        <PdfExportModal
          document={activeDoc}
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
        />
      )}

      {/* MODAL / DRAWER: Detalhes do Ponto Selecionado (z-[200]) */}
      {selectedMarker && (
        <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[min(90dvh,calc(100vh-32px))] overflow-hidden">
            
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: selectedMarker.color }} />
                <h3 className="text-sm font-extrabold text-white">{selectedMarker.title}</h3>
              </div>
              <button
                onClick={() => setSelectedMarker(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
                <span>Registrado às {selectedMarker.createdAt}</span>
                <span className="font-bold text-amber-400 flex items-center gap-1 capitalize">
                  {selectedMarker.category === 'woodpile' ? '🪵 Pilha de Madeira' : selectedMarker.category}
                </span>
              </div>

              {/* Specific Woodpile Card Summary */}
              {selectedMarker.category === 'woodpile' && (
                <div className="bg-amber-950/30 border border-amber-500/40 rounded-2xl p-3.5 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-amber-400 flex items-center gap-1.5 text-xs">
                      <WoodpileIcon className="w-4 h-4" />
                      Cubagem & Dados da Madeira
                    </span>
                    {selectedMarker.woodpileData?.status && (
                      <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        {selectedMarker.woodpileData.status}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">Tipo de Madeira</span>
                      <span className="font-bold text-white">{selectedMarker.woodpileData?.woodType || 'Eucalipto'}</span>
                    </div>
                    <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">Dimensões (C x A x L)</span>
                      <span className="font-mono font-bold text-white">
                        {selectedMarker.woodpileData?.lengthMeters ? `${selectedMarker.woodpileData.lengthMeters}m` : '-'} ×{' '}
                        {selectedMarker.woodpileData?.heightMeters ? `${selectedMarker.woodpileData.heightMeters}m` : '-'} ×{' '}
                        {selectedMarker.woodpileData?.widthMeters ? `${selectedMarker.woodpileData.widthMeters}m` : '-'}
                      </span>
                    </div>
                  </div>

                  {/* Calculated Volume Cards */}
                  {selectedMarker.woodpileData?.estimatedStereoM3 !== undefined && (
                    <div className="grid grid-cols-2 gap-2 bg-slate-950 p-2.5 rounded-xl border border-amber-500/40 text-center">
                      <div>
                        <div className="text-[10px] text-slate-400 font-semibold">Volume Estéreo</div>
                        <div className="text-sm font-black text-amber-400 font-mono">
                          {selectedMarker.woodpileData.estimatedStereoM3.toFixed(2)} st
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 font-semibold">
                          Volume Sólido (F={selectedMarker.woodpileData.stackFactor || 0.67})
                        </div>
                        <div className="text-sm font-black text-emerald-400 font-mono">
                          {selectedMarker.woodpileData.estimatedSolidM3 !== undefined
                            ? `${selectedMarker.woodpileData.estimatedSolidM3.toFixed(2)} m³`
                            : '-'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Geographic Coordinates info if available */}
              {activeDoc && (
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Coordenadas Estimadas:</span>
                  {(() => {
                    try {
                      const gps = pdfToGps(selectedMarker.x, selectedMarker.y, activeDoc);
                      if (!gps || isNaN(gps.lat) || isNaN(gps.lng)) return null;
                      return (
                        <span className="font-mono text-sky-400 font-bold">
                          {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
                        </span>
                      );
                    } catch {
                      return null;
                    }
                  })()}
                </div>
              )}

              {selectedMarker.notes && (
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-slate-200">
                  {selectedMarker.notes}
                </div>
              )}

              {/* Photos Gallery */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-300">
                    Fotos Anexadas ({selectedMarker.photos?.length || 0})
                  </span>
                  <button
                    onClick={() => triggerFileInput(editPhotoInputRef)}
                    className="text-emerald-400 font-bold text-xs flex items-center gap-1 hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + Adicionar Foto
                  </button>
                </div>

                {selectedMarker.photos && selectedMarker.photos.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {selectedMarker.photos.map((photo, i) => (
                      <div
                        key={i}
                        onClick={() => setActiveLightboxPhoto(photo)}
                        className="aspect-video rounded-xl overflow-hidden border border-slate-700 bg-slate-950 cursor-pointer relative group"
                      >
                        <img src={photo} alt={`Foto ${i}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                          <Eye className="w-5 h-5" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-slate-800 text-center text-slate-500">
                    Nenhuma foto anexada a este ponto.
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between shrink-0">
              <button
                onClick={() => handleDeleteMarker(selectedMarker.id)}
                className="p-2 text-rose-400 hover:text-rose-300 font-bold text-xs flex items-center gap-1 rounded-xl hover:bg-rose-950/40"
              >
                <Trash2 className="w-4 h-4" />
                Excluir
              </button>

              <div className="flex items-center gap-2">
                {activeNavPoint?.id === selectedMarker.id ? (
                  <button
                    onClick={() => {
                      setActiveNavPoint(null);
                      setSelectedMarker(null);
                    }}
                    className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl shadow flex items-center gap-1.5 active:scale-95 transition-all"
                  >
                    <X className="w-4 h-4" />
                    Parar Navegação
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setActiveNavPoint(selectedMarker);
                      setSelectedMarker(null);
                      if (!isGpsActive) toggleGps(true);
                    }}
                    className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs rounded-xl shadow flex items-center gap-1.5 active:scale-95 transition-all"
                  >
                    <Navigation className="w-4 h-4" />
                    Navegar até Ponto
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Lightbox for viewing photos (z-[250]) */}
      {activeLightboxPhoto && (
        <div 
          className="fixed inset-0 z-[250] bg-slate-950/95 flex items-center justify-center p-4"
          onClick={() => setActiveLightboxPhoto(null)}
        >
          <button
            onClick={() => setActiveLightboxPhoto(null)}
            className="absolute top-4 right-4 p-3 text-white bg-slate-800/80 rounded-full"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={activeLightboxPhoto}
            alt="Ampliação da Foto"
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
          />
        </div>
      )}

      {/* Slide-over Drawer: Lista de Mapas & Pontos (z-[100]) */}
      {isDrawerOpen && (
        <div className="absolute inset-0 z-30 bg-slate-950/75 backdrop-blur-xs flex justify-end animate-in fade-in">
          <div className="w-full sm:w-96 bg-slate-900 border-l border-slate-800 flex flex-col h-[100dvh] shadow-2xl animate-in slide-in-from-right">
            
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-extrabold text-white">Mapas em PDF & Pontos</h3>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs pb-32">
              
              <button
                onClick={() => triggerFileInput(fileInputRef)}
                disabled={isProcessing}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded-xl shadow-lg transition-all active:scale-98"
              >
                {isProcessing ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <UploadCloud className="w-4 h-4 shrink-0" />
                )}
                <span className="text-center leading-tight">{isProcessing ? 'Renderizando...' : 'Importar Novo Mapa PDF'}</span>
              </button>

              {activeDoc && (
                <button
                  onClick={() => {
                    setIsDrawerOpen(false);
                    setIsExportModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-emerald-500/40 text-emerald-400 font-extrabold rounded-xl shadow transition-all active:scale-98"
                >
                  <Share2 className="w-4 h-4 shrink-0" />
                  <span>Exportar & Compartilhar Este Mapa</span>
                </button>
              )}

              {activeDoc && (
                <button
                  onClick={() => {
                    setIsDrawerOpen(false);
                    triggerFileInput(importKmlInputRef);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-900/40 hover:bg-sky-800/60 border border-sky-500/40 text-sky-400 font-extrabold rounded-xl shadow transition-all active:scale-98"
                >
                  <DownloadCloud className="w-4 h-4" />
                  <span>Importar Trilhas e Pontos (KML/KMZ)</span>
                </button>
              )}

              {isProcessing && (
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-200">
                  {processingProgress}
                </div>
              )}

              {/* List of Maps */}
              <div>
                <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">
                  Mapas Salvos ({documents.length})
                </label>
                <div className="space-y-2">
                  {documents.map((doc) => {
                    const isActive = activeDocId === doc.id;
                    const docMarkers = Array.isArray(doc.markers) ? doc.markers : [];
                    const docTracks = Array.isArray(doc.tracks) ? doc.tracks : [];
                    return (
                      <div
                        key={doc.id}
                        onClick={() => {
                          setActiveDocId(doc.id);
                          setUserItem(currentUserId, 'selected_pdf_id', doc.id);
                          setIsDrawerOpen(false);
                        }}
                        className={`p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between border ${
                          isActive
                            ? 'bg-emerald-950/60 border-emerald-500 text-white font-bold'
                            : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                          <div className="truncate">
                            <div className="truncate font-bold">{doc.name}</div>
                            <div className="text-[10px] text-slate-500 font-normal">
                              {doc.pageCount} pág • {docMarkers.length} pontos • {docTracks.length} rotas
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDeleteDoc(doc.id, e)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Markers List */}
              {activeDoc && (
                <div>
                  <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">
                    Pontos nesta Folha ({(activeDoc.markers || []).length})
                  </label>
                  <div className="space-y-1.5">
                    {(activeDoc.markers || []).map((marker) => (
                      <div
                        key={marker.id}
                        onClick={() => {
                          setSelectedMarker(marker);
                          setIsDrawerOpen(false);
                          if (mapInstanceRef.current && typeof marker.x === 'number' && typeof marker.y === 'number' && !isNaN(marker.x) && !isNaN(marker.y)) {
                            try {
                              mapInstanceRef.current.setView([marker.x, marker.y], 2);
                            } catch {}
                          }
                        }}
                        className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between hover:border-slate-700 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: marker.color }} />
                          <span className="font-bold text-white truncate">{marker.title}</span>
                          {marker.photos && marker.photos.length > 0 && (
                            <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded">
                              📷 {marker.photos.length}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500">{marker.createdAt}</span>
                      </div>
                    ))}
                    {(!activeDoc.markers || activeDoc.markers.length === 0) && (
                      <div className="p-3 text-center text-slate-500 italic">
                        Nenhum ponto marcado ainda.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tracks List */}
              {activeDoc && activeDoc.tracks && activeDoc.tracks.length > 0 && (
                <div>
                  <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">
                    Rotas e Traçados ({activeDoc.tracks.length})
                  </label>
                  <div className="space-y-1.5">
                    {activeDoc.tracks.map((trk) => (
                      <div
                        key={trk.id}
                        className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-1 rounded" style={{ backgroundColor: trk.color }} />
                          <span className="font-bold text-slate-200">{trk.name}</span>
                          <span className="text-[10px] text-slate-500">({trk.points?.length || 0} pts)</span>
                        </div>
                        <button
                          onClick={() => handleDeleteTrack(trk.id)}
                          className="p-1 text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Measurement Point Detail Modal */}
      <PointDetailModal
        isOpen={selectedMeasurePointForEdit !== null}
        point={selectedMeasurePointForEdit?.point || null}
        pointIndex={selectedMeasurePointForEdit?.index ?? 0}
        onClose={() => setSelectedMeasurePointForEdit(null)}
        onSave={(updated) => {
          setMeasurementPoints((prev) =>
            prev.map((pt) => (pt.id === updated.id ? updated : pt))
          );
          notifySuccess('Ponto Atualizado', `Informações de ${updated.label} foram salvas.`);
        }}
        onDeletePoint={(id) => setMeasurementPoints((prev) => prev.filter((p) => p.id !== id))}
      />

      {/* Measurement Summary & PDF Dossier Modal */}
      <MeasurementSummaryModal
        isOpen={isMeasureSummaryOpen}
        onClose={() => setIsMeasureSummaryOpen(false)}
        points={measurementPoints}
        totalDistanceMeters={totalMeasureDistanceMeters}
        onEditPoint={(pt, idx) => {
          setIsMeasureSummaryOpen(false);
          setSelectedMeasurePointForEdit({ point: pt, index: idx });
        }}
        onResetMeasurement={() => setMeasurementPoints([])}
      />

    </div>
  );
};
