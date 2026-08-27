import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MeasurementPoint, MeasurementSession } from '../types';
import { calculateDistanceMeters, formatToDMS, latLngToUTM, calculatePolygonArea } from './geoUtils';

// Helper math for Spherical Web Mercator Tiles
function lon2tileX(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function lat2tileY(lat: number, zoom: number): number {
  const latRad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  );
}

// Convert Lat/Lng to pixel on Mercator projection at given zoom
function projectMercator(lat: number, lng: number, zoom: number): { px: number; py: number } {
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const px = ((lng + 180) / 360) * 256 * Math.pow(2, zoom);
  const py =
    (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) *
    256 *
    Math.pow(2, zoom);
  return { px, py };
}

/**
 * Loads an image from URL with CORS enabled, returning a Promise.
 */
function loadImageAsync(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = typeof document !== 'undefined' ? document.createElement('img') : new (globalThis as any).Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

/**
 * Renders a high-resolution cartographic canvas featuring real map imagery (Satellite or Topo),
 * route polyline, closed polygon overlay, distance badges, point pins, compass, and graphic scale.
 */
export async function generateMeasurementMapCanvasAsync(
  points: MeasurementPoint[],
  width = 1200,
  height = 760,
  mapType: 'satellite' | 'street' | 'drawing' = 'satellite'
): Promise<string> {
  if (!points || points.length === 0) return '';

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // 1. Calculate Geographic Bounds
  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLng = points[0].lng;
  let maxLng = points[0].lng;

  for (const pt of points) {
    if (pt.lat < minLat) minLat = pt.lat;
    if (pt.lat > maxLat) maxLat = pt.lat;
    if (pt.lng < minLng) minLng = pt.lng;
    if (pt.lng > maxLng) maxLng = pt.lng;
  }

  const latSpan = Math.max(maxLat - minLat, 0.0008);
  const lngSpan = Math.max(maxLng - minLng, 0.0008);

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  // Clamp zoom to avoid over-zooming beyond imagery availability
  let zoom = 17;
  for (let z = 17; z >= 11; z--) {
    const pMin = projectMercator(maxLat, minLng, z);
    const pMax = projectMercator(minLat, maxLng, z);
    const boxW = Math.abs(pMax.px - pMin.px);
    const boxH = Math.abs(pMax.py - pMin.py);

    if (boxW <= width * 0.68 && boxH <= height * 0.68) {
      zoom = z;
      break;
    }
  }

  const centerMerc = projectMercator(centerLat, centerLng, zoom);
  const originX = centerMerc.px - width / 2;
  const originY = centerMerc.py - height / 2;

  const toCanvasPx = (lat: number, lng: number) => {
    const merc = projectMercator(lat, lng, zoom);
    return {
      x: merc.px - originX,
      y: merc.py - originY,
    };
  };

  let tilesDrawn = 0;
  if (mapType !== 'drawing') {
    const minTileX = lon2tileX(centerLng - (lngSpan * 1.8), zoom);
    const maxTileX = lon2tileX(centerLng + (lngSpan * 1.8), zoom);
    const minTileY = lat2tileY(centerLat + (latSpan * 1.8), zoom);
    const maxTileY = lat2tileY(centerLat - (latSpan * 1.8), zoom);

    const tilePromises: Promise<void>[] = [];

    for (let tx = minTileX; tx <= maxTileX; tx++) {
      for (let ty = minTileY; ty <= maxTileY; ty++) {
        const tileMercX = tx * 256;
        const tileMercY = ty * 256;
        const screenX = tileMercX - originX;
        const screenY = tileMercY - originY;

        if (screenX + 256 >= 0 && screenX <= width && screenY + 256 >= 0 && screenY <= height) {
          // Candidate tile URLs with Google Satellite as primary (100% Brazilian coverage)
          const candidateUrls =
            mapType === 'satellite'
              ? [
                  `https://mt1.google.com/vt/lyrs=s&x=${tx}&y=${ty}&z=${zoom}`,
                  `https://mt2.google.com/vt/lyrs=y&x=${tx}&y=${ty}&z=${zoom}`,
                  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${Math.min(zoom, 15)}/${lat2tileY(centerLat, Math.min(zoom, 15))}/${lon2tileX(centerLng, Math.min(zoom, 15))}`,
                  `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`,
                ]
              : [
                  `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`,
                  `https://a.basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${tx}/${ty}.png`,
                ];

          const p = (async () => {
            for (const url of candidateUrls) {
              try {
                const img = await loadImageAsync(url);
                if (img && img.width > 0) {
                  ctx.drawImage(img, screenX, screenY, 256, 256);
                  tilesDrawn++;
                  return;
                }
              } catch {
                // Try next candidate
              }
            }
          })();

          tilePromises.push(p);
        }
      }
    }

    await Promise.race([
      Promise.allSettled(tilePromises),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  }

  if (tilesDrawn === 0) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(51, 65, 85, 0.45)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
  } else {
    const gradient = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.max(width, height) * 0.65);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(15, 23, 42, 0.45)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  const pixelPoints = points.map((pt) => ({
    ...toCanvasPx(pt.lat, pt.lng),
    data: pt,
  }));

  const isClosed =
    points.length >= 3 &&
    points[0].lat === points[points.length - 1].lat &&
    points[0].lng === points[points.length - 1].lng;

  if (pixelPoints.length > 1) {
    if (isClosed) {
      ctx.save();
      ctx.fillStyle = 'rgba(16, 185, 129, 0.22)';
      ctx.beginPath();
      ctx.moveTo(pixelPoints[0].x, pixelPoints[0].y);
      for (let i = 1; i < pixelPoints.length; i++) ctx.lineTo(pixelPoints[i].x, pixelPoints[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(pixelPoints[0].x, pixelPoints[0].y);
    for (let i = 1; i < pixelPoints.length; i++) ctx.lineTo(pixelPoints[i].x, pixelPoints[i].y);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = isClosed ? '#10b981' : '#f43f5e';
    ctx.lineWidth = 3.5;
    if (!isClosed) ctx.setLineDash([8, 4]);

    ctx.beginPath();
    ctx.moveTo(pixelPoints[0].x, pixelPoints[0].y);
    for (let i = 1; i < pixelPoints.length; i++) ctx.lineTo(pixelPoints[i].x, pixelPoints[i].y);
    ctx.stroke();
    ctx.restore();

    for (let i = 1; i < points.length; i++) {
      const p1 = pixelPoints[i - 1];
      const p2 = pixelPoints[i];
      const dist = calculateDistanceMeters(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
      const distFormatted = dist >= 1000 ? `${(dist / 1000).toFixed(2)} km` : `${Math.round(dist)} m`;

      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      ctx.save();
      ctx.font = 'bold 12px sans-serif';
      const textWidth = ctx.measureText(distFormatted).width;
      const pillPad = 6;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = isClosed ? '#10b981' : '#f43f5e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(midX - textWidth / 2 - pillPad, midY - 10 - pillPad / 2, textWidth + pillPad * 2, 20 + pillPad, 6);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(distFormatted, midX, midY + 1);
      ctx.restore();
    }
  }

  pixelPoints.forEach((pxPt, idx) => {
    const pt = pxPt.data;
    ctx.save();
    let bgColor = '#0284c7';
    let borderColor = '#ffffff';
    let iconText = `${idx + 1}`;
    if (pt.type === 'stop') { bgColor = '#10b981'; iconText = `🛑 ${idx + 1}`; }
    else if (pt.type === 'hazard') { bgColor = '#f59e0b'; iconText = `⚠️ ${idx + 1}`; }
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = bgColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(pxPt.x, pxPt.y, 14, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(iconText, pxPt.x, pxPt.y);
    const tagText = pt.label || `Ponto ${idx + 1}`;
    ctx.font = 'bold 10px sans-serif';
    const tagWidth = ctx.measureText(tagText).width;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(pxPt.x - tagWidth / 2 - 5, pxPt.y + 18, tagWidth + 10, 16, 4);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(tagText, pxPt.x, pxPt.y + 26);
    ctx.restore();
  });

  ctx.save();
  const northX = width - 50;
  const northY = 50;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(northX, northY, 24, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(northX, northY - 17); ctx.lineTo(northX - 5, northY + 3); ctx.lineTo(northX, northY);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(northX, northY - 17); ctx.lineTo(northX + 5, northY + 3); ctx.lineTo(northX, northY);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', northX, northY - 19);
  ctx.restore();

  ctx.save();
  const scaleX = 24;
  const scaleY = height - 52;
  const metersPerPixel = (Math.cos((centerLat * Math.PI) / 180) * 2 * Math.PI * 6378137) / (256 * Math.pow(2, zoom));
  const rawDistMeters = 120 * metersPerPixel;
  let roundDistMeters = 100;
  if (rawDistMeters > 5000) roundDistMeters = Math.round(rawDistMeters / 1000) * 1000;
  else if (rawDistMeters > 1000) roundDistMeters = Math.round(rawDistMeters / 500) * 500;
  else if (rawDistMeters > 200) roundDistMeters = Math.round(rawDistMeters / 100) * 100;
  else roundDistMeters = Math.round(rawDistMeters / 25) * 25;
  const barPx = Math.max(roundDistMeters / metersPerPixel, 40);
  const scaleLabel = roundDistMeters >= 1000 ? `${roundDistMeters / 1000} km` : `${roundDistMeters} m`;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.roundRect(scaleX - 8, scaleY - 16, barPx + 16, 28, 4);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(scaleX, scaleY, barPx, 4);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(scaleX, scaleY, barPx / 2, 4);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Escala: 0 — ${scaleLabel}`, scaleX + barPx / 2, scaleY - 6);
  ctx.restore();

  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, width - 16, height - 16);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fillRect(10, height - 32, width - 20, 22);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`GoField Pro • Satélite Real de Campo | Datum: WGS 84 / SIRGAS 2000 | Vértices: ${points.length} | Lat: ${centerLat.toFixed(5)}° Lng: ${centerLng.toFixed(5)}°`, 20, height - 18);

  return canvas.toDataURL('image/jpeg', 0.92);
}

export function generateMeasurementMapCanvas(
  points: MeasurementPoint[],
  width = 800,
  height = 360
): string {
  if (!points || points.length === 0) return '';
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
  for (let y = 0; y < height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
  let minLat = points[0].lat, maxLat = points[0].lat, minLng = points[0].lng, maxLng = points[0].lng;
  for (const pt of points) {
    if (pt.lat < minLat) minLat = pt.lat;
    if (pt.lat > maxLat) maxLat = pt.lat;
    if (pt.lng < minLng) minLng = pt.lng;
    if (pt.lng > maxLng) maxLng = pt.lng;
  }
  const latDelta = Math.max(maxLat - minLat, 0.001), lngDelta = Math.max(maxLng - minLng, 0.001);
  const padding = 50, drawWidth = width - padding * 2, drawHeight = height - padding * 2;
  const toPx = (lat: number, lng: number) => ({
    x: padding + ((lng - (minLng - lngDelta * 0.1)) / (lngDelta * 1.2)) * drawWidth,
    y: height - (padding + ((lat - (minLat - latDelta * 0.1)) / (latDelta * 1.2)) * drawHeight)
  });
  const pixelPoints = points.map((pt) => ({ ...toPx(pt.lat, pt.lng), data: pt }));
  const isClosed = points.length >= 3 && points[0].lat === points[points.length - 1].lat && points[0].lng === points[points.length - 1].lng;
  if (pixelPoints.length > 1) {
    if (isClosed) { ctx.save(); ctx.fillStyle = 'rgba(16, 185, 129, 0.15)'; ctx.beginPath(); ctx.moveTo(pixelPoints[0].x, pixelPoints[0].y); for (let i = 1; i < pixelPoints.length; i++) ctx.lineTo(pixelPoints[i].x, pixelPoints[i].y); ctx.closePath(); ctx.fill(); ctx.restore(); }
    ctx.save(); ctx.strokeStyle = isClosed ? '#10b981' : '#f43f5e'; ctx.lineWidth = 3; if (!isClosed) ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(pixelPoints[0].x, pixelPoints[0].y); for (let i = 1; i < pixelPoints.length; i++) ctx.lineTo(pixelPoints[i].x, pixelPoints[i].y); ctx.stroke(); ctx.restore();
  }
  pixelPoints.forEach((pxPt, idx) => {
    const pt = pxPt.data;
    ctx.save();
    let bgColor = pt.type === 'stop' ? '#10b981' : (pt.type === 'hazard' ? '#f59e0b' : '#0284c7');
    ctx.fillStyle = bgColor; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pxPt.x, pxPt.y, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${idx + 1}`, pxPt.x, pxPt.y); ctx.restore();
  });
  return canvas.toDataURL('image/jpeg', 0.85);
}

export async function generateMeasurementPdfReport(
  session: MeasurementSession,
  options: {
    companyName?: string;
    responsibleName?: string;
    weatherCondition?: string;
    mapType?: 'satellite' | 'street' | 'drawing';
  } = {}
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  const companyName = options.companyName || 'GOFIELD PRO • GESTÃO E ENGENHARIA DE CAMPO';
  const responsibleName = options.responsibleName || session.technicianName || 'Operador Técnico';
  const issueDate = new Date().toLocaleString('pt-BR');

  // 1. Sleek Compact Header (Height: 18mm)
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 18, 'F');
  doc.setFillColor(14, 165, 233); // sky-500
  doc.rect(0, 18, pageWidth, 1.2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('RELATÓRIO TÉCNICO DE MEDIÇÃO & LEVANTAMENTO TOPOGRÁFICO', margin, 8.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`${companyName} • Datum WGS84 / SIRGAS 2000`, margin, 14);

  // Certification Seal
  doc.setFillColor(16, 185, 129);
  doc.roundedRect(pageWidth - margin - 36, 4, 36, 10, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('PRECISÃO GEODÉSICA', pageWidth - margin - 34, 7.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text('SIRGAS 2000 / WGS84', pageWidth - margin - 34, 11.5);

  // 2. Executive KPI Ribbon (Height: 14mm)
  const kpiY = 22;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, kpiY, contentWidth, 14, 1.5, 1.5, 'FD');

  const totalDistFormatted =
    session.totalDistanceMeters >= 1000
      ? `${(session.totalDistanceMeters / 1000).toFixed(3)} km (${Math.round(session.totalDistanceMeters)} m)`
      : `${session.totalDistanceMeters.toFixed(1)} m`;

  const stopsCount = session.points.filter((p) => p.type === 'stop').length;
  const hazardsCount = session.points.filter((p) => p.type === 'hazard').length;

  const isClosed =
    session.points.length >= 3 &&
    session.points[0].lat === session.points[session.points.length - 1].lat &&
    session.points[0].lng === session.points[session.points.length - 1].lng;

  const area = isClosed ? calculatePolygonArea(session.points) : { m2: 0, hectares: 0 };
  const walkMinutes = Math.round((session.totalDistanceMeters / 4000) * 60);

  // Col 1: Distância Total / Perímetro
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(isClosed ? 'PERÍMETRO TOTAL (FECHADO)' : 'DISTÂNCIA TOTAL MEDIDA', margin + 3, kpiY + 4.5);
  doc.setFontSize(9.5);
  doc.setTextColor(isClosed ? 16 : 2, isClosed ? 185 : 132, isClosed ? 129 : 199);
  doc.text(totalDistFormatted, margin + 3, kpiY + 10);

  // Divider 1
  doc.setDrawColor(203, 213, 225);
  doc.line(margin + 54, kpiY + 2, margin + 54, kpiY + 12);

  // Col 2: Área ou Vértices
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  if (isClosed) {
    doc.text('ÁREA TOTAL CALCULADA', margin + 57, kpiY + 4.5);
    doc.setFontSize(9.5);
    doc.setTextColor(16, 185, 129);
    doc.text(`${area.hectares} ha (${area.m2.toLocaleString('pt-BR')} m²)`, margin + 57, kpiY + 10);
  } else {
    doc.text('VÉRTICES MARCADOS', margin + 57, kpiY + 4.5);
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${session.points.length} pontos (${stopsCount} paradas, ${hazardsCount} alertas)`, margin + 57, kpiY + 10);
  }

  // Divider 2
  doc.line(margin + 124, kpiY + 2, margin + 124, kpiY + 12);

  // Col 3: Operação
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('RESPONSÁVEL & EMISSÃO', margin + 127, kpiY + 4.5);
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`${responsibleName}`, margin + 127, kpiY + 9.5);
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text(`Tempo a pé: ~${walkMinutes} min | ${issueDate.split(' ')[0]}`, margin + 127, kpiY + 13);

  // 3. Real Satellite Map Frame (Height: 88mm)
  let currentY = 39;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('ENQUADRAMENTO CARTOGRÁFICO DE CAMPO (IMAGEM REAL DE SATÉLITE)', margin, currentY);

  const realMapImg = await generateMeasurementMapCanvasAsync(
    session.points,
    1400,
    760,
    options.mapType || 'satellite'
  );

  const mapHeight = 84;
  if (realMapImg) {
    doc.addImage(realMapImg, 'JPEG', margin, currentY + 2, contentWidth, mapHeight);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, currentY + 2, contentWidth, mapHeight, 1, 1, 'S');
    currentY += mapHeight + 5;
  }

  // 4. Point-by-Point Data Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('DETALHAMENTO DE VÉRTICES, SEGMENTOS E COORDENADAS', margin, currentY);

  let cumulativeDist = 0;
  const tableRows = session.points.map((pt, idx) => {
    const segDist =
      idx === 0
        ? 0
        : calculateDistanceMeters(
            session.points[idx - 1].lat,
            session.points[idx - 1].lng,
            pt.lat,
            pt.lng
          );
    cumulativeDist += segDist;

    const utm = latLngToUTM(pt.lat, pt.lng);
    const segFormatted = idx === 0 ? '--- (Início)' : `${segDist.toFixed(1)} m`;
    const cumFormatted = `${cumulativeDist.toFixed(1)} m`;

    let typeLabel = 'Padrão';
    if (pt.type === 'stop') typeLabel = 'Parada';
    if (pt.type === 'hazard') typeLabel = 'Atenção';

    return [
      `#${idx + 1} ${pt.label || ''}`,
      typeLabel,
      `${pt.lat.toFixed(5)}°, ${pt.lng.toFixed(5)}°`,
      `E:${utm.easting} N:${utm.northing} (F:${utm.zone})`,
      `${pt.altitude ? pt.altitude.toFixed(0) + 'm' : '---'}`,
      segFormatted,
      cumFormatted,
      pt.notes || (pt.photos && pt.photos.length > 0 ? `${pt.photos.length} foto(s)` : '-'),
    ];
  });

  autoTable(doc, {
    startY: currentY + 2,
    head: [
      [
        'Ponto',
        'Tipo',
        'Coordenadas Lat/Lng',
        'Projeção UTM SIRGAS',
        'Alt.',
        'Dist. Trecho',
        'Dist. Acum.',
        'Notas de Campo',
      ],
    ],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 6.5,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 1.5,
    },
    bodyStyles: {
      fontSize: 6.5,
      textColor: [30, 41, 59],
      cellPadding: 1.2,
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'left', cellWidth: 20 },
      1: { halign: 'center', cellWidth: 16 },
      2: { fontStyle: 'bold', halign: 'center', cellWidth: 28 },
      3: { halign: 'center', cellWidth: 34 },
      4: { halign: 'center', cellWidth: 10 },
      5: { fontStyle: 'bold', halign: 'right', cellWidth: 18 },
      6: { fontStyle: 'bold', halign: 'right', cellWidth: 18 },
      7: { halign: 'left' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: margin, right: margin },
  });

  // 5. Photo Gallery Section
  const allPhotos: { ptIndex: number; label: string; photoUrl: string }[] = [];
  session.points.forEach((pt, idx) => {
    if (pt.photos && pt.photos.length > 0) {
      pt.photos.forEach((ph) => {
        allPhotos.push({
          ptIndex: idx + 1,
          label: pt.label || `Ponto #${idx + 1}`,
          photoUrl: ph,
        });
      });
    }
  });

  if (allPhotos.length > 0) {
    doc.addPage();
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 16, 'F');
    doc.setFillColor(14, 165, 233);
    doc.rect(0, 16, pageWidth, 1, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('REGISTRO FOTOGRÁFICO & EVIDÊNCIAS DE CAMPO', margin, 10);

    let photoY = 22;
    const photoWidth = 86;
    const photoHeight = 54;

    for (let i = 0; i < allPhotos.length; i++) {
      const item = allPhotos[i];
      const col = i % 2;
      const x = margin + col * (photoWidth + 14);

      if (i > 0 && col === 0) {
        photoY += photoHeight + 14;
        if (photoY + photoHeight > pageHeight - 25) {
          doc.addPage();
          photoY = 22;
        }
      }

      try {
        doc.addImage(item.photoUrl, 'JPEG', x, photoY, photoWidth, photoHeight);
        doc.setDrawColor(203, 213, 225);
        doc.rect(x, photoY, photoWidth, photoHeight);

        doc.setFillColor(248, 250, 252);
        doc.rect(x, photoY + photoHeight, photoWidth, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(15, 23, 42);
        doc.text(`Foto ${i + 1}: ${item.label}`, x + 3, photoY + photoHeight + 4.5);
      } catch (err) {
        console.warn('Failed to embed photo', err);
      }
    }
  }

  // 6. Signature Block
  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : pageHeight - 28;
  if (finalY < pageHeight - 22) {
    doc.setDrawColor(148, 163, 184);
    doc.line(pageWidth / 2 - 35, finalY + 8, pageWidth / 2 + 35, finalY + 8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(responsibleName.toUpperCase(), pageWidth / 2, finalY + 12, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Responsável Técnico de Campo • GoField Pro', pageWidth / 2, finalY + 15.5, {
      align: 'center',
    });
  }

  const fileNameSafe = `Relatorio_Medicao_${session.projectName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
  doc.save(fileNameSafe);
}

export function exportMeasurementKml(session: MeasurementSession): void {
  const escapeXml = (str?: string) => (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const coordsString = session.points.map((pt) => `${pt.lng},${pt.lat},${pt.altitude || 0}`).join(' ');
  const placemarksPoints = session.points.map((pt, idx) => `
    <Placemark>
      <name>${escapeXml(pt.label || `Ponto ${idx + 1}`)}</name>
      <Point><coordinates>${pt.lng},${pt.lat},${pt.altitude || 0}</coordinates></Point>
    </Placemark>`).join('');
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(session.name)}</name>
    <Placemark>
      <LineString><coordinates>${coordsString}</coordinates></LineString>
    </Placemark>
    ${placemarksPoints}
  </Document>
</kml>`;
  const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${session.name.replace(/\s+/g, '_')}.kml`; a.click();
}
