import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { useApp } from '../../context/AppContext';
import { Waypoint, TeamMember, MeasurementPoint, MeasurementPointType } from '../../types';
import { formatToDMS, latLngToUTM, calculateDistanceMeters } from '../../utils/geoUtils';
import {
  Compass,
  Crosshair,
  Layers as LayersIcon,
  Plus,
  Radio,
  Ruler,
  Maximize2,
  Navigation,
  ShieldCheck,
  AlertTriangle,
  Flame,
  CheckCircle2,
  FileText,
  ZoomIn,
  ZoomOut,
  Loader2,
  HardDrive,
  Download,
  Activity,
  Play,
  Pause,
  Square,
  MapPin,
  Pin,
  Trash2,
  Clock,
  Gauge,
  Eye,
  EyeOff,
} from 'lucide-react';
import { MeasurementControlBar } from './MeasurementControlBar';
import { MapToolsController } from './MapToolsController';
import { PointDetailModal } from './PointDetailModal';
import { MeasurementSummaryModal } from './MeasurementSummaryModal';
import { OfflineMapDownloadModal } from '../Offline/OfflineMapDownloadModal';
import { SaveTrackModal } from '../FieldTrack/SaveTrackModal';

const basemapConfigs: Record<string, { url: string; subdomains?: string[]; maxNativeZoom?: number; maxZoom?: number; attribution: string }> = {
  satellite: {
    url: 'https://mt{s}.google.com/vt/lyrs=y&hl=pt-BR&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    maxNativeZoom: 20,
    maxZoom: 22,
    attribution: '© Google Satélite',
  },
  hybrid: {
    url: 'https://mt{s}.google.com/vt/lyrs=y&hl=pt-BR&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    maxNativeZoom: 20,
    maxZoom: 22,
    attribution: '© Google Satélite',
  },
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    maxNativeZoom: 19,
    maxZoom: 21,
    attribution: '© OpenStreetMap contributors',
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    maxNativeZoom: 17,
    maxZoom: 20,
    attribution: '© OpenTopoMap',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    subdomains: ['a', 'b', 'c', 'd'],
    maxNativeZoom: 19,
    maxZoom: 21,
    attribution: '© CartoDB',
  },
};

const createBasemapTileLayer = (type: string): L.TileLayer => {
  const config = basemapConfigs[type] || basemapConfigs.satellite;
  return L.tileLayer(config.url, {
    subdomains: config.subdomains || ['a', 'b', 'c'],
    maxZoom: config.maxZoom || 22,
    maxNativeZoom: config.maxNativeZoom || 19,
    attribution: config.attribution,
    crossOrigin: true,
  });
};

export const MapViewer: React.FC = () => {
  const {
    basemap,
    layers,
    waypoints,
    savedTracks,
    activeTrack,
    currentGps,
    hasGpsLock,
    isManualGpsLocked,
    isGpsSimulated,
    requestCurrentLocation,
    setManualGpsLocation,
    unlockDeviceGps,
    teamMembers,
    navigateToWaypoint,
    deleteWaypoint,
    setIsAddWaypointModalOpen,
    setIsWoodpileModalOpen,
    setPendingWaypointCoord,
    setIsLayerModalOpen,
    setIsAiModalOpen,
    isMeasuring,
    setIsMeasuring,
    navTarget,
    activeProject,
    t,
    currentRole,
    isRecordingTrack,
    isRecordingPaused,
    startTrackRecording,
    pauseTrackRecording,
    resumeTrackRecording,
    stopTrackRecording,
    notifySuccess,
    notifyInfo,
    notifyWarning,
    notifyError,
  } = useApp();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayLayersGroupRef = useRef<L.FeatureGroup | null>(null);
  const measureLayerGroupRef = useRef<L.FeatureGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userAccuracyCircleRef = useRef<L.Circle | null>(null);
  const activeTrackShadowRef = useRef<L.Polyline | null>(null);
  const activeTrackPolylineRef = useRef<L.Polyline | null>(null);
  const activeTrackStartMarkerRef = useRef<L.Marker | null>(null);
  const hasAutoCenteredRef = useRef<boolean>(false);
  const userInteractedRef = useRef<boolean>(false);
  const lastProjectIdRef = useRef<string>(activeProject?.id || 'default');

  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [isCalibratingGps, setIsCalibratingGps] = useState<boolean>(false);
  const [isPinModeActive, setIsPinModeActive] = useState<boolean>(false);
  const [isPinChoiceMenuOpen, setIsPinChoiceMenuOpen] = useState<boolean>(false);
  const [isSaveTrackModalOpen, setIsSaveTrackModalOpen] = useState<boolean>(false);
  const [measurementPoints, setMeasurementPoints] = useState<MeasurementPoint[]>([]);
  const [currentMeasureType, setCurrentMeasureType] = useState<MeasurementPointType>('standard');
  const [selectedPointForEdit, setSelectedPointForEdit] = useState<{
    point: MeasurementPoint;
    index: number;
  } | null>(null);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState<boolean>(false);
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState<boolean>(false);
  const [isToolsVisible, setIsToolsVisible] = useState<boolean>(true);

  // Ref to keep current measurement type, calibration state, and pin mode accessible in Leaflet event listeners
  const currentMeasureTypeRef = useRef<MeasurementPointType>(currentMeasureType);
  currentMeasureTypeRef.current = currentMeasureType;

  const isCalibratingGpsRef = useRef<boolean>(isCalibratingGps);
  isCalibratingGpsRef.current = isCalibratingGps;

  const isPinModeActiveRef = useRef<boolean>(isPinModeActive);
  isPinModeActiveRef.current = isPinModeActive;

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Initialize Leaflet Map
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;
    if (mapInstanceRef.current) return;

    if ((container as any)._leaflet_id) {
      delete (container as any)._leaflet_id;
    }

    const initialLat = hasGpsLock && currentGps?.lat ? currentGps.lat : (activeProject?.centerCoordinate?.lat ?? -23.5505);
    const initialLng = hasGpsLock && currentGps?.lng ? currentGps.lng : (activeProject?.centerCoordinate?.lng ?? -46.6333);

    const map = L.map(container, {
      center: [initialLat, initialLng],
      zoom: hasGpsLock ? 16 : (activeProject?.zoomLevel || 13),
      minZoom: 2,
      maxZoom: 21,
      zoomControl: false,
      attributionControl: false,
      touchZoom: true,
      dragging: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
    });


    // Basemap tile with high maxNativeZoom and maxZoom
    const tileLayer = createBasemapTileLayer(basemap).addTo(map);
    tileLayerRef.current = tileLayer;

    // Feature group for overlays (Waypoints, PDF, KML)
    const overlaysGroup = L.featureGroup().addTo(map);
    overlayLayersGroupRef.current = overlaysGroup;

    // Dedicated feature group for Measurement layers
    const measureGroup = L.featureGroup().addTo(map);
    measureLayerGroupRef.current = measureGroup;

    // Listen to user map interactions to prevent unexpected automated resets
    map.on('zoomstart dragstart movestart', () => {
      userInteractedRef.current = true;
    });

    mapInstanceRef.current = map;

    // If GPS is already active on initial mount, mark as centered
    if (hasGpsLock) {
      hasAutoCenteredRef.current = true;
    }

    // ResizeObserver ensures map always adapts when tab opens, window resizes or device rotates
    const resizeObserver = new ResizeObserver(() => {
      try {
        map.invalidateSize();
      } catch {}
    });
    resizeObserver.observe(container);

    setTimeout(() => {
      try {
        map.invalidateSize();
      } catch {}
    }, 100);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Only auto-center once when first acquiring GPS lock if user hasn't manually interacted
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (!hasAutoCenteredRef.current && hasGpsLock && !userInteractedRef.current) {
      const currentZoom = mapInstanceRef.current.getZoom() || 17;
      mapInstanceRef.current.flyTo([currentGps.lat, currentGps.lng], Math.max(currentZoom, 17), {
        duration: 1.0,
      });
      hasAutoCenteredRef.current = true;
    }
  }, [hasGpsLock, currentGps.lat, currentGps.lng]);

  // Update Basemap Tiles without altering view or zoom
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    try {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    } catch {}
    const newTile = createBasemapTileLayer(basemap).addTo(mapInstanceRef.current);
    tileLayerRef.current = newTile;
  }, [basemap]);

  // Update Map View ONLY when active project ID actually changes explicitly
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (lastProjectIdRef.current !== activeProject.id) {
      lastProjectIdRef.current = activeProject.id;
      userInteractedRef.current = false;
      mapInstanceRef.current.setView(
        [activeProject.centerCoordinate.lat, activeProject.centerCoordinate.lng],
        activeProject.zoomLevel
      );
    }
  }, [activeProject.id]);

  // Render Dynamic Overlays: PDF Maps, KML/KMZ Features, Waypoints, Tracks, and Team Members
  useEffect(() => {
    if (!mapInstanceRef.current || !overlayLayersGroupRef.current) return;
    const group = overlayLayersGroupRef.current;
    group.clearLayers();

    // 1. Render PDF Overlays
    for (const layer of layers) {
      if (layer.visible && layer.type === 'pdf' && layer.pdfData?.previewUrl) {
        const bounds = L.latLngBounds(layer.pdfData.bounds);
        const imageOverlay = L.imageOverlay(layer.pdfData.previewUrl, bounds, {
          opacity: layer.opacity,
          interactive: true,
          zIndex: 10,
        });

        imageOverlay.bindTooltip(
          `<b>${layer.name}</b><br/>Escala: ${layer.pdfData.scale}<br/>Datum: ${layer.pdfData.datum}`,
          { sticky: true, className: 'leaflet-tactical-tooltip' }
        );

        imageOverlay.addTo(group);
      }

      // 2. Render KML / KMZ vector features
      if (layer.visible && (layer.type === 'kml' || layer.type === 'kmz') && layer.features) {
        for (const feat of layer.features) {
          if (feat.type === 'Polygon' && Array.isArray(feat.coordinates)) {
            const latLngs = feat.coordinates.map((c) => [c.lat, c.lng] as [number, number]);
            const poly = L.polygon(latLngs, {
              color: feat.color || layer.color,
              fillColor: feat.fillColor || feat.color || layer.color,
              fillOpacity: layer.opacity * 0.35,
              weight: feat.strokeWidth || 2,
            });

            poly.bindPopup(`
              <div class="p-2 text-slate-900 font-sans">
                <span class="inline-block px-1.5 py-0.5 mb-1 text-[10px] font-bold bg-slate-200 rounded uppercase tracking-wider">${layer.name}</span>
                <h4 class="font-bold text-sm text-slate-900">${feat.name}</h4>
                <p class="text-xs text-slate-600 mt-1">${feat.description || 'Delimitação vetorial de campo.'}</p>
              </div>
            `);

            poly.addTo(group);
          } else if (feat.type === 'LineString' && Array.isArray(feat.coordinates)) {
            const latLngs = feat.coordinates.map((c) => [c.lat, c.lng] as [number, number]);
            const line = L.polyline(latLngs, {
              color: feat.color || layer.color,
              weight: (feat.strokeWidth || 3) + 1,
              opacity: layer.opacity,
            });

            line.bindPopup(`
              <div class="p-2 text-slate-900 font-sans">
                <span class="inline-block px-1.5 py-0.5 mb-1 text-[10px] font-bold bg-blue-100 text-blue-800 rounded uppercase">Trilha Vetorial</span>
                <h4 class="font-bold text-sm text-slate-900">${feat.name}</h4>
                <p class="text-xs text-slate-600 mt-1">${feat.description || ''}</p>
              </div>
            `);

            line.addTo(group);
          } else if (feat.type === 'Point' && !Array.isArray(feat.coordinates)) {
            const ptMarker = L.circleMarker([feat.coordinates.lat, feat.coordinates.lng], {
              radius: 6,
              fillColor: feat.color || layer.color,
              color: '#ffffff',
              weight: 2,
              opacity: layer.opacity,
              fillOpacity: layer.opacity,
            });

            ptMarker.bindPopup(`
              <div class="p-2 text-slate-900 font-sans">
                <h4 class="font-bold text-sm text-slate-900">${feat.name}</h4>
                <p class="text-xs text-slate-600">${feat.description || ''}</p>
              </div>
            `);

            ptMarker.addTo(group);
          }
        }
      }
    }

    // 3. Render Saved Tracks
    for (const track of savedTracks) {
      if (track.visible && track.points.length > 1) {
        const latLngs = track.points.map((p) => [p.lat, p.lng] as [number, number]);
        const trackPolyline = L.polyline(latLngs, {
          color: track.color || '#10b981',
          weight: 4,
          opacity: 0.9,
          lineJoin: 'round',
        });

        trackPolyline.bindPopup(`
          <div class="p-2 text-slate-900 font-sans">
            <span class="inline-block px-1.5 py-0.5 mb-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded uppercase">Trilha Gravada</span>
            <h4 class="font-bold text-sm text-slate-900">${track.name}</h4>
            <div class="text-xs text-slate-600 mt-1 space-y-0.5">
              <div>Distância: <b>${track.distanceKm.toFixed(2)} km</b></div>
              <div>Duração: <b>${Math.round(track.durationSeconds / 60)} min</b></div>
              <div>Operador: <b>${track.userName}</b></div>
            </div>
          </div>
        `);

        trackPolyline.addTo(group);
      }
    }

    // 4. Render Project Waypoints (Alfinetes de Marcação)
    for (const wp of waypoints) {
      const getCategoryInfo = (cat: Waypoint['category']) => {
        switch (cat) {
          case 'fire':
            return { color: '#ef4444', icon: '🔥', label: 'Fogo / Sinistro' };
          case 'woodpile':
            return { color: '#d97706', icon: '🪵', label: 'Pilha Madeira' };
          case 'hazard':
            return { color: '#ef4444', icon: '⚠️', label: 'Perigo' };
          case 'obstacle':
            return { color: '#f97316', icon: '🚧', label: 'Obstáculo' };
          case 'geodesic':
            return { color: '#8b5cf6', icon: '📐', label: 'Geodésico' };
          case 'fauna_flora':
            return { color: '#059669', icon: '🌲', label: 'Fauna/Flora' };
          case 'soil_sample':
            return { color: '#ec4899', icon: '🧪', label: 'Solo/Minério' };
          case 'infrastructure':
            return { color: '#f59e0b', icon: '🏗️', label: 'Infraestrutura' };
          case 'inspection':
            return { color: '#10b981', icon: '🔍', label: 'Inspeção' };
          default:
            return { color: '#0284c7', icon: '📍', label: 'Marco' };
        }

      };

      const info = getCategoryInfo(wp.category);
      const isNavTarget = navTarget?.id === wp.id;

      const wpIcon = L.divIcon({
        className: 'custom-wp-pin',
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
            <div style="width: ${isNavTarget ? '32px' : '26px'}; height: ${isNavTarget ? '32px' : '26px'}; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); background-color: ${info.color}; border: 2px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; ${isNavTarget ? 'animation: bounce 1.5s infinite;' : ''}">
              <div style="transform: rotate(45deg); font-size: 11px; line-height: 1;">
                ${info.icon}
              </div>
            </div>
            <div style="margin-top: 2px; background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(255,255,255,0.2); color: #f1f5f9; font-size: 9px; font-weight: 700; padding: 1px 4px; border-radius: 4px; white-space: nowrap;">
              ${wp.code || wp.name}
            </div>
            ${
              isNavTarget
                ? `<div style="position: absolute; top: -6px; width: 44px; height: 44px; border-radius: 50%; border: 2.5px solid ${info.color}; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>`
                : ''
            }
          </div>
        `,
        iconSize: [30, 42],
        iconAnchor: [15, 30],
      });

      const marker = L.marker([wp.lat, wp.lng], { icon: wpIcon, zIndexOffset: isNavTarget ? 1500 : 700 });
      const utmCoord = latLngToUTM(wp.lat, wp.lng);

      const photosHtml =
        wp.photos && wp.photos.length > 0
          ? `
            <div style="margin-top: 8px; border-top: 1px solid #e2e8f0; padding-top: 6px;">
              <div style="font-size: 10px; font-weight: 700; color: #0284c7; margin-bottom: 4px;">📷 ${wp.photos.length} Foto(s) Georreferenciada(s):</div>
              <div style="display: flex; gap: 4px; overflow-x: auto; padding-bottom: 4px;">
                ${wp.photos.map((p) => `<img src="${p}" style="width: 54px; height: 54px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1;" />`).join('')}
              </div>
            </div>
          `
          : '';

      marker.bindPopup(`
        <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 220px; max-width: 280px; padding: 4px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 4px;">
            <span style="font-size: 9px; font-weight: 800; background-color: ${info.color}20; color: ${info.color}; border: 1px solid ${info.color}40; padding: 2px 6px; border-radius: 6px; text-transform: uppercase;">
              ${info.icon} ${wp.code || 'ALF'}
            </span>
            <span style="font-size: 10px; color: #64748b; font-family: monospace;">
              ${wp.createdAt ? new Date(wp.createdAt).toLocaleDateString('pt-BR') : ''}
            </span>
          </div>

          <h4 style="margin: 0 0 6px 0; font-size: 14px; font-weight: 800; color: #0f172a; line-height: 1.2;">
            ${wp.name}
          </h4>

          <div style="font-size: 11px; font-family: monospace; color: #334155; background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px; border-radius: 8px; line-height: 1.4;">
            <div><b>LAT:</b> ${wp.lat.toFixed(6)}°</div>
            <div><b>LNG:</b> ${wp.lng.toFixed(6)}°</div>
            <div><b>UTM ${utmCoord.zone}:</b> E ${utmCoord.easting} | N ${utmCoord.northing}</div>
            <div><b>ALT:</b> ${wp.altitude}m (±${wp.accuracy}m)</div>
          </div>

          ${wp.notes ? `<p style="margin: 6px 0 0 0; font-size: 11px; color: #475569; font-style: italic;">"${wp.notes}"</p>` : ''}
          ${photosHtml}

          <div style="margin-top: 8px; display: flex; gap: 4px;">
            <button
              id="popup-btn-nav-${wp.id}"
              onclick="window.dispatchEvent(new CustomEvent('gofield-navigate-waypoint', { detail: '${wp.id}' }))"
              style="flex: 1; background-color: #0284c7; color: #ffffff; border: none; padding: 6px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;"
            >
              🎯 Navegar
            </button>
            <button
              id="popup-btn-del-${wp.id}"
              onclick="window.dispatchEvent(new CustomEvent('gofield-delete-waypoint', { detail: '${wp.id}' }))"
              style="background-color: #f1f5f9; color: #ef4444; border: 1px solid #cbd5e1; padding: 6px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;"
              title="Excluir Alfinete"
            >
              🗑️
            </button>
          </div>
        </div>
      `);

      marker.addTo(group);
    }

    // 6. Render Field Team Members
    for (const member of teamMembers) {
      if (member.lastLocation) {
        const teamIcon = L.divIcon({
          className: 'custom-team-pin',
          html: `
            <div style="position: relative; display: flex; align-items: center; justify-content: center;">
              <div style="width: 28px; height: 28px; border-radius: 50%; border: 2px solid ${member.status === 'sos' ? '#ef4444' : '#10b981'}; overflow: hidden; background-color: #0f172a; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
                <img src="${member.avatar}" style="width: 100%; height: 100%; object-fit: cover;" alt="${member.name}" />
              </div>
              <div style="position: absolute; bottom: -2px; right: -2px; width: 10px; height: 10px; border-radius: 50%; background-color: ${member.status === 'sos' ? '#ef4444' : '#10b981'}; border: 1.5px solid white;"></div>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const memberMarker = L.marker([member.lastLocation.lat, member.lastLocation.lng], {
          icon: teamIcon,
        });

        memberMarker.bindPopup(`
          <div class="p-2 text-slate-900 font-sans">
            <h4 class="font-bold text-sm text-slate-900">${member.name}</h4>
            <div class="text-xs text-slate-600">Status: <b class="uppercase">${member.status}</b></div>
            <div class="text-xs text-slate-600">Bateria: <b>${member.batteryLevel}%</b></div>
          </div>
        `);

        memberMarker.addTo(group);
      }
    }
  }, [layers, waypoints, savedTracks, teamMembers, navTarget]);

  // Dedicated Incremental Active Track Polyline Rendering (Zero Thrashing, O(1) Updates)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Clean up if track recording stopped
    if (!activeTrack || !activeTrack.points || activeTrack.points.length === 0) {
      if (activeTrackShadowRef.current) {
        map.removeLayer(activeTrackShadowRef.current);
        activeTrackShadowRef.current = null;
      }
      if (activeTrackPolylineRef.current) {
        map.removeLayer(activeTrackPolylineRef.current);
        activeTrackPolylineRef.current = null;
      }
      if (activeTrackStartMarkerRef.current) {
        map.removeLayer(activeTrackStartMarkerRef.current);
        activeTrackStartMarkerRef.current = null;
      }
      return;
    }

    const points = activeTrack.points;
    const latLngs = points.map((p) => [p.lat, p.lng] as [number, number]);

    // 1. Manage Start Marker
    if (points.length >= 1 && !activeTrackStartMarkerRef.current) {
      const startIcon = L.divIcon({
        className: 'custom-track-start-pin',
        html: `
          <div style="background-color: #10b981; color: white; font-weight: 900; font-size: 10px; padding: 2px 6px; border-radius: 12px; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.6); display: flex; align-items: center; gap: 3px; white-space: nowrap;">
            <span>🟢 Início</span>
          </div>
        `,
        iconSize: [60, 20],
        iconAnchor: [30, 10],
      });

      activeTrackStartMarkerRef.current = L.marker([points[0].lat, points[0].lng], {
        icon: startIcon,
        zIndexOffset: 800,
      }).addTo(map);
    }

    // 2. Manage Incremental Polylines
    if (points.length >= 2) {
      if (!activeTrackPolylineRef.current) {
        // Instantiate Shadow Polyline
        activeTrackShadowRef.current = L.polyline(latLngs, {
          color: '#000000',
          weight: 7,
          opacity: 0.6,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        // Instantiate Active Neon Polyline
        activeTrackPolylineRef.current = L.polyline(latLngs, {
          color: activeTrack.color || '#ef4444',
          weight: 4.5,
          opacity: 1.0,
          dashArray: isRecordingPaused ? '8, 8' : undefined,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      } else {
        // High-Performance Incremental coordinate update without tearing down DOM
        activeTrackShadowRef.current?.setLatLngs(latLngs);
        activeTrackPolylineRef.current.setLatLngs(latLngs);
        activeTrackPolylineRef.current.setStyle({
          color: activeTrack.color || '#ef4444',
          dashArray: isRecordingPaused ? '8, 8' : undefined,
        });
      }
    }
  }, [activeTrack, isRecordingPaused]);

  // Update Live Current GPS User Marker
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Do NOT show fake user location marker if GPS lock is not acquired and simulation is off
    if (!hasGpsLock && !isGpsSimulated) {
      if (userMarkerRef.current) {
        map.removeLayer(userMarkerRef.current);
        userMarkerRef.current = null;
      }
      if (userAccuracyCircleRef.current) {
        map.removeLayer(userAccuracyCircleRef.current);
        userAccuracyCircleRef.current = null;
      }
      return;
    }

    if (!userMarkerRef.current) {
      const userIcon = L.divIcon({
        className: 'custom-user-gps-dot',
        html: `
          <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 24px; height: 24px; border-radius: 50%; background-color: #38bdf8; opacity: 0.75; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="position: relative; width: 14px; height: 14px; border-radius: 50%; background-color: #0284c7; border: 2.5px solid white; box-shadow: 0 0 10px rgba(2, 132, 199, 0.9);"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      userMarkerRef.current = L.marker([currentGps.lat, currentGps.lng], {
        icon: userIcon,
        zIndexOffset: 1000,
      }).addTo(map);

      userAccuracyCircleRef.current = L.circle([currentGps.lat, currentGps.lng], {
        radius: currentGps.accuracy || 5,
        color: '#0284c7',
        fillColor: '#38bdf8',
        fillOpacity: 0.15,
        weight: 1,
      }).addTo(map);
    } else {
      userMarkerRef.current.setLatLng([currentGps.lat, currentGps.lng]);
      if (userAccuracyCircleRef.current) {
        userAccuracyCircleRef.current.setLatLng([currentGps.lat, currentGps.lng]);
        userAccuracyCircleRef.current.setRadius(currentGps.accuracy || 5);
      }
    }
  }, [currentGps.lat, currentGps.lng, currentGps.accuracy, hasGpsLock, isGpsSimulated]);

  // Calculate Total Measurement Distance
  const totalDistanceMeters = useMemo(() => {
    if (measurementPoints.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < measurementPoints.length; i++) {
      total += calculateDistanceMeters(
        measurementPoints[i - 1].lat,
        measurementPoints[i - 1].lng,
        measurementPoints[i].lat,
        measurementPoints[i].lng
      );
    }
    return total;
  }, [measurementPoints]);

  // Handle Measurement Click on Leaflet Map
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      // 1. If in GPS Calibration Mode, pin user location exactly where clicked
      if (isCalibratingGpsRef.current) {
        setManualGpsLocation({
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          altitude: currentGps.altitude || 1250,
          accuracy: 1.0,
          timestamp: Date.now(),
        });
        setIsCalibratingGps(false);
        map.flyTo([e.latlng.lat, e.latlng.lng], Math.max(map.getZoom(), 17));
        return;
      }

      // 2. If in Pin Dropping Mode, open AddWaypointModal at clicked location
      if (isPinModeActiveRef.current) {
        setPendingWaypointCoord({
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          altitude: currentGps.altitude || 1280,
        });
        setIsPinModeActive(false);
        setIsAddWaypointModalOpen(true);
        return;
      }

      if (!isMeasuring) return;

      // If user has >= 2 points and clicks near the starting point (< 25m), snap directly to close loop
      if (measurementPoints.length >= 2) {
        const startPt = measurementPoints[0];
        const distToStart = calculateDistanceMeters(e.latlng.lat, e.latlng.lng, startPt.lat, startPt.lng);
        if (distToStart < 25) {
          const isAlreadyClosed =
            measurementPoints.length >= 3 &&
            measurementPoints[0].lat === measurementPoints[measurementPoints.length - 1].lat &&
            measurementPoints[0].lng === measurementPoints[measurementPoints.length - 1].lng;

          if (!isAlreadyClosed) {
            const closePt: MeasurementPoint = {
              id: `meas-close-${Date.now()}`,
              lat: startPt.lat,
              lng: startPt.lng,
              altitude: startPt.altitude,
              type: 'stop',
              label: `Fechamento (Ponto 1)`,
              notes: 'Ponto final conectado exatamente ao início para fechamento de perímetro sem perda métrica',
              photos: [],
              timestamp: Date.now(),
            };
            setMeasurementPoints((prev) => [...prev, closePt]);
            notifySuccess('Perímetro Fechado', 'Traçado conectado com precisão cirúrgica ao ponto inicial.');
            return;
          }
        }
      }

      const type = currentMeasureTypeRef.current;
      const pointIndex = measurementPoints.length;
      let label = `Ponto ${pointIndex + 1}`;
      if (type === 'stop') {
        const stopsSoFar = measurementPoints.filter((p) => p.type === 'stop').length;
        label = `Parada ${stopsSoFar + 1}`;
      } else if (type === 'hazard') {
        const hazardsSoFar = measurementPoints.filter((p) => p.type === 'hazard').length;
        label = `Atenção ${hazardsSoFar + 1}`;
      }

      const newPoint: MeasurementPoint = {
        id: `meas-pt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        altitude: currentGps.altitude || 1280,
        type,
        label,
        notes: '',
        photos: [],
        timestamp: Date.now(),
      };

      setMeasurementPoints((prev) => [...prev, newPoint]);
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [isMeasuring, measurementPoints, currentGps.altitude]);

  // Render Measurement Visuals: Markers, Polyline, Distance Pills
  useEffect(() => {
    if (!mapInstanceRef.current || !measureLayerGroupRef.current) return;
    const group = measureLayerGroupRef.current;
    group.clearLayers();

    if (measurementPoints.length === 0) return;

    const isClosed =
      measurementPoints.length >= 3 &&
      measurementPoints[0].lat === measurementPoints[measurementPoints.length - 1].lat &&
      measurementPoints[0].lng === measurementPoints[measurementPoints.length - 1].lng;

    // 1. Draw Connecting Polyline with glow
    if (measurementPoints.length > 1) {
      const latLngs = measurementPoints.map((p) => [p.lat, p.lng] as [number, number]);

      L.polyline(latLngs, {
        color: isClosed ? '#10b981' : '#e11d48', // emerald if closed, rose if open
        weight: 3.5,
        dashArray: isClosed ? undefined : '6, 6',
        opacity: 0.95,
      }).addTo(group);

      // 2. Draw Distance Badges on Segment Midpoints
      for (let i = 1; i < measurementPoints.length; i++) {
        const p1 = measurementPoints[i - 1];
        const p2 = measurementPoints[i];
        const segDist = calculateDistanceMeters(p1.lat, p1.lng, p2.lat, p2.lng);
        const segFormatted =
          segDist >= 1000 ? `${(segDist / 1000).toFixed(2)} km` : `${Math.round(segDist)} m`;

        const midLat = (p1.lat + p2.lat) / 2;
        const midLng = (p1.lng + p2.lng) / 2;

        const pillIcon = L.divIcon({
          className: 'custom-seg-pill',
          html: `
            <div style="
              background: rgba(15, 23, 42, 0.9);
              border: 1.5px solid ${isClosed ? '#10b981' : '#f43f5e'};
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

        L.marker([midLat, midLng], { icon: pillIcon, interactive: false }).addTo(group);
      }
    }

    // 3. Draw Styled Point Markers
    measurementPoints.forEach((pt, idx) => {
      let bgColor = '#0284c7';
      let iconSymbol = `${idx + 1}`;

      if (pt.type === 'stop') {
        bgColor = '#10b981';
        iconSymbol = `🛑 ${idx + 1}`;
      } else if (pt.type === 'hazard') {
        bgColor = '#f59e0b';
        iconSymbol = `⚠️ ${idx + 1}`;
      }

      const isStartPoint = idx === 0;

      const pointIcon = L.divIcon({
        className: 'custom-measure-point-marker',
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
            <div style="
              min-width: 26px;
              height: 26px;
              padding: 0 4px;
              border-radius: 13px;
              background-color: ${bgColor};
              border: 2px solid ${isStartPoint && measurementPoints.length >= 2 && !isClosed ? '#fbbf24' : '#ffffff'};
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

      const marker = L.marker([pt.lat, pt.lng], { icon: pointIcon, zIndexOffset: 500 });

      // Click to edit point details/photos or close loop if clicking start point
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (idx === 0 && measurementPoints.length >= 2 && !isClosed) {
          handleCloseLoop();
        } else {
          setSelectedPointForEdit({ point: pt, index: idx });
        }
      });

      marker.addTo(group);
    });
  }, [measurementPoints]);

  // Measurement Actions
  const handleCloseLoop = () => {
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
      id: `meas-close-${Date.now()}`,
      lat: startPt.lat,
      lng: startPt.lng,
      altitude: startPt.altitude,
      type: 'stop',
      label: `Fechamento (Ponto 1)`,
      notes: 'Ponto final conectado exatamente ao início para fechamento de perímetro sem perda métrica',
      photos: [],
      timestamp: Date.now(),
    };

    setMeasurementPoints((prev) => [...prev, closePt]);
    notifySuccess('Perímetro Fechado', 'Traçado conectado com precisão cirúrgica ao ponto inicial.');
  };
  const handleAddCurrentGpsPoint = async () => {
    if (!hasGpsLock && !isGpsSimulated) {
      setIsLocating(true);
      const loc = await requestCurrentLocation();
      setIsLocating(false);
      if (!loc) {
        notifyWarning(
          'GPS Não Fixado',
          'Permita o GPS no navegador ou clique no botão de calibrar para definir sua posição no mapa.'
        );
        return;
      }
    }

    const type = currentMeasureType;
    const pointIndex = measurementPoints.length;
    let label = `Ponto GPS ${pointIndex + 1}`;
    if (type === 'stop') label = `Parada GPS ${pointIndex + 1}`;
    if (type === 'hazard') label = `Atenção GPS ${pointIndex + 1}`;

    const newPt: MeasurementPoint = {
      id: `meas-gps-${Date.now()}`,
      lat: currentGps.lat,
      lng: currentGps.lng,
      altitude: currentGps.altitude || 1280,
      type,
      label,
      notes: 'Marcado na posição GPS do operador',
      photos: [],
      timestamp: Date.now(),
    };

    setMeasurementPoints((prev) => [...prev, newPt]);
    notifyInfo('Ponto Adicionado', `Coordenada GPS (${currentGps.lat.toFixed(5)}°, ${currentGps.lng.toFixed(5)}°) inserida.`);
  };

  const handleUndoLastPoint = () => {
    setMeasurementPoints((prev) => prev.slice(0, -1));
  };

  const handleClearMeasurement = () => {
    setMeasurementPoints([]);
    notifyInfo('Medição Limpa', 'Todos os pontos foram removidos.');
  };

  const handleSavePointEdit = (updated: MeasurementPoint) => {
    setMeasurementPoints((prev) =>
      prev.map((pt) => (pt.id === updated.id ? updated : pt))
    );
    notifySuccess('Ponto Atualizado', `Informações de ${updated.label} foram salvas.`);
  };

  const handleDeletePoint = (pointId: string) => {
    setMeasurementPoints((prev) => prev.filter((p) => p.id !== pointId));
  };

  const centerOnGps = async () => {
    if (!mapInstanceRef.current) return;
    setIsLocating(true);
    userInteractedRef.current = true;

    const currentZoom = Math.max(mapInstanceRef.current.getZoom(), 17);

    // If GPS is manually calibrated and locked, fly directly there without querying browser IP
    if (isManualGpsLocked && currentGps && currentGps.lat) {
      mapInstanceRef.current.flyTo([currentGps.lat, currentGps.lng], currentZoom, {
        duration: 0.8,
      });
      notifySuccess('GPS Calibrado', `Centralizado na posição fixada: ${currentGps.lat.toFixed(5)}°, ${currentGps.lng.toFixed(5)}°`);
      setIsLocating(false);
      return;
    }

    // If we ALREADY have a real GPS lock, fly there immediately
    if (hasGpsLock && currentGps && currentGps.lat) {
      mapInstanceRef.current.flyTo([currentGps.lat, currentGps.lng], currentZoom, {
        duration: 0.8,
      });
    }

    try {
      const loc = await requestCurrentLocation();
      if (loc && mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([loc.lat, loc.lng], currentZoom, { duration: 0.8 });
        notifySuccess('GPS Localizado', `Posição fixada com precisão de ±${loc.accuracy || 2}m.`);
      } else {
        notifyWarning(
          'Permissão de GPS Necessária',
          'Permita o acesso à localização no navegador ou use o botão 📍 para calibrar sua posição manualmente no mapa.'
        );
      }
    } catch (err) {
      console.warn('Center GPS error:', err);
      notifyError('Erro de GPS', 'Não foi possível obter sinal de satélite.');
    } finally {
      setIsLocating(false);
    }
  };

  const fitAllLayers = () => {
    if (!mapInstanceRef.current || !overlayLayersGroupRef.current) return;
    const bounds = overlayLayersGroupRef.current.getBounds();
    if (bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
    }
  };

  // Handle custom popup events for navigation and deletion
  useEffect(() => {
    const handleNav = (e: any) => {
      const wpId = e.detail;
      const targetWp = waypoints.find((w) => w.id === wpId);
      if (targetWp) {
        navigateToWaypoint(targetWp);
      }
    };

    const handleDel = (e: any) => {
      const wpId = e.detail;
      deleteWaypoint(wpId);
    };

    window.addEventListener('gofield-navigate-waypoint', handleNav);
    window.addEventListener('gofield-delete-waypoint', handleDel);

    return () => {
      window.removeEventListener('gofield-navigate-waypoint', handleNav);
      window.removeEventListener('gofield-delete-waypoint', handleDel);
    };
  }, [waypoints, navigateToWaypoint, deleteWaypoint]);

  const currentUtm = latLngToUTM(currentGps.lat, currentGps.lng);

  return (
    <div className="relative w-full h-full flex-1 overflow-hidden">
      {/* Leaflet Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0 bg-slate-950" />

      {/* Measurement Active Floating HUD */}
      {isMeasuring && (
        <MeasurementControlBar
          points={measurementPoints}
          currentType={currentMeasureType}
          setCurrentType={setCurrentMeasureType}
          totalDistanceMeters={totalDistanceMeters}
          onAddCurrentGpsPoint={handleAddCurrentGpsPoint}
          onUndoLastPoint={handleUndoLastPoint}
          onClearMeasurement={handleClearMeasurement}
          onCloseLoop={handleCloseLoop}
          onFinishMeasurement={() => setIsSummaryModalOpen(true)}
          onClose={() => setIsMeasuring(false)}
        />
      )}

      {/* Live Track Recording Floating Console HUD */}
      {isRecordingTrack && activeTrack && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 w-[94%] max-w-md bg-slate-900/95 backdrop-blur-md border-2 border-red-500/80 rounded-2xl p-3 shadow-2xl text-white pointer-events-auto animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
              <span className="font-bold text-xs uppercase tracking-wider text-red-400">
                {isRecordingPaused ? '⏸️ Gravação Pausada' : '🔴 Gravando Rota no Mapa'}
              </span>
            </div>
            <span className="font-mono text-xs font-bold text-slate-300">
              {activeTrack.points.length} pts
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center mb-2.5">
            <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
              <div className="text-[9px] text-slate-400 uppercase font-semibold">Distância</div>
              <div className="text-sm font-mono font-black text-white mt-0.5">
                {activeTrack.distanceKm >= 1
                  ? `${activeTrack.distanceKm.toFixed(2)} km`
                  : `${Math.round(activeTrack.distanceKm * 1000)} m`}
              </div>
            </div>

            <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
              <div className="text-[9px] text-slate-400 uppercase font-semibold">Duração</div>
              <div className="text-sm font-mono font-black text-amber-400 mt-0.5">
                {formatDuration(activeTrack.durationSeconds)}
              </div>
            </div>

            <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
              <div className="text-[9px] text-slate-400 uppercase font-semibold">Velocidade</div>
              <div className="text-sm font-mono font-black text-emerald-400 mt-0.5">
                {(activeTrack.points[activeTrack.points.length - 1]?.speed || 3.8).toFixed(1)}{' '}
                <span className="text-[9px] font-normal text-slate-400">km/h</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isRecordingPaused ? (
              <button
                onClick={resumeTrackRecording}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Continuar
              </button>
            ) : (
              <button
                onClick={pauseTrackRecording}
                className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg transition-colors"
              >
                <Pause className="w-3.5 h-3.5" />
                Pausar
              </button>
            )}

            <button
              onClick={() => setIsSaveTrackModalOpen(true)}
              className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-red-900/40 transition-colors"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Finalizar & Baixar
            </button>
          </div>
        </div>
      )}

      {/* Active Pin Dropping Mode Banner */}
      {isPinModeActive && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-sky-600 text-white font-bold px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 border-2 border-sky-400 animate-pulse pointer-events-auto">
          <MapPin className="w-5 h-5 text-white animate-bounce" />
          <span className="text-xs sm:text-sm">Toque no mapa no local exato onde deseja fixar o alfinete</span>
          <button
            onClick={() => setIsPinModeActive(false)}
            className="px-2.5 py-1 bg-slate-950 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Floating Toggle Tools Button (When Tools are hidden) */}
      {!isToolsVisible && (
        <button
          onClick={() => setIsToolsVisible(true)}
          className="absolute top-3 right-3 z-20 px-3 py-2 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-sky-500/80 text-sky-400 font-black text-xs flex items-center gap-1.5 shadow-2xl hover:bg-slate-800 active:scale-95 transition-all pointer-events-auto animate-in fade-in"
          title="Mostrar Ferramentas do Mapa"
        >
          <LayersIcon className="w-4 h-4 text-sky-400" />
          <span>☰ Ferramentas</span>
        </button>
      )}


      {/* Active GPS Manual Calibration Overlay Banner */}
      {isCalibratingGps && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-amber-500 text-slate-950 font-black px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-3 border-2 border-amber-300 animate-pulse pointer-events-auto">
          <MapPin className="w-5 h-5 text-slate-950 animate-bounce" />
          <span className="text-xs sm:text-sm">Clique no mapa no ponto exato da sua posição real para calibrar</span>
          <button
            onClick={() => setIsCalibratingGps(false)}
            className="px-2.5 py-1 bg-slate-950 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}

{/* Unified Map Tools Controller (Material 3 Android Floating System) */}
      <MapToolsController
        onMarkWaypoint={() => {
          setPendingWaypointCoord(null);
          setIsAddWaypointModalOpen(true);
        }}
        onMarkWaypointClickMap={() => setIsPinModeActive(true)}
        isRecordingTrack={isRecordingTrack}
        isRecordingPaused={isRecordingPaused}
        onStartTrackRecording={() => {
          startTrackRecording(`Trilha Campo ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`);
          notifySuccess('Gravação Iniciada', 'Traçado em tempo real ativado.');
        }}
        onStopTrackRecording={() => setIsSaveTrackModalOpen(true)}
        onPauseTrackRecording={pauseTrackRecording}
        onResumeTrackRecording={resumeTrackRecording}
        trackDistanceFormatted={activeTrack?.distance || '0.00 km'}
        trackDurationFormatted={activeTrack?.duration || '00:00'}

        isMeasuring={isMeasuring}
        onToggleMeasuring={() => setIsMeasuring(!isMeasuring)}
        measurementPointsCount={measurementPoints.length}
        totalDistanceFormatted={
          totalDistanceMeters >= 1000
            ? `${(totalDistanceMeters / 1000).toFixed(2)} km`
            : `${totalDistanceMeters.toFixed(0)} m`
        }
        onClearMeasurement={handleClearMeasurement}
        onFinishMeasurement={() => setIsSummaryModalOpen(true)}

        onRecenterGps={centerOnGps}
        hasGpsLock={hasGpsLock}
        onZoomIn={() => mapInstanceRef.current?.zoomIn()}
        onZoomOut={() => mapInstanceRef.current?.zoomOut()}
        onFitBounds={fitAllLayers}

        onOpenLayers={() => setIsLayerModalOpen(true)}
        onOpenOfflineDownload={() => setIsOfflineModalOpen(true)}
        onOpenWoodpileCubage={() => setIsWoodpileModalOpen(true)}
      />

      {/* Map Bottom-Left Copyright & Attribution Badge */}
      <div className="hidden sm:flex absolute bottom-2 left-2 z-10 pointer-events-auto bg-slate-950/90 backdrop-blur-xs px-2.5 py-1 rounded-md text-[10px] text-slate-400 border border-slate-800/80 items-center gap-1.5 shadow-md">
        <span className="font-semibold text-slate-300">GoField Pro</span>
        <span>•</span>
        <span>AM TST SAÚDE E SEGURANÇA DO TRABALHO</span>
        <span>•</span>
        <a
          href="https://amtst.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-400 hover:text-sky-300 hover:underline"
        >
          amtst.vercel.app
        </a>
      </div>

      {/* Modals */}
      <SaveTrackModal
        isOpen={isSaveTrackModalOpen}
        activeTrack={activeTrack}
        onClose={() => setIsSaveTrackModalOpen(false)}
        onSaveAndApply={(name, color) => {
          stopTrackRecording(name, color);
          setIsSaveTrackModalOpen(false);
        }}
      />

      <PointDetailModal
        isOpen={selectedPointForEdit !== null}
        point={selectedPointForEdit?.point || null}
        pointIndex={selectedPointForEdit?.index ?? 0}
        onClose={() => setSelectedPointForEdit(null)}
        onSave={handleSavePointEdit}
        onDeletePoint={handleDeletePoint}
      />

      <MeasurementSummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        points={measurementPoints}
        totalDistanceMeters={totalDistanceMeters}
        onEditPoint={(pt, idx) => {
          setIsSummaryModalOpen(false);
          setSelectedPointForEdit({ point: pt, index: idx });
        }}
        onResetMeasurement={handleClearMeasurement}
      />

      <OfflineMapDownloadModal
        isOpen={isOfflineModalOpen}
        onClose={() => setIsOfflineModalOpen(false)}
      />
    </div>
  );
};

function SparklesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}
