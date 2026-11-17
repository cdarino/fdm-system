import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Ledger } from "@/lib/types/billing";

function formatQuickbooksTime(d: Date): string {
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}

function formatQuickbooksShortDate(d: Date): string {
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  const yy = d.getFullYear().toString().slice(-2);
  return `${mm}/${dd}/${yy}`;
}

export function formatPaymentHistoryDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  const yyyy = d.getFullYear().toString();
  return `${mm}/${dd}/${yyyy}`;
}

export function formatPaymentHistoryAmount(amount: number): string {
  return (amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function buildPaymentHistoryHeader(ledger: Ledger): {
  companyName: string;
  reportTitle: string;
  subtitle: string;
} {
  const clientName = ledger.client?.fullName || "Client";
  const projectArea = ledger.property?.projectArea || "";
  const block = ledger.property?.blockNumber ?? 0;
  const lot = ledger.property?.lotNumber ?? 0;
  const lotArea = ledger.property?.lotArea ?? 0;
  const tsp = Math.round(ledger.contractPrice ?? 0);

  const lotDescriptor = `B${block}L${lot}`;
  const reportTitle = `All Transactions for ${clientName} ${projectArea} ${lotDescriptor} ${lotArea} ${tsp}`
    .replace(/\s+/g, " ")
    .trim();

  return {
    companyName: "First Davao Millennium Property Ventures Services,Inc.",
    reportTitle,
    subtitle: "All Transactions",
  };
}

export function generatePaymentHistoryPdf(ledger: Ledger, generatedAt: Date = new Date()): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const { companyName, reportTitle, subtitle } = buildPaymentHistoryHeader(ledger);

  const marginX = 14;
  let cursorY = 14;

  // Top-left print timestamp matching QuickBooks statement export
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text(formatQuickbooksTime(generatedAt), marginX, cursorY);
  doc.text(formatQuickbooksShortDate(generatedAt), marginX, cursorY + 3.8);

  // Centered header block
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(companyName, pageWidth / 2, cursorY, { align: "center" });

  cursorY += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(reportTitle, pageWidth / 2, cursorY, { align: "center" });

  cursorY += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(subtitle, pageWidth / 2, cursorY, { align: "center" });

  cursorY += 6;

  // Payments sorted descending by date (newest first) as shown in .temp/payments.jpeg
  const sortedPayments = [...(ledger.payments || [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const totalAmount = sortedPayments.reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0
  );

  const tableBody = sortedPayments.map((p) => [
    "Payment",
    p.receiptNo || "Payment",
    formatPaymentHistoryDate(p.date),
    "Undeposited Funds",
    formatPaymentHistoryAmount(p.amount),
  ]);

  autoTable(doc, {
    startY: cursorY,
    head: [["Type", "Num", "Date", "Account", "Amount"]],
    body: tableBody,
    foot: [["", "", "", "", formatPaymentHistoryAmount(totalAmount)]],
    theme: "plain",
    margin: { left: marginX, right: marginX, bottom: 16 },
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      textColor: [0, 0, 0],
      cellPadding: { top: 1.2, bottom: 1.2, left: 1, right: 1 },
      lineColor: [0, 0, 0],
    },
    headStyles: {
      font: "helvetica",
      fontStyle: "bold",
      fontSize: 8.5,
      fillColor: false,
      textColor: [0, 0, 0],
      lineWidth: { top: 0.2, bottom: 0.2 },
    },
    footStyles: {
      font: "helvetica",
      fontStyle: "bold",
      fontSize: 8.5,
      fillColor: false,
      textColor: [0, 0, 0],
      lineWidth: { top: 0.2 },
    },
    columnStyles: {
      0: { cellWidth: 26, halign: "left" },
      1: { cellWidth: 42, halign: "left" },
      2: { cellWidth: 28, halign: "left" },
      3: { cellWidth: "auto", halign: "left" },
      4: { cellWidth: 32, halign: "right" },
    },
    didDrawPage: (data) => {
      // Bottom-right page count: Page X of Y
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      const pageStr = `Page ${data.pageNumber} of ${doc.getNumberOfPages()}`;
      doc.text(pageStr, pageWidth - marginX, pageHeight - 10, { align: "right" });
    },
  });

  return doc;
}

export function downloadPaymentHistoryPdf(
  ledger: Ledger,
  filename?: string
): void {
  const doc = generatePaymentHistoryPdf(ledger);
  const safeName = (ledger.client?.fullName || "Account").replace(/[^a-zA-Z0-9_-]/g, "_");
  const targetName = filename ?? `Payment-History-${safeName}.pdf`;
  doc.save(targetName);
}
