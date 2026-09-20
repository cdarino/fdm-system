import type jsPDF from 'jspdf';

export const PDF_COLORS = {
  textPrimary: [15, 23, 42] as [number, number, number],
  textSecondary: [100, 116, 139] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  cardBg: [248, 250, 252] as [number, number, number],
  headerBg: [241, 245, 249] as [number, number, number],
  accent: [30, 41, 59] as [number, number, number],
};

export function formatCurrency(value: number | null | undefined): string {
  const num = Number(value ?? 0);
  return `PHP ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatArea(value: number | null | undefined): string {
  const num = Number(value ?? 0);
  return `${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} sqm`;
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(dateString);
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateString);
  }
}

export function drawReportHeader(
  doc: jsPDF,
  options: {
    title: string;
    subtitle: string;
    refCode?: string;
  }
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  let cursorY = 16;

  // Header branding bar
  doc.setDrawColor(...PDF_COLORS.border);
  doc.setLineWidth(0.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.textSecondary);
  doc.text('FDM REAL ESTATE SYSTEM • MANAGEMENT OPERATIONS REPORT', 14, cursorY);

  if (options.refCode) {
    doc.text(`REF: ${options.refCode}`, pageWidth - 14, cursorY, { align: 'right' });
  }

  cursorY += 6;
  doc.line(14, cursorY, pageWidth - 14, cursorY);

  // Main Report Title
  cursorY += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...PDF_COLORS.textPrimary);
  doc.text(options.title, 14, cursorY);

  // Subtitle & Generation timestamp
  cursorY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.textSecondary);
  doc.text(options.subtitle, 14, cursorY);

  const generatedDate = `Generated on ${formatDateTime(new Date().toISOString())}`;
  doc.text(generatedDate, pageWidth - 14, cursorY, { align: 'right' });

  cursorY += 6;
  doc.line(14, cursorY, pageWidth - 14, cursorY);

  return cursorY + 6;
}

export function drawSectionTitle(doc: jsPDF, title: string, yPos: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...PDF_COLORS.textPrimary);
  doc.text(title.toUpperCase(), 14, yPos);

  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setDrawColor(...PDF_COLORS.border);
  doc.setLineWidth(0.3);
  doc.line(14, yPos + 2, pageWidth - 14, yPos + 2);

  return yPos + 7;
}

export function drawReportFooter(doc: jsPDF, reportType: string): void {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Add footer to each page
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...PDF_COLORS.border);
    doc.setLineWidth(0.4);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.textSecondary);
    doc.text(`FDM System — ${reportType} (Strictly Confidential)`, 14, pageHeight - 7);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
  }
}

export function getLastTableFinalY(doc: jsPDF): number {
  const docWithTable = doc as unknown as { lastAutoTable?: { finalY?: number } };
  return docWithTable.lastAutoTable?.finalY ?? 40;
}

