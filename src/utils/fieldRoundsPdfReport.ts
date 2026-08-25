import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FieldRound } from '../types';

export interface ReportFilterOptions {
  startDate?: string;
  endDate?: string;
  technicianName?: string;
  vehiclePlate?: string;
  companyName?: string;
}

export const generateFieldRoundsPdf = async (
  rounds: FieldRound[],
  options: ReportFilterOptions = {}
): Promise<void> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const companyName = options.companyName || 'GOFIELD PRO - GESTÃO OPERACIONAL DE CAMPO';
  const issueDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Calculate stats
  const totalRounds = rounds.length;
  const totalKmSum = rounds.reduce((sum, r) => sum + (r.totalKm || 0), 0);
  const avgKm = totalRounds > 0 ? (totalKmSum / totalRounds).toFixed(1) : '0';

  // 1. Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 32, 'F');

  // Accent Line
  doc.setFillColor(14, 165, 233); // sky-500
  doc.rect(0, 32, 210, 2, 'F');

  // Title & Subtitle
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('RELATÓRIO DE ATIVIDADES DE CAMPO & QUILOMETRAGEM', 14, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`${companyName} | Registro de Deslocamentos e Vistorias`, 14, 20);
  doc.text(`Emitido em: ${issueDate}`, 14, 27);

  // 2. Summary KPI Box
  const startY = 38;
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(14, startY, 182, 20, 2, 2, 'FD');

  // Stat 1: Total KM
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL PERCORRIDO', 20, startY + 6);
  doc.setFontSize(12);
  doc.setTextColor(14, 165, 233);
  doc.text(`${totalKmSum.toLocaleString('pt-BR')} KM`, 20, startY + 14);

  // Divider 1
  doc.setDrawColor(203, 213, 225);
  doc.line(75, startY + 4, 75, startY + 16);

  // Stat 2: Total Rodadas / Locais
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('RODADAS / VISITAS', 82, startY + 6);
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`${totalRounds} registradas`, 82, startY + 14);

  // Divider 2
  doc.line(138, startY + 4, 138, startY + 16);

  // Stat 3: Média KM / Rodada
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('MÉDIA POR RODADA', 145, startY + 6);
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`${avgKm} KM/visita`, 145, startY + 14);

  // 3. Table of Records
  const tableData = rounds.map((r, index) => {
    const formattedDate = r.date
      ? new Date(r.date + 'T00:00:00').toLocaleDateString('pt-BR')
      : 'N/I';
    const timeRange = `${r.startTime || '--:--'} às ${r.endTime || '--:--'}`;
    const initialKmStr = r.initialKm.toLocaleString('pt-BR');
    const finalKmStr = r.finalKm ? r.finalKm.toLocaleString('pt-BR') : 'Em andamento';
    const totalKmStr = r.totalKm ? `${r.totalKm.toLocaleString('pt-BR')} km` : '--';
    const vehicleInfo = [r.technicianName, r.vehiclePlate ? `[${r.vehiclePlate}]` : '']
      .filter(Boolean)
      .join(' ');

    return [
      (index + 1).toString(),
      `${formattedDate}\n${timeRange}`,
      `${r.locationName}\n${r.purpose ? `(${r.purpose})` : ''}`,
      vehicleInfo,
      initialKmStr,
      finalKmStr,
      totalKmStr,
      r.status === 'em_andamento' ? 'Em Aberto' : 'Concluída',
    ];
  });

  autoTable(doc, {
    startY: startY + 24,
    head: [
      ['#', 'Data & Hora', 'Local Visitado / Atividade', 'Técnico / Veículo', 'KM Inicial', 'KM Final', 'Total KM', 'Status'],
    ],
    body: tableData,
    foot: [
      [
        {
          content: `TOTAL GERAL (${totalRounds} ${totalRounds === 1 ? 'registro' : 'registros'})`,
          colSpan: 6,
          styles: { halign: 'right', fontStyle: 'bold', fontSize: 8.5, textColor: [15, 23, 42] },
        },
        {
          content: `${totalKmSum.toLocaleString('pt-BR')} km`,
          styles: { halign: 'right', fontStyle: 'bold', fontSize: 9, textColor: [2, 132, 199] },
        },
        {
          content: '',
          styles: { halign: 'center' },
        },
      ],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 26, halign: 'center' },
      2: { cellWidth: 44 },
      3: { cellWidth: 32 },
      4: { cellWidth: 18, halign: 'right' },
      5: { cellWidth: 18, halign: 'right' },
      6: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
      7: { cellWidth: 16, halign: 'center' },
    },
    styles: {
      overflow: 'linebreak',
    },
  });

  // Check photos across all rounds
  const roundsWithPhotos = rounds.filter((r) => r.photos && r.photos.length > 0);

  if (roundsWithPhotos.length > 0) {
    doc.addPage();
    let currentY = 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('ANEXO FOTOGRÁFICO DAS ATIVIDADES DE CAMPO', 14, currentY);
    currentY += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Registros de odômetro, locais visitados e evidências das atividades realizadas.', 14, currentY);
    currentY += 10;

    for (const round of roundsWithPhotos) {
      if (currentY > 230) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(14, 165, 233); // sky-500
      doc.text(`• ${round.locationName} (${round.date}) - ${round.totalKm} KM`, 14, currentY);
      currentY += 5;

      let photoX = 14;
      for (let i = 0; i < round.photos.length; i++) {
        const photo = round.photos[i];
        try {
          if (photo.startsWith('data:image')) {
            doc.addImage(photo, 'JPEG', photoX, currentY, 55, 42);
            photoX += 60;
            if (photoX > 150) {
              photoX = 14;
              currentY += 46;
            }
          }
        } catch (e) {
          console.warn('Error adding image to PDF:', e);
        }
      }
      currentY += 50;
    }
  }

  // Final Signatures Box on last page
  const pageHeight = doc.internal.pageSize.getHeight();
  let signY = pageHeight - 32;

  doc.setDrawColor(203, 213, 225);
  doc.line(20, signY, 85, signY);
  doc.line(125, signY, 190, signY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Técnico / Responsável pelo Deslocamento', 23, signY + 4);
  doc.text('Gestão / Supervisão de Campo', 137, signY + 4);

  // Add Copyright Footer to ALL Pages of the document
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 287, 196, 287);
    doc.text(
      'GoField Pro • Sistema de Relatório de Campo e Deslocamentos',
      14,
      291
    );
    doc.text(`Página ${i} de ${totalPages}`, 196, 291, { align: 'right' });
  }

  // Save the PDF
  const filename = `GoField_Relatorio_Rodadas_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
};
