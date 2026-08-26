import { FireIncident } from '../types';
import JSZip from 'jszip';

export function generateFireKML(incidents: FireIncident[]): string {
  const escapeXml = (str?: string) => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const placemarks = incidents.map((inc) => {
    const resources = inc.resourcesMobilized?.join(', ') || 'N/A';
    return `
    <Placemark id="${escapeXml(inc.id)}">
      <name>${escapeXml(inc.title || inc.locationName)}</name>
      <description><![CDATA[
        <div style="font-family: sans-serif; padding: 6px;">
          <h3 style="color: #ef4444; margin: 0 0 6px 0;">🔥 Foco de Incêndio / Sinistro</h3>
          <p><b>Local:</b> ${escapeXml(inc.locationName)}</p>
          <p><b>Data/Hora:</b> ${escapeXml(inc.date)} ${escapeXml(inc.time)}</p>
          <p><b>Status:</b> ${escapeXml(inc.status)}</p>
          <p><b>Severidade:</b> ${escapeXml(inc.severity)}</p>
          <p><b>Área Estimada:</b> ${inc.estimatedAreaHectares ? inc.estimatedAreaHectares + ' ha' : 'N/A'}</p>
          <p><b>Recursos:</b> ${escapeXml(resources)}</p>
          <p><b>Técnico:</b> ${escapeXml(inc.technicianName)}</p>
          ${inc.notes ? `<p><b>Observações:</b><br/>${escapeXml(inc.notes)}</p>` : ''}
          <hr style="border: 0; border-top: 1px solid #ddd; margin: 8px 0;" />
          <p style="font-size: 10px; color: #888;">GoField Pro • Monitoramento de Incêndios</p>
        </div>
      ]]></description>
      <Style>
        <IconStyle>
          <scale>1.3</scale>
          <Icon>
            <href>http://maps.google.com/mapfiles/kml/shapes/firedept.png</href>
          </Icon>
        </IconStyle>
      </Style>
      <Point>
        <coordinates>${inc.lng},${inc.lat},${inc.altitude || 0}</coordinates>
      </Point>
    </Placemark>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>GoField Pro - Focos de Incêndio e Sinistros</name>
    <description>Camadas de monitoramento de queimadas e sinistros florestais</description>
    ${placemarks}
  </Document>
</kml>`;
}

export async function generateFireKMZ(incidents: FireIncident[]): Promise<Blob> {
  const zip = new JSZip();
  const kml = generateFireKML(incidents);
  zip.file('doc.kml', kml);

  const photosFolder = zip.folder('photos');
  let photoIdx = 1;

  for (const inc of incidents) {
    if (inc.photos && inc.photos.length > 0) {
      for (const p of inc.photos) {
        if (p && p.startsWith('data:image')) {
          const base64Data = p.split(',')[1];
          if (base64Data && photosFolder) {
            photosFolder.file(`incendio_${inc.id}_${photoIdx}.jpg`, base64Data, { base64: true });
            photoIdx++;
          }
        }
      }
    }
  }

  return await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.google-earth.kmz' });
}
