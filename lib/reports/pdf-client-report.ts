import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ClientReportData } from '@/lib/types/report';
import {
  PDF_COLORS,
  formatCurrency,
  formatArea,
  formatDate,
  formatDateTime,
  drawReportHeader,
  drawSectionTitle,
  drawReportFooter,
  getLastTableFinalY,
} from './pdf-theme';

export function generateClientPdfReport(data: ClientReportData): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Render header
  let yPos = drawReportHeader(doc, {
    title: data.client.full_name,
    subtitle: 'Client Operational & Property Holdings Summary',
    refCode: data.client.client_id.slice(0, 8).toUpperCase(),
  });

  // Section 1: Essential Client Information
  yPos = drawSectionTitle(doc, '1. Essential Client Information', yPos);

  const primaryContact = data.contacts.find((c) => c.is_primary) ?? data.contacts[0];
  const otherContacts = data.contacts.filter((c) => c !== primaryContact);

  autoTable(doc, {
    startY: yPos,
    theme: 'plain',
    styles: { fontSize: 8.5, textColor: PDF_COLORS.textPrimary, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: PDF_COLORS.textSecondary, cellWidth: 30 },
      1: { cellWidth: 58 },
      2: { fontStyle: 'bold', textColor: PDF_COLORS.textSecondary, cellWidth: 30 },
      3: { cellWidth: 58 },
    },
    body: [
      ['Full Name', data.client.full_name, 'Client ID', data.client.client_id],
      ['Account Status', data.client.status, 'TIN Number', data.client.tin_number || 'None recorded'],
      ['Address', data.client.address || 'None recorded', 'Registered Date', formatDate(data.client.created_at)],
      [
        'Primary Contact',
        primaryContact ? `${primaryContact.type}: ${primaryContact.value}` : 'None recorded',
        'Last Profile Update',
        formatDate(data.client.updated_at),
      ],
    ],
  });

  yPos = getLastTableFinalY(doc) + 3;

  if (otherContacts.length > 0) {
    autoTable(doc, {
      startY: yPos,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.8, lineColor: PDF_COLORS.border, lineWidth: 0.2 },
      headStyles: { fillColor: PDF_COLORS.headerBg, textColor: PDF_COLORS.textSecondary, fontStyle: 'bold' },
      head: [['Contact Type', 'Detail / Value', 'Designation']],
      body: otherContacts.map((c) => [c.type, c.value, c.is_primary ? 'Primary Contact' : 'Secondary Contact']),
    });
    yPos = getLastTableFinalY(doc) + 5;
  } else {
    yPos += 3;
  }

  // Section 2: Assigned Property Holdings
  yPos = drawSectionTitle(doc, '2. Assigned Property Holdings', yPos);

  if (data.properties.length > 0) {
    const propertyRows = data.properties.map((p) => [
      `Block ${p.block_number}, Lot ${p.lot_number}`,
      p.location,
      formatArea(p.area_size),
      formatCurrency(p.price_per_sqm),
      formatCurrency(p.total_contract_price),
      p.status,
      `${p.role} (${p.ownership_percentage}%)`,
    ]);

    autoTable(doc, {
      startY: yPos,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, lineColor: PDF_COLORS.border, lineWidth: 0.2 },
      headStyles: { fillColor: PDF_COLORS.headerBg, textColor: PDF_COLORS.textSecondary, fontStyle: 'bold' },
      head: [['Lot', 'Location / Site', 'Area', 'Price/Sqm', 'Contract Price', 'Status', 'Ownership']],
      body: propertyRows,
      foot: [
        [
          'TOTALS',
          `${data.properties.length} Lot(s) Allocated`,
          formatArea(data.financials.totalAreaSqm),
          '-',
          formatCurrency(data.financials.totalPortfolioValue),
          '-',
          '-',
        ],
      ],
      footStyles: { fillColor: PDF_COLORS.cardBg, textColor: PDF_COLORS.textPrimary, fontStyle: 'bold' },
    });

    yPos = getLastTableFinalY(doc) + 6;
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...PDF_COLORS.textSecondary);
    doc.text('No property lots currently allocated or owned by this client.', 14, yPos + 3);
    yPos += 9;
  }

  // Section 3: Interpreted Data & Operational Insights
  yPos = drawSectionTitle(doc, '3. Operational Insights & Account Interpretation', yPos);

  // Document Compliance & Financial Status Summary
  const isComplete = data.documentChecklist.isComplete;
  const missingList = data.documentChecklist.missing.length > 0
    ? data.documentChecklist.missing.join(', ')
    : 'None (All mandatory documents on file)';
  const presentList = data.documentChecklist.present.length > 0
    ? data.documentChecklist.present.join(', ')
    : 'None submitted yet';

  const settledAmount = Math.max(0, data.financials.totalPortfolioValue - data.financials.totalRemainingBalance);
  const settlementRate = data.financials.totalPortfolioValue > 0
    ? ((settledAmount / data.financials.totalPortfolioValue) * 100).toFixed(1)
    : '0.0';

  autoTable(doc, {
    startY: yPos,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.5, lineColor: PDF_COLORS.border, lineWidth: 0.2 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: PDF_COLORS.cardBg, cellWidth: 48 },
      1: { cellWidth: 132 },
    },
    body: [
      [
        'Documentation Status',
        isComplete
          ? 'VERIFIED COMPLETE — Ready for Deed of Absolute Sale & Title processing'
          : `PENDING REQUIREMENTS — Missing mandatory documents: ${missingList}`,
      ],
      ['Submitted Documents', presentList],
      ['Total Portfolio Value', formatCurrency(data.financials.totalPortfolioValue)],
      ['Outstanding Balance', formatCurrency(data.financials.totalRemainingBalance)],
      ['Estimated Paid to Date', `${formatCurrency(settledAmount)} (${settlementRate}% Settled)`],
      ['Client Touchpoints', `${data.logs.length} logged staff interactions and audit entries`],
    ],
  });

  yPos = getLastTableFinalY(doc) + 5;

  // Interaction History Table
  if (data.logs.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.textPrimary);
    doc.text('Recent Interaction & Activity Log (Latest Touchpoints)', 14, yPos + 2);
    yPos += 4;

    const recentLogs = data.logs.slice(0, 10).map((l) => [
      l.event_type,
      l.description || 'No additional details noted',
      formatDateTime(l.time),
      l.performer_name || 'System Staff',
    ]);

    autoTable(doc, {
      startY: yPos,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 1.8, lineColor: PDF_COLORS.border, lineWidth: 0.2 },
      headStyles: { fillColor: PDF_COLORS.headerBg, textColor: PDF_COLORS.textSecondary, fontStyle: 'bold' },
      head: [['Event / Type', 'Discussion / Log Details', 'Date & Time', 'Recorded By']],
      body: recentLogs,
    });
  }

  // Draw footer with confidentiality and page numbers
  drawReportFooter(doc, 'Client Summary Report');

  // Trigger browser download
  const sanitizedName = data.client.full_name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`Client_Report_${sanitizedName}_${dateStr}.pdf`);
}
