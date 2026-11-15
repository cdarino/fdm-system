import React from "react";
import { buildExcelSoaModel } from "@/lib/billing/export-excel";
import { formatCurrency, formatDate } from "@/lib/billing/ledger-engine";
import { Ledger, LedgerSummary } from "@/lib/types/billing";

interface ExcelSoaDocumentProps {
  ledger: Ledger;
  summary: LedgerSummary;
  asOfDate: string;
}

export function ExcelSoaDocument({
  ledger,
  summary,
  asOfDate,
}: ExcelSoaDocumentProps) {
  const model = buildExcelSoaModel(ledger, summary, asOfDate);

  return (
    <div
      style={{
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
      className="bg-white text-black p-6 sm:p-10 text-[9pt] max-w-6xl mx-auto print:p-0 print:max-w-none print:w-full leading-normal"
    >
      {/* Title & Organization Header matching Excel Rows 1-5 */}
      <div className="text-center space-y-1 mb-4">
        <div className="text-[12pt] font-bold uppercase tracking-wider text-black">
          {model.meta.companyName}
        </div>
        <div className="text-[8.5pt] text-black">
          {model.meta.companyAddress}
        </div>
        <div className="text-[12pt] font-bold text-black pt-2 tracking-wide uppercase">
          {model.meta.title}
        </div>
        <div className="text-[9pt] italic text-black">
          As of: <span className="font-bold not-italic">{formatDate(asOfDate)}</span>
        </div>
      </div>

      {/* Metadata Section matching Excel Rows 7-16 spreadsheet layout */}
      <div className="grid grid-cols-12 gap-y-1 gap-x-4 text-[8.5pt] mb-4 pb-2">
        <div className="col-span-7 space-y-1">
          <div className="grid grid-cols-12">
            <span className="col-span-4 font-bold">Account Name:</span>
            <span className="col-span-8 font-bold">{model.meta.accountName}</span>
          </div>
          <div className="grid grid-cols-12">
            <span className="col-span-4 font-bold">Address:</span>
            <span className="col-span-8">{model.meta.address}</span>
          </div>
          <div className="grid grid-cols-12">
            <span className="col-span-4 font-bold">Contact No.:</span>
            <span className="col-span-8">{model.meta.contactNo}</span>
          </div>
          <div className="grid grid-cols-12">
            <span className="col-span-4 font-bold">Referred by:</span>
            <span className="col-span-8">{model.meta.referredBy}</span>
          </div>
          <div className="pt-1.5 grid grid-cols-12">
            <span className="col-span-4 font-bold">Project Area:</span>
            <span className="col-span-8">{model.meta.projectArea}</span>
          </div>
          <div className="grid grid-cols-12">
            <span className="col-span-4 font-bold">Block No.:</span>
            <span className="col-span-2">{model.meta.blockNo}</span>
            <span className="col-span-2 font-bold text-right pr-2">Lot No.:</span>
            <span className="col-span-4">{model.meta.lotNo}</span>
          </div>
          <div className="grid grid-cols-12">
            <span className="col-span-4 font-bold">Lot Area (Sqm):</span>
            <span className="col-span-8">{model.meta.lotArea}</span>
          </div>
          <div className="grid grid-cols-12">
            <span className="col-span-4 font-bold">Price per Sqm:</span>
            <span className="col-span-8">{model.meta.pricePerSqm}</span>
          </div>
        </div>

        <div className="col-span-5 space-y-1">
          <div className="grid grid-cols-12">
            <span className="col-span-6 font-bold">CTS Date:</span>
            <span className="col-span-6 text-right">{formatDate(model.meta.ctsDate)}</span>
          </div>
          <div className="grid grid-cols-12">
            <span className="col-span-6 font-bold">Terms (Month):</span>
            <span className="col-span-6 text-right font-mono">{model.meta.terms}</span>
          </div>
          <div className="grid grid-cols-12">
            <span className="col-span-6 font-bold">End of Contract:</span>
            <span className="col-span-6 text-right">{formatDate(model.meta.endOfContract)}</span>
          </div>
          <div className="grid grid-cols-12 pt-1.5">
            <span className="col-span-6 font-bold">Total Selling Price (TSP):</span>
            <span className="col-span-6 text-right font-mono font-bold">
              {formatCurrency(model.meta.tsp)}
            </span>
          </div>
          <div className="grid grid-cols-12">
            <span className="col-span-6 font-bold">Monthly Installment:</span>
            <span className="col-span-6 text-right font-mono font-bold">
              {formatCurrency(model.meta.monthlyInstallment)}
            </span>
          </div>
        </div>
      </div>

      {/* 11-Column Spreadsheet Table matching Excel Rows 18+ */}
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-left border-collapse border border-black text-[8pt] leading-tight">
          <thead>
            <tr className="bg-[#F2F2F2] text-black font-bold">
              <th className="py-2 px-1 border border-black text-center w-12">Inst. No</th>
              <th className="py-2 px-1 border border-black text-center w-20">Due Date</th>
              <th className="py-2 px-1 border border-black text-center w-24">Monthly Installment Due</th>
              <th className="py-2 px-1 border border-black text-center w-20">Date Paid</th>
              <th className="py-2 px-1 border border-black text-center w-20">Before Due Discount</th>
              <th className="py-2 px-1 border border-black text-center w-24">Amount Paid</th>
              <th className="py-2 px-1 border border-black text-center w-24">Penalty Charge (Paid)</th>
              <th className="py-2 px-1 border border-black text-center w-24">Penalty Balance</th>
              <th className="py-2 px-1 border border-black text-center w-28">Total Monthly Installment Due</th>
              <th className="py-2 px-1 border border-black text-center w-28">TSP Outstanding Balance</th>
              <th className="py-2 px-1 border border-black text-center w-24">Invoice/ Receipt No</th>
            </tr>
          </thead>
          <tbody>
            {model.rows.map((r, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="py-1 px-1 border border-black text-center font-mono">{r.instNo}</td>
                <td className="py-1 px-1 border border-black text-center whitespace-nowrap">
                  {r.dueDate ? formatDate(r.dueDate) : ""}
                </td>
                <td className="py-1 px-1 border border-black text-right font-mono tabular-nums">
                  {r.monthlyDue !== null ? formatCurrency(r.monthlyDue) : ""}
                </td>
                <td className="py-1 px-1 border border-black text-center whitespace-nowrap">
                  {r.datePaid ? formatDate(r.datePaid) : ""}
                </td>
                <td className="py-1 px-1 border border-black text-right font-mono tabular-nums">
                  {r.discount !== null ? formatCurrency(r.discount) : ""}
                </td>
                <td className="py-1 px-1 border border-black text-right font-mono tabular-nums font-semibold">
                  {r.amountPaid !== null ? formatCurrency(r.amountPaid) : ""}
                </td>
                <td
                  className={`py-1 px-1 border border-black text-right font-mono tabular-nums ${
                    r.penaltyCharge && r.penaltyCharge > 0 ? "text-red-600 font-bold" : ""
                  }`}
                >
                  {r.penaltyCharge !== null ? formatCurrency(r.penaltyCharge) : ""}
                </td>
                <td className="py-1 px-1 border border-black text-right font-mono tabular-nums">
                  {r.penaltyBalance !== null ? formatCurrency(r.penaltyBalance) : ""}
                </td>
                <td className="py-1 px-1 border border-black text-right font-mono tabular-nums font-medium">
                  {r.totalMonthlyDue !== null ? formatCurrency(r.totalMonthlyDue) : ""}
                </td>
                <td className="py-1 px-1 border border-black text-right font-mono tabular-nums font-semibold">
                  {r.tspBalance !== null ? formatCurrency(r.tspBalance) : ""}
                </td>
                <td className="py-1 px-1 border border-black text-center font-mono">
                  {r.receiptNo || ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Accounting Summary & Signatory Section matching Excel Rows 245-262 */}
      <div className="pt-3 text-[8.5pt]">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-8 col-start-2 space-y-1">
            <div className="grid grid-cols-12 py-0.5">
              <span className="col-span-7 font-bold">Total Selling Price</span>
              <span className="col-span-5 text-right font-mono font-bold">
                {formatCurrency(model.summary.tsp)}
              </span>
            </div>

            <div className="py-0.5">
              <div className="font-bold">Total Amount Paid</div>
              <div className="grid grid-cols-12 pt-0.5">
                <span className="col-span-7 pl-6">During Contract Period</span>
                <span className="col-span-3 text-right font-mono">
                  {formatCurrency(model.summary.paidDuringContract)}
                </span>
                <span className="col-span-2"></span>
              </div>
              <div className="grid grid-cols-12 pt-0.5">
                <span className="col-span-7 pl-6">After Contract Period</span>
                <span className="col-span-3 text-right font-mono">
                  {formatCurrency(model.summary.paidAfterContract)}
                </span>
                <span className="col-span-2 text-right font-mono font-bold">
                  {formatCurrency(model.summary.totalPaid)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-12 py-0.5 border-t border-slate-200">
              <span className="col-span-7 font-bold">Balance</span>
              <span className="col-span-5 text-right font-mono font-bold">
                {formatCurrency(model.summary.principalBalance)}
              </span>
            </div>

            <div className="py-0.5 border-t border-slate-200">
              <div className="font-bold">Add: Penalties</div>
              <div className="grid grid-cols-12 pt-0.5">
                <span className="col-span-7 pl-6">During Contract Period</span>
                <span className="col-span-3 text-right font-mono">
                  {formatCurrency(model.summary.penaltiesDuringContract)}
                </span>
                <span className="col-span-2"></span>
              </div>
              <div className="grid grid-cols-12 pt-0.5">
                <span className="col-span-7 pl-6">After Contract Period</span>
                <span className="col-span-3 text-right font-mono">
                  {formatCurrency(model.summary.penaltiesAfterContract)}
                </span>
                <span className="col-span-2 text-right font-mono font-bold text-red-600">
                  {formatCurrency(model.summary.totalPenalties)}
                </span>
              </div>
            </div>

            {/* Total Amount Due with Accounting Double Bottom Border */}
            <div className="grid grid-cols-12 items-center pt-2 pb-1 border-t border-black border-b-[3px] border-b-double border-b-black font-bold text-[9pt]">
              <span className="col-span-7">Total Amount Due</span>
              <span className="col-span-5 text-right font-mono text-[9.5pt]">
                {formatCurrency(model.summary.totalAmountDue)}
              </span>
            </div>
          </div>
        </div>

        {/* Signatory Section matching Excel Row 260 */}
        <div className="pt-10 flex justify-end pr-8">
          <div className="w-56 text-center">
            <div className="border-t border-black pt-1 font-bold text-[9pt]">
              {model.summary.signatoryName}
            </div>
            <div className="text-[8pt] text-black">
              {model.summary.signatoryTitle}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExcelSoaDocument;
