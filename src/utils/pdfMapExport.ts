import jsPDF from 'jspdf';
import JSZip from 'jszip';
import { PdfDocument, PdfMarker, PdfTrack } from './pdfStorage';
import { pdfToGps } from './geoTransform';

/**
 * Exports document waypoints and tracks to standard OGC KML format
 * (Compatible with Google Earth, QGIS, ArcGIS, Avenza Maps, Locus Map, Maps.me)
 */
export function generateKML(doc: PdfDocument, projectName = 'GoField Pro'): string {
  const escapeXml = (str?: string) => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const markersKml = (doc.markers || []).map((marker) => {
    const coords = marker.lat !== undefined && marker.lng !== undefined
      ? { lat: marker.lat, lng: marker.lng }
      : pdfToGps(marker.x, marker.y, doc);

    const photosNote = marker.photos && marker.photos.length > 0 
      ? `&lt;br/&gt;&lt;b&gt;Evidências Fotográficas:&lt;/b&gt; ${marker.photos.length} foto(s) anexada(s)` 
      : '';

    return `
    <Placemark id="${escapeXml(marker.id)}">
      <name>${escapeXml(marker.title)}</name>
      <description><![CDATA[
        <div style="font-family: sans-serif;">
          <p><b>Categoria:</b> ${escapeXml(marker.category)}</p>
          <p><b>Data/Hora:</b> ${escapeXml(marker.createdAt)}</p>
          ${marker.notes ? `<p><b>Anotações de Campo:</b><br/>${escapeXml(marker.notes)}</p>` : ''}
          ${photosNote}
          <hr/>
          <p style="font-size: 10px; color: #666;">GoField Pro • Levantamento de Campo</p>
        </div>
      ]]></description>
      <Style>
        <IconStyle>
          <color>ff${(marker.color || '#0284c7').replace('#', '')}</color>
          <scale>1.2</scale>
          <Icon>
            <href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>
          </Icon>
        </IconStyle>
      </Style>
      <Point>
        <coordinates>${coords.lng},${coords.lat},0</coordinates>
      </Point>
    </Placemark>`;
  }).join('\n');

  const tracksKml = (doc.tracks || []).map((track) => {
    const coordsList = track.points.map((pt) => {
      const c = pt.lat !== undefined && pt.lng !== undefined
        ? { lat: pt.lat, lng: pt.lng }
        : pdfToGps(pt.x, pt.y, doc);
      return `${c.lng},${c.lat},${pt.altitude || 0}`;
    }).join(' ');

    const kmlColor = (track.color || '#ef4444').replace('#', '');
    // KML format is AABBGGRR
    const hexColor = `ff${kmlColor.length === 6 ? kmlColor.slice(4,6) + kmlColor.slice(2,4) + kmlColor.slice(0,2) : '0000ff'}`;

    return `
    <Placemark id="${escapeXml(track.id)}">
      <name>${escapeXml(track.name)}</name>
      <description><![CDATA[
        <div style="font-family: sans-serif;">
          <p><b>Tipo:</b> ${track.isRecorded ? 'Trilha Gravada em Campo' : 'Rota Planejada'}</p>
          <p><b>Vértices:</b> ${track.points.length} pontos</p>
          <p><b>Data:</b> ${escapeXml(track.createdAt)}</p>
          <p><b>Distância:</b> ${escapeXml(track.distance || 'N/A')}</p>
          <hr/>
          <p style="font-size: 10px; color: #666;">GoField Pro • Sistema de Campo</p>
        </div>
      ]]></description>
      <Style>
        <LineStyle>
          <color>${hexColor}</color>
          <width>4</width>
        </LineStyle>
      </Style>
      <LineString>
        <extrude>1</extrude>
        <tessellate>1</tessellate>
        <altitudeMode>clampToGround</altitudeMode>
        <coordinates>${coordsList}</coordinates>
      </LineString>
    </Placemark>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
  <Document>
    <name>${escapeXml(doc.name)} - Levantamento de Campo</name>
    <description>Marcações, Vistorias e Trilhas de Campo exportadas do GoField Pro</description>
    
    <Folder>
      <name>Pontos de Campo (Waypoints - ${doc.markers.length})</name>
      ${markersKml}
    </Folder>

    <Folder>
      <name>Rotas e Trilhas (${(doc.tracks || []).length})</name>
      ${tracksKml}
    </Folder>
  </Document>
</kml>`;
}

/**
 * Exports document waypoints and tracks to standard RFC 7946 GeoJSON format
 * (Compatible with QGIS, ArcGIS, Mapbox, Leaflet, GeoPandas, WebGIS)
 */
export function generateGeoJSON(doc: PdfDocument): string {
  const features: any[] = [];

  // Add Waypoints
  (doc.markers || []).forEach((marker) => {
    const coords = marker.lat !== undefined && marker.lng !== undefined
      ? { lat: marker.lat, lng: marker.lng }
      : pdfToGps(marker.x, marker.y, doc);

    features.push({
      type: 'Feature',
      id: marker.id,
      geometry: {
        type: 'Point',
        coordinates: [coords.lng, coords.lat],
      },
      properties: {
        id: marker.id,
        title: marker.title,
        notes: marker.notes || '',
        category: marker.category,
        color: marker.color,
        createdAt: marker.createdAt,
        photosCount: marker.photos ? marker.photos.length : 0,
        pdfPixelX: marker.x,
        pdfPixelY: marker.y,
        mapSource: doc.name,
        system: 'GoField Pro - Sistema de Navegação',
      },
    });
  });

  // Add Tracks / Routes
  (doc.tracks || []).forEach((track) => {
    const lineCoords = track.points.map((pt) => {
      const c = pt.lat !== undefined && pt.lng !== undefined
        ? { lat: pt.lat, lng: pt.lng }
        : pdfToGps(pt.x, pt.y, doc);
      return [c.lng, c.lat];
    });

    features.push({
      type: 'Feature',
      id: track.id,
      geometry: {
        type: 'LineString',
        coordinates: lineCoords,
      },
      properties: {
        id: track.id,
        name: track.name,
        color: track.color,
        isRecorded: !!track.isRecorded,
        createdAt: track.createdAt,
        distance: track.distance || '',
        duration: track.duration || '',
        pointCount: track.points.length,
        mapSource: doc.name,
        system: 'GoField Pro - AM TST (https://amtst.vercel.app/)',
      },
    });
  });

  const geoJsonObj = {
    type: 'FeatureCollection',
    name: `${doc.name}_Levantamento_Campo`,
    metadata: {
      generatedAt: new Date().toISOString(),
      mapDocument: doc.name,
      pageCount: doc.pageCount,
      author: 'AM TST SAÚDE E SEGURANÇA DO TRABALHO',
      website: 'https://amtst.vercel.app/',
    },
    features,
  };

  return JSON.stringify(geoJsonObj, null, 2);
}

/**
 * Exports document waypoints and tracks to standard GPX 1.1 format
 * (Compatible with Garmin, Strava, Gaia GPS, Wikiloc, Topo GPS, OruxMaps)
 */
export function generateGPX(doc: PdfDocument): string {
  const escapeXml = (str?: string) => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const waypointsGpx = (doc.markers || []).map((marker) => {
    const coords = marker.lat !== undefined && marker.lng !== undefined
      ? { lat: marker.lat, lng: marker.lng }
      : pdfToGps(marker.x, marker.y, doc);

    return `  <wpt lat="${coords.lat}" lon="${coords.lng}">
    <name>${escapeXml(marker.title)}</name>
    <desc>${escapeXml(marker.notes || marker.category)} - ${escapeXml(marker.createdAt)}</desc>
    <sym>Flag, Blue</sym>
    <type>${escapeXml(marker.category)}</type>
  </wpt>`;
  }).join('\n');

  const tracksGpx = (doc.tracks || []).map((track) => {
    const trkpts = track.points.map((pt) => {
      const coords = pt.lat !== undefined && pt.lng !== undefined
        ? { lat: pt.lat, lng: pt.lng }
        : pdfToGps(pt.x, pt.y, doc);

      return `      <trkpt lat="${coords.lat}" lon="${coords.lng}">
        ${pt.altitude ? `<ele>${pt.altitude}</ele>` : ''}
        ${pt.time ? `<time>${new Date().toISOString()}</time>` : ''}
      </trkpt>`;
    }).join('\n');

    return `  <trk>
    <name>${escapeXml(track.name)}</name>
    <desc>${track.isRecorded ? 'Trilha gravada em campo' : 'Rota traçada'}</desc>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GoField Pro"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(doc.name)}</name>
    <desc>Levantamento Técnico de Campo e Georreferenciamento</desc>
    <author>
      <name>GoField Pro</name>
    </author>
    <time>${new Date().toISOString()}</time>
  </metadata>
${waypointsGpx}
${tracksGpx}
</gpx>`;
}

/**
 * Generates high-resolution annotated PDF with map, superimposed vector markers, routes, and report
 */
export async function generateAnnotatedPdf(
  doc: PdfDocument,
  responsibleName = 'Técnico de Campo'
): Promise<Blob> {
  const pageIdx = doc.currentPage || 0;
  const currentDataUrl = doc.dataUrls[pageIdx] || doc.dataUrls[0];

  // Create an offscreen canvas to render map image + overlay markers & tracks
  const canvas = document.createElement('canvas');
  const img = typeof document !== 'undefined' ? document.createElement('img') : new (globalThis as any).Image();

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Falha ao carregar imagem base do mapa'));
    img.src = currentDataUrl;
  });

  const width = img.naturalWidth || doc.width || 1600;
  const height = img.naturalHeight || doc.height || 1200;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível inicializar o canvas de renderização');

  // 1. Draw base map image
  ctx.drawImage(img, 0, 0, width, height);

  // 2. Draw tracks and routes
  if (doc.tracks && doc.tracks.length > 0) {
    doc.tracks.forEach((track) => {
      if (track.points.length > 1) {
        ctx.beginPath();
        track.points.forEach((pt, i) => {
          // In Leaflet CRS.Simple [lat, lng] corresponds to [canvasY, canvasX]
          const canvasX = pt.y;
          const canvasY = height - pt.x; // Invert vertical coordinate

          if (i === 0) ctx.moveTo(canvasX, canvasY);
          else ctx.lineTo(canvasX, canvasY);
        });

        ctx.strokeStyle = track.color || '#0284c7';
        ctx.lineWidth = track.isRecorded ? 5 : 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (track.isRecorded) {
          ctx.setLineDash([8, 6]);
        } else {
          ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  }

  // 3. Draw markers (ALFINETES DE LOCALIZAÇÃO COM PONTA NO LOCAL EXATO)
  (doc.markers || []).forEach((marker, idx) => {
    const canvasX = marker.y;
    const canvasY = height - marker.x;
    const markerColor = marker.color || '#0284c7';
    const label = marker.title;

    ctx.save();

    // A. Ground target shadow and needle target point at exact coordinate
    ctx.beginPath();
    ctx.ellipse(canvasX, canvasY + 1.5, 7, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    // Fine target ring at exact coordinate
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();

    // B. Alfinete de Localização (Pin)
    // Needle tip is exactly at (canvasX, canvasY)
    const pinHeight = 36;
    const headRadius = 13;
    const headCenterY = canvasY - pinHeight + headRadius;

    ctx.beginPath();
    ctx.moveTo(canvasX, canvasY); // Ponta do alfinete no ponto exato
    ctx.bezierCurveTo(
      canvasX - 3, canvasY - 10,
      canvasX - headRadius, headCenterY + 6,
      canvasX - headRadius, headCenterY
    );
    ctx.arc(canvasX, headCenterY, headRadius, Math.PI, 0, false);
    ctx.bezierCurveTo(
      canvasX + headRadius, headCenterY + 6,
      canvasX + 3, canvasY - 10,
      canvasX, canvasY
    );
    ctx.closePath();

    // Pin Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 3;

    ctx.fillStyle = markerColor;
    ctx.fill();

    // White border outline
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // C. Inner white circular badge with point number
    ctx.beginPath();
    ctx.arc(canvasX, headCenterY, headRadius - 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${idx + 1}`, canvasX, headCenterY);

    // D. Marker floating label box above the pin head
    if (label) {
      ctx.font = 'bold 12px sans-serif';
      const textWidth = ctx.measureText(label).width;
      const boxW = textWidth + 14;
      const boxH = 20;
      const boxX = canvasX - boxW / 2;
      const boxY = headCenterY - headRadius - boxH - 4;

      // Rounded background box
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      const r = 5;
      ctx.moveTo(boxX + r, boxY);
      ctx.lineTo(boxX + boxW - r, boxY);
      ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + r);
      ctx.lineTo(boxX + boxW, boxY + boxH - r);
      ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - r, boxY + boxH);
      ctx.lineTo(boxX + r, boxY + boxH);
      ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - r);
      ctx.lineTo(boxX, boxY + r);
      ctx.quadraticCurveTo(boxX, boxY, boxX + r, boxY);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = markerColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, canvasX, boxY + boxH / 2);
    }

    ctx.restore();
  });

  // Get combined annotated canvas as image
  const annotatedMapDataUrl = canvas.toDataURL('image/jpeg', 0.92);

  // Initialize jsPDF (Landscape format matching typical map sheets)
  const isLandscape = width >= height;
  const pdfDoc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdfDoc.internal.pageSize.getWidth();
  const pageHeight = pdfDoc.internal.pageSize.getHeight();

  // Header Banner
  pdfDoc.setFillColor(15, 23, 42); // slate-900
  pdfDoc.rect(0, 0, pageWidth, 22, 'F');

  pdfDoc.setTextColor(255, 255, 255);
  pdfDoc.setFont('helvetica', 'bold');
  pdfDoc.setFontSize(13);
  pdfDoc.text('GOFIELD PRO | PLANTA TÉCNICA E MAPA ANOTADO DE CAMPO', 10, 9);

  pdfDoc.setFont('helvetica', 'normal');
  pdfDoc.setFontSize(8);
  pdfDoc.setTextColor(148, 163, 184); // slate-400
  pdfDoc.text(`PLANTA: ${doc.name.toUpperCase()} | EMISSÃO: ${new Date().toLocaleString('pt-BR')}`, 10, 15);
  pdfDoc.text(`RESPONSÁVEL: ${responsibleName.toUpperCase()} | PÁGINA: ${pageIdx + 1}/${doc.pageCount}`, 10, 19);

  // Embed Map Image
  const mapMarginTop = 24;
  const mapMarginBottom = 16;
  const availableHeight = pageHeight - mapMarginTop - mapMarginBottom;
  const availableWidth = pageWidth - 20;

  const scaleRatio = Math.min(availableWidth / width, availableHeight / height);
  const renderW = width * scaleRatio;
  const renderH = height * scaleRatio;
  const posX = 10 + (availableWidth - renderW) / 2;
  const posY = mapMarginTop + (availableHeight - renderH) / 2;

  pdfDoc.addImage(annotatedMapDataUrl, 'JPEG', posX, posY, renderW, renderH);

  // Footer
  pdfDoc.setFontSize(7.5);
  pdfDoc.setTextColor(148, 163, 184);
  pdfDoc.text(
    `GoField Pro • Sistema de Navegação e Mapeamento • Total: ${doc.markers.length} pontos e ${doc.tracks?.length || 0} rotas registradas`,
    10,
    pageHeight - 6
  );

  // Add Page 2 with Details Table if there are markers or tracks
  if (doc.markers.length > 0 || (doc.tracks && doc.tracks.length > 0)) {
    pdfDoc.addPage();

    // Page 2 Header
    pdfDoc.setFillColor(15, 23, 42);
    pdfDoc.rect(0, 0, pageWidth, 20, 'F');
    pdfDoc.setTextColor(255, 255, 255);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(12);
    pdfDoc.text('RELATÓRIO DESCRITIVO DE VISTORIAS E FEITOS DE CAMPO', 10, 9);
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(8);
    pdfDoc.setTextColor(148, 163, 184);
    pdfDoc.text(`Documento: ${doc.name} • GoField Pro`, 10, 15);

    let curY = 28;

    // Waypoints Section
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(10);
    pdfDoc.setTextColor(15, 23, 42);
    pdfDoc.text(`PONTOS DE CAMPO E VISTORIAS (${doc.markers.length})`, 10, curY);
    curY += 6;

    doc.markers.forEach((m, idx) => {
      if (curY > pageHeight - 30) {
        pdfDoc.addPage();
        curY = 20;
      }

      const coords = m.lat !== undefined && m.lng !== undefined
        ? { lat: m.lat, lng: m.lng }
        : pdfToGps(m.x, m.y, doc);

      pdfDoc.setFillColor(248, 250, 252);
      pdfDoc.roundedRect(10, curY, pageWidth - 20, 16, 2, 2, 'F');
      pdfDoc.setDrawColor(226, 232, 240);
      pdfDoc.roundedRect(10, curY, pageWidth - 20, 16, 2, 2, 'S');

      pdfDoc.setFont('helvetica', 'bold');
      pdfDoc.setFontSize(9);
      pdfDoc.setTextColor(15, 23, 42);
      pdfDoc.text(`${idx + 1}. ${m.title} [${m.category.toUpperCase()}]`, 14, curY + 6);

      pdfDoc.setFont('helvetica', 'normal');
      pdfDoc.setFontSize(8);
      pdfDoc.setTextColor(71, 85, 105);
      pdfDoc.text(`Horário: ${m.createdAt} | Coordenadas: Lat ${coords.lat.toFixed(6)}, Lng ${coords.lng.toFixed(6)} | Fotos: ${m.photos?.length || 0}`, 14, curY + 11);

      if (m.notes) {
        pdfDoc.text(`Obs: ${m.notes}`, 14, curY + 15);
      }

      curY += 19;
    });

    // Tracks Section
    if (doc.tracks && doc.tracks.length > 0) {
      curY += 4;
      if (curY > pageHeight - 30) {
        pdfDoc.addPage();
        curY = 20;
      }

      pdfDoc.setFont('helvetica', 'bold');
      pdfDoc.setFontSize(10);
      pdfDoc.setTextColor(15, 23, 42);
      pdfDoc.text(`ROTAS E TRILHAS GRAVADAS (${doc.tracks.length})`, 10, curY);
      curY += 6;

      doc.tracks.forEach((trk, idx) => {
        if (curY > pageHeight - 25) {
          pdfDoc.addPage();
          curY = 20;
        }

        pdfDoc.setFillColor(248, 250, 252);
        pdfDoc.roundedRect(10, curY, pageWidth - 20, 14, 2, 2, 'F');
        pdfDoc.setDrawColor(226, 232, 240);
        pdfDoc.roundedRect(10, curY, pageWidth - 20, 14, 2, 2, 'S');

        pdfDoc.setFont('helvetica', 'bold');
        pdfDoc.setFontSize(9);
        pdfDoc.setTextColor(15, 23, 42);
        pdfDoc.text(`${idx + 1}. ${trk.name} (${trk.isRecorded ? 'Trilha Gravada em Tempo Real' : 'Rota Traçada'})`, 14, curY + 6);

        pdfDoc.setFont('helvetica', 'normal');
        pdfDoc.setFontSize(8);
        pdfDoc.setTextColor(71, 85, 105);
        pdfDoc.text(`Data: ${trk.createdAt} | Pontos: ${trk.points.length} | Distância Estimada: ${trk.distance || 'N/A'}`, 14, curY + 11);

        curY += 17;
      });
    }

    // Page 2 Footer
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(148, 163, 184);
    pdfDoc.text(
      `GoField Pro • Sistema de Navegação e Mapeamento de Campo`,
      10,
      pageHeight - 6
    );
  }

  return pdfDoc.output('blob');
}

/**
 * Downloads a string or blob file locally
 */
export function downloadFile(content: string | Blob, fileName: string, mimeType: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Native Web Share API helper with fallback
 */
export async function shareExportedFile(
  fileBlob: Blob,
  fileName: string,
  title: string,
  text: string
): Promise<boolean> {
  try {
    const file = new File([fileBlob], fileName, { type: fileBlob.type });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title,
        text,
        files: [file],
      });
      return true;
    } else if (navigator.share) {
      await navigator.share({
        title,
        text,
      });
      downloadFile(fileBlob, fileName, fileBlob.type);
      return true;
    }
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      console.warn('Native share error, falling back to download:', err);
    }
  }

  // Fallback download
  downloadFile(fileBlob, fileName, fileBlob.type);
  return false;
}

/**
 * Exports document waypoints and tracks to KMZ (Zipped KML with images)
 */
export async function generateKMZ(doc: PdfDocument, projectName = 'GoField Pro'): Promise<Blob> {
  const zip = new JSZip();
  
  // We need to modify the KML slightly to reference local images in KMZ
  let kmlString = generateKML(doc, projectName);
  
  const imgFolder = zip.folder('images');
  if (imgFolder) {
    (doc.markers || []).forEach(marker => {
      if (marker.photos && marker.photos.length > 0) {
        marker.photos.forEach((photoBase64, idx) => {
          const parts = photoBase64.split(',');
          if (parts.length === 2) {
            const base64Data = parts[1];
            let ext = 'jpg';
            if (parts[0].includes('png')) ext = 'png';
            if (parts[0].includes('webp')) ext = 'webp';
            const filename = `${marker.id}_${idx}.${ext}`;
            
            imgFolder.file(filename, base64Data, {base64: true});
            
            // Replace base64 strings in KML with relative image paths
            // KML exported from generateKML currently embeds the base64 as an <img> tag src.
            // We need to replace src="data:image/jpeg;base64,..." with src="images/filename.jpg"
            // Wait, we can just blind replace the exact base64 dataUrl string!
            kmlString = kmlString.replace(photoBase64, `images/${filename}`);
          }
        });
      }
    });
  }
  
  zip.file('doc.kml', kmlString);
  return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
