import JSZip from 'jszip';
import { KMLFeature, GeoCoordinate, Waypoint, Track } from '../types';

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

export function parseKMLString(kmlText: string, layerId: string = 'kml-layer', imagesMap?: Record<string, string>): KMLFeature[] {
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

    let photos: string[] = [];
    if (imagesMap && description) {
      const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
      let match;
      while ((match = imgRegex.exec(description)) !== null) {
        const src = match[1];
        if (imagesMap[src]) photos.push(imagesMap[src]);
        else if (imagesMap['images/' + src]) photos.push(imagesMap['images/' + src]);
        else {
           // fuzzy match filename
           const filename = src.split('/').pop();
           if (filename) {
             const key = Object.keys(imagesMap).find(k => k.endsWith(filename));
             if (key) photos.push(imagesMap[key]);
           }
        }
      }
    }

    // A Placemark can have Point, LineString, Polygon, MultiGeometry, gx:Track
    // Let's aggressively search for ANY <coordinates> tag inside this placemark
    const coordTags = pm.getElementsByTagName('coordinates');
    
    if (coordTags.length > 0) {
      for (let j = 0; j < coordTags.length; j++) {
        if (!coordTags[j].textContent) continue;
        const coords = parseKMLCoordinates(coordTags[j].textContent!);
        if (coords.length === 0) continue;
        
        if (coords.length === 1) {
          features.push({
            id: `${layerId}-pt-${i}-${j}`,
            name,
            description,
            type: 'Point',
            coordinates: coords[0],
            color: '#3b82f6',
            layerId,
            photos
          });
        } else {
          features.push({
            id: `${layerId}-line-${i}-${j}`,
            name,
            description,
            type: 'LineString',
            coordinates: coords,
            color: '#3b82f6',
            layerId,
            photos
          });
        }
      }
    } else {
      // Look for gx:coord in gx:Track (Google Earth specific format for tracks)
      const gxCoords = pm.getElementsByTagName('gx:coord');
      if (gxCoords.length > 0) {
        const coords: GeoCoordinate[] = [];
        for (let j = 0; j < gxCoords.length; j++) {
           const txt = gxCoords[j].textContent;
           if (txt) {
             const parts = txt.trim().split(/\s+/);
             if (parts.length >= 2) {
               coords.push({ lng: parseFloat(parts[0]), lat: parseFloat(parts[1]) });
             }
           }
        }
        if (coords.length === 1) {
          features.push({
            id: `${layerId}-gxpt-${i}`,
            name,
            description,
            type: 'Point',
            coordinates: coords[0],
            color: '#3b82f6',
            layerId,
            photos
          });
        } else if (coords.length > 1) {
          features.push({
            id: `${layerId}-gxline-${i}`,
            name,
            description,
            type: 'LineString',
            coordinates: coords,
            color: '#3b82f6',
            layerId,
            photos
          });
        }
      }
    }
  }

  return features;
}

export async function parseKMZFile(file: File | Blob, layerId: string = 'kmz-layer'): Promise<{ features: KMLFeature[]; name: string }> {
  const zip = new JSZip();
  const zipContent = await zip.loadAsync(file);
  
  let kmlFile = zipContent.file('doc.kml');
  if (!kmlFile) {
    const kmlFiles = zipContent.file(/\.kml$/i);
    if (kmlFiles.length > 0) kmlFile = kmlFiles[0];
  }

  if (!kmlFile) {
    throw new Error('Nenhum arquivo .kml válido encontrado dentro do pacote KMZ.');
  }

  const imagesMap: Record<string, string> = {};
  const imageFiles = zipContent.file(/\.(jpg|jpeg|png|webp|gif)$/i);
  for (const imgFile of imageFiles) {
    try {
      const base64Data = await imgFile.async('base64');
      let mimeType = 'image/jpeg';
      if (imgFile.name.toLowerCase().endsWith('.png')) mimeType = 'image/png';
      else if (imgFile.name.toLowerCase().endsWith('.webp')) mimeType = 'image/webp';
      else if (imgFile.name.toLowerCase().endsWith('.gif')) mimeType = 'image/gif';
      
      imagesMap[imgFile.name] = `data:${mimeType};base64,${base64Data}`;
    } catch (e) {
      console.warn('Failed to extract image from KMZ', imgFile.name);
    }
  }

  const kmlText = await kmlFile.async('text');
  const features = parseKMLString(kmlText, layerId, imagesMap);
  const name = file instanceof File ? file.name.replace(/\.kmz$/i, '') : 'Camada KMZ';
  return { features, name };
}

const escapeXml = (str?: string) => {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
};

export function exportToKMLString(projectName: string, waypoints: Waypoint[], tracks: Track[]): string {
  let kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n    <name>${escapeXml(projectName)} - GeoField Pro Export</name>\n\n`;
  waypoints.forEach((wp) => {
    kml += `    <Placemark>\n      <name>${escapeXml(wp.name || wp.code)}</name>\n      <description>${escapeXml(wp.notes || '')}</description>\n      <Point>\n        <coordinates>${wp.lng},${wp.lat},${wp.altitude || 0}</coordinates>\n      </Point>\n    </Placemark>\n`;
  });
  tracks.forEach((trk) => {
    kml += `    <Placemark>\n      <name>${escapeXml(trk.name)}</name>\n      <LineString>\n        <tessellate>1</tessellate>\n        <coordinates>\n`;
    trk.points.forEach((pt) => { kml += `          ${pt.lng},${pt.lat},${pt.altitude || 0}\n`; });
    kml += `        </coordinates>\n      </LineString>\n    </Placemark>\n`;
  });
  kml += `  </Document>\n</kml>`;
  return kml;
}

export async function exportToKMZBlob(projectName: string, waypoints: Waypoint[], tracks: Track[]): Promise<Blob> {
  const kmlString = exportToKMLString(projectName, waypoints, tracks);
  const zip = new JSZip();
  zip.file('doc.kml', kmlString);
  return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export function exportToGeoJSON(projectName: string, waypoints: Waypoint[], tracks: Track[]): string {
  const geojson = {
    type: 'FeatureCollection',
    name: projectName,
    features: [
      ...waypoints.map(wp => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [wp.lng, wp.lat, wp.altitude] },
        properties: { id: wp.id, name: wp.name, code: wp.code, category: wp.category, notes: wp.notes, accuracy: wp.accuracy, createdBy: wp.createdBy, createdAt: wp.createdAt }
      })),
      ...tracks.map(trk => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: trk.points.map(pt => [pt.lng, pt.lat, pt.altitude]) },
        properties: { id: trk.id, name: trk.name, distanceKm: trk.distanceKm, startTime: trk.startTime, endTime: trk.endTime }
      }))
    ]
  };
  return JSON.stringify(geojson, null, 2);
}

export function exportToGPX(projectName: string, waypoints: Waypoint[], tracks: Track[]): string {
  let gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="GoField Pro" xmlns="http://www.topografix.com/GPX/1/1">\n  <metadata>\n    <name>${escapeXml(projectName)}</name>\n    <time>${new Date().toISOString()}</time>\n  </metadata>\n\n`;
  waypoints.forEach((wp) => {
    gpx += `  <wpt lat="${wp.lat}" lon="${wp.lng}">\n`;
    if (wp.altitude) gpx += `    <ele>${wp.altitude}</ele>\n`;
    gpx += `    <name>${escapeXml(wp.name || wp.code)}</name>\n    <desc>${escapeXml(wp.notes || '')}</desc>\n    <type>${escapeXml(wp.category)}</type>\n  </wpt>\n`;
  });
  tracks.forEach((trk) => {
    gpx += `  <trk>\n    <name>${escapeXml(trk.name)}</name>\n    <trkseg>\n`;
    trk.points.forEach((pt) => {
      gpx += `      <trkpt lat="${pt.lat}" lon="${pt.lng}">\n`;
      if (pt.altitude) gpx += `        <ele>${pt.altitude}</ele>\n`;
      gpx += `      </trkpt>\n`;
    });
    gpx += `    </trkseg>\n  </trk>\n`;
  });
  gpx += `</gpx>`;
  return gpx;
}

export function exportToCSV(waypoints: Waypoint[]): string {
  const headers = ['ID', 'Codigo', 'Nome', 'Categoria', 'Latitude', 'Longitude', 'Altitude_m', 'Precisao_m', 'Responsavel', 'Data_Hora', 'Notas'];
  const rows = waypoints.map(w => [
    '"' + w.id + '"',
    '"' + (w.code || '') + '"',
    '"' + (w.name ? w.name.replace(/"/g, '""') : '') + '"',
    '"' + (w.category || '') + '"',
    w.lat.toFixed(7),
    w.lng.toFixed(7),
    w.altitude || 0,
    w.accuracy || 0,
    '"' + (w.createdBy ? w.createdBy.replace(/"/g, '""') : '') + '"',
    '"' + (w.createdAt ? new Date(w.createdAt).toISOString() : '') + '"',
    '"' + (w.notes ? w.notes.replace(/"/g, '""') : '') + '"',
  ]);
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
