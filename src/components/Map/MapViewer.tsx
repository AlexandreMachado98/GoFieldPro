import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useApp } from '../../context/AppContext';
import { Waypoint, TeamMember } from '../../types';
import { formatToDMS, latLngToUTM } from '../../utils/geoUtils';
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
} from 'lucide-react';

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
  } = useApp();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayLayersGroupRef = useRef<L.FeatureGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userAccuracyCircleRef = useRef<L.Circle | null>(null);
  const measurePointsRef = useRef<[number, number][]>([]);
  const measurePolylineRef = useRef<L.Polyline | null>(null);
  const hasAutoCenteredRef = useRef<boolean>(false);
  const userInteractedRef = useRef<boolean>(false);
  const lastProjectIdRef = useRef<string>(activeProject.id);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // Initialize Map
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

    // Feature group for overlays
    const overlaysGroup = L.featureGroup().addTo(map);
    overlayLayersGroupRef.current = overlaysGroup;

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
        const trackLine = L.polyline(latLngs, {
          color: track.color || '#0284c7',
          weight: 4,
          opacity: 0.9,
          dashArray: '2, 6',
        });

        trackLine.bindPopup(`
          <div class="p-2 text-slate-900 font-sans">
            <span class="inline-block px-1.5 py-0.5 mb-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded">Trilha Gravada</span>
            <h4 class="font-bold text-sm text-slate-900">${track.name}</h4>
            <div class="grid grid-cols-2 gap-1 text-[11px] text-slate-600 mt-1">
              <div>Distância: <b>${track.distanceKm.toFixed(2)} km</b></div>
              <div>Vel. Média: <b>${track.avgSpeedKmh.toFixed(1)} km/h</b></div>
              <div>Elevação: <b>+${track.elevationGainM}m</b></div>
              <div>Operador: <b>${track.userName}</b></div>
            </div>
          </div>
        `);

        trackLine.addTo(group);
      }
    }

    // 4. Render Active Recording Track
    if (activeTrack && activeTrack.points.length > 1) {
      const latLngs = activeTrack.points.map((p) => [p.lat, p.lng] as [number, number]);
      const activeLine = L.polyline(latLngs, {
        color: '#f59e0b',
        weight: 5,
        opacity: 1.0,
      });
      activeLine.addTo(group);
    }

    // 5. Render Waypoints
    for (const wp of waypoints) {
      const getCategoryBadgeColor = (cat: Waypoint['category']) => {
        switch (cat) {
          case 'hazard': return '#ef4444';
          case 'geodesic': return '#8b5cf6';
          case 'fauna_flora': return '#10b981';
          case 'inspection': return '#0284c7';
          case 'obstacle': return '#f97316';
          default: return '#64748b';
        }
      };

      const color = getCategoryBadgeColor(wp.category);

      const customIcon = L.divIcon({
        className: 'custom-tactical-waypoint',
        html: `
          <div class="tactical-pin-wrap" style="transform: translate(-50%, -100%);">
            <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
              <div style="
                width: 28px;
                height: 28px;
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg);
                background-color: ${color};
                border: 2px solid #ffffff;
                box-shadow: 0 4px 12px rgba(0,0,0,0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.15s ease;
              ">
                <div style="
                  transform: rotate(45deg);
                  color: #ffffff;
                  font-size: 10px;
                  font-weight: 900;
                  line-height: 1;
                  font-family: monospace;
                ">
                  ${wp.code.slice(0, 3)}
                </div>
              </div>
              <div style="
                margin-top: 2px;
                background: rgba(15,23,42,0.9);
                color: #e2e8f0;
                font-size: 9px;
                font-weight: 700;
                padding: 1px 4px;
                border-radius: 4px;
                border: 1px solid rgba(255,255,255,0.2);
                white-space: nowrap;
                box-shadow: 0 2px 4px rgba(0,0,0,0.5);
              ">${wp.code}</div>
            </div>
          </div>
        `,
        iconSize: [28, 34],
        iconAnchor: [14, 34],
      });

      const marker = L.marker([wp.lat, wp.lng], { icon: customIcon });

      const utm = latLngToUTM(wp.lat, wp.lng);

      const popupContent = document.createElement('div');
      popupContent.className = 'p-3 font-sans text-slate-900 max-w-[280px]';
      popupContent.innerHTML = `
        <div class="flex items-center justify-between gap-2 border-b border-slate-200 pb-1.5 mb-2">
          <span class="px-2 py-0.5 text-[10px] font-bold rounded text-white" style="background-color: ${color}">${wp.category.toUpperCase()}</span>
          <span class="text-xs font-mono font-semibold text-slate-600">${wp.code}</span>
        </div>
        <h4 class="font-bold text-sm text-slate-900 leading-tight">${wp.name}</h4>
        <p class="text-xs text-slate-600 mt-1 line-clamp-2">${wp.notes || 'Sem observações adicionais.'}</p>
        
        <div class="mt-2 text-[10px] font-mono text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-200">
          <div>LAT/LNG: ${wp.lat.toFixed(5)}, ${wp.lng.toFixed(5)}</div>
          <div>UTM: ${utm.zone} E:${utm.easting} N:${utm.northing}</div>
          <div>ALT: ${wp.altitude}m (±${wp.accuracy}m)</div>
        </div>

        ${wp.photos && wp.photos.length > 0 ? `
          <div class="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            ${wp.photos.map(p => `<img src="${p}" class="w-12 h-12 object-cover rounded border border-slate-300 flex-shrink-0" />`).join('')}
          </div>
        ` : ''}

        <div class="mt-3 pt-2 border-t border-slate-200 flex gap-1.5">
          <button id="btn-nav-${wp.id}" class="flex-1 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold py-1.5 px-2 rounded flex items-center justify-center gap-1 transition-colors">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
            Navegar
          </button>
        </div>
      `;

      popupContent.querySelector(`#btn-nav-${wp.id}`)?.addEventListener('click', () => {
        navigateToWaypoint(wp);
        marker.closePopup();
      });

      marker.bindPopup(popupContent);
      marker.addTo(group);
    }

    // 6. Render Remote Team Members Live Positions
    for (const member of teamMembers) {
      const isLead = member.role === 'field_lead';
      const isSos = member.status === 'sos';

      const teamIcon = L.divIcon({
        className: 'team-member-icon',
        html: `
          <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 cursor-pointer group">
            <div class="w-9 h-9 rounded-full border-2 ${isSos ? 'border-red-500 animate-ping' : isLead ? 'border-sky-400' : 'border-emerald-400'} bg-slate-900 overflow-hidden shadow-lg">
              <img src="${member.avatar}" alt="${member.name}" class="w-full h-full object-cover" />
            </div>
            <div class="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${member.status === 'in_field' ? 'bg-emerald-500' : member.status === 'sos' ? 'bg-red-500 animate-pulse' : 'bg-slate-400'}"></div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const memberMarker = L.marker([member.lastLocation.lat, member.lastLocation.lng], { icon: teamIcon });
      memberMarker.bindPopup(`
        <div class="p-2 text-slate-900 font-sans text-xs">
          <div class="flex items-center gap-2 mb-1.5">
            <img src="${member.avatar}" class="w-7 h-7 rounded-full object-cover border border-slate-300" />
            <div>
              <div class="font-bold text-slate-900">${member.name}</div>
              <div class="text-[10px] text-slate-500 uppercase">${member.role.replace('_', ' ')}</div>
            </div>
          </div>
          <div class="text-slate-700 bg-slate-100 p-1.5 rounded">
            <div>Tarefa: <b>${member.currentTask || 'Patrulhamento'}</b></div>
            <div>Bateria: <b>${member.batteryLevel}%</b> | Sinal: <b>${member.signalStrength.toUpperCase()}</b></div>
            <div>Último sinal: <b>${member.lastUpdate}</b></div>
          </div>
        </div>
      `);
      memberMarker.addTo(group);
    }
  }, [layers, waypoints, savedTracks, activeTrack, teamMembers]);

  // Update Live GPS User Marker
  useEffect(() => {
    if (!mapInstanceRef.current || !hasGpsLock) return;
    const map = mapInstanceRef.current;

    if (!userMarkerRef.current) {
      const userIcon = L.divIcon({
        className: 'bg-transparent border-0',
        html: `
          <div class="relative w-5 h-5 flex items-center justify-center">
            <div class="w-5 h-5 rounded-full bg-sky-500 border-2 border-white shadow-xl relative z-10 flex items-center justify-center">
              <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
            </div>
            <div class="w-10 h-10 rounded-full bg-sky-500/40 animate-ping absolute"></div>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      userMarkerRef.current = L.marker([currentGps.lat, currentGps.lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
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

  // Measurement Tool Click Handler
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (!isMeasuring) return;
      const pt: [number, number] = [e.latlng.lat, e.latlng.lng];
      measurePointsRef.current.push(pt);

      if (measurePolylineRef.current) {
        measurePolylineRef.current.setLatLngs(measurePointsRef.current);
      } else {
        measurePolylineRef.current = L.polyline(measurePointsRef.current, {
          color: '#e11d48',
          weight: 3,
          dashArray: '4, 4',
        }).addTo(map);
      }
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [isMeasuring]);

  const clearMeasurement = () => {
    measurePointsRef.current = [];
    if (measurePolylineRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(measurePolylineRef.current);
      measurePolylineRef.current = null;
    }
  };

  const centerOnGps = async () => {
    if (!mapInstanceRef.current) return;
    setIsLocating(true);
    userInteractedRef.current = true;

    const currentZoom = Math.max(mapInstanceRef.current.getZoom(), 16);

    // If we already have a position, fly immediately preserving current zoom
    if (currentGps && currentGps.lat) {
      mapInstanceRef.current.flyTo([currentGps.lat, currentGps.lng], currentZoom, { duration: 0.8 });
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
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0 bg-slate-950" />

      {/* Floating Tactical Top-Left Telemetry Bar */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 pointer-events-none">
        <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-lg p-2.5 shadow-2xl text-xs text-slate-200 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${hasGpsLock ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-ping'}`}></div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Posição GPS Atual</div>
              {hasGpsLock ? (
                <div className="font-mono font-bold text-slate-100">{currentGps.lat.toFixed(5)}°, {currentGps.lng.toFixed(5)}°</div>
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
            {hasGpsLock ? <div className="font-mono text-slate-200">E: {currentUtm.easting} N: {currentUtm.northing}</div> : <div className="text-xs text-slate-400">---</div>}
          </div>

          <div className="h-6 w-px bg-slate-800 hidden sm:block"></div>

          <div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Altitude / Precisão</div>
            {hasGpsLock ? <div className="font-mono text-sky-400 font-bold">{currentGps.altitude}m <span className="text-[10px] text-slate-400 font-normal">±{currentGps.accuracy}m</span></div> : <div className="text-xs text-slate-400">---</div>}
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
          {isLocating ? <Loader2 className="w-5 h-5 animate-spin text-sky-400" /> : <Crosshair className="w-5 h-5" />}
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

        <button
          id="btn-measure-tool"
          onClick={() => {
            if (isMeasuring) {
              clearMeasurement();
            }
            setIsMeasuring(!isMeasuring);
          }}
          title="Régua Geodésica de Medição"
          className={`w-10 h-10 rounded-lg border shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${
            isMeasuring ? 'bg-rose-600 text-white border-rose-500' : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-800'
          }`}
        >
          <Ruler className="w-5 h-5" />
        </button>

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
        <div className="absolute bottom-8 right-4 sm:bottom-6 sm:right-6 z-10 pointer-events-auto pb-[env(safe-area-inset-bottom)]">
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
        <a href="https://amtst.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300 hover:underline">
          amtst.vercel.app
        </a>
      </div>
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
