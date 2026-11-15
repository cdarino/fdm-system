import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Ledger, LedgerSummary } from "@/lib/types/billing";
import { buildExcelSoaModel, ExcelSoaModel } from "@/lib/billing/export-excel";
import { formatCurrency, formatDate } from "@/lib/billing/ledger-engine";

export function generateSoaPdf(
  ledger: Ledger,
  summary: LedgerSummary,
  asOfDate: string
): jsPDF {
  const model: ExcelSoaModel = buildExcelSoaModel(ledger, summary, asOfDate);

  // Landscape A4 orientation matches official 11-column spreadsheet layout
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let cursorY = 14;

  // Header matching Excel Rows 1-5
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(model.meta.companyName, pageWidth / 2, cursorY, { align: "center" });

  cursorY += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(model.meta.companyAddress, pageWidth / 2, cursorY, { align: "center" });

  cursorY += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(model.meta.title, pageWidth / 2, cursorY, { align: "center" });

  cursorY += 4.5;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.text(`As of: ${formatDate(asOfDate)}`, pageWidth / 2, cursorY, { align: "center" });

  cursorY += 6;

  // Metadata Grid matching Excel Rows 7-16
  const leftColX = 14;
  const rightColX = 160;

  const leftMeta = [
    { label: "Account Name:", val: model.meta.accountName, bold: true },
    { label: "Address:", val: model.meta.address, bold: false },
    { label: "Contact No.:", val: model.meta.contactNo, bold: false },
    { label: "Referred by:", val: model.meta.referredBy, bold: false },
    { label: "Project Area:", val: model.meta.projectArea, bold: false },
    { label: "Block No.:", val: model.meta.blockNo, bold: false },
    { label: "Lot No.:", val: model.meta.lotNo, bold: false },
    { label: "Lot Area (Sqm):", val: model.meta.lotArea, bold: false },
    { label: "Price per Sqm:", val: model.meta.pricePerSqm, bold: false },
  ];

  const rightMeta = [
    { label: "CTS Date:", val: formatDate(model.meta.ctsDate) },
    { label: "Terms (Month):", val: String(model.meta.terms) },
    { label: "End of Contract:", val: formatDate(model.meta.endOfContract) },
    { label: "Total Selling Price (TSP):", val: formatCurrency(model.meta.tsp), isNum: true },
    { label: "Monthly Installment:", val: formatCurrency(model.meta.monthlyInstallment), isNum: true },
  ];

  const startMetaY = cursorY;
  doc.setFontSize(8);

  leftMeta.forEach((m, idx) => {
    const y = startMetaY + idx * 3.8;
    doc.setFont("helvetica", "bold");
    doc.text(m.label, leftColX, y);
    doc.setFont("helvetica", m.bold ? "bold" : "normal");
    doc.text(m.val, leftColX + 32, y);
  });

  rightMeta.forEach((m, idx) => {
    const y = startMetaY + (idx + 4) * 3.8;
    doc.setFont("helvetica", "bold");
    doc.text(m.label, rightColX, y);
    doc.setFont("helvetica", m.isNum ? "bold" : "normal");
    doc.text(m.val, rightColX + 46, y);
  });

  cursorY = startMetaY + leftMeta.length * 3.8 + 4;

  // 11-Column Table matching Excel Row 18+
  const headers = [
    "Inst. No",
    "Due Date",
    "Monthly Installment Due",
    "Date Paid",
    "Before Due Discount",
    "Amount Paid",
    "Penalty Charge (Paid)",
    "Penalty Balance",
    "Total Monthly Installment Due",
    "TSP Outstanding Balance",
    "Invoice/ Receipt No",
  ];

  const tableBody = model.rows.map((r) => [
    r.instNo,
    r.dueDate ? formatDate(r.dueDate) : "",
    r.monthlyDue !== null ? formatCurrency(r.monthlyDue) : "",
    r.datePaid ? formatDate(r.datePaid) : "",
    r.discount !== null ? formatCurrency(r.discount) : "",
    r.amountPaid !== null ? formatCurrency(r.amountPaid) : "",
    r.penaltyCharge !== null ? formatCurrency(r.penaltyCharge) : "",
    r.penaltyBalance !== null ? formatCurrency(r.penaltyBalance) : "",
    r.totalMonthlyDue !== null ? formatCurrency(r.totalMonthlyDue) : "",
    r.tspBalance !== null ? formatCurrency(r.tspBalance) : "",
    r.receiptNo || "",
  ]);

  autoTable(doc, {
    startY: cursorY,
    head: [headers],
    body: tableBody,
    theme: "grid",
    headStyles: {
      fillColor: [242, 242, 242],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "center",
      valign: "middle",
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      cellPadding: 1.5,
    },
    styles: {
      font: "helvetica",
      fontSize: 7,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      cellPadding: 1.2,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 16 },
      1: { halign: "center", cellWidth: 20 },
      2: { halign: "right", cellWidth: 28 },
      3: { halign: "center", cellWidth: 20 },
      4: { halign: "right", cellWidth: 22 },
      5: { halign: "right", cellWidth: 26 },
      6: { halign: "right", cellWidth: 26, textColor: [220, 38, 38] },
      7: { halign: "right", cellWidth: 26 },
      8: { halign: "right", cellWidth: 28 },
      9: { halign: "right", cellWidth: 28 },
      10: { halign: "center", cellWidth: 28 },
    },
    margin: { left: 14, right: 14 },
    didDrawCell: (data) => {
      // Highlight penalty charges in red if greater than 0
      if (data.section === "body" && data.column.index === 6 && data.cell.raw) {
        data.cell.styles.textColor = [220, 38, 38];
      }
    },
  });

  // Position cursor below table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastTable = (doc as any).lastAutoTable;
  cursorY = lastTable ? lastTable.finalY + 6 : cursorY + 40;

  // Summary Block matching Excel Rows 245-257
  const summaryX = 90;
  const colSubX = summaryX + 65;
  const colTotalX = summaryX + 115;

  doc.setFontSize(8);

  const summaryItems = [
    { label: "Total Selling Price", total: formatCurrency(model.summary.tsp), bold: true },
    { label: "Total Amount Paid", bold: true },
    { label: "   During Contract Period", sub: formatCurrency(model.summary.paidDuringContract) },
    {
      label: "   After Contract Period",
      sub: formatCurrency(model.summary.paidAfterContract),
      total: formatCurrency(model.summary.totalPaid),
      boldTotal: true,
    },
    { label: "Balance", total: formatCurrency(model.summary.principalBalance), bold: true },
    { label: "Add: Penalties", bold: true },
    { label: "   During Contract Period", sub: formatCurrency(model.summary.penaltiesDuringContract) },
    {
      label: "   After Contract Period",
      sub: formatCurrency(model.summary.penaltiesAfterContract),
      total: formatCurrency(model.summary.totalPenalties),
      boldTotal: true,
    },
    {
      label: "Total Amount Due",
      total: formatCurrency(model.summary.totalAmountDue),
      isTotal: true,
    },
  ];

  summaryItems.forEach((item) => {
    if (item.isTotal) {
      cursorY += 1.5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(item.label, summaryX, cursorY);
      doc.text(item.total || "", colTotalX, cursorY, { align: "right" });

      // Accounting double underline
      doc.setLineWidth(0.2);
      doc.line(colTotalX - 35, cursorY - 3.5, colTotalX, cursorY - 3.5);
      doc.line(colTotalX - 35, cursorY + 1, colTotalX, cursorY + 1);
      doc.line(colTotalX - 35, cursorY + 1.8, colTotalX, cursorY + 1.8);
      cursorY += 4.5;
    } else {
      doc.setFont("helvetica", item.bold ? "bold" : "normal");
      doc.setFontSize(8);
      doc.text(item.label, summaryX, cursorY);

      if (item.sub) {
        doc.setFont("helvetica", "normal");
        doc.text(item.sub, colSubX, cursorY, { align: "right" });
      }

      if (item.total) {
        doc.setFont("helvetica", item.boldTotal ? "bold" : "normal");
        doc.text(item.total, colTotalX, cursorY, { align: "right" });
      }

      cursorY += 3.8;
    }
  });

  // Signatory Section matching Excel Row 260
  cursorY += 6;
  const sigX = 225;
  doc.setLineWidth(0.3);
  doc.line(sigX - 30, cursorY, sigX + 30, cursorY);

  cursorY += 3.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(model.summary.signatoryName, sigX, cursorY, { align: "center" });

  cursorY += 3.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(model.summary.signatoryTitle, sigX, cursorY, { align: "center" });

  return doc;
}

export function downloadSoaPdf(
  ledger: Ledger,
  summary: LedgerSummary,
  asOfDate: string,
  filename?: string
): void {
  const doc = generateSoaPdf(ledger, summary, asOfDate);
  const safeName = (ledger.client?.fullName || "Account").replace(/[^a-zA-Z0-9_-]/g, "_");
  const targetName = filename ?? `SOA-${safeName}-${asOfDate}.pdf`;
  doc.save(targetName);
}
