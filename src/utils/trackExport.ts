import { Track } from '../types';

/**
 * Generates a valid GPX XML 1.1 file content from a recorded Track
 */
export function generateGPXContent(track: Track): string {
  const pointsXml = track.points
    .map(
      (p) =>
        `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lng.toFixed(7)}">\n` +
        `        <ele>${(p.altitude || 0).toFixed(1)}</ele>\n` +
        `        <time>${new Date(p.timestamp).toISOString()}</time>\n` +
        (p.speed ? `        <speed>${(p.speed / 3.6).toFixed(2)}</speed>\n` : '') +
        `      </trkpt>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GoField Pro - https://amtst.vercel.app/" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(track.name)}</name>
    <desc>Trilha gravada em campo via GoField Pro GNSS Telemetry</desc>
    <author>
      <name>${escapeXml(track.userName || 'Operador de Campo')}</name>
    </author>
    <time>${new Date(track.startTime).toISOString()}</time>
  </metadata>
  <trk>
    <name>${escapeXml(track.name)}</name>
    <desc>Distância: ${track.distanceKm.toFixed(2)} km | Duração: ${track.durationSeconds}s</desc>
    <trkseg>
${pointsXml}
    </trkseg>
  </trk>
</gpx>`;
}

/**
 * Generates a valid OGC KML 2.2 file content from a recorded Track
 */
export function generateKMLContent(track: Track): string {
  const coordsStr = track.points
    .map((p) => `${p.lng.toFixed(7)},${p.lat.toFixed(7)},${(p.altitude || 0).toFixed(1)}`)
    .join(' ');

  // Convert hex color #RRGGBB to KML aabbggrr
  const hex = (track.color || '#ef4444').replace('#', '');
  const r = hex.slice(0, 2) || 'ef';
  const g = hex.slice(2, 4) || '44';
  const b = hex.slice(4, 6) || '44';
  const kmlColor = `ff${b}${g}${r}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(track.name)}</name>
    <description>Trilha gravada no GoField Pro - Distância: ${track.distanceKm.toFixed(2)} km</description>
    <Style id="trackStyle">
      <LineStyle>
        <color>${kmlColor}</color>
        <width>4</width>
      </LineStyle>
    </Style>
    <Placemark>
      <name>${escapeXml(track.name)}</name>
      <styleUrl>#trackStyle</styleUrl>
      <LineString>
        <extrude>1</extrude>
        <tessellate>1</tessellate>
        <altitudeMode>clampToGround</altitudeMode>
        <coordinates>
          ${coordsStr}
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;
}

/**
 * Generates a standard GeoJSON FeatureCollection from a recorded Track
 */
export function generateGeoJSONContent(track: Track): string {
  const geojson = {
    type: 'FeatureCollection',
    properties: {
      generator: 'GoField Pro',
      trackId: track.id,
      name: track.name,
      distanceKm: track.distanceKm,
      durationSeconds: track.durationSeconds,
      avgSpeedKmh: track.avgSpeedKmh,
      elevationGainM: track.elevationGainM,
      elevationLossM: track.elevationLossM,
      startTime: track.startTime,
      endTime: track.endTime,
      color: track.color,
    },
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: track.points.map((p) => [
            +p.lng.toFixed(7),
            +p.lat.toFixed(7),
            +(p.altitude || 0).toFixed(1),
          ]),
        },
        properties: {
          name: track.name,
          color: track.color || '#ef4444',
          pointsCount: track.points.length,
        },
      },
    ],
  };

  return JSON.stringify(geojson, null, 2);
}

/**
 * Helper to trigger browser download of a generated file
 */
export function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '\'':
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}
