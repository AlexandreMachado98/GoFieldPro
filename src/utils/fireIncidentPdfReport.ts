import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FireIncident } from '../types';
import { APP_VERSION } from '../config/version';
import { latLngToUTM } from './geoUtils';

const SEVERITY_LABELS: Record<string, string> = {
  baixa: 'Baixa (Controlável)',
  media: 'Média (Atenção)',
  alta: 'Alta (Emergência)',
  critica: 'Crítica / Desastre',
};

const STATUS_LABELS: Record<string, string> = {
  em_combate: 'Em Combate Ativo',
  controlado: 'Foco Controlado',
  extinto: 'Foco Extinto / Rescaldo',
  monitoramento: 'Em Monitoramento',
};

const TYPE_LABELS: Record<string, string> = {
  foco_ativo: 'Foco de Incêndio Ativo',
  area_queimada: 'Cicatriz / Área Queimada',
  queima_controlada: 'Queima Prescrita / Controlada',
  sinistro_florestal: 'Sinistro / Dano Florestal',
  principio_incendio: 'Princípio de Incêndio',
};

export async function generateFireIncidentPdf(
  incidents: FireIncident[],
  title = 'Dossiê Técnico de Focos de Incêndio & Sinistros Florestais'
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 1. Header Banner
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 32, 'F');

  // Red/Orange Accent Bar
  doc.setFillColor(239, 68, 68); // Red 500
  doc.rect(0, 32, pageWidth, 2.5, 'F');

  // Header Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('GOFIELD PRO • GESTÃO DE INCÊNDIOS & SINISTROS', 14, 13);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  doc.text(title.toUpperCase(), 14, 20);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  const emitDate = new Date().toLocaleString('pt-BR');
  doc.text(`Emissão: ${emitDate} | Sistema GoField Pro v${APP_VERSION}`, 14, 27);

  // 2. Executive Summary KPIs
  const totalIncidents = incidents.length;
  const activeCombats = incidents.filter((i) => i.status === 'em_combate').length;
  const controlled = incidents.filter((i) => i.status === 'controlado' || i.status === 'extinto').length;
  const totalAreaHectares = incidents.reduce((sum, i) => sum + (i.estimatedAreaHectares || 0), 0);

  let startY = 42;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, startY, pageWidth - 28, 22, 3, 3, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, startY, pageWidth - 28, 22, 3, 3, 'D');

  const colW = (pageWidth - 28) / 4;

  // KPI 1
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL DE OCORRÊNCIAS', 14 + colW * 0 + 4, startY + 6);
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`${totalIncidents}`, 14 + colW * 0 + 4, startY + 14);

  // KPI 2
  doc.setFontSize(7.5);
  doc.setTextColor(220, 38, 38);
  doc.text('EM COMBATE ATIVO', 14 + colW * 1 + 4, startY + 6);
  doc.setFontSize(12);
  doc.text(`${activeCombats}`, 14 + colW * 1 + 4, startY + 14);

  // KPI 3
  doc.setFontSize(7.5);
  doc.setTextColor(16, 185, 129);
  doc.text('CONTROLADOS / EXTINTOS', 14 + colW * 2 + 4, startY + 6);
  doc.setFontSize(12);
  doc.text(`${controlled}`, 14 + colW * 2 + 4, startY + 14);

  // KPI 4
  doc.setFontSize(7.5);
  doc.setTextColor(217, 119, 6);
  doc.text('ÁREA TOTAL AFETADA', 14 + colW * 3 + 4, startY + 6);
  doc.setFontSize(12);
  doc.text(`${totalAreaHectares > 0 ? totalAreaHectares.toLocaleString('pt-BR') : '0'} ha`, 14 + colW * 3 + 4, startY + 14);

  // 3. Incidents Table
  const tableRows = incidents.map((item, idx) => {
    const utm = item.utm || latLngToUTM(item.lat, item.lng);
    const coordsStr = `${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}\n(UTM: ${utm.easting}E, ${utm.northing}N)`;
    const typeStr = TYPE_LABELS[item.type] || item.type;
    const statusStr = STATUS_LABELS[item.status] || item.status;
    const severityStr = SEVERITY_LABELS[item.severity] || item.severity;
    const areaStr = item.estimatedAreaHectares ? `${item.estimatedAreaHectares.toLocaleString('pt-BR')} ha` : '--';

    return [
      String(idx + 1).padStart(2, '0'),
      `${item.date}\n${item.time}`,
      `${item.locationName}\nResp: ${item.technicianName}`,
      `${typeStr}\n[${severityStr}]`,
      statusStr,
      areaStr,
      coordsStr,
    ];
  });

  autoTable(doc, {
    startY: startY + 28,
    head: [['#', 'Data/Hora', 'Local & Técnico', 'Tipo & Severidade', 'Status', 'Área', 'Coordenadas GPS']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 2.5,
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 38 },
      3: { cellWidth: 36 },
      4: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 18, halign: 'center' },
      6: { cellWidth: 38, fontSize: 6.5 },
    },
    styles: {
      overflow: 'linebreak',
    },
    margin: { left: 14, right: 14 },
  });

  // 4. Photographic Evidence & Detailed Observations Section
  let currentY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 10 : startY + 60;

  for (const incident of incidents) {
    if (currentY > pageHeight - 60) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, currentY, pageWidth - 28, 8, 2, 2, 'F');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`DETALHAMENTO: ${incident.title || incident.locationName} (${incident.date})`, 18, currentY + 5.5);

    currentY += 12;

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);

    const resources = incident.resourcesMobilized && incident.resourcesMobilized.length > 0 
      ? incident.resourcesMobilized.join(', ') 
      : 'Nenhum recurso especial listado';

    const weatherInfo = `Condições Climáticas: Vento ${incident.windSpeedKmh || '--'} km/h (${incident.windDirection || 'N/A'}) | Temp: ${incident.temperatureC || '--'}°C | UR: ${incident.relativeHumidity || '--'}%`;

    doc.text(`• Recursos Empregados: ${resources}`, 16, currentY);
    currentY += 5;
    doc.text(`• ${weatherInfo}`, 16, currentY);
    currentY += 5;

    if (incident.notes || incident.combatTeamNotes) {
      const notes = incident.combatTeamNotes ? `Combate: ${incident.combatTeamNotes}. ${incident.notes || ''}` : (incident.notes || '');
      const splitNotes = doc.splitTextToSize(`• Parecer Técnico: ${notes}`, pageWidth - 32);
      doc.text(splitNotes, 16, currentY);
      currentY += splitNotes.length * 4.5 + 2;
    }

    // Embed photos if available
    if (incident.photos && incident.photos.length > 0) {
      const photosToRender = incident.photos.slice(0, 3);
      const photoW = 48;
      const photoH = 36;

      if (currentY + photoH > pageHeight - 30) {
        doc.addPage();
        currentY = 20;
      }

      let photoX = 16;
      for (const photoBase64 of photosToRender) {
        try {
          doc.addImage(photoBase64, 'JPEG', photoX, currentY, photoW, photoH);
          doc.setDrawColor(203, 213, 225);
          doc.rect(photoX, currentY, photoW, photoH, 'D');
          photoX += photoW + 6;
        } catch {
          // ignore photo render failure
        }
      }
      currentY += photoH + 8;
    }

    currentY += 4;
  }

  // 5. Signature Footer
  if (currentY > pageHeight - 35) {
    doc.addPage();
    currentY = 20;
  }

  currentY = Math.max(currentY + 10, pageHeight - 30);
  doc.setDrawColor(148, 163, 184);
  doc.line(pageWidth / 2 - 40, currentY, pageWidth / 2 + 40, currentY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Responsável Técnico / Brigada de Incêndio', pageWidth / 2, currentY + 4, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Documento gerado eletronicamente pelo GoField Pro com carimbo de integridade GPS.', pageWidth / 2, currentY + 8, { align: 'center' });

  // Save PDF
  const fileName = `GoField_Relatorio_Incendios_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
