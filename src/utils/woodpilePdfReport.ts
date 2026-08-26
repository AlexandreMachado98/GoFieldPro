import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface WoodpileItem {
  id: string;
  pileCode: string;
  locationName: string;
  woodSpecies: string;
  lengthMeters: number;
  heightMeters: number;
  logLengthMeters: number;
  stackingFactor: number;
  stereVolume: number;
  solidVolumeM3: number;
  date: string;
  technicianName: string;
  notes?: string;
  photos: string[];
}

export function generateWoodpilePdfReport(
  piles: WoodpileItem[],
  technicianName: string,
  companyName: string = 'AM TST SAÚDE E SEGURANÇA DO TRABALHO',
  companyLogoBase64?: string
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header Banner (Dark Emerald / Forest Theme)
  doc.setFillColor(6, 78, 59); // emerald-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Custom Company Logo (if provided)
  if (companyLogoBase64 && companyLogoBase64.startsWith('data:image')) {
    try {
      doc.addImage(companyLogoBase64, 'PNG', 12, 4, 20, 20);
    } catch (e) {
      console.warn('Could not embed custom logo', e);
    }
  }

  // Header Texts
  const textLeftMargin = companyLogoBase64 ? 36 : 14;
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('GOFIELD PRO | LAUDO DE CUBAGEM FLORESTAL & PILHAS', textLeftMargin, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(209, 250, 229); // emerald-100
  doc.text(
    `EMPRESA: ${companyName.toUpperCase()} | EMISSÃO: ${new Date().toLocaleString('pt-BR')} | RESPONSÁVEL: ${technicianName.toUpperCase()}`,
    textLeftMargin,
    18
  );

  // Security Seal
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.roundedRect(pageWidth - 52, 6, 40, 16, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('CUBAGEM TÉCNICA', pageWidth - 48, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('VOLUME CERTIFICADO', pageWidth - 49, 17);

  // Summary Metrics Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 34, pageWidth - 28, 22, 2, 2, 'FD');

  const totalStereVolume = piles.reduce((sum, p) => sum + (p.stereVolume || 0), 0);
  const totalSolidVolume = piles.reduce((sum, p) => sum + (p.solidVolumeM3 || 0), 0);
  const avgFE = piles.length > 0 ? (piles.reduce((sum, p) => sum + (p.stackingFactor || 0.65), 0) / piles.length).toFixed(2) : '0.65';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Pilhas Medidas:', 20, 42);
  doc.text('Volume Estéreo (st):', 65, 42);
  doc.text('Volume Sólido (m³):', 115, 42);
  doc.text('Fator Médio (FE):', 165, 42);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.text(`${piles.length} pilhas`, 20, 50);
  doc.text(`${totalStereVolume.toFixed(2)} st`, 65, 50);
  doc.text(`${totalSolidVolume.toFixed(2)} m³`, 115, 50);
  doc.text(`${avgFE}`, 165, 50);

  // Table of Woodpiles
  const tableRows = piles.map((p) => [
    p.pileCode || 'PILHA',
    p.locationName || 'Talhão Geral',
    p.woodSpecies || 'Eucalipto',
    `${p.lengthMeters.toFixed(2)}m x ${p.heightMeters.toFixed(2)}m x ${p.logLengthMeters.toFixed(2)}m`,
    `${p.stackingFactor.toFixed(2)}`,
    `${p.stereVolume.toFixed(2)} st`,
    `${p.solidVolumeM3.toFixed(2)} m³`,
    p.date ? new Date(p.date).toLocaleDateString('pt-BR') : '-',
  ]);

  autoTable(doc, {
    startY: 62,
    head: [['Código', 'Talhão / Local', 'Espécie', 'Dimensões (C x A x L)', 'F.E.', 'Vol. Estéreo', 'Vol. Sólido', 'Data']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [6, 78, 59],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 32 },
      2: { cellWidth: 26 },
      3: { cellWidth: 36 },
      4: { cellWidth: 14 },
      5: { cellWidth: 22 },
      6: { cellWidth: 22 },
      7: { cellWidth: 20 },
    },
    alternateRowStyles: {
      fillColor: [240, 253, 244],
    },
  });

  // Attached Photos Section
  let currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : 120;

  const pilesWithPhotos = piles.filter((p) => p.photos && p.photos.length > 0);

  if (pilesWithPhotos.length > 0) {
    if (currentY > pageHeight - 60) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('REGISTRO FOTOGRÁFICO DE CAMPO DAS PILHAS', 14, currentY);
    currentY += 6;

    pilesWithPhotos.forEach((p) => {
      p.photos.forEach((photoBase64, photoIdx) => {
        if (currentY > pageHeight - 75) {
          doc.addPage();
          currentY = 20;
        }

        try {
          doc.addImage(photoBase64, 'JPEG', 14, currentY, 70, 52);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(15, 23, 42);
          doc.text(`Pilha: ${p.pileCode} - ${p.locationName}`, 88, currentY + 10);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(71, 85, 105);
          doc.text(`Espécie: ${p.woodSpecies}`, 88, currentY + 16);
          doc.text(`Dimensões: ${p.lengthMeters.toFixed(2)}m (C) x ${p.heightMeters.toFixed(2)}m (A) x ${p.logLengthMeters.toFixed(2)}m (Toro)`, 88, currentY + 22);
          doc.text(`Volume: ${p.stereVolume.toFixed(2)} st / ${p.solidVolumeM3.toFixed(2)} m³ sólido (FE: ${p.stackingFactor.toFixed(2)})`, 88, currentY + 28);
          if (p.notes) {
            doc.text(`Obs: ${p.notes}`, 88, currentY + 34, { maxWidth: 100 });
          }

          currentY += 58;
        } catch (e) {
          console.warn('Error adding woodpile photo to PDF', e);
        }
      });
    });
  }

  // Technical Responsibility Signature Area
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
  doc.text('RESPONSÁVEL PELA MEDIÇÃO', 14, currentY + 5);
  doc.text('SUPERVISÃO / GESTOR FLORESTAL', pageWidth - 90, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(technicianName.toUpperCase(), 14, currentY + 9);
  doc.text(companyName.toUpperCase(), pageWidth - 90, currentY + 9);

  // Footer page number
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `GoField Pro • Laudo de Cubagem Florestal • Página ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  doc.save(`Laudo_Cubagem_${piles[0]?.pileCode || 'Florestal'}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
