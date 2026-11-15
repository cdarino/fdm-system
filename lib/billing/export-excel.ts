import ExcelJS from "exceljs";
import { Ledger, LedgerSummary } from "@/lib/types/billing";
import { addMonthsToDate, formatDate } from "./ledger-engine";

export interface SoaRowData {
  instNo: string;
  dueDate: string;
  monthlyDue: number | null;
  datePaid: string;
  discount: number | null;
  amountPaid: number | null;
  penaltyCharge: number | null;
  penaltyBalance: number | null;
  totalMonthlyDue: number | null;
  tspBalance: number | null;
  receiptNo: string;
}

export interface SoaSummaryData {
  tsp: number;
  paidDuringContract: number;
  paidAfterContract: number;
  totalPaid: number;
  principalBalance: number;
  penaltiesDuringContract: number;
  penaltiesAfterContract: number;
  totalPenalties: number;
  totalAmountDue: number;
  signatoryName: string;
  signatoryTitle: string;
}

export interface SoaMetadata {
  companyName: string;
  companyAddress: string;
  title: string;
  asOfDate: string;
  accountName: string;
  address: string;
  contactNo: string;
  referredBy: string;
  projectArea: string;
  blockNo: string;
  lotNo: string;
  lotArea: string;
  pricePerSqm: string;
  ctsDate: string;
  terms: number;
  endOfContract: string;
  tsp: number;
  monthlyInstallment: number;
}

export interface ExcelSoaModel {
  meta: SoaMetadata;
  rows: SoaRowData[];
  summary: SoaSummaryData;
}

export function buildExcelSoaModel(
  ledger: Ledger,
  summary: LedgerSummary,
  asOfDate: string
): ExcelSoaModel {
  const maturityDate = addMonthsToDate(ledger.firstDueDate, ledger.termMonths - 1, ledger.dueDay);

  let paidDuringContract = 0;
  let paidAfterContract = 0;
  ledger.payments
    .filter((p) => p.date <= asOfDate)
    .forEach((p) => {
      if (p.date <= maturityDate) {
        paidDuringContract += p.amount;
      } else {
        paidAfterContract += p.amount;
      }
    });
  const totalPaid = +(paidDuringContract + paidAfterContract).toFixed(2);

  let penaltiesDuringContract = 0;
  let penaltiesAfterContract = 0;
  summary.journal.forEach((row) => {
    if (row.rowType === "penalty_charge" && row.penaltyCharged) {
      if (row.date <= maturityDate) {
        penaltiesDuringContract += row.penaltyCharged;
      } else {
        penaltiesAfterContract += row.penaltyCharged;
      }
    }
  });

  const rows: SoaRowData[] = summary.journal.map((j) => {
    if (j.rowType === "opening") {
      return {
        instNo: "Total Selling Price",
        dueDate: "",
        monthlyDue: null,
        datePaid: "",
        discount: null,
        amountPaid: null,
        penaltyCharge: null,
        penaltyBalance: null,
        totalMonthlyDue: null,
        tspBalance: j.tspBalance,
        receiptNo: "",
      };
    }
    if (j.rowType === "downpayment_due") {
      return {
        instNo: "Reservation Fee",
        dueDate: "",
        monthlyDue: j.monthlyDue ?? null,
        datePaid: "",
        discount: null,
        amountPaid: null,
        penaltyCharge: null,
        penaltyBalance: j.penaltyBalance || 0,
        totalMonthlyDue: j.monthlyDue ?? null,
        tspBalance: j.tspBalance,
        receiptNo: "",
      };
    }
    if (j.rowType === "installment_due") {
      return {
        instNo: j.instLabel,
        dueDate: j.date,
        monthlyDue: j.monthlyDue ?? null,
        datePaid: "",
        discount: null,
        amountPaid: null,
        penaltyCharge: null,
        penaltyBalance: j.penaltyBalance,
        totalMonthlyDue: j.currentDueBalance,
        tspBalance: j.tspBalance,
        receiptNo: "",
      };
    }
    if (j.rowType === "penalty_charge") {
      return {
        instNo: j.instLabel,
        dueDate: "",
        monthlyDue: null,
        datePaid: "",
        discount: null,
        amountPaid: null,
        penaltyCharge: j.penaltyCharged ?? null,
        penaltyBalance: j.penaltyBalance,
        totalMonthlyDue: j.currentDueBalance,
        tspBalance: j.tspBalance,
        receiptNo: "",
      };
    }
    return {
      instNo: j.instLabel,
      dueDate: "",
      monthlyDue: null,
      datePaid: j.date,
      discount: null,
      amountPaid: j.amountPaid ?? null,
      penaltyCharge: j.penaltyPaid ? j.penaltyPaid : null,
      penaltyBalance: j.penaltyBalance,
      totalMonthlyDue: j.currentDueBalance,
      tspBalance: j.tspBalance,
      receiptNo: j.receiptNo || "",
    };
  });

  return {
    meta: {
      companyName: "FIRST DAVAO MILLENNIUM PROPERTY VENTURES SERVICES, INC.",
      companyAddress: "No. 59 FDM Bldg., Bolton Ext., Brgy. 1-A, Davao City",
      title: "Statement of Account",
      asOfDate,
      accountName: ledger.client?.fullName || "—",
      address: ledger.client?.address || "Davao City",
      contactNo: ledger.client?.contactNumber || "—",
      referredBy: ledger.client?.referredBy || "—",
      projectArea: ledger.property?.projectArea || "—",
      blockNo: String(ledger.property?.blockNumber ?? "—"),
      lotNo: String(ledger.property?.lotNumber ?? "—"),
      lotArea: String(ledger.property?.lotArea ?? "—"),
      pricePerSqm: ledger.property?.pricePerSqm ? String(ledger.property.pricePerSqm) : "—",
      ctsDate: ledger.firstDueDate,
      terms: ledger.termMonths,
      endOfContract: maturityDate,
      tsp: ledger.contractPrice,
      monthlyInstallment: ledger.monthlyAmortization,
    },
    rows,
    summary: {
      tsp: ledger.contractPrice,
      paidDuringContract: +paidDuringContract.toFixed(2),
      paidAfterContract: +paidAfterContract.toFixed(2),
      totalPaid,
      principalBalance: summary.tspOutstandingBalance,
      penaltiesDuringContract: +penaltiesDuringContract.toFixed(2),
      penaltiesAfterContract: +penaltiesAfterContract.toFixed(2),
      totalPenalties: summary.totalPenaltyDue,
      totalAmountDue: summary.totalPayableNow,
      signatoryName: "ALEX M. SANTOS",
      signatoryTitle: "Accounting Head",
    },
  };
}

export async function exportLedgerToExcel(
  ledger: Ledger,
  summary: LedgerSummary,
  asOfDate: string
): Promise<void> {
  const model = buildExcelSoaModel(ledger, summary, asOfDate);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Statement of Account", {
    views: [{ showGridLines: true }],
  });

  ws.columns = [
    { width: 12 },
    { width: 14 },
    { width: 19 },
    { width: 14 },
    { width: 13 },
    { width: 17 },
    { width: 17 },
    { width: 17 },
    { width: 19 },
    { width: 19 },
    { width: 16 },
  ];

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
  };

  ws.mergeCells("A1:K1");
  const cellA1 = ws.getCell("A1");
  cellA1.value = model.meta.companyName;
  cellA1.font = { name: "Arial", size: 13, bold: true };
  cellA1.alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells("A2:K2");
  const cellA2 = ws.getCell("A2");
  cellA2.value = model.meta.companyAddress;
  cellA2.font = { name: "Arial", size: 9 };
  cellA2.alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells("A4:K4");
  const cellA4 = ws.getCell("A4");
  cellA4.value = model.meta.title;
  cellA4.font = { name: "Arial", size: 13, bold: true };
  cellA4.alignment = { horizontal: "center", vertical: "middle" };

  ws.getCell("E5").value = "As of:";
  ws.getCell("E5").font = { name: "Arial", size: 9, italic: true };
  ws.getCell("E5").alignment = { horizontal: "right" };
  ws.getCell("F5").value = formatDate(asOfDate);
  ws.getCell("F5").font = { name: "Arial", size: 9, bold: true };
  ws.getCell("F5").alignment = { horizontal: "left" };

  const metaLeft = [
    { r: 7, label: "Account Name:", val: model.meta.accountName, bold: true },
    { r: 8, label: "Address:", val: model.meta.address },
    { r: 9, label: "Contact No.:", val: model.meta.contactNo },
    { r: 10, label: "Referred by:", val: model.meta.referredBy },
    { r: 12, label: "Project Area:", val: model.meta.projectArea },
    { r: 13, label: "Block No.:", val: model.meta.blockNo },
    { r: 14, label: "Lot No.:", val: model.meta.lotNo },
    { r: 15, label: "Lot Area (Sqm):", val: model.meta.lotArea },
    { r: 16, label: "Price per Sqm", val: model.meta.pricePerSqm },
  ];

  metaLeft.forEach((m) => {
    ws.getCell(`A${m.r}`).value = m.label;
    ws.getCell(`A${m.r}`).font = { name: "Arial", size: 9, bold: true };
    ws.getCell(`C${m.r}`).value = m.val;
    ws.getCell(`C${m.r}`).font = { name: "Arial", size: 9, bold: !!m.bold };
  });

  const metaRight = [
    { r: 12, label: "CTS Date:", val: formatDate(model.meta.ctsDate) },
    { r: 13, label: "Terms (Month):", val: model.meta.terms },
    { r: 14, label: "End of Contract:", val: formatDate(model.meta.endOfContract) },
    { r: 15, label: "Total Selling Price(TSP):", val: model.meta.tsp, isNum: true },
    { r: 16, label: "Monthly Installment:", val: model.meta.monthlyInstallment, isNum: true },
  ];

  metaRight.forEach((m) => {
    ws.getCell(`H${m.r}`).value = m.label;
    ws.getCell(`H${m.r}`).font = { name: "Arial", size: 9, bold: true };
    const vCell = ws.getCell(`J${m.r}`);
    vCell.value = m.val;
    vCell.font = { name: "Arial", size: 9, bold: !!m.isNum };
    if (m.isNum) {
      vCell.numFmt = "#,##0.00";
      vCell.alignment = { horizontal: "right" };
    }
  });

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

  const headerRow = ws.getRow(18);
  headerRow.values = headers;
  headerRow.height = 26;
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { name: "Arial", size: 9, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF2F2F2" },
    };
    cell.border = thinBorder;
  });

  let currentRowIdx = 19;

  model.rows.forEach((r) => {
    const row = ws.getRow(currentRowIdx);
    row.values = [
      r.instNo,
      r.dueDate ? formatDate(r.dueDate) : "",
      r.monthlyDue !== null ? r.monthlyDue : "",
      r.datePaid ? formatDate(r.datePaid) : "",
      r.discount !== null ? r.discount : "",
      r.amountPaid !== null ? r.amountPaid : "",
      r.penaltyCharge !== null ? r.penaltyCharge : "",
      r.penaltyBalance !== null ? r.penaltyBalance : "",
      r.totalMonthlyDue !== null ? r.totalMonthlyDue : "",
      r.tspBalance !== null ? r.tspBalance : "",
      r.receiptNo,
    ];

    for (let c = 1; c <= 11; c++) {
      const cell = row.getCell(c);
      cell.border = thinBorder;
      cell.font = { name: "Arial", size: 9 };

      if ([3, 5, 6, 7, 8, 9, 10].includes(c)) {
        if (typeof cell.value === "number") {
          cell.numFmt = "#,##0.00";
          cell.alignment = { horizontal: "right", vertical: "middle" };
        }
      } else {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      }

      if (c === 7 && typeof cell.value === "number" && cell.value > 0) {
        cell.font = { name: "Arial", size: 9, color: { argb: "FFFF0000" } };
      }
    }

    currentRowIdx++;
  });

  currentRowIdx += 2;

  const sumRows: { label: string; sub?: string; valF?: number; valG?: number; isTotal?: boolean; isDouble?: boolean }[] = [
    { label: "Total Selling Price", valG: model.summary.tsp },
    { label: "Total Amount Paid" },
    { label: "", sub: "During Contract Period", valF: model.summary.paidDuringContract },
    { label: "", sub: "After Contract Period", valF: model.summary.paidAfterContract, valG: model.summary.totalPaid },
    { label: "Balance", valG: model.summary.principalBalance },
    { label: "Add: Penalties" },
    { label: "", sub: "During Contract Period", valF: model.summary.penaltiesDuringContract },
    { label: "", sub: "After Contract Period", valF: model.summary.penaltiesAfterContract, valG: model.summary.totalPenalties },
    { label: "Total Amount Due", valG: model.summary.totalAmountDue, isTotal: true, isDouble: true },
  ];

  sumRows.forEach((s) => {
    const row = ws.getRow(currentRowIdx);
    if (s.label) {
      const dCell = row.getCell("D");
      dCell.value = s.label;
      dCell.font = { name: "Arial", size: s.isTotal ? 10 : 9, bold: true };
    }
    if (s.sub) {
      const dCell = row.getCell("D");
      dCell.value = `   ${s.sub}`;
      dCell.font = { name: "Arial", size: 9 };
    }
    if (s.valF !== undefined) {
      const fCell = row.getCell("F");
      fCell.value = s.valF;
      fCell.font = { name: "Arial", size: 9 };
      fCell.numFmt = "#,##0.00";
      fCell.alignment = { horizontal: "right" };
    }
    if (s.valG !== undefined) {
      const gCell = row.getCell("G");
      gCell.value = s.valG;
      gCell.font = { name: "Arial", size: s.isTotal ? 10 : 9, bold: true };
      gCell.numFmt = "#,##0.00";
      gCell.alignment = { horizontal: "right" };

      if (s.isDouble) {
        gCell.border = {
          top: { style: "thin" },
          bottom: { style: "double" },
        };
      }
    }
    currentRowIdx++;
  });

  currentRowIdx += 2;
  const sigNameCell = ws.getCell(`H${currentRowIdx}`);
  sigNameCell.value = model.summary.signatoryName;
  sigNameCell.font = { name: "Arial", size: 9, bold: true };
  sigNameCell.alignment = { horizontal: "center" };
  sigNameCell.border = { top: { style: "thin", color: { argb: "FF000000" } } };

  const sigTitleCell = ws.getCell(`H${currentRowIdx + 1}`);
  sigTitleCell.value = model.summary.signatoryTitle;
  sigTitleCell.font = { name: "Arial", size: 9 };
  sigTitleCell.alignment = { horizontal: "center" };

  const safeName = (model.meta.accountName || "Account").replace(/[^a-zA-Z0-9_-]/g, "_");
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `SOA-${safeName}-${asOfDate}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
