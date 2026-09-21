import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PropertyReportData } from '@/lib/types/report';
import {
  PDF_COLORS,
  formatCurrency,
  formatArea,
  formatDate,
  drawReportHeader,
  drawSectionTitle,
  drawReportFooter,
  getLastTableFinalY,
} from './pdf-theme';

export function generatePropertyPdfReport(data: PropertyReportData): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  // Render header
  let yPos = drawReportHeader(doc, {
    title: `Block ${data.lot.block_number}, Lot ${data.lot.lot_number}`,
    subtitle: `Property Lot Operational & Financial Summary — ${data.lot.location}`,
    refCode: data.lot.property_id.slice(0, 8).toUpperCase(),
  });

  // Section 1: Lot Identity & Core Specifications
  yPos = drawSectionTitle(doc, '1. Lot Specifications & Valuation', yPos);

  const tcp = data.active_account?.total_contract_price ?? data.calculated_total_price;

  autoTable(doc, {
    startY: yPos,
    theme: 'plain',
    styles: { fontSize: 8.5, textColor: PDF_COLORS.textPrimary, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: PDF_COLORS.textSecondary, cellWidth: 32 },
      1: { cellWidth: 56 },
      2: { fontStyle: 'bold', textColor: PDF_COLORS.textSecondary, cellWidth: 32 },
      3: { cellWidth: 56 },
    },
    body: [
      [
        'Lot Identification',
        `Block ${data.lot.block_number} • Lot ${data.lot.lot_number}`,
        'Current Status',
        data.lot.status,
      ],
      [
        'Location / Project',
        data.lot.location,
        'Site / Subdivision',
        data.site_name || 'Standard Plat',
      ],
      [
        'Lot Area',
        formatArea(data.lot.area_size),
        'Price per Sqm',
        formatCurrency(data.lot.price_per_sqm),
      ],
      [
        'Total Contract Price',
        formatCurrency(tcp),
        'Boundary Mapping',
        data.lot.boundary ? 'Plat GIS Coordinates Defined' : 'Standard Boundary (Unplatted)',
      ],
    ],
  });

    yPos = getLastTableFinalY(doc) + 6;

  // Section 2: Buyer & Ownership Allocation
  yPos = drawSectionTitle(doc, '2. Buyer & Ownership Allocation', yPos);

  if (data.parties.length > 0) {
    const partyRows = data.parties.map((p) => {
      const primaryContact = p.contacts.find((c) => c.is_primary) ?? p.contacts[0];
      const contactStr = primaryContact ? `${primaryContact.type}: ${primaryContact.value}` : 'No contact on file';
      return [
        p.full_name,
        p.role,
        `${p.ownership_percentage}%`,
        p.tin_number || 'N/A',
        contactStr,
      ];
    });

    autoTable(doc, {
      startY: yPos,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, lineColor: PDF_COLORS.border, lineWidth: 0.2 },
      headStyles: { fillColor: PDF_COLORS.headerBg, textColor: PDF_COLORS.textSecondary, fontStyle: 'bold' },
      head: [['Client Name', 'Ownership Role', 'Share %', 'TIN Number', 'Primary Contact']],
      body: partyRows,
    });

    yPos = getLastTableFinalY(doc) + 6;
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...PDF_COLORS.textSecondary);
    doc.text('Unassigned — This lot is currently open inventory and available for customer allocation.', 14, yPos + 3);
    yPos += 9;
  }

  // Section 3: Financial & Ledger Snapshot
  yPos = drawSectionTitle(doc, '3. Financial & Ledger Account Status', yPos);

  if (data.active_account) {
    const acct = data.active_account;
    autoTable(doc, {
      startY: yPos,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5, lineColor: PDF_COLORS.border, lineWidth: 0.2 },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: PDF_COLORS.cardBg, cellWidth: 48 },
        1: { cellWidth: 132 },
      },
      body: [
        ['Ledger Account ID', acct.account_id],
        ['Account Status', acct.status],
        ['Total Contract Price (TCP)', formatCurrency(acct.total_contract_price)],
        ['Remaining Balance', formatCurrency(acct.remaining_balance)],
        [
          'Paid to Date (Equity)',
          `${formatCurrency(acct.paid_amount)} (${acct.completion_rate.toFixed(1)}% Settled)`,
        ],
      ],
    });
    yPos = getLastTableFinalY(doc) + 6;
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...PDF_COLORS.textSecondary);
    doc.text('No active ledger account opened for this lot. Pricing benchmarked at standard base list price.', 14, yPos + 3);
    yPos += 9;
  }

  // Section 4: Operational History & Record Metadata
  yPos = drawSectionTitle(doc, '4. Record Metadata & Administration', yPos);

  autoTable(doc, {
    startY: yPos,
    theme: 'plain',
    styles: { fontSize: 8, textColor: PDF_COLORS.textSecondary, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35 },
      1: { cellWidth: 55 },
      2: { fontStyle: 'bold', cellWidth: 35 },
      3: { cellWidth: 55 },
    },
    body: [
      ['Registration Date', formatDate(data.lot.created_at), 'Last Updated', formatDate(data.lot.updated_at)],
      ['System Lot ID', data.lot.property_id, 'Inventory Disposition', data.lot.status === 'Open' ? 'Available for Sale' : 'Allocated'],
    ],
  });

  // Render footer
  drawReportFooter(doc, 'Property Summary Report');

  // Trigger browser download
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`Property_Report_Block${data.lot.block_number}_Lot${data.lot.lot_number}_${dateStr}.pdf`);
}
