import JSZip from 'jszip';
import { KMLFeature, GeoCoordinate, Waypoint, Track } from '../types';

/**
 * Robustly parses KML/KMZ coordinate strings in any format:
 * - Lon,Lat,Alt or Lon,Lat
 * - Spaces around commas, newlines, tabs
 * - Scientific notation (e.g. -4.663e+01)
 * - Space-separated tuples (gx:coord style)
 */
export function parseKMLCoordinates(coordStr: string): GeoCoordinate[] {
  const coords: GeoCoordinate[] = [];
  if (!coordStr || typeof coordStr !== 'string') return coords;

  const clean = coordStr.trim();
  if (!clean) return coords;

  // Primary regex: Match lng,lat[,alt] with optional whitespace around commas and scientific notation
  const coordRegex = /(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(?:\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?))?/g;

  let match;
  while ((match = coordRegex.exec(clean)) !== null) {
    const lng = parseFloat(match[1]);
    const lat = parseFloat(match[2]);
    const altitude = match[3] !== undefined ? parseFloat(match[3]) : undefined;
    if (!isNaN(lat) && !isNaN(lng)) {
      coords.push({ lat, lng, altitude });
    }
  }

  // Fallback: If no comma-separated coordinates were found, try space-separated numbers (gx:coord or whitespace dumps)
  if (coords.length === 0) {
    const tokens = clean.split(/\s+/).map(Number).filter(n => !isNaN(n));
    if (tokens.length >= 2) {
      if (tokens.length % 3 === 0) {
        for (let i = 0; i < tokens.length; i += 3) {
          coords.push({ lng: tokens[i], lat: tokens[i + 1], altitude: tokens[i + 2] });
        }
      } else {
        for (let i = 0; i < tokens.length; i += 2) {
          coords.push({ lng: tokens[i], lat: tokens[i + 1] });
        }
      }
    }
  }

  return coords;
}

/**
 * Extracts image URLs from a Placemark description HTML
 */
function extractImagesFromDescription(description: string, imagesMap?: Record<string, string>): string[] {
  const photos: string[] = [];
  if (!imagesMap || !description) return photos;

  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = imgRegex.exec(description)) !== null) {
    const src = match[1];
    if (imagesMap[src]) {
      photos.push(imagesMap[src]);
    } else if (imagesMap['images/' + src]) {
      photos.push(imagesMap['images/' + src]);
    } else {
      const filename = src.split('/').pop()?.toLowerCase();
      if (filename) {
        const key = Object.keys(imagesMap).find(k => k.toLowerCase().endsWith(filename));
        if (key && imagesMap[key]) photos.push(imagesMap[key]);
      }
    }
  }
  return photos;
}

/**
 * Parses a raw KML string into KMLFeature list with DOMParser and Regex fallback
 */
export function parseKMLString(kmlText: string, layerId: string = 'kml-layer', imagesMap?: Record<string, string>): KMLFeature[] {
  if (!kmlText || typeof kmlText !== 'string') return [];

  const features: KMLFeature[] = [];

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
    
    // Check if XML parser failed
    const parserError = xmlDoc.getElementsByTagName('parsererror');
    if (parserError.length === 0) {
      // Find all Placemarks or geometry nodes
      const allElements = xmlDoc.getElementsByTagName('*');
      const placemarks: Element[] = [];

      for (let i = 0; i < allElements.length; i++) {
        const node = allElements[i];
        if (node.nodeName.toLowerCase().endsWith('placemark')) {
          placemarks.push(node);
        }
      }

      for (let i = 0; i < placemarks.length; i++) {
        const pm = placemarks[i];
        
        let name = `Elemento ${i + 1}`;
        const nameTags = pm.getElementsByTagName('name');
        if (nameTags.length > 0 && nameTags[0].textContent) {
          name = nameTags[0].textContent.trim() || name;
        }

        let description = '';
        const descTags = pm.getElementsByTagName('description');
        if (descTags.length > 0 && descTags[0].textContent) {
          description = descTags[0].textContent.trim();
        }

        const photos = extractImagesFromDescription(description, imagesMap);

        // Find all coordinates inside this Placemark (including nested in LineString, Polygon, MultiGeometry, Point)
        const pmElements = pm.getElementsByTagName('*');
        let foundGeometry = false;

        for (let k = 0; k < pmElements.length; k++) {
          const el = pmElements[k];
          const tagLower = el.nodeName.toLowerCase();

          if (tagLower.endsWith('coordinates') && el.textContent) {
            const coords = parseKMLCoordinates(el.textContent);
            if (coords.length === 1) {
              features.push({
                id: `${layerId}-pt-${i}-${k}`,
                name,
                description,
                type: 'Point',
                coordinates: coords[0],
                color: '#10b981',
                layerId,
                photos,
              });
              foundGeometry = true;
            } else if (coords.length > 1) {
              features.push({
                id: `${layerId}-line-${i}-${k}`,
                name,
                description,
                type: 'LineString',
                coordinates: coords,
                color: '#0284c7',
                layerId,
                photos,
              });
              foundGeometry = true;
            }
          }
        }

        // Check for Google Earth gx:Track coordinates (<gx:coord> or <coord>)
        if (!foundGeometry) {
          const gxCoords: GeoCoordinate[] = [];
          for (let k = 0; k < pmElements.length; k++) {
            const el = pmElements[k];
            const tagLower = el.nodeName.toLowerCase();
            if ((tagLower === 'gx:coord' || tagLower.endsWith(':coord') || tagLower === 'coord') && el.textContent) {
              const parts = el.textContent.trim().split(/\s+/);
              if (parts.length >= 2) {
                const lng = parseFloat(parts[0]);
                const lat = parseFloat(parts[1]);
                const altitude = parts.length > 2 ? parseFloat(parts[2]) : undefined;
                if (!isNaN(lat) && !isNaN(lng)) {
                  gxCoords.push({ lat, lng, altitude });
                }
              }
            }
          }

          if (gxCoords.length === 1) {
            features.push({
              id: `${layerId}-gxpt-${i}`,
              name,
              description,
              type: 'Point',
              coordinates: gxCoords[0],
              color: '#10b981',
              layerId,
              photos,
            });
          } else if (gxCoords.length > 1) {
            features.push({
              id: `${layerId}-gxline-${i}`,
              name,
              description,
              type: 'LineString',
              coordinates: gxCoords,
              color: '#0284c7',
              layerId,
              photos,
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('DOMParser failed on KML, falling back to raw regex extractor:', err);
  }

  // Fallback: If no features were extracted (due to XML namespaces, parser errors, or malformed tags), use raw regex
  if (features.length === 0) {
    // Search for any <coordinates>...</coordinates>
    const coordBlockRegex = /<(?:\w+:)?coordinates[^>]*>([\s\S]*?)<\/(?:\w+:)?coordinates>/gi;
    let blockMatch;
    let fallbackIdx = 0;

    while ((blockMatch = coordBlockRegex.exec(kmlText)) !== null) {
      const rawBlock = blockMatch[1];
      const coords = parseKMLCoordinates(rawBlock);
      if (coords.length === 1) {
        features.push({
          id: `${layerId}-rawpt-${fallbackIdx++}`,
          name: `Ponto Importado ${fallbackIdx}`,
          type: 'Point',
          coordinates: coords[0],
          color: '#10b981',
          layerId,
        });
      } else if (coords.length > 1) {
        features.push({
          id: `${layerId}-rawline-${fallbackIdx++}`,
          name: `Trilha Importada ${fallbackIdx}`,
          type: 'LineString',
          coordinates: coords,
          color: '#0284c7',
          layerId,
        });
      }
    }
  }

  return features;
}

/**
 * Extracts and parses all KML files and media images from a KMZ archive
 */
export async function parseKMZFile(file: File | Blob, layerId: string = 'kmz-layer'): Promise<{ features: KMLFeature[]; name: string }> {
  const zip = new JSZip();
  const zipContent = await zip.loadAsync(file);

  // 1. Extract all images into base64 mapping
  const imagesMap: Record<string, string> = {};
  const imageFiles = zipContent.file(/\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i);
  for (const imgFile of imageFiles) {
    try {
      const base64Data = await imgFile.async('base64');
      let mimeType = 'image/jpeg';
      const lower = imgFile.name.toLowerCase();
      if (lower.endsWith('.png')) mimeType = 'image/png';
      else if (lower.endsWith('.webp')) mimeType = 'image/webp';
      else if (lower.endsWith('.gif')) mimeType = 'image/gif';
      else if (lower.endsWith('.svg')) mimeType = 'image/svg+xml';
      
      const dataUri = `data:${mimeType};base64,${base64Data}`;
      imagesMap[imgFile.name] = dataUri;
      imagesMap[imgFile.name.toLowerCase()] = dataUri;
      const bareName = imgFile.name.split('/').pop();
      if (bareName) {
        imagesMap[bareName] = dataUri;
        imagesMap[bareName.toLowerCase()] = dataUri;
      }
    } catch (e) {
      console.warn('Failed to extract image from KMZ:', imgFile.name, e);
    }
  }

  // 2. Find and parse ALL .kml files inside the KMZ
  const kmlFiles = zipContent.file(/\.kml$/i);
  if (kmlFiles.length === 0) {
    throw new Error('Nenhum arquivo .kml válido encontrado dentro do pacote KMZ.');
  }

  const allFeatures: KMLFeature[] = [];

  for (let i = 0; i < kmlFiles.length; i++) {
    try {
      const kmlText = await kmlFiles[i].async('text');
      const fileFeatures = parseKMLString(kmlText, `${layerId}-${i}`, imagesMap);
      allFeatures.push(...fileFeatures);
    } catch (err) {
      console.warn(`Error parsing internal KML: ${kmlFiles[i].name}`, err);
    }
  }

  const name = file instanceof File ? file.name.replace(/\.kmz$/i, '') : 'Camada KMZ';
  return { features: allFeatures, name };
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
