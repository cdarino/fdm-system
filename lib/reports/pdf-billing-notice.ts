import jsPDF from "jspdf";
import { PDF_COLORS, formatCurrency, formatDate } from "./pdf-theme";

export interface BillingNoticePdfParams {
  clientName: string;
  projectArea: string;
  blockNumber: string | number;
  lotNumber: string | number;
  termMonths: number;
  monthlyAmortization: number;
  docDate: string;
  docStage: "first_notice" | "second_notice" | "final_demand" | "forfeited";
  totalDue: number;
  arrears: number;
  penalty: number;
  penaltyRate: number;
  trackingNo?: string | null;
}

const STAGE_TITLES: Record<
  BillingNoticePdfParams["docStage"],
  { title: string; subtitle: string }
> = {
  first_notice: {
    title: "FIRST OVERDUE NOTICE & REMINDER",
    subtitle: "Friendly settlement reminder for overdue installment amortization.",
  },
  second_notice: {
    title: "SECOND NOTICE & DEMAND LETTER",
    subtitle: "Formal demand setting a 15-day settlement deadline.",
  },
  final_demand: {
    title: "FINAL DEMAND & NOTICE OF CANCELLATION",
    subtitle:
      "Notarized 30-day notice of contract cancellation pursuant to the Maceda Law (R.A. 6552).",
  },
  forfeited: {
    title: "NOTICE OF FORFEITURE & VACATE ORDER",
    subtitle:
      "Final notice of account forfeiture and demand to peacefully vacate premises.",
  },
};

export function generateBillingNoticePdf(params: BillingNoticePdfParams): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let cursorY = 18;

  // Company Letterhead Branding
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PDF_COLORS.textPrimary);
  doc.text(
    "FIRST DAVAO MILLENNIUM PROPERTY VENTURES SERVICES, INC.",
    pageWidth / 2,
    cursorY,
    { align: "center" }
  );

  cursorY += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.textSecondary);
  doc.text(
    "No. 59 FDM Bldg., Bolton Ext., Brgy. 1-A, Davao City • Tel: (082) 222-0000",
    pageWidth / 2,
    cursorY,
    { align: "center" }
  );

  cursorY += 3.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "CREDIT, BILLING & LEGAL AFFAIRS DEPARTMENT",
    pageWidth / 2,
    cursorY,
    { align: "center" }
  );

  cursorY += 4;
  doc.setDrawColor(...PDF_COLORS.border);
  doc.setLineWidth(0.6);
  doc.line(14, cursorY, pageWidth - 14, cursorY);

  // Metadata Section
  cursorY += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_COLORS.textPrimary);

  doc.text(`Date Issued: ${formatDate(params.docDate)}`, 14, cursorY);
  doc.text(
    `Contract Plan: ${params.termMonths} Months (${formatCurrency(params.monthlyAmortization)}/mo)`,
    pageWidth - 14,
    cursorY,
    { align: "right" }
  );

  cursorY += 4.5;
  doc.setFont("helvetica", "bold");
  doc.text(`Buyer Name: ${params.clientName.toUpperCase()}`, 14, cursorY);
  if (params.trackingNo) {
    doc.setFont("helvetica", "normal");
    doc.text(`Tracking Ref: ${params.trackingNo}`, pageWidth - 14, cursorY, {
      align: "right",
    });
  }

  cursorY += 4.5;
  doc.setFont("helvetica", "normal");
  doc.text(
    `Property: ${params.projectArea} • Block ${params.blockNumber} Lot ${params.lotNumber}`,
    14,
    cursorY
  );

  // Stage Title Box
  cursorY += 7;
  const stageInfo = STAGE_TITLES[params.docStage];
  doc.setDrawColor(...PDF_COLORS.border);
  doc.setFillColor(...PDF_COLORS.cardBg);
  doc.roundedRect(14, cursorY, pageWidth - 28, 14, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_COLORS.textPrimary);
  doc.text(stageInfo.title, pageWidth / 2, cursorY + 5.5, { align: "center" });

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF_COLORS.textSecondary);
  doc.text(stageInfo.subtitle, pageWidth / 2, cursorY + 10.5, {
    align: "center",
  });

  cursorY += 19;

  // Financial Snapshot Box
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, cursorY, pageWidth - 28, 22, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_COLORS.textPrimary);
  doc.text("Overdue Principal Arrears:", 18, cursorY + 5.5);
  doc.text(formatCurrency(params.arrears), pageWidth - 18, cursorY + 5.5, {
    align: "right",
  });

  doc.text(
    `Accumulated Late Penalties (${(params.penaltyRate * 100).toFixed(1)}%/mo):`,
    18,
    cursorY + 11
  );
  doc.setTextColor(185, 28, 28);
  doc.text(formatCurrency(params.penalty), pageWidth - 18, cursorY + 11, {
    align: "right",
  });

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(18, cursorY + 14, pageWidth - 18, cursorY + 14);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.textPrimary);
  doc.text("Total Due and Demandable Now:", 18, cursorY + 19);
  doc.text(formatCurrency(params.totalDue), pageWidth - 18, cursorY + 19, {
    align: "right",
  });

  cursorY += 28;

  // Legal Body Text
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.textPrimary);

  const paragraphs = getNoticeBodyParagraphs(params);
  for (const para of paragraphs) {
    const lines = doc.splitTextToSize(para, pageWidth - 28);
    doc.text(lines, 14, cursorY);
    cursorY += lines.length * 4.5 + 3.5;
  }

  // Signatory Block
  cursorY = Math.max(cursorY + 6, 235);
  const colWidth = (pageWidth - 36) / 2;

  // Left Signatory
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.textSecondary);
  doc.text("Issued by:", 14, cursorY);

  doc.setDrawColor(...PDF_COLORS.border);
  doc.line(14, cursorY + 12, 14 + colWidth, cursorY + 12);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.textPrimary);
  doc.text("FIRST DAVAO MILLENNIUM", 14, cursorY + 16);
  doc.setFont("helvetica", "normal");
  doc.text("Credit & Collection Department", 14, cursorY + 20);

  // Right Signatory
  const rightColX = 14 + colWidth + 8;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_COLORS.textSecondary);
  doc.text("Noted / Approved:", rightColX, cursorY);

  doc.line(rightColX, cursorY + 12, rightColX + colWidth, cursorY + 12);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.textPrimary);
  doc.text("MANAGEMENT / LEGAL COUNSEL", rightColX, cursorY + 16);
  doc.setFont("helvetica", "normal");
  doc.text("First Davao Millennium Property Ventures", rightColX, cursorY + 20);

  // Footer Divider & Disclaimer
  doc.line(14, 280, pageWidth - 14, 280);
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF_COLORS.textSecondary);
  doc.text("Served via: Registered Mail / Personal Service", 14, 284);
  doc.text(
    "Copy on File • Credit & Collection Dept.",
    pageWidth - 14,
    284,
    { align: "right" }
  );

  return doc;
}

function getNoticeBodyParagraphs(params: BillingNoticePdfParams): string[] {
  const propertyLabel = `${params.projectArea} Block ${params.blockNumber} Lot ${params.lotNumber}`;
  const totalDueStr = formatCurrency(params.totalDue);
  const arrearsStr = formatCurrency(params.arrears);
  const penaltyStr = formatCurrency(params.penalty);

  if (params.docStage === "first_notice") {
    return [
      `Our billing records indicate that your installment obligations for ${propertyLabel} have matured and remain unpaid as of ${formatDate(params.docDate)}.`,
      `The total unpaid amount of ${totalDueStr} (including principal arrears of ${arrearsStr} and accumulated late penalties of ${penaltyStr}) is now due for settlement.`,
      "Please remit the total amount due at our main office on Bolton Ext., Davao City, or via accredited bank transfer within seven (7) days upon receipt hereof to maintain your account in good standing.",
    ];
  }

  if (params.docStage === "second_notice") {
    return [
      "This serves as our SECOND FORMAL NOTICE & DEMAND regarding your overdue account. Despite our previous notice, your monthly installments remain unsettled, placing your Contract to Sell in sustained default.",
      `DEMAND IS HEREBY MADE upon you to settle the full amount of ${totalDueStr} within fifteen (15) days from receipt of this letter.`,
      "Failure to comply will leave us no recourse but to initiate formal notarized contract cancellation and forfeiture proceedings pursuant to Section 8 of your Contract to Sell.",
    ];
  }

  if (params.docStage === "final_demand") {
    return [
      "FINAL DEMAND AND NOTARIZED NOTICE OF CANCELLATION under Section 8 and 9 of the Contract to Sell and Republic Act No. 6552 (Maceda Law).",
      `Having defaulted in your monthly installment payments, with total accumulated overdue obligations now amounting to ${totalDueStr} (comprising ${arrearsStr} in principal arrears and ${penaltyStr} in surcharges), First Davao Millennium hereby formally gives notice of cancellation of your Contract.`,
      "You are hereby granted a final, non-extendible period of THIRTY (30) DAYS from service of this notice within which to fully pay your total outstanding arrears.",
      "Should you fail to fully settle within said thirty (30) day grace period, this Contract shall be deemed officially and irrevocably cancelled without need of judicial action, all payments previously made shall be forfeited, and you shall immediately surrender possession of the property.",
    ];
  }

  return [
    `The thirty (30) day grace period granted in the Notarized Notice of Cancellation having fully expired without the settlement of your overdue account (${totalDueStr}), notice is hereby officially served that Contract for ${propertyLabel} is CANCELLED, TERMINATED, AND RESCINDED.`,
    "Pursuant to Section 8, 9, and 10 of the Contract to Sell, all payments made under this contract are hereby declared FORFEITED in favor of First Davao Millennium Property Ventures Services, Inc. and treated as liquidated damages and reasonable rentals for the use and occupancy of the premises.",
    "You are hereby directed to peacefully vacate and surrender the subject premises within five (5) days from receipt hereof. First Davao Millennium is now legally free to enter and dispose of the property.",
  ];
}

export function downloadBillingNoticePdf(
  params: BillingNoticePdfParams,
  filename?: string
): void {
  const doc = generateBillingNoticePdf(params);
  const cleanName = params.clientName.replace(/[^\w.-]+/g, "_");
  const targetName =
    filename ??
    `Notice_${params.docStage}_${cleanName}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(targetName);
}
