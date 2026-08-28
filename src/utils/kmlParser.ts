import JSZip from 'jszip';
import { KMLFeature, GeoCoordinate, Waypoint, Track } from '../types';

export interface KmlStyle {
  id: string;
  lineColor?: string;
  lineWidth?: number;
  polyColor?: string;
  polyOpacity?: number;
  iconColor?: string;
  iconHref?: string;
  fill?: boolean;
  outline?: boolean;
}

export interface KmlParseResult {
  features: KMLFeature[];
  name: string;
  folders: string[];
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
    centerLat: number;
    centerLng: number;
  } | null;
  stats: {
    pointCount: number;
    lineCount: number;
    polygonCount: number;
    totalCoordinates: number;
  };
}

/**
 * Converts KML 8-digit hex AABBGGRR (Alpha, Blue, Green, Red) to standard web HEX #RRGGBB + Opacity (0..1)
 */
export function parseKmlColor(kmlColorStr?: string, defaultHex = '#0284c7'): { hex: string; opacity: number } {
  if (!kmlColorStr || typeof kmlColorStr !== 'string') {
    return { hex: defaultHex, opacity: 1 };
  }
  const clean = kmlColorStr.trim().replace(/^#/, '');
  if (clean.length === 8) {
    // KML standard order: AABBGGRR
    const aa = clean.substring(0, 2);
    const bb = clean.substring(2, 4);
    const gg = clean.substring(4, 6);
    const rr = clean.substring(6, 8);
    const opacity = Math.round((parseInt(aa, 16) / 255) * 100) / 100;
    const hex = '#' + rr + gg + bb;
    return { hex: hex.toLowerCase(), opacity: isNaN(opacity) ? 1 : opacity };
  } else if (clean.length === 6) {
    return { hex: ('#' + clean).toLowerCase(), opacity: 1 };
  }
  return { hex: defaultHex, opacity: 1 };
}

/**
 * Robustly parses KML/KMZ coordinate strings with FULL DOUBLE PRECISION and WGS84 range validation.
 * Format: longitude,latitude[,altitude]
 */
export function parseKMLCoordinates(coordStr: string): GeoCoordinate[] {
  const coords: GeoCoordinate[] = [];
  if (!coordStr || typeof coordStr !== 'string') return coords;
  const clean = coordStr.trim();
  if (!clean) return coords;

  const coordRegex = /(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(?:\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?))?/g;
  let match: RegExpExecArray | null;
  while ((match = coordRegex.exec(clean)) !== null) {
    const lng = parseFloat(match[1]);
    const lat = parseFloat(match[2]);
    const altitude = match[3] !== undefined ? parseFloat(match[3]) : undefined;
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      coords.push({ lat, lng, altitude: isNaN(altitude as number) ? undefined : altitude });
    }
  }

  if (coords.length === 0) {
    const tokens = clean.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
    if (tokens.length >= 2) {
      if (tokens.length % 3 === 0) {
        for (let i = 0; i < tokens.length; i += 3) {
          const lng = tokens[i];
          const lat = tokens[i + 1];
          const alt = tokens[i + 2];
          if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            coords.push({ lng, lat, altitude: alt });
          }
        }
      } else {
        for (let i = 0; i < tokens.length; i += 2) {
          const lng = tokens[i];
          const lat = tokens[i + 1];
          if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            coords.push({ lng, lat });
          }
        }
      }
    }
  }

  return coords;
}

function extractImagesFromDescription(description: string, imagesMap?: Record<string, string>): string[] {
  const photos: string[] = [];
  if (!imagesMap || !description) return photos;
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(description)) !== null) {
    const src = match[1];
    if (imagesMap[src]) photos.push(imagesMap[src]);
    else if (imagesMap['images/' + src]) photos.push(imagesMap['images/' + src]);
    else {
      const filename = src.split('/').pop()?.toLowerCase();
      if (filename) {
        const key = Object.keys(imagesMap).find((k) => k.toLowerCase().endsWith(filename));
        if (key && imagesMap[key]) photos.push(imagesMap[key]);
      }
    }
  }
  return photos;
}

function parseKmlStyles(xmlDoc: Document): Map<string, KmlStyle> {
  const stylesMap = new Map<string, KmlStyle>();
  const styleNodes = Array.from(xmlDoc.getElementsByTagName('*')).filter((n) =>
    n.nodeName.toLowerCase().endsWith('style') && n.getAttribute('id')
  );

  for (const styleNode of styleNodes) {
    const id = styleNode.getAttribute('id');
    if (!id) continue;
    const style: KmlStyle = { id };

    const lineStyles = styleNode.getElementsByTagName('LineStyle');
    if (lineStyles.length > 0) {
      const ls = lineStyles[0];
      const colorNode = ls.getElementsByTagName('color')[0];
      const widthNode = ls.getElementsByTagName('width')[0];
      if (colorNode?.textContent) {
        const { hex } = parseKmlColor(colorNode.textContent, '#0284c7');
        style.lineColor = hex;
      }
      if (widthNode?.textContent) {
        const w = parseFloat(widthNode.textContent);
        if (!isNaN(w) && w > 0) style.lineWidth = w;
      }
    }

    const polyStyles = styleNode.getElementsByTagName('PolyStyle');
    if (polyStyles.length > 0) {
      const ps = polyStyles[0];
      const colorNode = ps.getElementsByTagName('color')[0];
      const fillNode = ps.getElementsByTagName('fill')[0];
      const outlineNode = ps.getElementsByTagName('outline')[0];
      if (colorNode?.textContent) {
        const { hex, opacity } = parseKmlColor(colorNode.textContent, '#10b981');
        style.polyColor = hex;
        style.polyOpacity = opacity;
      }
      if (fillNode?.textContent) style.fill = fillNode.textContent.trim() !== '0';
      if (outlineNode?.textContent) style.outline = outlineNode.textContent.trim() !== '0';
    }

    const iconStyles = styleNode.getElementsByTagName('IconStyle');
    if (iconStyles.length > 0) {
      const is = iconStyles[0];
      const colorNode = is.getElementsByTagName('color')[0];
      const hrefNode = is.getElementsByTagName('href')[0];
      if (colorNode?.textContent) {
        const { hex } = parseKmlColor(colorNode.textContent, '#10b981');
        style.iconColor = hex;
      }
      if (hrefNode?.textContent) style.iconHref = hrefNode.textContent.trim();
    }

    stylesMap.set(id, style);
    stylesMap.set('#' + id, style);
  }

  const styleMapNodes = Array.from(xmlDoc.getElementsByTagName('*')).filter((n) =>
    n.nodeName.toLowerCase().endsWith('stylemap') && n.getAttribute('id')
  );
  for (const smNode of styleMapNodes) {
    const smId = smNode.getAttribute('id');
    if (!smId) continue;
    const pairs = smNode.getElementsByTagName('Pair');
    for (let i = 0; i < pairs.length; i++) {
      const keyNode = pairs[i].getElementsByTagName('key')[0];
      const styleUrlNode = pairs[i].getElementsByTagName('styleUrl')[0];
      if (keyNode?.textContent?.trim() === 'normal' && styleUrlNode?.textContent) {
        const refId = styleUrlNode.textContent.trim();
        const referencedStyle = stylesMap.get(refId);
        if (referencedStyle) {
          stylesMap.set(smId, referencedStyle);
          stylesMap.set('#' + smId, referencedStyle);
        }
      }
    }
  }
  return stylesMap;
}

function parseGeometryElements(
  geomNode: Element,
  baseProps: {
    name: string;
    description: string;
    folder: string;
    layerId: string;
    style?: KmlStyle;
    photos: string[];
    properties: Record<string, any>;
  },
  pmIndex: number,
  geomCounter: { count: number }
): KMLFeature[] {
  const result: KMLFeature[] = [];
  const tag = geomNode.nodeName.toLowerCase().split(':').pop() || '';

  if (tag === 'point') {
    const coordEl = geomNode.getElementsByTagName('coordinates')[0];
    if (coordEl?.textContent) {
      const coords = parseKMLCoordinates(coordEl.textContent);
      if (coords.length >= 1) {
        const color = baseProps.style?.iconColor || baseProps.style?.lineColor || '#10b981';
        result.push({
          id: `${baseProps.layerId}-pt-${pmIndex}-${geomCounter.count++}`,
          name: baseProps.name,
          description: baseProps.description,
          type: 'Point',
          coordinates: coords[0],
          color,
          layerId: baseProps.layerId,
          photos: baseProps.photos,
          properties: {
            ...baseProps.properties,
            folder: baseProps.folder,
            altitude: coords[0].altitude,
          },
        });
      }
    }
  } else if (tag === 'linestring') {
    const coordEl = geomNode.getElementsByTagName('coordinates')[0];
    if (coordEl?.textContent) {
      const coords = parseKMLCoordinates(coordEl.textContent);
      if (coords.length > 1) {
        const color = baseProps.style?.lineColor || '#0284c7';
        const strokeWidth = baseProps.style?.lineWidth || 3;
        result.push({
          id: `${baseProps.layerId}-line-${pmIndex}-${geomCounter.count++}`,
          name: baseProps.name,
          description: baseProps.description,
          type: 'LineString',
          coordinates: coords,
          color,
          strokeWidth,
          layerId: baseProps.layerId,
          photos: baseProps.photos,
          properties: {
            ...baseProps.properties,
            folder: baseProps.folder,
            vertexCount: coords.length,
          },
        });
      }
    }
  } else if (tag === 'polygon') {
    const outerBoundary = geomNode.getElementsByTagName('outerBoundaryIs')[0];
    const targetEl = outerBoundary || geomNode;
    const coordEl = targetEl.getElementsByTagName('coordinates')[0];
    if (coordEl?.textContent) {
      const coords = parseKMLCoordinates(coordEl.textContent);
      if (coords.length >= 3) {
        if (coords[0].lat !== coords[coords.length - 1].lat || coords[0].lng !== coords[coords.length - 1].lng) {
          coords.push({ ...coords[0] });
        }
        const color = baseProps.style?.lineColor || '#10b981';
        const fillColor = baseProps.style?.polyColor || color;
        const fillOpacity = baseProps.style?.polyOpacity !== undefined ? baseProps.style.polyOpacity : 0.25;
        const strokeWidth = baseProps.style?.lineWidth || 2.5;
        result.push({
          id: `${baseProps.layerId}-poly-${pmIndex}-${geomCounter.count++}`,
          name: baseProps.name,
          description: baseProps.description,
          type: 'Polygon',
          coordinates: coords,
          color,
          fillColor,
          strokeWidth,
          layerId: baseProps.layerId,
          photos: baseProps.photos,
          properties: {
            ...baseProps.properties,
            folder: baseProps.folder,
            fillOpacity,
            vertexCount: coords.length,
          },
        });
      }
    }
  } else if (tag === 'multigeometry') {
    const children = Array.from(geomNode.children);
    for (const child of children) {
      result.push(...parseGeometryElements(child, baseProps, pmIndex, geomCounter));
    }
  } else if (tag === 'track' || tag.endsWith('track')) {
    const gxCoords: GeoCoordinate[] = [];
    const gxNodes = Array.from(geomNode.getElementsByTagName('*')).filter((n) =>
      n.nodeName.toLowerCase().endsWith('coord')
    );
    for (const gxNode of gxNodes) {
      if (gxNode.textContent) {
        const parts = gxNode.textContent.trim().split(/\s+/);
        if (parts.length >= 2) {
          const lng = parseFloat(parts[0]);
          const lat = parseFloat(parts[1]);
          const altitude = parts.length > 2 ? parseFloat(parts[2]) : undefined;
          if (!isNaN(lat) && !isNaN(lng)) gxCoords.push({ lat, lng, altitude });
        }
      }
    }
    if (gxCoords.length === 1) {
      result.push({
        id: `${baseProps.layerId}-gxpt-${pmIndex}-${geomCounter.count++}`,
        name: baseProps.name,
        description: baseProps.description,
        type: 'Point',
        coordinates: gxCoords[0],
        color: baseProps.style?.iconColor || '#10b981',
        layerId: baseProps.layerId,
        photos: baseProps.photos,
        properties: { ...baseProps.properties, folder: baseProps.folder },
      });
    } else if (gxCoords.length > 1) {
      result.push({
        id: `${baseProps.layerId}-gxline-${pmIndex}-${geomCounter.count++}`,
        name: baseProps.name,
        description: baseProps.description,
        type: 'LineString',
        coordinates: gxCoords,
        color: baseProps.style?.lineColor || '#0284c7',
        strokeWidth: baseProps.style?.lineWidth || 3,
        layerId: baseProps.layerId,
        photos: baseProps.photos,
        properties: { ...baseProps.properties, folder: baseProps.folder, vertexCount: gxCoords.length },
      });
    }
  }
  return result;
}

export function parseKMLString(
  kmlText: string,
  layerId: string = 'kml-layer',
  imagesMap?: Record<string, string>
): KMLFeature[] {
  if (!kmlText || typeof kmlText !== 'string') return [];
  const features: KMLFeature[] = [];
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
    const parserError = xmlDoc.getElementsByTagName('parsererror');
    if (parserError.length === 0) {
      const stylesMap = parseKmlStyles(xmlDoc);
      const placemarks = Array.from(xmlDoc.getElementsByTagName('*')).filter((n) =>
        n.nodeName.toLowerCase().endsWith('placemark')
      );
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
        let folderName = '';
        let parent: Element | null = pm.parentElement;
        while (parent) {
          if (parent.nodeName.toLowerCase().endsWith('folder')) {
            const folderNameEl = parent.getElementsByTagName('name')[0];
            if (folderNameEl?.textContent) {
              folderName = folderName ? `${folderNameEl.textContent.trim()} > ${folderName}` : folderNameEl.textContent.trim();
            }
          }
          parent = parent.parentElement;
        }
        const properties: Record<string, any> = {};
        const extData = pm.getElementsByTagName('ExtendedData')[0];
        if (extData) {
          const dataNodes = extData.getElementsByTagName('Data');
          for (let d = 0; d < dataNodes.length; d++) {
            const dNode = dataNodes[d];
            const dName = dNode.getAttribute('name');
            const dVal = dNode.getElementsByTagName('value')[0]?.textContent?.trim();
            if (dName && dVal !== undefined) properties[dName] = dVal;
          }
          const simpleDataNodes = extData.getElementsByTagName('SimpleData');
          for (let s = 0; s < simpleDataNodes.length; s++) {
            const sNode = simpleDataNodes[s];
            const sName = sNode.getAttribute('name');
            const sVal = sNode.textContent?.trim();
            if (sName && sVal !== undefined) properties[sName] = sVal;
          }
        }
        let style: KmlStyle | undefined;
        const styleUrlEl = pm.getElementsByTagName('styleUrl')[0];
        if (styleUrlEl?.textContent) {
          const sUrl = styleUrlEl.textContent.trim();
          style = stylesMap.get(sUrl) || stylesMap.get(sUrl.replace(/^#/, ''));
        }
        const inlineStyles = pm.getElementsByTagName('Style');
        if (inlineStyles.length > 0) {
          const inlineDoc = parser.parseFromString(`<kml>${pm.innerHTML}</kml>`, 'text/xml');
          const inlineMap = parseKmlStyles(inlineDoc);
          if (inlineMap.size > 0) style = inlineMap.values().next().value;
        }
        const photos = extractImagesFromDescription(description, imagesMap);
        const baseProps = {
          name,
          description,
          folder: folderName || 'Camada Principal',
          layerId,
          style,
          photos,
          properties,
        };
        const geomCounter = { count: 0 };
        const pmGeomElements = Array.from(pm.children).filter((c) => {
          const t = c.nodeName.toLowerCase().split(':').pop() || '';
          return ['point', 'linestring', 'polygon', 'multigeometry', 'track'].includes(t);
        });
        if (pmGeomElements.length > 0) {
          for (const geomEl of pmGeomElements) {
            const parsed = parseGeometryElements(geomEl, baseProps, i, geomCounter);
            features.push(...parsed);
          }
        } else {
          const deepGeom = Array.from(pm.getElementsByTagName('*')).filter((c) => {
            const t = c.nodeName.toLowerCase().split(':').pop() || '';
            return ['point', 'linestring', 'polygon', 'multigeometry'].includes(t);
          });
          for (const geomEl of deepGeom) {
            const parsed = parseGeometryElements(geomEl, baseProps, i, geomCounter);
            features.push(...parsed);
          }
        }
      }
    }
  } catch (err) {
    console.warn('DOMParser failed on KML, falling back to raw regex extractor:', err);
  }

  if (features.length === 0) {
    const coordBlockRegex = /<(?:\w+:)?coordinates[^>]*>([\s\S]*?)<\/(?:\w+:)?coordinates>/gi;
    let blockMatch: RegExpExecArray | null;
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
      } else if (coords.length > 2 && (coords[0].lat === coords[coords.length - 1].lat && coords[0].lng === coords[coords.length - 1].lng)) {
        features.push({
          id: `${layerId}-rawpoly-${fallbackIdx++}`,
          name: `Polígono Importado ${fallbackIdx}`,
          type: 'Polygon',
          coordinates: coords,
          color: '#10b981',
          fillColor: '#10b981',
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

export function calculateKmlBoundsAndStats(features: KMLFeature[]): KmlParseResult {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  let hasValid = false;
  let pointCount = 0, lineCount = 0, polygonCount = 0, totalCoordinates = 0;
  const folderSet = new Set<string>();

  features.forEach((feat) => {
    if (feat.properties?.folder) folderSet.add(feat.properties.folder);
    if (feat.type === 'Point') {
      pointCount++;
      totalCoordinates++;
      const coord = feat.coordinates as GeoCoordinate;
      if (coord && typeof coord.lat === 'number' && typeof coord.lng === 'number') {
        minLat = Math.min(minLat, coord.lat);
        maxLat = Math.max(maxLat, coord.lat);
        minLng = Math.min(minLng, coord.lng);
        maxLng = Math.max(maxLng, coord.lng);
        hasValid = true;
      }
    } else if (feat.type === 'LineString' && Array.isArray(feat.coordinates)) {
      lineCount++;
      (feat.coordinates as GeoCoordinate[]).forEach((coord) => {
        totalCoordinates++;
        if (coord && typeof coord.lat === 'number' && typeof coord.lng === 'number') {
          minLat = Math.min(minLat, coord.lat);
          maxLat = Math.max(maxLat, coord.lat);
          minLng = Math.min(minLng, coord.lng);
          maxLng = Math.max(maxLng, coord.lng);
          hasValid = true;
        }
      });
    } else if (feat.type === 'Polygon' && Array.isArray(feat.coordinates)) {
      polygonCount++;
      (feat.coordinates as GeoCoordinate[]).forEach((coord) => {
        totalCoordinates++;
        if (coord && typeof coord.lat === 'number' && typeof coord.lng === 'number') {
          minLat = Math.min(minLat, coord.lat);
          maxLat = Math.max(maxLat, coord.lat);
          minLng = Math.min(minLng, coord.lng);
          maxLng = Math.max(maxLng, coord.lng);
          hasValid = true;
        }
      });
    }
  });

  return {
    features,
    name: 'Camada KML/KMZ',
    folders: Array.from(folderSet),
    bounds: hasValid ? { minLat, maxLat, minLng, maxLng, centerLat: (minLat + maxLat) / 2, centerLng: (minLng + maxLng) / 2 } : null,
    stats: { pointCount, lineCount, polygonCount, totalCoordinates },
  };
}

export async function parseKMZFile(file: File | Blob, layerId: string = 'kmz-layer'): Promise<KmlParseResult> {
  const zip = new JSZip();
  const zipContent = await zip.loadAsync(file);
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

  let kmlFiles = zipContent.file(/\.kml$/i);
  if (kmlFiles.length === 0) {
    throw new Error('Nenhum arquivo .kml válido encontrado dentro do pacote KMZ.');
  }
  kmlFiles = kmlFiles.sort((a, b) => {
    if (a.name.toLowerCase().includes('doc.kml')) return -1;
    if (b.name.toLowerCase().includes('doc.kml')) return 1;
    return 0;
  });
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
  const result = calculateKmlBoundsAndStats(allFeatures);
  result.name = name;
  return result;
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
    trk.points.forEach((pt) => {
      kml += `          ${pt.lng},${pt.lat},${pt.altitude || 0}\n`;
    });
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
      ...waypoints.map((wp) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [wp.lng, wp.lat, wp.altitude] },
        properties: {
          id: wp.id,
          name: wp.name,
          code: wp.code,
          category: wp.category,
          notes: wp.notes,
          accuracy: wp.accuracy,
          createdBy: wp.createdBy,
          createdAt: wp.createdAt,
        },
      })),
      ...tracks.map((trk) => ({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: trk.points.map((pt) => [pt.lng, pt.lat, pt.altitude]),
        },
        properties: {
          id: trk.id,
          name: trk.name,
          distanceKm: trk.distanceKm,
          startTime: trk.startTime,
          endTime: trk.endTime,
        },
      })),
    ],
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
  const headers = [
    'ID',
    'Codigo',
    'Nome',
    'Categoria',
    'Latitude',
    'Longitude',
    'Altitude_m',
    'Precisao_m',
    'Responsavel',
    'Data_Hora',
    'Notas',
  ];
  const rows = waypoints.map((w) => [
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
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}