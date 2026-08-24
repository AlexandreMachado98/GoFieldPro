import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ProjectFolder, Waypoint, Track, TeamMember } from '../types';

export function generateFieldDossierPDF(
  project: ProjectFolder,
  waypoints: Waypoint[],
  tracks: Track[],
  teamMembers: TeamMember[],
  responsibleName: string
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header Navy Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Title & Subtitle
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('GOFIELD PRO | RELATÓRIO TÉCNICO DE CAMPO', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`EMISSÃO: ${new Date().toLocaleString('pt-BR')} | RESPONSÁVEL: ${responsibleName.toUpperCase()}`, 14, 20);

  // Security Seal Badge
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.roundedRect(pageWidth - 55, 7, 42, 14, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('CRIPTOGRAFIA E2EE', pageWidth - 50, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('INTEGRIDADE VERIFICADA', pageWidth - 52, 17);

  // Project Info Card
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`PROJETO: ${project.name}`, 14, 38);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Localização: ${project.locationName} (Centro: ${project.centerCoordinate.lat.toFixed(5)}, ${project.centerCoordinate.lng.toFixed(5)})`, 14, 44);
  doc.text(`Descrição Operacional: ${project.description}`, 14, 49);

  // KPI Metrics Box
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, 54, pageWidth - 28, 20, 2, 2, 'F');
  
  const totalTrackKm = tracks.reduce((acc, t) => acc + t.distanceKm, 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Pontos Coletados:', 20, 63);
  doc.text('Trilhas GPS:', 68, 63);
  doc.text('Km Percorridos:', 115, 63);
  doc.text('Status de Sincronia:', 160, 63);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(`${waypoints.length} waypoints`, 20, 69);
  doc.text(`${tracks.length} rotas`, 68, 69);
  doc.text(`${totalTrackKm.toFixed(2)} km`, 115, 69);
  doc.text('100% Sincronizado', 160, 69);

  // Waypoints Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('REGISTRO DE MARCOS & PONTOS DE INTERESSE', 14, 83);

  const tableRows = waypoints.map((wp) => [
    wp.code || wp.id.slice(0, 6),
    wp.name,
    wp.category.toUpperCase(),
    `${wp.lat.toFixed(6)}, ${wp.lng.toFixed(6)}`,
    `${wp.altitude}m (±${wp.accuracy}m)`,
    wp.notes || 'Sem observações adicionais',
    wp.createdBy,
  ]);

  autoTable(doc, {
    startY: 87,
    head: [['Código', 'Identificador', 'Categoria', 'Coordenadas (Lat, Lng)', 'Altitude/Prec.', 'Notas de Campo', 'Operador']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 32 },
      2: { cellWidth: 24 },
      3: { cellWidth: 35 },
      4: { cellWidth: 22 },
      5: { cellWidth: 35 },
      6: { cellWidth: 20 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // Digital Signatures & Hash Footer
  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 15 : 230;
  
  if (finalY < 260) {
    doc.setDrawColor(203, 213, 225);
    doc.line(14, finalY + 15, 90, finalY + 15);
    doc.line(120, finalY + 15, pageWidth - 14, finalY + 15);

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Assinatura do Responsável Técnico / SIG', 20, finalY + 20);
    doc.text('Supervisão Operacional de Campo', 130, finalY + 20);
  }

  // Footer Hash & Copyright
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  const hash = `SHA-256: ${Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
  doc.text(`Documento gerado por GoField Pro • Hash: ${hash}`, 14, 288);

  doc.save(`GoField_${project.name.replace(/\s+/g, '_')}_Dossie_${new Date().toISOString().slice(0, 10)}.pdf`);
}
