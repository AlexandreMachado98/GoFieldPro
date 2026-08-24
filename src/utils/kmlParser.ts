import JSZip from 'jszip';
import { KMLFeature, GeoCoordinate, Waypoint, Track } from '../types';

/**
 * Parses coordinate string from KML (e.g. "lng,lat,alt lng,lat,alt ...")
 */
export function parseKMLCoordinates(coordStr: string): GeoCoordinate[] {
  const coords: GeoCoordinate[] = [];
  const cleanStr = coordStr.trim();
  if (!cleanStr) return coords;

  const rawPoints = cleanStr.split(/\s+/);
  for (const raw of rawPoints) {
    const parts = raw.split(',');
    if (parts.length >= 2) {
      const lng = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      const altitude = parts.length > 2 ? parseFloat(parts[2]) : undefined;
      if (!isNaN(lat) && !isNaN(lng)) {
        coords.push({ lat, lng, altitude });
      }
    }
  }
  return coords;
}

/**
 * Parses XML KML document and extracts structured KMLFeature objects
 */
export function parseKMLString(kmlText: string, layerId: string = 'kml-layer'): KMLFeature[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
  const features: KMLFeature[] = [];

  const placemarks = xmlDoc.getElementsByTagName('Placemark');

  for (let i = 0; i < placemarks.length; i++) {
    const pm = placemarks[i];
    const nameEl = pm.getElementsByTagName('name')[0];
    const name = nameEl ? nameEl.textContent || `Elemento ${i + 1}` : `Elemento ${i + 1}`;
    
    const descEl = pm.getElementsByTagName('description')[0];
    const description = descEl ? descEl.textContent || '' : '';

    // Check for Point
    const pointEl = pm.getElementsByTagName('Point')[0];
    if (pointEl) {
      const coordsEl = pointEl.getElementsByTagName('coordinates')[0];
      if (coordsEl && coordsEl.textContent) {
        const coords = parseKMLCoordinates(coordsEl.textContent);
        if (coords.length > 0) {
          features.push({
            id: `${layerId}-pt-${i}`,
            name,
            description,
            type: 'Point',
            coordinates: coords[0],
            color: '#3b82f6',
            layerId,
          });
        }
      }
    }

    // Check for LineString
    const lineEl = pm.getElementsByTagName('LineString')[0];
    if (lineEl) {
      const coordsEl = lineEl.getElementsByTagName('coordinates')[0];
      if (coordsEl && coordsEl.textContent) {
        const coords = parseKMLCoordinates(coordsEl.textContent);
        if (coords.length > 1) {
          features.push({
            id: `${layerId}-line-${i}`,
            name,
            description,
            type: 'LineString',
            coordinates: coords,
            color: '#10b981',
            strokeWidth: 4,
            layerId,
          });
        }
      }
    }

    // Check for Polygon
    const polyEl = pm.getElementsByTagName('Polygon')[0];
    if (polyEl) {
      const coordsEl = polyEl.getElementsByTagName('coordinates')[0];
      if (coordsEl && coordsEl.textContent) {
        const coords = parseKMLCoordinates(coordsEl.textContent);
        if (coords.length >= 3) {
          features.push({
            id: `${layerId}-poly-${i}`,
            name,
            description,
            type: 'Polygon',
            coordinates: coords,
            color: '#f59e0b',
            fillColor: 'rgba(245, 158, 11, 0.25)',
            strokeWidth: 2,
            layerId,
          });
        }
      }
    }
  }

  return features;
}

/**
 * Extracts and parses KMZ archive using JSZip
 */
export async function parseKMZFile(file: File | Blob, layerId: string = 'kmz-layer'): Promise<{ features: KMLFeature[]; name: string }> {
  const zip = new JSZip();
  const zipContent = await zip.loadAsync(file);
  
  // Find doc.kml or any .kml file inside the KMZ archive
  let kmlFile = zipContent.file('doc.kml');
  if (!kmlFile) {
    const kmlFiles = zipContent.file(/\.kml$/i);
    if (kmlFiles.length > 0) {
      kmlFile = kmlFiles[0];
    }
  }

  if (!kmlFile) {
    throw new Error('Nenhum arquivo .kml válido encontrado dentro do pacote KMZ.');
  }

  const kmlText = await kmlFile.async('text');
  const features = parseKMLString(kmlText, layerId);
  return { features, name: file instanceof File ? file.name.replace(/\.kmz$/i, '') : 'Camada KMZ' };
}

/**
 * Exports waypoints and tracks to KML string
 */
export function exportToKMLString(projectName: string, waypoints: Waypoint[], tracks: Track[]): string {
  let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(projectName)} - GeoField Pro Export</name>
    <description>Exportado automaticamente pelo GeoField Pro - Inteligência Geoespacial de Campo</description>
    
    <Folder>
      <name>Marcos e Pontos de Campo</name>`;

  for (const wp of waypoints) {
    kml += `
      <Placemark>
        <name>${escapeXml(wp.name)} (${escapeXml(wp.code)})</name>
        <description><![CDATA[
          <b>Categoria:</b> ${escapeXml(wp.category)}<br/>
          <b>Coordenadas:</b> Lat: ${wp.lat.toFixed(6)}, Lng: ${wp.lng.toFixed(6)}<br/>
          <b>Altitude:</b> ${wp.altitude}m (Precisão: ±${wp.accuracy}m)<br/>
          <b>Notas de Campo:</b> ${escapeXml(wp.notes)}<br/>
          <b>Criado por:</b> ${escapeXml(wp.createdBy)} em ${new Date(wp.createdAtétoLocaleString('pt-BR')}
        ]]></description>
        <Point>
          <coordinates>${wp.lng},${wp.lat},${wp.altitude}</coordinates>
        </Point>
      </Placemark>`;
  }

  kml += `
    </Folder>
    <Folder>
      <name>Trilhas e Rastreamentos GPS</name>`;

  for (const tr of tracks) {
    if (tr.points.length > 1) {
      const coordStr = tr.points.map(p => `${p.lng},${p.lat},${p.altitude}`).join(' ');
      kml += `
      <Placemark>
        <name>${escapeXml(tr.name)}</name>
        <description><![CDATA[
          <b>Distância:</b> ${tr.distanceKm.toFixed(2)} km<br/>
          <b>Velocidade Média:</b> ${tr.avgSpeedKmh.toFixed(1)} km/h<br/>
          <b>Ganho de Elevação:</b> +${tr.elevationGainM}m<br/>
          <b>Operador:</b> ${escapeXml(tr.userName)}
        ]]></description>
        <LineString>
          <tessellate>1</tessellate>
          <coordinates>${coordStr}</coordinates>
        </LineString>
      </Placemark>`;
    }
  }

  kml += `
    </Folder>
  </Document>
</kml>`;

  return kml;
}

/**
 * Creates and downloads a KMZ zipped package
 */
export async function exportToKMZBlob(projectName: string, waypoints: Waypoint[], tracks: Track[]): Promise<Blob> {
  const kmlString = exportToKMLString(projectName, waypoints, tracks);
  const zip = new JSZip();
  zip.file('doc.kml', kmlString);
  return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

/**
 * Exports to GeoJSON feature collection
 */
export function exportToGeoJSON(projectName: string, waypoints: Waypoint[], tracks: Track[]): string {
  const geojson = {
    type: 'FeatureCollection',
    name: projectName,
    features: [
      ...waypoints.map(wp => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [wp.lng, wp.lat, wp.altitude],
        },
        properties: {
          id: wp.id,
          name: wp.name,
          code: wp.code,
          category: wp.category,
          notes: wp.notes,
          accuracy: wp.accuracy,
          createdBy: wp.createdBy,
          createdAtéwp.createdAtésynced: wp.synced,
        }
      })),
      ...tracks.map(tr => ({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: tr.points.map(p => [p.lng, p.lat, p.altitude]),
        },
        properties: {
          id: tr.id,
          name: tr.name,
          userName: tr.userName,
          distanceKm: tr.distanceKm,
          avgSpeedKmh: tr.avgSpeedKmh,
          elevationGainM: tr.elevationGainM,
        }
      }))
    ]
  };

  return JSON.stringify(geojson, null, 2);
}

/**
 * Exports to CSV string
 */
export function exportToCSV(waypoints: Waypoint[]): string {
  const headers = ['ID', 'Codigo', 'Nome', 'Categoria', 'Latitude', 'Longitude', 'Altitude_m', 'Precisao_m', 'Responsavel', 'Data_Hora', 'Notas'];
  const rows = waypoints.map(w => [
    `"${w.id}"`,
    `"${w.code}"`,
    `"${w.name.replace(/"/g, '""')}"`,
    `"${w.category}"`,
    w.lat.toFixed(7),
    w.lng.toFixed(7),
    w.altitude,
    w.accuracy,
    `"${w.createdBy.replace(/"/g, '""')}"`,
    `"${new Date(w.createdAtétoISOString()}"`,
    `"${w.notes.replace(/"/g, '""')}"`,
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Exports GPS tracks to GPX 1.1 format
 */
export function exportToGPX(projectName: string, waypoints: Waypoint[], tracks: Track[]): string {
  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GeoField Pro - SIG Campo" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(projectName)}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>`;

  for (const wp of waypoints) {
    gpx += `
  <wpt lat="${wp.lat}" lon="${wp.lng}">
    <ele>${wp.altitude}</ele>
    <name>${escapeXml(wp.name)}</name>
    <desc>${escapeXml(wp.notes)}</desc>
    <type>${escapeXml(wp.category)}</type>
  </wpt>`;
  }

  for (const tr of tracks) {
    gpx += `
  <trk>
    <name>${escapeXml(tr.name)}</name>
    <trkseg>`;
    for (const p of tr.points) {
      gpx += `
      <trkpt lat="${p.lat}" lon="${p.lng}">
        <ele>${p.altitude}</ele>
        <time>${new Date(p.timestamp).toISOString()}</time>
      </trkpt>`;
    }
    gpx += `
    </trkseg>
  </trk>`;
  }

  gpx += `
</gpx>`;

  return gpx;
}

function escapeXml(unsafe: string = ''): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
