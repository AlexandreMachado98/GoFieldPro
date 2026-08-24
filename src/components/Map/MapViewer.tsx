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
  Square,
} from 'lucide-react';
import { MeasurementControlBar } from './MeasurementControlBar';
import { PointDetailModal } from './PointDetailModal';
import { MeasurementSummaryModal } from './MeasurementSummaryModal';
import { OfflineMapDownloadModal } from '../Offline/OfflineMapDownloadModal';

const basemapTileUrls = {
  satellite: 'http://mt0.google.com/vt/lyrs=y&hl=pt-BR&x={x}&y={y}&z={z}',
  topo: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  hybrid: 'http://mt0.google.com/vt/lyrs=y&hl=pt-BR&x={x}&y={y}&z={z}',
};

const basemapAttributions = {
  satellite: 'Map data: © Google',
  topo: 'Map data: © OpenStreetMap, SRTM | Map style: © OpenTopoMap',
  osm: '© OpenStreetMap contributors',
  dark: '© CartoDB, © OpenStreetMap',
  hybrid: 'Map data: © Google',
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
    requestCurrentLocation,
    teamMembers,
    navigateToWaypoint,
    setIsAddWaypointModalOpen,
    setIsLayerModalOpen,
    setIsAiModalOpen,
    isMeasuring,
    setIsMeasuring,
    navTarget,
    activeProject,
    t,
    currentRole,
    isRecordingTrack,
    startTrackRecording,
    stopTrackRecording,
    notifySuccess,
    notifyInfo,
  } = useApp();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayLayersGroupRef = useRef<L.FeatureGroup | null>(null);
  const measureLayerGroupRef = useRef<L.FeatureGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userAccuracyCircleRef = useRef<L.Circle | null>(null);
  const hasAutoCenteredRef = useRef<boolean>(false);
  const userInteractedRef = useRef<boolean>(false);
  const lastProjectIdRef = useRef<string>(activeProject.id);

  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [measurementPoints, setMeasurementPoints] = useState<MeasurementPoint[]>([]);
  const [currentMeasureType, setCurrentMeasureType] = useState<MeasurementPointType>('standard');
  const [selectedPointForEdit, setSelectedPointForEdit] = useState<{
    point: MeasurementPoint;
    index: number;
  } | null>(null);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState<boolean>(false);
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState<boolean>(false);

  // Ref to keep current measurement type accessible in Leaflet event listeners
  const currentMeasureTypeRef = useRef<MeasurementPointType>(currentMeasureType);
  currentMeasureTypeRef.current = currentMeasureType;

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialLat = hasGpsLock ? currentGps.lat : activeProject.centerCoordinate.lat;
    const initialLng = hasGpsLock ? currentGps.lng : activeProject.centerCoordinate.lng;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: hasGpsLock ? 16 : activeProject.zoomLevel,
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
    const tileLayer = L.tileLayer(basemapTileUrls[basemap], {
      attribution: basemapAttributions[basemap],
      maxZoom: 21,
      maxNativeZoom: 19,
    }).addTo(map);

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

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Only auto-center once when first acquiring GPS lock if user hasn't manually interacted
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (!hasAutoCenteredRef.current && hasGpsLock && !userInteractedRef.current) {
      const currentZoom = mapInstanceRef.current.getZoom() || 16;
      mapInstanceRef.current.setView([currentGps.lat, currentGps.lng], Math.max(currentZoom, 16));
      hasAutoCenteredRef.current = true;
    }
  }, [hasGpsLock]);

  // Update Basemap Tiles without altering view or zoom
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    mapInstanceRef.current.removeLayer(tileLayerRef.current);
    const newTile = L.tileLayer(basemapTileUrls[basemap], {
      attribution: basemapAttributions[basemap],
      maxZoom: 21,
      maxNativeZoom: 19,
    }).addTo(mapInstanceRef.current);
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

    // 4. Render Active Recording Track Live
    if (activeTrack && activeTrack.points.length > 1) {
      const latLngs = activeTrack.points.map((p) => [p.lat, p.lng] as [number, number]);
      const activeLine = L.polyline(latLngs, {
        color: '#ef4444',
        weight: 5,
        opacity: 0.95,
        dashArray: '8, 6',
      });
      activeLine.addTo(group);
    }

    // 5. Render Project Waypoints
    for (const wp of waypoints) {
      const getCategoryColor = (cat: Waypoint['category']) => {
        switch (cat) {
          case 'hazard':
          case 'obstacle':
            return '#ef4444'; // Red
          case 'geodesic':
            return '#8b5cf6'; // Violet
          case 'fauna_flora':
            return '#10b981'; // Green
          case 'soil_sample':
            return '#ec4899'; // Pink
          case 'infrastructure':
            return '#f59e0b'; // Amber
          default:
            return '#0284c7'; // Sky
        }
      };

      const color = getCategoryColor(wp.category);
      const isNavTarget = navTarget?.id === wp.id;

      const wpIcon = L.divIcon({
        className: 'custom-wp-pin',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            <div style="width: ${isNavTarget ? '28px' : '20px'}; height: ${isNavTarget ? '28px' : '20px'}; border-radius: 50%; background-color: ${color}; border: 2.5px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 10px;">
              ${wp.code ? wp.code.slice(0, 3) : '•'}
            </div>
            ${
              isNavTarget
                ? `<div style="position: absolute; width: 38px; height: 38px; border-radius: 50%; border: 2px solid ${color}; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>`
                : ''
            }
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([wp.lat, wp.lng], { icon: wpIcon });

      const utmCoord = latLngToUTM(wp.lat, wp.lng);

      marker.bindPopup(`
        <div class="p-2 text-slate-900 font-sans max-w-xs">
          <div class="flex items-center justify-between gap-2 mb-1">
            <span class="px-1.5 py-0.5 text-[9px] font-bold bg-sky-100 text-sky-800 rounded uppercase">${wp.code || 'MARCO'}</span>
            <span class="text-[10px] text-slate-500 font-mono">${wp.createdAt ? new Date(wp.createdAt).toLocaleDateString('pt-BR') : ''}</span>
          </div>
          <h4 class="font-bold text-sm text-slate-900">${wp.name}</h4>
          <div class="text-[11px] font-mono text-slate-600 mt-1 bg-slate-100 p-1.5 rounded">
            <div>LAT: ${wp.lat.toFixed(5)}° LNG: ${wp.lng.toFixed(5)}°</div>
            <div>UTM: E ${utmCoord.easting} N ${utmCoord.northing}</div>
            <div>ALT: ${wp.altitude}m (±${wp.accuracy}m)</div>
          </div>
          ${wp.notes ? `<p class="text-xs text-slate-700 mt-1.5 italic">"${wp.notes}"</p>` : ''}
          ${
            wp.photos && wp.photos.length > 0
              ? `<div class="mt-2 text-[10px] font-bold text-sky-600">📷 ${wp.photos.length} foto(s) anexada(s)</div>`
              : ''
          }
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
  }, [layers, waypoints, savedTracks, activeTrack, teamMembers, navTarget]);

  // Update Live Current GPS User Marker
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (!userMarkerRef.current) {
      const userIcon = L.divIcon({
        className: 'custom-user-gps-dot',
        html: `
          <div style="position: relative; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 20px; height: 20px; border-radius: 50%; background-color: #38bdf8; opacity: 0.75; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="position: relative; width: 12px; height: 12px; border-radius: 50%; background-color: #0284c7; border: 2px solid white; box-shadow: 0 0 8px rgba(2, 132, 199, 0.8);"></div>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
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
  }, [currentGps, hasGpsLock]);

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
      if (!isMeasuring) return;

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
  }, [isMeasuring, measurementPoints.length, currentGps.altitude]);

  // Render Measurement Visuals: Markers, Polyline, Distance Pills
  useEffect(() => {
    if (!mapInstanceRef.current || !measureLayerGroupRef.current) return;
    const group = measureLayerGroupRef.current;
    group.clearLayers();

    if (measurementPoints.length === 0) return;

    // 1. Draw Connecting Polyline with glow
    if (measurementPoints.length > 1) {
      const latLngs = measurementPoints.map((p) => [p.lat, p.lng] as [number, number]);

      const polyline = L.polyline(latLngs, {
        color: '#e11d48', // rose-600
        weight: 3.5,
        dashArray: '6, 6',
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
              border: 1.5px solid #f43f5e;
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
              border: 2px solid #ffffff;
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

      // Click to edit point details/photos
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setSelectedPointForEdit({ point: pt, index: idx });
      });

      marker.addTo(group);
    });
  }, [measurementPoints]);

  // Measurement Actions
  const handleAddCurrentGpsPoint = () => {
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

    const currentZoom = Math.max(mapInstanceRef.current.getZoom(), 16);

    if (currentGps && currentGps.lat) {
      mapInstanceRef.current.flyTo([currentGps.lat, currentGps.lng], currentZoom, {
        duration: 0.8,
      });
    }

    try {
      const loc = await requestCurrentLocation();
      if (loc && mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([loc.lat, loc.lng], currentZoom, { duration: 0.8 });
      }
    } catch (err) {
      console.warn('Center GPS error:', err);
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
          onFinishMeasurement={() => setIsSummaryModalOpen(true)}
          onClose={() => setIsMeasuring(false)}
        />
      )}

      {/* Floating Tactical Top-Left Telemetry Bar */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 pointer-events-none">
        <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-lg p-2.5 shadow-2xl text-xs text-slate-200 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                hasGpsLock ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-ping'
              }`}
            ></div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                Posição GPS Atual
              </div>
              {hasGpsLock ? (
                <div className="font-mono font-bold text-slate-100">
                  {currentGps.lat.toFixed(5)}°, {currentGps.lng.toFixed(5)}°
                </div>
              ) : (
                <div className="text-xs text-amber-400 font-mono flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> Conectando GPS...
                </div>
              )}
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800"></div>

          <div className="hidden sm:block">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">UTM Fuso 23S</div>
            {hasGpsLock ? (
              <div className="font-mono text-slate-200">
                E: {currentUtm.easting} N: {currentUtm.northing}
              </div>
            ) : (
              <div className="text-xs text-slate-400">---</div>
            )}
          </div>

          <div className="h-6 w-px bg-slate-800 hidden sm:block"></div>

          <div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">
              Altitude / Precisão
            </div>
            {hasGpsLock ? (
              <div className="font-mono text-sky-400 font-bold">
                {currentGps.altitude}m{' '}
                <span className="text-[10px] text-slate-400 font-normal">
                  ±{currentGps.accuracy}m
                </span>
              </div>
            ) : (
              <div className="text-xs text-slate-400">---</div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Tactical Map Controls (Right Side) */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-2 pointer-events-auto">
        <button
          id="btn-center-gps"
          onClick={centerOnGps}
          title="Centralizar no GPS"
          className="w-10 h-10 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-sky-400 border border-slate-800 shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        >
          {isLocating ? (
            <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
          ) : (
            <Crosshair className="w-5 h-5" />
          )}
        </button>

        <button
          id="btn-zoom-in"
          onClick={() => mapInstanceRef.current?.zoomIn()}
          title="Aproximar Zoom (+)"
          className="w-10 h-10 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-800 shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        >
          <ZoomIn className="w-5 h-5" />
        </button>

        <button
          id="btn-zoom-out"
          onClick={() => mapInstanceRef.current?.zoomOut()}
          title="Afastar Zoom (-)"
          className="w-10 h-10 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-800 shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        >
          <ZoomOut className="w-5 h-5" />
        </button>

        <button
          id="btn-fit-bounds"
          onClick={fitAllLayers}
          title="Ajustar Visualização a Todas as Camadas"
          className="w-10 h-10 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-800 shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        >
          <Maximize2 className="w-5 h-5" />
        </button>

        <button
          id="btn-layer-manager-quick"
          onClick={() => setIsLayerModalOpen(true)}
          title="Gerenciar Camadas (PDF, KML, KMZ)"
          className="w-10 h-10 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-800 shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 relative"
        >
          <LayersIcon className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-sky-600 text-white text-[9px] font-bold flex items-center justify-center">
            {layers.filter((l) => l.visible).length}
          </span>
        </button>

        {/* Ruler / Geodesic Measurement Tool Trigger */}
        <button
          id="btn-measure-tool"
          onClick={() => {
            if (isMeasuring && measurementPoints.length > 0) {
              setIsSummaryModalOpen(true);
            } else {
              setIsMeasuring(!isMeasuring);
            }
          }}
          title={
            isMeasuring
              ? 'Régua Ativa - Clique para Ver Resumo e Relatório'
              : 'Ativar Régua Geodésica de Medição'
          }
          className={`w-10 h-10 rounded-lg border shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 relative ${
            isMeasuring
              ? 'bg-rose-600 text-white border-rose-500 shadow-rose-900/50 animate-pulse'
              : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-800'
          }`}
        >
          <Ruler className="w-5 h-5" />
          {measurementPoints.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black flex items-center justify-center">
              {measurementPoints.length}
            </span>
          )}
        </button>

        {/* Quick Offline Map Area Downloader */}
        <button
          id="btn-download-offline-map-quick"
          onClick={() => setIsOfflineModalOpen(true)}
          title="Baixar Área do Mapa para Uso Offline"
          className="w-10 h-10 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-emerald-400 border border-slate-800 shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        >
          <Download className="w-5 h-5" />
        </button>

        {/* AI Assistant */}
        <button
          id="btn-ai-assistant"
          onClick={() => setIsAiModalOpen(true)}
          title="Assistente SIG IA"
          className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-600 to-sky-600 text-white shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        >
          <SparklesIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Floating Bottom Quick Action Button: Mark Waypoint */}
      {currentRole !== 'auditor' && (
        <div className="absolute bottom-8 right-4 sm:bottom-6 sm:right-6 z-10 pointer-events-auto pb-[env(safe-area-inset-bottom)] flex items-center gap-2">
          {/* Quick Track Recording on Map */}
          {isRecordingTrack ? (
            <button
              onClick={stopTrackRecording}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-3.5 py-3 rounded-full font-bold shadow-2xl transition-all transform hover:-translate-y-0.5 border border-red-400/40 text-xs animate-pulse"
            >
              <Square className="w-4 h-4" />
              <span>Parar Gravação</span>
            </button>
          ) : (
            <button
              onClick={() => startTrackRecording(`Trilha Campo ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`)}
              className="flex items-center gap-1.5 bg-slate-900/95 hover:bg-slate-800 text-emerald-400 border border-slate-800 px-3.5 py-3 rounded-full font-bold shadow-2xl transition-all transform hover:-translate-y-0.5 text-xs"
              title="Iniciar Gravação de Trilha GPS no Mapa"
            >
              <Play className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Gravar Trilha</span>
            </button>
          )}

          <button
            id="btn-quick-drop-waypoint"
            onClick={() => setIsAddWaypointModalOpen(true)}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white px-4 py-3 rounded-full font-bold shadow-2xl transition-all transform hover:-translate-y-0.5 border border-sky-400/40"
          >
            <Plus className="w-5 h-5" />
            <span className="text-sm">Marcar Ponto em Campo</span>
          </button>
        </div>
      )}

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
