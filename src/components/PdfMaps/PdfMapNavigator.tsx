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
  Ruler
} from 'lucide-react';
import L from 'leaflet';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'leaflet/dist/leaflet.css';
import { 
  PdfDocument,
  GeoCalibration, 
  PdfMarker, 
  PdfTrack, 
  PdfTrackPoint,
  getAllPdfDocuments,
  savePdfDocument,
  deletePdfDocument
} from '../../utils/pdfStorage';
import { 
  gpsToPdf, 
  pdfToGps, 
  createCenteredCalibration, 
  calculateNavigationToMarker
} from '../../utils/geoTransform';
import { calculateDistanceMeters } from '../../utils/geoUtils';
import { parseKMLString, parseKMZFile } from '../../utils/kmlParser';
import { KMLFeature, GeoCoordinate } from '../../types';
import { MeasurementPoint, MeasurementPointType } from '../../types';
import { MeasurementControlBar } from '../Map/MeasurementControlBar';
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
        const img = new Image();
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
  const {
    addPdfFile,
    currentGps,
    notifySuccess,
    notifyError,
    notifyWarning,
    notifyInfo,
    showConfirm,
  } = useApp();
  
  // Storage state
  const [documents, setDocuments] = useState<PdfDocument[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);

  // Tools mode: 'pan', 'add_point', 'draw_track', 'record_track', 'measure', 'woodpile'
  const [activeTool, setActiveTool] = useState<'pan' | 'add_point' | 'draw_track' | 'record_track' | 'measure' | 'woodpile'>('pan');

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

  // Calibration Modal state
  const [isCalibrationModalOpen, setIsCalibrationModalOpen] = useState(false);
  const [calibScale, setCalibScale] = useState(0.85);

  // Save Live Recorded Route Modal state
  const [isSaveRecordedModalOpen, setIsSaveRecordedModalOpen] = useState(false);
  const [recordedRouteName, setRecordedRouteName] = useState('');
  const [recordedRouteColor, setRecordedRouteColor] = useState('#ef4444');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const markerPhotoInputRef = useRef<HTMLInputElement>(null);
  const markerCameraInputRef = useRef<HTMLInputElement>(null);
  const editPhotoInputRef = useRef<HTMLInputElement>(null);
  const importKmlInputRef = useRef<HTMLInputElement>(null);

  // KML/KMZ Import Handler
  const handleImportKml = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeDoc) return;
    
    setIsDrawerOpen(false); // Close drawer to show full screen loading
    setIsProcessing(true);
    setProcessingProgress('Importando e decodificando KML/KMZ...');
    
    // Give React time to render the loading screen
    await new Promise(resolve => setTimeout(resolve, 150));
    
    try {
      let features: KMLFeature[] = [];
      if (file.name.toLowerCase().endsWith('.kmz')) {
        const res = await parseKMZFile(file);
        features = res.features;
      } else {
        const text = await file.text();
        features = parseKMLString(text);
      }

      if (!features || features.length === 0) {
        notifyWarning(
          'Nenhum Elemento Encontrado',
          'O arquivo KML/KMZ não contém pontos ou coordenadas geográficas reconhecíveis.'
        );
        return;
      }

      setProcessingProgress(`Projetando ${features.length} elementos na folha do PDF...`);
      await new Promise(resolve => setTimeout(resolve, 80));
      
      // 1. Calculate Bounding Box of all imported coordinates
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
        } else if (feat.type === 'LineString' && Array.isArray(feat.coordinates)) {
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

      // 2. ALWAYS Auto-Anchor the PDF calibration to the KML bounds so nothing is thrown outside the map
      let effectiveCalibration: GeoCalibration;
      
      if (hasValidCoords) {
        const latSpan = Math.abs(maxLat - minLat) || 0.005;
        const lngSpan = Math.abs(maxLng - minLng) || 0.005;
        // 10% padding around the edges
        const latPad = latSpan * 0.1;
        const lngPad = lngSpan * 0.1;

        effectiveCalibration = {
          isCalibrated: true,
          ref1: { x: h * 0.90, y: w * 0.10, lat: maxLat + latPad, lng: minLng - lngPad },
          ref2: { x: h * 0.10, y: w * 0.90, lat: minLat - latPad, lng: maxLng + lngPad },
          scaleMetersPerPixel: 1,
        };
      } else {
        effectiveCalibration = activeDoc.calibration || {
          isCalibrated: false,
          ref1: { x: h * 0.9, y: w * 0.1, lat: -23.5420, lng: -46.6380 },
          ref2: { x: h * 0.1, y: w * 0.9, lat: -23.5540, lng: -46.6220 },
        };
      }

      // Temporary document with effective calibration
      const tempDoc: PdfDocument = {
        ...activeDoc,
        calibration: effectiveCalibration,
      };

      let newTracks: PdfTrack[] = [...(activeDoc.tracks || [])];
      let newMarkers: PdfMarker[] = [...(activeDoc.markers || [])];

      let markersAdded = 0;
      let tracksAdded = 0;
      let wasTruncated = false;

      features.forEach((feat) => {
        if (feat.type === 'Point' && !Array.isArray(feat.coordinates)) {
          if (markersAdded >= 500) {
            wasTruncated = true;
            return;
          }
          const coord = feat.coordinates as GeoCoordinate;
          if (coord && typeof coord.lat === 'number' && typeof coord.lng === 'number' && !isNaN(coord.lat) && !isNaN(coord.lng)) {
            const pdfCoord = gpsToPdf(coord.lat, coord.lng, tempDoc);
            // Strict Clamping inside PDF page canvas
            const clampedX = Math.max(15, Math.min(h - 15, pdfCoord.x));
            const clampedY = Math.max(15, Math.min(w - 15, pdfCoord.y));

            if (!isNaN(clampedX) && !isNaN(clampedY)) {
              newMarkers.push({
                id: `kmz-pt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                x: clampedX,
                y: clampedY,
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
        } else if (feat.type === 'LineString' && Array.isArray(feat.coordinates)) {
          if (tracksAdded >= 150) {
            wasTruncated = true;
            return;
          }
          let pts = (feat.coordinates as GeoCoordinate[])
            .filter((c) => c && typeof c.lat === 'number' && typeof c.lng === 'number' && !isNaN(c.lat) && !isNaN(c.lng))
            .map((c) => {
              const pc = gpsToPdf(c.lat, c.lng, tempDoc);
              const clampedX = Math.max(10, Math.min(h - 10, pc.x));
              const clampedY = Math.max(10, Math.min(w - 10, pc.y));
              return { x: clampedX, y: clampedY, lat: c.lat, lng: c.lng };
            })
            .filter((p) => !isNaN(p.x) && !isNaN(p.y));

          // Downsample high-density tracks to keep Leaflet fast & responsive
          if (pts.length > 500) {
            const step = Math.ceil(pts.length / 500);
            pts = pts.filter((_, idx) => idx % step === 0 || idx === pts.length - 1);
          }

          if (pts.length > 1) {
            newTracks.push({
              id: `kmz-trk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: feat.name || 'Trilha Importada',
              points: pts,
              color: feat.color || '#0284c7',
              createdAt: new Date().toISOString(),
              isRecorded: false,
            });
            tracksAdded++;
          }
        }
      });

      const updatedDoc: PdfDocument = {
        ...activeDoc,
        calibration: effectiveCalibration,
        markers: newMarkers,
        tracks: newTracks,
      };

      updateDocumentInStore(updatedDoc);

      // Re-center camera directly on the PDF document canvas
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.fitBounds([[0, 0], [h, w]], {
            padding: [20, 20],
            animate: true,
          });
        } catch (fitErr) {
          console.warn('Could not fit bounds to PDF image:', fitErr);
        }
      }

      notifySuccess(
        'KML/KMZ Projetado no Mapa',
        wasTruncated
          ? `${markersAdded} pontos e ${tracksAdded} trilhas foram ajustados e desenhados diretamente na sua folha PDF.`
          : `${markersAdded} pontos e ${tracksAdded} trilhas foram ajustados e desenhados diretamente na sua folha PDF.`
      );
    } catch (err) {
      console.error('Error importing KML/KMZ:', err);
      notifyError('Falha na Importação', 'Não foi possível ler as coordenadas do arquivo KML/KMZ fornecido.');
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
  const measureLayerRef = useRef<L.LayerGroup | null>(null);
  const activeDrawPolylineRef = useRef<L.Polyline | null>(null);
  const liveRecordPolylineRef = useRef<L.Polyline | null>(null);
  const targetGuideLineRef = useRef<L.Polyline | null>(null);
  const gpsUserMarkerRef = useRef<L.Marker | null>(null);
  const gpsAccuracyCircleRef = useRef<L.Circle | null>(null);
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
        markers: Array.isArray(updatedDoc.markers) ? updatedDoc.markers : [],
        tracks: Array.isArray(updatedDoc.tracks) ? updatedDoc.tracks : [],
      };
      setDocuments((prev) => prev.map((d) => (d.id === cleanDoc.id ? cleanDoc : d)));
      savePdfDocument(cleanDoc).catch((e) => console.warn('Failed to persist doc', e));
    } catch (err) {
      console.error('Error updating document in store:', err);
    }
  }, []);

  // Initialize Map safely
  const initializeMap = useCallback(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    try {
      const map = L.map(mapContainerRef.current, {
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

            // If clicking near the start point (< 35px in PDF sheet) and length >= 2, snap to close loop
            if (pts.length >= 2) {
              const startPt = pts[0];
              if (typeof startPt.pdfX === 'number' && typeof startPt.pdfY === 'number') {
                const distPx = Math.hypot(lat - startPt.pdfX, lng - startPt.pdfY);
                if (distPx < 35) {
                  const isAlreadyClosed =
                    pts.length >= 3 &&
                    pts[0].lat === pts[pts.length - 1].lat &&
                    pts[0].lng === pts[pts.length - 1].lng;

                  if (!isAlreadyClosed) {
                    const closePt: MeasurementPoint = {
                      id: `pdf-meas-close-${Date.now()}`,
                      lat: startPt.lat,
                      lng: startPt.lng,
                      pdfX: startPt.pdfX,
                      pdfY: startPt.pdfY,
                      altitude: startPt.altitude || 1280,
                      type: 'stop',
                      label: `Fechamento (${startPt.label || 'Ponto 1'})`,
                      notes: 'Vértice conectado exatamente ao início para fechamento de perímetro',
                      photos: [],
                      timestamp: Date.now(),
                    };
                    setMeasurementPoints((prev) => [...prev, closePt]);
                    notifySuccess('Perímetro Fechado', 'Traçado conectado com precisão ao ponto inicial.');
                    return;
                  }
                }
              }
            }

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
        measureLayerRef.current = null;
      }
    };
  }, [initializeMap]);

  // Load documents from IndexedDB on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const docs = await getAllPdfDocuments();
        if (mounted) {
          if (docs.length > 0) {
            setDocuments(docs);
            const requested = localStorage.getItem('geofield_selected_pdf_id');
            const exists = docs.some((d) => d.id === requested);
            if (requested && exists) {
              setActiveDocId(requested);
            } else {
              setActiveDocId(docs[0].id);
            }
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
  }, []);

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
      const bounds = new L.LatLngBounds([0, 0], [h, w]);

      if (imageOverlayRef.current) {
        map.removeLayer(imageOverlayRef.current);
        imageOverlayRef.current = null;
      }

      if (currentDataUrl) {
        try {
          imageOverlayRef.current = L.imageOverlay(currentDataUrl, bounds, { pane: 'pdfImagePane' }).addTo(map);
          map.fitBounds(bounds, { padding: [15, 15] });
          map.setMaxBounds(bounds.pad(1.5));
          
          const baseZoom = map.getBoundsZoom(bounds);
          if (isFinite(baseZoom)) {
            map.setMinZoom(baseZoom - 1.2);
          } else {
            map.setMinZoom(-3);
          }
        } catch (err) {
          console.warn('Error loading image overlay:', err);
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
        let startPoint: [number, number];
        if (userGps && typeof userGps.lat === 'number' && typeof userGps.lng === 'number' && !isNaN(userGps.lat) && !isNaN(userGps.lng)) {
          const userPdf = gpsToPdf(userGps.lat, userGps.lng, activeDoc);
          startPoint = [userPdf.x, userPdf.y];
        } else {
          const center = map.getCenter();
          startPoint = [center.lat, center.lng];
        }

        if (!isNaN(startPoint[0]) && !isNaN(startPoint[1])) {
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

  // Real-time GPS Location Tracker & PDF Coordinate Projection Engine
  const updateUserGpsPosition = useCallback((pos: GeolocationPosition) => {
    try {
      if (!pos || !pos.coords) return;
      const { latitude, longitude, accuracy, speed, altitude, heading } = pos.coords;
      if (typeof latitude !== 'number' || typeof longitude !== 'number' || isNaN(latitude) || isNaN(longitude)) return;

      setUserGps({
        lat: latitude,
        lng: longitude,
        accuracy: typeof accuracy === 'number' && !isNaN(accuracy) ? accuracy : 5,
        speed: typeof speed === 'number' && !isNaN(speed) ? speed : null,
        altitude: typeof altitude === 'number' && !isNaN(altitude) ? altitude : null,
        heading: typeof heading === 'number' && !isNaN(heading) ? heading : null,
        timestamp: pos.timestamp || Date.now(),
      });
      setErrorMsg(null);

      if (!mapInstanceRef.current || !activeDoc) return;
      const map = mapInstanceRef.current;

      const pdfCoords = gpsToPdf(latitude, longitude, activeDoc);
      if (isNaN(pdfCoords.x) || isNaN(pdfCoords.y)) return;

      const headingDeg = heading !== null && !isNaN(heading) ? heading : 0;
      const userMarkerHtml = `
        <div class="user-gps-pulse-wrapper" style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; inset: 0; border-radius: 50%; background: rgba(14, 165, 233, 0.35); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="width: 20px; height: 20px; border-radius: 50%; background: #0284c7; border: 3px solid #ffffff; box-shadow: 0 0 14px rgba(2, 132, 199, 0.9); display: flex; align-items: center; justify-content: center;">
            <div style="width: 6px; height: 6px; border-radius: 50%; background: #ffffff;"></div>
          </div>
          ${heading !== null ? `
            <div style="position: absolute; top: -8px; width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-bottom: 8px solid #38bdf8; transform: rotate(${headingDeg}deg); transform-origin: 50% 26px;"></div>
          ` : ''}
        </div>
      `;

      const userIcon = L.divIcon({
        className: 'custom-user-gps-marker',
        html: userMarkerHtml,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
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

      const safeAccuracy = typeof accuracy === 'number' && !isNaN(accuracy) ? accuracy : 5;
      const accuracyRadiusPx = Math.max(15, Math.min(120, safeAccuracy * 0.8));
      if (gpsAccuracyCircleRef.current) {
        gpsAccuracyCircleRef.current.setLatLng([pdfCoords.x, pdfCoords.y]);
        gpsAccuracyCircleRef.current.setRadius(accuracyRadiusPx);
      } else {
        gpsAccuracyCircleRef.current = L.circle([pdfCoords.x, pdfCoords.y], {
          radius: accuracyRadiusPx,
          color: '#0284c7',
          fillColor: '#38bdf8',
          fillOpacity: 0.12,
          weight: 1,
          dashArray: '4, 4',
        }).addTo(map);
      }

      if (activeToolRef.current === 'record_track' && !isRecordingPaused) {
        setRecordedPoints((prev) => {
          const lastPt = prev[prev.length - 1];
          if (!lastPt) {
            return [{
              x: pdfCoords.x,
              y: pdfCoords.y,
              lat: latitude,
              lng: longitude,
              speed: speed !== null ? speed : undefined,
              altitude: altitude !== null ? altitude : undefined,
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
                lat: latitude,
                lng: longitude,
                speed: speed !== null ? speed : undefined,
                altitude: altitude !== null ? altitude : undefined,
                time: new Date().toLocaleTimeString('pt-BR'),
              },
            ];
          }
          return prev;
        });
      }
    } catch (err) {
      console.warn('Error in GPS update:', err);
    }
  }, [activeDoc, isRecordingPaused]);

  // Handle GPS start / stop watcher
  const toggleGps = useCallback((forceState?: boolean) => {
    const nextState = forceState !== undefined ? forceState : !isGpsActive;

    if (nextState) {
      if (!('geolocation' in navigator)) {
        notifyError('GPS Não Suportado', 'Seu navegador ou dispositivo não possui suporte a geolocalização.');
        return;
      }

      setIsGpsActive(true);
      notifyInfo('GPS Ativado', 'Obtendo localização de satélite em tempo real...');

      try {
        gpsWatchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            updateUserGpsPosition(pos);
          },
          (err) => {
            console.warn('Geolocation watch error:', err);
            let errText = 'Não foi possível obter a localização do dispositivo.';
            if (err.code === err.PERMISSION_DENIED) {
              errText = 'Permissão de localização negada pelo usuário.';
            } else if (err.code === err.POSITION_UNAVAILABLE) {
              errText = 'Sinal de GPS indisponível no momento.';
            } else if (err.code === err.TIMEOUT) {
              errText = 'Tempo limite esgotado ao buscar satélites.';
            }
            setErrorMsg(errText);
          },
          {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 1000,
          }
        );
      } catch (err) {
        console.warn('Failed to start GPS watch:', err);
      }
    } else {
      setIsGpsActive(false);
      if (gpsWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
        gpsWatchIdRef.current = null;
      }
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
      setUserGps(null);
      notifyInfo('GPS Desativado', 'Rastreio de posição pausado.');
    }
  }, [isGpsActive, notifyError, notifyInfo, updateUserGpsPosition]);

  // Clean up GPS watcher on unmount & suspend on background for battery/thermal savings
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (!isRecordingLive && gpsWatchIdRef.current !== null && navigator.geolocation) {
          try {
            navigator.geolocation.clearWatch(gpsWatchIdRef.current);
            gpsWatchIdRef.current = null;
          } catch {}
        }
      } else if (document.visibilityState === 'visible') {
        if (isGpsActive && gpsWatchIdRef.current === null && navigator.geolocation) {
          try {
            gpsWatchIdRef.current = navigator.geolocation.watchPosition(
              (pos) => updateUserGpsPosition(pos),
              (err) => console.warn('GPS resume error:', err),
              { enableHighAccuracy: true, timeout: 12000, maximumAge: 2000 }
            );
          } catch {}
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (gpsWatchIdRef.current !== null) {
        try {
          navigator.geolocation.clearWatch(gpsWatchIdRef.current);
          gpsWatchIdRef.current = null;
        } catch {}
      }
    };
  }, [isRecordingLive, isGpsActive, updateUserGpsPosition]);

  // Center map on user's current GPS position on PDF
  const centerOnUserGps = useCallback(() => {
    if (!userGps) {
      toggleGps(true);
      return;
    }

    if (!mapInstanceRef.current || !activeDoc) return;
    try {
      const pdfCoords = gpsToPdf(userGps.lat, userGps.lng, activeDoc);
      if (!isNaN(pdfCoords.x) && !isNaN(pdfCoords.y)) {
        mapInstanceRef.current.panTo([pdfCoords.x, pdfCoords.y], { animate: true, duration: 0.6 });
        notifySuccess('Localização Centralizada', `Lat: ${userGps.lat.toFixed(5)} | Lng: ${userGps.lng.toFixed(5)}`);
      }
    } catch (err) {
      console.warn('Error centering on GPS:', err);
    }
  }, [userGps, activeDoc, toggleGps, notifySuccess]);

  // Calibrate map with user's current GPS position
  const handleCalibrateCurrentGps = useCallback(() => {
    if (!activeDoc) return;
    if (!userGps) {
      notifyWarning('GPS Necessário', 'Ative o GPS primeiro para calibrar a folha com a sua posição.');
      toggleGps(true);
      return;
    }

    try {
      const newCalibration = createCenteredCalibration(activeDoc, userGps.lat, userGps.lng, calibScale);
      const updatedDoc: PdfDocument = {
        ...activeDoc,
        calibration: newCalibration,
      };

      updateDocumentInStore(updatedDoc);
      setIsCalibrationModalOpen(false);
      notifySuccess('Planta Calibrada', 'A folha do PDF foi ancorada na sua posição geográfica atual.');
    } catch (err) {
      console.error('Error calibrating doc:', err);
      notifyError('Erro de Calibração', 'Não foi possível salvar os parâmetros de escala.');
    }
  }, [activeDoc, userGps, calibScale, updateDocumentInStore, toggleGps, notifySuccess, notifyWarning, notifyError]);

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

  // Process and Render PDF / Image File safely
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
          calibration: createCenteredCalibration(
            null,
            currentGps?.lat || -23.542,
            currentGps?.lng || -46.638,
            0.75
          ),
          markers: [],
          tracks: [],
          uploadedAt: new Date().toLocaleDateString('pt-BR'),
        };

        await savePdfDocument(newDoc);
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

        notifySuccess('Mapa em PDF Importado', `"${newDoc.name}" pronto para navegação e marcações.`);
      } else {
        // Image format handling
        setProcessingProgress('Carregando imagem do mapa...');
        const reader = new FileReader();
        reader.onload = async (event) => {
          const dataUrl = event.target?.result as string;
          const img = new Image();
          img.onload = async () => {
            const newDoc: PdfDocument = {
              id: `img-${Date.now()}`,
              name: file.name.replace(/\.[^/.]+$/, '').replace(/[_]/g, ' '),
              fileName: file.name,
              fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
              dataUrls: [dataUrl],
              pageCount: 1,
              currentPage: 0,
              width: img.naturalWidth || 1600,
              height: img.naturalHeight || 1200,
              calibration: createCenteredCalibration(
                null,
                currentGps?.lat || -23.542,
                currentGps?.lng || -46.638,
                0.75
              ),
              markers: [],
              tracks: [],
              uploadedAt: new Date().toLocaleDateString('pt-BR'),
            };
            await savePdfDocument(newDoc);
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
          await deletePdfDocument(docId);
          const remaining = documents.filter((d) => d.id !== docId);
          setDocuments(remaining);
          if (activeDocId === docId) {
            setActiveDocId(remaining.length > 0 ? remaining[0].id : null);
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
    if (newPage < 0 || newPage >= activeDoc.pageCount) return;
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
        const bounds = new L.LatLngBounds([0, 0], [h, w]);
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

  return (
    <div className="flex-1 w-full h-full bg-slate-950 flex flex-col relative overflow-hidden select-none">
      
      {/* Top Floating App Bar */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-[1000] flex items-center justify-between pointer-events-none gap-2">
        
        {/* Left: Document Info, Drawer Opener & Page Navigation */}
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl px-3 py-1.5 shadow-2xl flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-1.5 text-xs font-extrabold text-white hover:text-emerald-400 transition-colors"
            title="Abrir Camadas, Mapas, Pontos e Rotas"
          >
            <List className="w-4 h-4 shrink-0 text-emerald-400 shrink-0" />
            <span className="truncate max-w-[110px] sm:max-w-[180px]">
              {activeDoc ? activeDoc.name : 'Nenhum Mapa'}
            </span>
          </button>

          {activeDoc && activeDoc.pageCount > 1 && (
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

        {/* Center / Right Tactical Toolbar (GPS, Calibration, Export & Zoom Controls) */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          
          {/* GPS Live Tracking Toggle Button */}
          <button
            onClick={() => toggleGps()}
            className={`px-3 py-1.5 rounded-2xl border text-xs font-extrabold flex items-center gap-1.5 shadow-2xl transition-all active:scale-95 ${
              isGpsActive
                ? 'bg-sky-600 border-sky-400 text-white shadow-sky-900/60 ring-2 ring-sky-400/40'
                : 'bg-slate-900/95 backdrop-blur-md border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title={isGpsActive ? 'Desativar GPS' : 'Ativar Minha Localização GPS no Mapa'}
          >
            <LocateFixed className={`w-4 h-4 ${isGpsActive ? 'animate-spin' : 'text-sky-400'}`} style={{ animationDuration: '4s' }} />
            <span className="hidden sm:inline">{isGpsActive ? 'GPS Ativo' : 'Meu GPS'}</span>
          </button>

          {/* Quick Center on GPS button (when GPS is active) */}
          {isGpsActive && userGps && (
            <button
              onClick={centerOnUserGps}
              className="p-2 bg-sky-950/90 hover:bg-sky-900 border border-sky-500/80 text-sky-200 rounded-2xl shadow-xl active:scale-95"
              title="Centralizar na Minha Posição"
            >
              <Crosshair className="w-4 h-4 text-sky-400" />
            </button>
          )}

          

          {/* Export & Share Modal Opener */}
          {activeDoc && (
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="px-3 py-1.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-emerald-400/60 text-xs font-extrabold flex items-center gap-1.5 shadow-2xl transition-all active:scale-95"
              title="Exportar e Compartilhar Mapa com Marcações (KML, GPX, GeoJSON, PDF)"
            >
              <Share2 className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline">Exportar</span>
            </button>
          )}

          {/* Calibrate GPS Coordinates */}
          {activeDoc && (
            <button
              onClick={() => setIsCalibrationModalOpen(true)}
              className="p-2 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 text-slate-300 hover:text-amber-400 hover:bg-slate-800 rounded-2xl shadow-2xl active:scale-95"
              title="Calibrar Georreferenciamento da Folha"
            >
              <Sliders className="w-4 h-4" />
            </button>
          )}

          {/* Zoom / Fullscreen Group */}
          <div className="flex items-center gap-0.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-1 shadow-2xl">
            <button
              onClick={handleZoomIn}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              title="Aproximar Zoom"
            >
              <ZoomIn className="w-4 h-4 shrink-0" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              title="Afastar Zoom"
            >
              <ZoomOut className="w-4 h-4 shrink-0" />
            </button>
            <button
              onClick={handleFitBounds}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              title="Ajustar à Tela"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={toggleFullscreen}
              className={`p-1.5 rounded-xl transition-colors ${
                isFullscreen ? 'bg-sky-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="Modo Tela Cheia"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Target Navigation Live HUD */}
      {activeNavPoint && navMetrics && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/95 backdrop-blur-md border border-sky-500 rounded-2xl px-4 py-2 shadow-2xl flex items-center gap-3 text-xs font-bold text-white pointer-events-auto animate-in fade-in">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-sky-500/20 border border-sky-500 flex items-center justify-center text-sky-400">
              <Navigation className="w-3.5 h-3.5 transform rotate-45" />
            </div>
            <div>
              <div className="text-[10px] text-sky-300 font-normal">Navegando até</div>
              <div className="font-extrabold text-white truncate max-w-[130px]">{activeNavPoint.title}</div>
            </div>
          </div>

          <div className="border-l border-slate-700 pl-3 flex items-center gap-2">
            <span className="text-emerald-400 font-black text-sm">{navMetrics.formattedDistance}</span>
            <span className="text-[11px] text-slate-400 font-mono">
              {navMetrics.cardinal} ({navMetrics.bearingDegrees.toFixed(0)}°)
            </span>
          </div>

          <button
            onClick={() => setActiveNavPoint(null)}
            className="ml-2 px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
            title="Encerrar Navegação"
          >
            <X className="w-3.5 h-3.5" />
            <span className="uppercase tracking-wider font-extrabold text-[10px]">Parar</span>
          </button>
        </div>
      )}

      {/* Helper Banner for Active Tool */}
      {activeTool === 'add_point' && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[1000] bg-emerald-600 text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 text-xs font-black animate-bounce pointer-events-auto">
          <Camera className="w-4 h-4" />
          <span>Toque na folha do PDF onde deseja marcar o ponto</span>
          <button
            onClick={() => setActiveTool('pan')}
            className="ml-2 bg-emerald-800/80 hover:bg-emerald-900 rounded-full px-2 py-0.5 text-[10px]"
          >
            Cancelar
          </button>
        </div>
      )}

      {activeTool === 'draw_track' && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[1000] bg-amber-600 text-slate-950 px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 text-xs font-black pointer-events-auto">
          <Activity className="w-4 h-4" />
          <span>Toque na folha para adicionar os vértices da rota ({currentTrackPoints.length} marcados)</span>
        </div>
      )}

      {/* Measurement Active Floating HUD */}
      {activeTool === 'measure' && (
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
        />
      )}

      {/* Woodpile Active Floating HUD */}
      {activeTool === 'woodpile' && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] w-[95%] max-w-xl bg-slate-900/95 backdrop-blur-md border border-amber-500/80 rounded-2xl p-2.5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-2.5 animate-in slide-in-from-top duration-200 pointer-events-auto">
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
                  ? 'Toque na folha para apontar local da pilha com foto e volume'
                  : 'Toque para marcar os vértices e calcular o comprimento da pilha'}
              </p>
            </div>
          </div>

          {/* Submode Switcher & Actions */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
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
                  <span className="w-4 h-4 rounded-full bg-slate-900 text-amber-400 text-[9px] flex items-center justify-center font-bold">
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
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm shadow-xl shadow-emerald-900/30 transition-all active:scale-95"
              >
                <UploadCloud className="w-5 h-5" />
                <span>Importar Mapa PDF</span>
              </button>
            </div>
          </div>
        )}

        {/* Live Track Recording Indicator Banner & Telemetry */}
        {isRecordingLive && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[1000] bg-rose-950/95 backdrop-blur-md border border-rose-500 rounded-2xl px-4 py-2 shadow-2xl flex items-center gap-3 animate-in fade-in pointer-events-auto">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
              <span className="text-xs font-black text-rose-200">
                {isRecordingPaused ? 'PAUSADO' : 'GRAVANDO TRILHA'}
              </span>
            </div>
            <div className="font-mono text-xs font-bold text-white bg-slate-950/90 px-2 py-0.5 rounded-lg border border-slate-800">
              ⏱️ {formatTimer(recordDuration)}
            </div>
            <div className="text-xs font-bold text-amber-300 bg-slate-950/90 px-2 py-0.5 rounded-lg border border-slate-800">
              📏 {totalRecordedDistanceMeters >= 1000 ? `${(totalRecordedDistanceMeters / 1000).toFixed(2)} km` : `${Math.round(totalRecordedDistanceMeters)} m`}
            </div>
            <span className="text-[11px] text-rose-300 font-semibold hidden sm:inline">
              📍 {recordedPoints.length} pts
            </span>
          </div>
        )}

        {/* Live GPS Telemetry Overlay Badge (Bottom Left) */}
        {isGpsActive && userGps && (
          <div className="absolute bottom-2 left-2 z-10 pointer-events-auto bg-slate-900/95 backdrop-blur-md border border-sky-500/80 rounded-2xl px-3 py-2 shadow-2xl flex items-center gap-3 text-xs text-slate-200">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
              <span className="font-mono font-black text-sky-300">
                {userGps.lat.toFixed(5)}, {userGps.lng.toFixed(5)}
              </span>
            </div>
            <div className="border-l border-slate-700 pl-2 text-[11px] text-slate-400 flex items-center gap-2">
              <span>±{userGps.accuracy.toFixed(1)}m</span>
              {userGps.speed !== null && userGps.speed !== undefined && (
                <span className="text-emerald-400 font-bold">{(userGps.speed * 3.6).toFixed(1)} km/h</span>
              )}
            </div>
            <button
              onClick={centerOnUserGps}
              className="p-1 text-sky-400 hover:text-white rounded-lg hover:bg-slate-800"
              title="Centralizar na Posição"
            >
              <Crosshair className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Lateral Tactical Action Dock (Right Side - Thumb Ergonomic, z-[1000]) */}
        {activeDoc && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 z-[1000] flex flex-col items-end gap-2 pointer-events-none max-h-[calc(100dvh-5rem)]">
            
            {/* Context Sub-Tool Bar (Drawing Actions - positioned to the left of the dock) */}
            {activeTool === 'draw_track' && currentTrackPoints.length > 0 && (
              <div className="bg-slate-900/95 backdrop-blur-md border border-amber-500/80 rounded-2xl p-2 shadow-2xl flex flex-col sm:flex-row items-center gap-1.5 pointer-events-auto animate-in slide-in-from-right duration-200">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-amber-400 px-2">
                    {currentTrackPoints.length} pts
                  </span>
                  <button
                    onClick={() => setCurrentTrackPoints((prev) => prev.slice(0, -1))}
                    className="p-2 bg-slate-800 text-slate-200 rounded-xl hover:bg-slate-700 active:scale-95"
                    title="Desfazer último vértice"
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsTrackModalOpen(true)}
                    className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow flex items-center gap-1 active:scale-95"
                  >
                    <Check className="w-4 h-4" />
                    Salvar
                  </button>
                  <button
                    onClick={() => {
                      setCurrentTrackPoints([]);
                      setActiveTool('pan');
                    }}
                    className="px-2.5 py-2 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-700 active:scale-95"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Context Sub-Tool Bar (Live Recording Actions - positioned to the left of the dock) */}
            {activeTool === 'record_track' && isRecordingLive && (
              <div className="bg-slate-900/95 backdrop-blur-md border border-rose-500/80 rounded-2xl p-2 shadow-2xl flex flex-col sm:flex-row items-center gap-1.5 pointer-events-auto animate-in slide-in-from-right duration-200">
                <button
                  onClick={() => {
                    try {
                      if (userGps && activeDoc) {
                        const p = gpsToPdf(userGps.lat, userGps.lng, activeDoc);
                        if (!isNaN(p.x) && !isNaN(p.y)) {
                          setRecordedPoints((prev) => [
                            ...prev,
                            { 
                              x: p.x, 
                              y: p.y, 
                              lat: userGps.lat, 
                              lng: userGps.lng, 
                              time: new Date().toLocaleTimeString('pt-BR'),
                              speed: userGps.speed !== null ? userGps.speed : undefined,
                              altitude: userGps.altitude !== null ? userGps.altitude : undefined
                            }
                          ]);
                        }
                      } else if (mapInstanceRef.current) {
                        const center = mapInstanceRef.current.getCenter();
                        if (!isNaN(center.lat) && !isNaN(center.lng)) {
                          setRecordedPoints((prev) => [
                            ...prev,
                            { x: center.lat, y: center.lng, time: new Date().toLocaleTimeString('pt-BR') }
                          ]);
                        }
                      }
                    } catch (err) {
                      console.warn('Error recording point:', err);
                    }
                  }}
                  className="w-full sm:w-auto px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  + Ponto
                </button>

                <div className="flex items-center gap-1 w-full sm:w-auto justify-between">
                  <button
                    onClick={() => setIsRecordingPaused(!isRecordingPaused)}
                    className="p-2 bg-slate-800 text-slate-200 rounded-xl active:scale-95"
                    title={isRecordingPaused ? 'Retomar' : 'Pausar'}
                  >
                    {isRecordingPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4 text-amber-400" />}
                  </button>

                  <button
                    onClick={handleStopAndSaveLiveRecording}
                    className="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow flex items-center gap-1 active:scale-95"
                  >
                    <Square className="w-4 h-4" />
                    Finalizar
                  </button>
                </div>
              </div>
            )}

            {/* Main Lateral Vertical Navigation Rail */}
            <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/90 rounded-2xl p-1.5 shadow-2xl flex flex-col gap-1.5 pointer-events-auto">
              
              {/* Navegar */}
              <button
                onClick={() => {
                  setActiveTool('pan');
                  setCurrentTrackPoints([]);
                }}
                title="Modo Navegação Livre"
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl transition-all active:scale-95 ${
                  activeTool === 'pan'
                    ? 'bg-slate-800 text-white ring-1 ring-slate-600 shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <MousePointer className="w-5 h-5 text-sky-400 mb-0.5" />
                <span className="text-[10px] font-extrabold tracking-tight">Navegar</span>
              </button>

              {/* Marcar Ponto com Foto */}
              <button
                onClick={() => {
                  setActiveTool('add_point');
                  setCurrentTrackPoints([]);
                }}
                title="Adicionar Ponto com Foto"
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl transition-all active:scale-95 ${
                  activeTool === 'add_point'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/60 ring-2 ring-emerald-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Camera className="w-5 h-5 text-emerald-400 mb-0.5" />
                <span className="text-[10px] font-extrabold tracking-tight">+ Ponto</span>
              </button>

              {/* Traçar Rota */}
              <button
                onClick={() => {
                  setActiveTool('draw_track');
                  setCurrentTrackPoints([]);
                }}
                title="Traçar Rota na Folha"
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl transition-all active:scale-95 ${
                  activeTool === 'draw_track'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/60 ring-2 ring-amber-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Activity className="w-5 h-5 text-amber-400 mb-0.5" />
                <span className="text-[10px] font-extrabold tracking-tight">Traçar</span>
              </button>

              {/* Gravar Rota */}
              <button
                onClick={handleStartLiveRecording}
                title="Gravar Trilha em Tempo Real via GPS"
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl transition-all active:scale-95 ${
                  activeTool === 'record_track'
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/60 ring-2 ring-rose-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Footprints className="w-5 h-5 text-rose-400 mb-0.5" />
                <span className="text-[10px] font-extrabold tracking-tight">Gravar</span>
              </button>

              {/* Medir Distância / Régua */}
              <button
                onClick={() => {
                  if (activeTool === 'measure' && measurementPoints.length > 0) {
                    setIsMeasureSummaryOpen(true);
                  } else {
                    setActiveTool('measure');
                    setCurrentTrackPoints([]);
                  }
                }}
                title="Régua Geodésica de Medição na Folha PDF"
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl transition-all active:scale-95 relative ${
                  activeTool === 'measure'
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/60 ring-2 ring-rose-400'
                    : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800/60'
                }`}
              >
                <Ruler className="w-5 h-5 shrink-0 text-rose-400 mb-0.5" />
                <span className="text-[10px] font-extrabold tracking-tight">Medir</span>
                {measurementPoints.length > 0 && activeTool === 'measure' && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black flex items-center justify-center">
                    {measurementPoints.length}
                  </span>
                )}
              </button>

              {/* Pilha de Madeira (Apontar ou Medir) */}
              <button
                onClick={() => {
                  if (activeTool === 'woodpile' && measurementPoints.length > 0 && woodpileSubMode === 'measure') {
                    setIsMeasureSummaryOpen(true);
                  } else {
                    setActiveTool('woodpile');
                    setCurrentTrackPoints([]);
                  }
                }}
                title="Medir ou Apontar Pilha de Madeira"
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl transition-all active:scale-95 relative ${
                  activeTool === 'woodpile'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/60 ring-2 ring-amber-400'
                    : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800/60'
                }`}
              >
                <WoodpileIcon className="w-5 h-5 text-amber-400 mb-0.5" />
                <span className="text-[10px] font-extrabold tracking-tight">Madeira</span>
                {activeDoc?.markers?.filter((m) => m.category === 'woodpile').length ? (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black flex items-center justify-center">
                    {activeDoc.markers.filter((m) => m.category === 'woodpile').length}
                  </span>
                ) : null}
              </button>

              <div className="w-full h-px bg-slate-800 my-0.5" />

              {/* Exportar & Compartilhar */}
              <button
                onClick={() => setIsExportModalOpen(true)}
                title="Exportar Dados do Mapa (KML, GPX, GeoJSON, PDF)"
                className="flex flex-col items-center justify-center p-2.5 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-all active:scale-95"
              >
                <Share2 className="w-5 h-5 shrink-0 text-emerald-400 mb-0.5" />
                <span className="text-[10px] font-extrabold tracking-tight">Exportar</span>
              </button>

              {/* Mapas / Gaveta */}
              <button
                onClick={() => setIsDrawerOpen(true)}
                title="Abrir Camadas"
                className="flex flex-col items-center justify-center p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all active:scale-95"
              >
                <Layers className="w-5 h-5 shrink-0 text-teal-400 mb-0.5" />
                <span className="text-[10px] font-extrabold tracking-tight">Camadas</span>
              </button>
            </div>
          </div>
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

      {/* MODAL: Adicionar Novo Ponto com Foto (z-[9999]) */}
      {pendingMarkerPos && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[85dvh] overflow-hidden">
            
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
                    <label className="block text-[11px] text-slate-300 font-bold mb-1">Tipo de Madeira</label>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1">
                      {['Eucalipto', 'Pinus', 'Nativa', 'Lenha', 'Mista'].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setWoodType(type)}
                          className={`py-1 px-1.5 rounded-lg text-[11px] font-bold border transition-all text-center ${
                            woodType === type
                              ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow'
                              : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dimensões: Comprimento, Altura, Largura */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-300 font-bold mb-0.5">Comprimento (m)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={woodpileLength}
                        onChange={(e) => setWoodpileLength(e.target.value)}
                        placeholder="Ex: 20.0"
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
                        placeholder="Ex: 2.5"
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
                            <div className="text-[10px] text-slate-400 font-semibold">Volume Sólido ({stF})</div>
                            <div className="text-sm font-black text-emerald-400 font-mono">{solid.toFixed(2)} m³</div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Status da Pilha */}
                  <div>
                    <label className="block text-[10px] text-slate-300 font-bold mb-1">Status da Pilha</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                      {[
                        { id: 'empilhada', label: 'Empilhada' },
                        { id: 'medida', label: 'Medida' },
                        { id: 'carregada', label: 'Carregada' },
                        { id: 'transportada', label: 'Transportada' },
                      ].map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setWoodpileStatus(st.id as any)}
                          className={`py-1 px-1.5 rounded-lg text-[10px] font-bold border transition-all text-center ${
                            woodpileStatus === st.id
                              ? 'bg-amber-600 text-white border-amber-400 font-black'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-bold mb-1">Anotações / Descrição</label>
                <textarea
                  value={markerNotes}
                  onChange={(e) => setMarkerNotes(e.target.value)}
                  placeholder="Observações técnicas, condições da pilha, etc."
                  rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              {/* Photos Section */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5 flex items-center justify-between">
                  <span>Fotos de Campo ({markerPhotos.length})</span>
                  {isCompressingPhoto && <span className="text-emerald-400 font-normal">Processando foto...</span>}
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
                    onClick={() => markerCameraInputRef.current?.click()}
                    className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-emerald-400 font-bold text-xs active:scale-95"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Tirar Foto</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => markerPhotoInputRef.current?.click()}
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

      {/* MODAL: Salvar Rota Traçada (z-[9999]) */}
      {isTrackModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-2xl shadow-2xl p-4 space-y-4 max-h-[85dvh] overflow-y-auto">
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

      {/* MODAL: Salvar Trilha Gravada em Tempo Real (z-[9999]) */}
      {isSaveRecordedModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-2xl shadow-2xl p-5 space-y-4 max-h-[85dvh] overflow-y-auto">
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

      {/* MODAL: Calibração de Georreferenciamento (z-[9999]) */}
      {isCalibrationModalOpen && activeDoc && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4 max-h-[85dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-extrabold text-white">Calibrar Georreferenciamento</h3>
              </div>
              <button
                onClick={() => setIsCalibrationModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Vincule a folha desta planta às coordenadas do mundo real. Você pode ancorar a planta usando sua localização atual do GPS para que o rastreio e navegação fiquem alinhados.
            </p>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Status do GPS:</span>
                <span className={`font-bold ${isGpsActive && userGps ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {isGpsActive && userGps ? `Conectado (±${userGps.accuracy.toFixed(0)}m)` : 'Desconectado'}
                </span>
              </div>
              {userGps && (
                <div className="text-xs font-mono text-slate-300">
                  Posição: {userGps.lat.toFixed(5)}, {userGps.lng.toFixed(5)}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <label className="text-slate-300 font-bold">Escala Estimada (Metros por Pixel)</label>
                <span className="font-mono font-bold text-amber-400">{calibScale.toFixed(2)} m/px</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="5.0"
                step="0.05"
                value={calibScale}
                onChange={(e) => setCalibScale(parseFloat(e.target.value))}
                className="w-full accent-amber-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>0.1 m/px (Planta Detalhada)</span>
                <span>5.0 m/px (Carta Regional)</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
              <button
                onClick={handleCalibrateCurrentGps}
                className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow active:scale-95"
              >
                <LocateFixed className="w-4 h-4" />
                <span>Ancorar na Minha Posição Atual</span>
              </button>

              <button
                onClick={() => setIsCalibrationModalOpen(false)}
                className="w-full py-2 text-slate-400 hover:text-white text-xs font-bold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Exportar e Compartilhar Arquivo (z-[9999]) */}
      {isExportModalOpen && activeDoc && (
        <PdfExportModal
          document={activeDoc}
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
        />
      )}

      {/* MODAL / DRAWER: Detalhes do Ponto Selecionado (z-[9999]) */}
      {selectedMarker && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[85dvh] overflow-hidden">
            
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
                    onClick={() => editPhotoInputRef.current?.click()}
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

      {/* Lightbox for viewing photos (z-[99999]) */}
      {activeLightboxPhoto && (
        <div 
          className="fixed inset-0 z-[99999] bg-black/95 flex items-center justify-center p-4"
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

      {/* Slide-over Drawer: Lista de Mapas & Pontos (z-[9999]) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xs flex justify-end animate-in fade-in">
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
                onClick={() => fileInputRef.current?.click()}
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
                    importKmlInputRef.current?.click();
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
