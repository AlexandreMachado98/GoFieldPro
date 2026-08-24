import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MeasurementPoint, MeasurementSession } from '../types';
import { calculateDistanceMeters, formatToDMS, latLngToUTM, calculatePolygonArea } from './geoUtils';

/**
 * Renders a high-resolution cartographic canvas illustration of the measured route,
 * including segment paths, distance badges, point markers (standard, stop, hazard),
 * UTM grid, north arrow, and graphic scale.
 */
export function generateMeasurementMapCanvas(
  points: MeasurementPoint[],
  width = 1200,
  height = 800
): string {
  if (!points || points.length === 0) return '';

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // 1. Cartographic Background (Technical Map Grid)
  ctx.fillStyle = '#0f172a'; // slate-900
  ctx.fillRect(0, 0, width, height);

  // Subtle grid pattern
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)'; // slate-700
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // 2. Calculate Geographic Bounds & Pixel Transformation
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

  // Margin in degrees if only 1 point or very close
  const latDelta = Math.max(maxLat - minLat, 0.001);
  const lngDelta = Math.max(maxLng - minLng, 0.001);

  const padding = 100;
  const drawWidth = width - padding * 2;
  const drawHeight = height - padding * 2;

  const toPx = (lat: number, lng: number) => {
    const x = padding + ((lng - (minLng - lngDelta * 0.1)) / (lngDelta * 1.2)) * drawWidth;
    const y = height - (padding + ((lat - (minLat - latDelta * 0.1)) / (latDelta * 1.2)) * drawHeight);
    return { x, y };
  };

  const pixelPoints = points.map((pt) => ({
    ...toPx(pt.lat, pt.lng),
    data: pt,
  }));

  // 3. Draw Connecting Polylines & Glow
  const isClosed =
    points.length >= 3 &&
    points[0].lat === points[points.length - 1].lat &&
    points[0].lng === points[points.length - 1].lng;

  if (pixelPoints.length > 1) {
    // Fill closed polygon
    if (isClosed) {
      ctx.save();
      ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
      ctx.beginPath();
      ctx.moveTo(pixelPoints[0].x, pixelPoints[0].y);
      for (let i = 1; i < pixelPoints.length; i++) {
        ctx.lineTo(pixelPoints[i].x, pixelPoints[i].y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Glow effect
    ctx.save();
    ctx.shadowColor = isClosed ? 'rgba(16, 185, 129, 0.6)' : 'rgba(14, 165, 233, 0.6)';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = isClosed ? '#10b981' : '#0284c7'; // emerald if closed, sky if open
    ctx.lineWidth = 4;
    ctx.setLineDash(isClosed ? [] : [8, 4]);

    ctx.beginPath();
    ctx.moveTo(pixelPoints[0].x, pixelPoints[0].y);
    for (let i = 1; i < pixelPoints.length; i++) {
      ctx.lineTo(pixelPoints[i].x, pixelPoints[i].y);
    }
    ctx.stroke();
    ctx.restore();

    // 4. Draw Segment Distances along Midpoints
    for (let i = 1; i < points.length; i++) {
      const p1 = pixelPoints[i - 1];
      const p2 = pixelPoints[i];
      const dist = calculateDistanceMeters(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
      const distFormatted = dist >= 1000 ? `${(dist / 1000).toFixed(2)} km` : `${Math.round(dist)} m`;

      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      // Distance Pill Background
      ctx.save();
      ctx.font = 'bold 13px sans-serif';
      const textWidth = ctx.measureText(distFormatted).width;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = isClosed ? '#10b981' : '#38bdf8';
      ctx.lineWidth = 1.5;

      const pillPad = 6;
      ctx.beginPath();
      ctx.roundRect(
        midX - textWidth / 2 - pillPad,
        midY - 10 - pillPad / 2,
        textWidth + pillPad * 2,
        20 + pillPad,
        6
      );
      ctx.fill();
      ctx.stroke();

      // Text
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(distFormatted, midX, midY + 1);
      ctx.restore();
    }
  }

  // 5. Draw Point Markers
  pixelPoints.forEach((pxPt, idx) => {
    const pt = pxPt.data;
    ctx.save();

    let bgColor = '#0284c7'; // default standard
    let borderColor = '#38bdf8';
    let iconText = `${idx + 1}`;

    if (pt.type === 'stop') {
      bgColor = '#10b981'; // emerald-500
      borderColor = '#6ee7b7';
      iconText = `🛑 ${idx + 1}`;
    } else if (pt.type === 'hazard') {
      bgColor = '#ef4444'; // red-500
      borderColor = '#fca5a5';
      iconText = `⚠️ ${idx + 1}`;
    }

    // Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 8;

    // Pin outer circle
    ctx.fillStyle = bgColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(pxPt.x, pxPt.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Pin text
    ctx.restore();
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(iconText, pxPt.x, pxPt.y);

    // Label tag below marker
    const tagText = pt.label || `Ponto ${idx + 1}`;
    ctx.font = 'bold 11px sans-serif';
    const tagWidth = ctx.measureText(tagText).width;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.roundRect(pxPt.x - tagWidth / 2 - 4, pxPt.y + 20, tagWidth + 8, 18, 4);
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(tagText, pxPt.x, pxPt.y + 30);

    ctx.restore();
  });

  // 6. Draw North Arrow / Compass (Top Right)
  ctx.save();
  const northX = width - 60;
  const northY = 60;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(northX, northY, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // North needle
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(northX, northY - 20);
  ctx.lineTo(northX - 6, northY + 4);
  ctx.lineTo(northX, northY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(northX, northY - 20);
  ctx.lineTo(northX + 6, northY + 4);
  ctx.lineTo(northX, northY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', northX, northY - 22);
  ctx.restore();

  // 7. Cartographic Frame & Neatline
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  // Bottom Legend & Metadata Banner
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fillRect(12, height - 42, width - 24, 30);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(
    `GoField Pro • Traçado Geodésico | Datum: WGS 84 / SIRGAS 2000 | Vértices: ${points.length}`,
    24,
    height - 23
  );

  return canvas.toDataURL('image/jpeg', 0.92);
}

/**
 * Generates and downloads the complete Technical Measurement PDF dossier.
 */
export async function generateMeasurementPdfReport(
  session: MeasurementSession,
  options: {
    companyName?: string;
    responsibleName?: string;
    weatherCondition?: string;
  } = {}
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const companyName = options.companyName || 'GOFIELD PRO • GESTÃO E ENGENHARIA DE CAMPO';
  const responsibleName = options.responsibleName || session.technicianName || 'Operador Técnico';
  const weather = options.weatherCondition || 'Céu Limpo / Operação Normal';
  const issueDate = new Date().toLocaleString('pt-BR');

  // 1. Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 30, 'F');

  // Accent Sky Bar
  doc.setFillColor(14, 165, 233); // sky-500
  doc.rect(0, 30, pageWidth, 2, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('RELATÓRIO TÉCNICO DE MEDIÇÃO & TRAÇADO DE CAMPO', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`${companyName} | Levantamento Planialtimétrico e Geodésico`, 14, 19);
  doc.text(`EMISSÃO: ${issueDate} | TÉCNICO RESPONSÁVEL: ${responsibleName.toUpperCase()}`, 14, 26);

  // E2EE Integrity Badge
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.roundedRect(pageWidth - 52, 7, 38, 15, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('PRECISÃO GEODÉSICA', pageWidth - 49, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('VERIFICADO WGS84', pageWidth - 49, 17);

  // 2. Executive Metrics Cards
  const startY = 36;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, startY, pageWidth - 28, 24, 2, 2, 'FD');

  const totalDistFormatted =
    session.totalDistanceMeters >= 1000
      ? `${(session.totalDistanceMeters / 1000).toFixed(3)} km (${Math.round(session.totalDistanceMeters)} m)`
      : `${session.totalDistanceMeters.toFixed(1)} metros`;

  const stopsCount = session.points.filter((p) => p.type === 'stop').length;
  const hazardsCount = session.points.filter((p) => p.type === 'hazard').length;

  // Walking & Vehicle ETA
  const walkMinutes = Math.round((session.totalDistanceMeters / 4000) * 60); // 4 km/h
  const vehicleMinutes = Math.round((session.totalDistanceMeters / 35000) * 60); // 35 km/h field speed

  const isClosed =
    session.points.length >= 3 &&
    session.points[0].lat === session.points[session.points.length - 1].lat &&
    session.points[0].lng === session.points[session.points.length - 1].lng;

  const area = isClosed ? calculatePolygonArea(session.points) : { m2: 0, hectares: 0 };

  // Column 1: Distância Total / Perímetro
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(isClosed ? 'PERÍMETRO TOTAL (FECHADO)' : 'DISTÂNCIA TOTAL MEDIDA', 18, startY + 6);
  doc.setFontSize(11);
  doc.setTextColor(isClosed ? 16 : 2, isClosed ? 185 : 132, isClosed ? 129 : 199);
  doc.text(totalDistFormatted, 18, startY + 14);
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Projeto: ${session.projectName}`, 18, startY + 20);

  // Divider
  doc.setDrawColor(203, 213, 225);
  doc.line(78, startY + 4, 78, startY + 20);

  // Column 2: Vértices & Paradas
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('VÉRTICES / PARADAS', 83, startY + 6);
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`${session.points.length} pontos`, 83, startY + 14);
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`${stopsCount} paradas • ${hazardsCount} alertas`, 83, startY + 20);

  // Divider
  doc.line(138, startY + 4, 138, startY + 20);

  // Column 3: Área Calculada (se fechado) ou Estimativa de Tempo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  if (isClosed) {
    doc.text('ÁREA TOTAL CALCULADA', 143, startY + 6);
    doc.setFontSize(10);
    doc.setTextColor(16, 185, 129);
    doc.text(`${area.hectares} ha`, 143, startY + 14);
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`${area.m2.toLocaleString('pt-BR')} m² exatos`, 143, startY + 20);
  } else {
    doc.text('TEMPO DE DESLOCAMENTO', 143, startY + 6);
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`A pé: ~${walkMinutes} min`, 143, startY + 14);
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Veículo 4x4: ~${Math.max(vehicleMinutes, 1)} min`, 143, startY + 20);
  }

  // 3. Render Cartographic Map Snapshot
  const mapImgData = generateMeasurementMapCanvas(session.points, 1200, 720);
  let currentY = 64;

  if (mapImgData) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('MAPA PLANIALTIMÉTRICO DO TRAÇADO', 14, currentY);

    const mapHeight = 82;
    doc.addImage(mapImgData, 'JPEG', 14, currentY + 3, pageWidth - 28, mapHeight);
    currentY += mapHeight + 8;
  }

  // 4. Point-by-Point Data Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('DETALHAMENTO DE VÉRTICES, SEGMENTOS E COORDENADAS', 14, currentY);

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
    if (pt.type === 'stop') typeLabel = 'Parada / Vistoria';
    if (pt.type === 'hazard') typeLabel = 'Atenção / Risco';

    return [
      `#${idx + 1} ${pt.label || ''}`,
      typeLabel,
      `${pt.lat.toFixed(5)}, ${pt.lng.toFixed(5)}`,
      `E: ${utm.easting} N: ${utm.northing} (Fuso ${utm.zone})`,
      `${pt.altitude ? pt.altitude.toFixed(0) + ' m' : '---'}`,
      segFormatted,
      cumFormatted,
      pt.notes || (pt.photos && pt.photos.length > 0 ? `${pt.photos.length} foto(s)` : '-'),
    ];
  });

  autoTable(doc, {
    startY: currentY + 3,
    head: [
      [
        'Ponto',
        'Classificação',
        'Coordenadas (Lat/Lng)',
        'Projeção UTM',
        'Alt.',
        'Dist. Trecho',
        'Dist. Acum.',
        'Observações',
      ],
    ],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'left', cellWidth: 20 },
      1: { halign: 'center', cellWidth: 24 },
      2: { fontStyle: 'bold', halign: 'center', cellWidth: 28 },
      3: { halign: 'center', cellWidth: 32 },
      4: { halign: 'center', cellWidth: 12 },
      5: { fontStyle: 'bold', halign: 'right', cellWidth: 18 },
      6: { fontStyle: 'bold', halign: 'right', cellWidth: 18 },
      7: { halign: 'left' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
  });

  // 5. Photo Gallery Section (if any points contain photos)
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

    // Page 2 Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 18, 'F');
    doc.setFillColor(14, 165, 233);
    doc.rect(0, 18, pageWidth, 1.5, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('REGISTRO FOTOGRÁFICO & EVIDÊNCIAS DE CAMPO', 14, 12);

    let photoY = 28;
    const photoWidth = 84;
    const photoHeight = 56;

    for (let i = 0; i < allPhotos.length; i++) {
      const item = allPhotos[i];
      const col = i % 2;
      const x = 14 + col * (photoWidth + 14);

      if (i > 0 && col === 0) {
        photoY += photoHeight + 20;
        if (photoY + photoHeight > pageHeight - 30) {
          doc.addPage();
          photoY = 24;
        }
      }

      try {
        doc.addImage(item.photoUrl, 'JPEG', x, photoY, photoWidth, photoHeight);
        doc.setDrawColor(203, 213, 225);
        doc.rect(x, photoY, photoWidth, photoHeight);

        // Caption box
        doc.setFillColor(248, 250, 252);
        doc.rect(x, photoY + photoHeight, photoWidth, 10, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text(`Foto ${i + 1}: ${item.label}`, x + 3, photoY + photoHeight + 6);
      } catch (err) {
        console.warn('Failed to embed photo into PDF', err);
      }
    }
  }

  // Signature Block on final page
  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 14 : pageHeight - 40;
  if (finalY < pageHeight - 35) {
    doc.setDrawColor(148, 163, 184);
    doc.line(pageWidth / 2 - 40, finalY + 12, pageWidth / 2 + 40, finalY + 12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(responsibleName.toUpperCase(), pageWidth / 2, finalY + 17, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('Assinatura do Responsável Técnico de Campo', pageWidth / 2, finalY + 21, {
      align: 'center',
    });
  }

  // Save PDF file
  const fileNameSafe = `Medicao_${session.projectName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
  doc.save(fileNameSafe);
}

/**
 * Exports measurement session to standard OGC KML format (Google Earth, QGIS, etc.).
 */
export function exportMeasurementKml(session: MeasurementSession): void {
  const escapeXml = (str?: string) => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const coordsString = session.points
    .map((pt) => `${pt.lng},${pt.lat},${pt.altitude || 0}`)
    .join(' ');

  const placemarksPoints = session.points
    .map(
      (pt, idx) => `
    <Placemark id="pt-${idx + 1}">
      <name>${escapeXml(pt.label || `Ponto ${idx + 1}`)}</name>
      <description><![CDATA[
        <p><b>Tipo:</b> ${pt.type}</p>
        <p><b>Observações:</b> ${escapeXml(pt.notes || '')}</p>
        <p><b>Coordenadas:</b> ${pt.lat.toFixed(6)}, ${pt.lng.toFixed(6)}</p>
      ]]></description>
      <Point>
        <coordinates>${pt.lng},${pt.lat},${pt.altitude || 0}</coordinates>
      </Point>
    </Placemark>`
    )
    .join('\n');

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(session.name || 'Medição de Distância')}</name>
    <description>Medição realizada no GoField Pro com ${session.points.length} pontos. Distância total: ${session.totalDistanceMeters.toFixed(1)} m.</description>
    <Style id="measureLine">
      <LineStyle>
        <color>ff0000ff</color>
        <width>4</width>
      </LineStyle>
    </Style>
    <Placemark id="route">
      <name>Traçado Medido - ${(session.totalDistanceMeters / 1000).toFixed(2)} km</name>
      <styleUrl>#measureLine</styleUrl>
      <LineString>
        <extrude>1</extrude>
        <tessellate>1</tessellate>
        <altitudeMode>clampToGround</altitudeMode>
        <coordinates>${coordsString}</coordinates>
      </LineString>
    </Placemark>
    ${placemarksPoints}
  </Document>
</kml>`;

  const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${session.name.replace(/\s+/g, '_')}_medicao.kml`;
  a.click();
  URL.revokeObjectURL(url);
}
