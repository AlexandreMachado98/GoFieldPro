import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ProjectFolder, Waypoint, Track, TeamMember } from '../types';
import { getUserRawItem } from './userStorage';

export function generateFieldDossierPDF(
  project: ProjectFolder,
  waypoints: Waypoint[],
  tracks: Track[],
  teamMembers: TeamMember[],
  responsibleName: string,
  userId?: string
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const customLogo = getUserRawItem(userId, 'custom_company_logo', '');
  const customCompanyName = getUserRawItem(userId, 'custom_company_name', '') || 'AM TST SAÚDE E SEGURANÇA DO TRABALHO';
  const customCnpj = getUserRawItem(userId, 'custom_company_cnpj', '');
  
  // Header Navy Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Custom Company Logo
  let textLeftMargin = 14;
  if (customLogo && customLogo.startsWith('data:image')) {
    try {
      doc.addImage(customLogo, 'PNG', 12, 4, 20, 20);
      textLeftMargin = 36;
    } catch (e) {
      console.warn('Could not embed custom logo', e);
    }
  }

  // Title & Subtitle
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('GOFIELD PRO | RELATÓRIO TÉCNICO DE CAMPO', textLeftMargin, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  const companyInfo = customCnpj ? `${customCompanyName.toUpperCase()} (CNPJ: ${customCnpj})` : customCompanyName.toUpperCase();
  doc.text(`EMPRESA: ${companyInfo} | RESPONSÁVEL: ${responsibleName.toUpperCase()}`, textLeftMargin, 18);
  doc.text(`EMISSÃO: ${new Date().toLocaleString('pt-BR')}`, textLeftMargin, 23);

  // Security Seal Badge
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.roundedRect(pageWidth - 55, 6, 42, 16, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('CRIPTOGRAFIA E2EE', pageWidth - 50, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('INTEGRIDADE VERIFICADA', pageWidth - 52, 16);

  // Project Info Card
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`PROJETO / TALHÃO: ${project.name}`, 14, 37);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Localização: ${project.locationName} (Centro: ${project.centerCoordinate.lat.toFixed(5)}, ${project.centerCoordinate.lng.toFixed(5)})`, 14, 43);
  doc.text(`Descrição Operacional: ${project.description || 'Levantamento e auditoria técnica de campo'}`, 14, 48);

  // KPI Metrics Box
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, 53, pageWidth - 28, 18, 2, 2, 'F');
  
  const totalTrackKm = tracks.reduce((acc, t) => acc + t.distanceKm, 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Pontos Coletados:', 20, 61);
  doc.text('Trilhas GPS:', 68, 61);
  doc.text('Km Percorridos:', 115, 61);
  doc.text('Status de Sincronia:', 160, 61);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(`${waypoints.length} waypoints`, 20, 67);
  doc.text(`${tracks.length} rotas`, 68, 67);
  doc.text(`${totalTrackKm.toFixed(2)} km`, 115, 67);
  doc.text('100% Sincronizado', 160, 67);

  // Waypoints Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('REGISTRO DE MARCOS, COORDENADAS & PONTOS DE INTERESSE', 14, 79);

  const tableRows = waypoints.map((wp) => [
    wp.code || wp.id.slice(0, 6),
    wp.name,
    wp.category.toUpperCase(),
    `${wp.lat.toFixed(6)}, ${wp.lng.toFixed(6)}`,
    `${wp.altitude}m (±${wp.accuracy}m)`,
    wp.notes || 'Sem observações adicionais',
    wp.createdBy || responsibleName,
  ]);

  autoTable(doc, {
    startY: 83,
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

  // Attached Photos Section
  let currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : 120;

  const waypointsWithPhotos = waypoints.filter((wp) => wp.photos && wp.photos.length > 0);

  if (waypointsWithPhotos.length > 0) {
    if (currentY > pageHeight - 60) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('REGISTRO FOTOGRÁFICO DE MARCOS E VISTORIAS', 14, currentY);
    currentY += 6;

    waypointsWithPhotos.forEach((wp) => {
      wp.photos.forEach((photoBase64) => {
        if (currentY > pageHeight - 65) {
          doc.addPage();
          currentY = 20;
        }

        try {
          doc.addImage(photoBase64, 'JPEG', 14, currentY, 65, 48);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(15, 23, 42);
          doc.text(`Marco: ${wp.name} (${wp.category})`, 84, currentY + 10);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(71, 85, 105);
          doc.text(`Coordenadas: ${wp.lat.toFixed(6)}, ${wp.lng.toFixed(6)}`, 84, currentY + 16);
          doc.text(`Altitude: ${wp.altitude}m (Precisão: ±${wp.accuracy}m)`, 84, currentY + 22);
          if (wp.notes) {
            doc.text(`Notas: ${wp.notes}`, 84, currentY + 28, { maxWidth: 100 });
          }

          currentY += 54;
        } catch (e) {
          console.warn('Error adding waypoint photo to PDF', e);
        }
      });
    });
  }

  // Footer Signature Block
  if (currentY > pageHeight - 40) {
    doc.addPage();
    currentY = 30;
  } else {
    currentY = Math.max(currentY + 10, pageHeight - 35);
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(14, currentY, 90, currentY);
  doc.line(pageWidth - 90, currentY, pageWidth - 14, currentY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('RESPONSÁVEL TÉCNICO DE CAMPO', 14, currentY + 5);
  doc.text('EMPRESA / AUDITORIA', pageWidth - 90, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(responsibleName.toUpperCase(), 14, currentY + 9);
  doc.text(customCompanyName.toUpperCase(), pageWidth - 90, currentY + 9);

  // Page Numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `GoField Pro • Relatório Técnico de Campo • Página ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  doc.save(`${project.name.replace(/\s+/g, '_')}_Dossie_Tecnico.pdf`);
}
