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
      style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
      className="bg-white text-black p-6 sm:p-10 text-[9pt] max-w-5xl mx-auto print:p-0 print:max-w-none print:w-full leading-normal"
    >
      {/* Header matching Excel Rows 1-5 */}
      <div className="text-center space-y-0.5 mb-5 pb-3">
        <div className="text-[13pt] font-bold uppercase tracking-wide text-black">
          {model.meta.companyName}
        </div>
        <div className="text-[9pt] text-slate-700">
          {model.meta.companyAddress}
        </div>
        <div className="text-[13pt] font-bold text-black pt-2 tracking-wide uppercase">
          {model.meta.title}
        </div>
        <div className="text-[9.5pt] italic text-slate-600">
          As of: <span className="font-bold not-italic text-black">{formatDate(asOfDate)}</span>
        </div>
      </div>

      {/* Contract Metadata Grid matching Excel Rows 7-16 */}
      <div className="grid grid-cols-2 gap-x-8 text-[9pt] mb-5 border border-black p-3 bg-white">
        <div className="space-y-1">
          <div className="flex justify-between py-0.5 border-b border-slate-200">
            <span className="font-bold">Account Name:</span>
            <span className="font-bold">{model.meta.accountName}</span>
          </div>
          <div className="flex justify-between py-0.5 border-b border-slate-200">
            <span className="font-bold">Address:</span>
            <span>{model.meta.address}</span>
          </div>
          <div className="flex justify-between py-0.5 border-b border-slate-200">
            <span className="font-bold">Contact No.:</span>
            <span>{model.meta.contactNo}</span>
          </div>
          <div className="flex justify-between py-0.5 border-b border-slate-200">
            <span className="font-bold">Referred by:</span>
            <span>{model.meta.referredBy}</span>
          </div>
          <div className="flex justify-between py-0.5 border-b border-slate-200">
            <span className="font-bold">Project Area:</span>
            <span>{model.meta.projectArea}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 py-0.5">
            <div className="flex justify-between">
              <span className="font-bold">Block No.:</span>
              <span>{model.meta.blockNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">Lot No.:</span>
              <span>{model.meta.lotNo}</span>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between py-0.5 border-b border-slate-200">
            <span className="font-bold">CTS Date:</span>
            <span>{formatDate(model.meta.ctsDate)}</span>
          </div>
          <div className="flex justify-between py-0.5 border-b border-slate-200">
            <span className="font-bold">Terms (Month):</span>
            <span className="font-mono">{model.meta.terms}</span>
          </div>
          <div className="flex justify-between py-0.5 border-b border-slate-200">
            <span className="font-bold">End of Contract:</span>
            <span>{formatDate(model.meta.endOfContract)}</span>
          </div>
          <div className="flex justify-between py-0.5 border-b border-slate-200">
            <span className="font-bold">Total Selling Price (TSP):</span>
            <span className="font-mono font-bold">{formatCurrency(model.meta.tsp)}</span>
          </div>
          <div className="flex justify-between py-0.5 border-b border-slate-200">
            <span className="font-bold">Monthly Installment:</span>
            <span className="font-mono font-bold">{formatCurrency(model.meta.monthlyInstallment)}</span>
          </div>
        </div>
      </div>

      {/* 11-Column Table matching Excel Row 18+ */}
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-left border-collapse border border-black text-[9pt] leading-tight">
          <thead>
            <tr className="bg-slate-100 text-black font-bold">
              <th className="py-2 px-1.5 border border-black text-center w-12">Inst. No</th>
              <th className="py-2 px-1.5 border border-black text-center w-20">Due Date</th>
              <th className="py-2 px-1.5 border border-black text-right w-24">Monthly Due</th>
              <th className="py-2 px-1.5 border border-black text-center w-20">Date Paid</th>
              <th className="py-2 px-1.5 border border-black text-right w-16">Discount</th>
              <th className="py-2 px-1.5 border border-black text-right w-24">Amount Paid</th>
              <th className="py-2 px-1.5 border border-black text-right w-24">Penalty Chg</th>
              <th className="py-2 px-1.5 border border-black text-right w-24">Pen Balance</th>
              <th className="py-2 px-1.5 border border-black text-right w-24">Total Monthly Due</th>
              <th className="py-2 px-1.5 border border-black text-right w-28">TSP Balance</th>
              <th className="py-2 px-1.5 border border-black text-center w-24">OR / CR No</th>
            </tr>
          </thead>
          <tbody>
            {model.rows.map((r, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="py-1 px-1.5 border border-black text-center font-mono">{r.instNo}</td>
                <td className="py-1 px-1.5 border border-black text-center whitespace-nowrap">{r.dueDate ? formatDate(r.dueDate) : ""}</td>
                <td className="py-1 px-1.5 border border-black text-right font-mono tabular-nums">{r.monthlyDue !== null ? formatCurrency(r.monthlyDue) : ""}</td>
                <td className="py-1 px-1.5 border border-black text-center whitespace-nowrap">{r.datePaid ? formatDate(r.datePaid) : ""}</td>
                <td className="py-1 px-1.5 border border-black text-right font-mono tabular-nums">{r.discount !== null ? formatCurrency(r.discount) : ""}</td>
                <td className="py-1 px-1.5 border border-black text-right font-mono tabular-nums font-semibold">{r.amountPaid !== null ? formatCurrency(r.amountPaid) : ""}</td>
                <td className={`py-1 px-1.5 border border-black text-right font-mono tabular-nums ${r.penaltyCharge ? "text-red-600 font-bold" : ""}`}>
                  {r.penaltyCharge !== null ? formatCurrency(r.penaltyCharge) : ""}
                </td>
                <td className="py-1 px-1.5 border border-black text-right font-mono tabular-nums">{r.penaltyBalance !== null ? formatCurrency(r.penaltyBalance) : ""}</td>
                <td className="py-1 px-1.5 border border-black text-right font-mono tabular-nums font-medium">{r.totalMonthlyDue !== null ? formatCurrency(r.totalMonthlyDue) : ""}</td>
                <td className="py-1 px-1.5 border border-black text-right font-mono tabular-nums font-semibold">{r.tspBalance !== null ? formatCurrency(r.tspBalance) : ""}</td>
                <td className="py-1 px-1.5 border border-black text-center font-mono">{r.receiptNo || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Block matching Excel Rows 245-257 */}
      <div className="grid grid-cols-2 gap-8 pt-4 text-[9pt] border-t border-slate-300">
        <div className="border border-black p-3 space-y-1.5 bg-white">
          <div className="flex justify-between py-0.5 border-b border-slate-200">
            <span className="font-bold">Total Selling Price:</span>
            <span className="font-mono font-bold">{formatCurrency(model.summary.tsp)}</span>
          </div>

          <div className="py-0.5">
            <div className="font-bold mb-0.5">Total Amount Paid:</div>
            <div className="pl-4 space-y-0.5 text-slate-700">
              <div className="flex justify-between">
                <span>During Contract Period:</span>
                <span className="font-mono">{formatCurrency(model.summary.paidDuringContract)}</span>
              </div>
              <div className="flex justify-between">
                <span>After Contract Period:</span>
                <span className="font-mono">{formatCurrency(model.summary.paidAfterContract)}</span>
              </div>
              <div className="flex justify-between font-bold text-black pt-1 border-t border-slate-200">
                <span>Total Collected:</span>
                <span className="font-mono">{formatCurrency(model.summary.totalPaid)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between py-1 border-t border-slate-200">
            <span className="font-bold">Balance (Principal):</span>
            <span className="font-mono font-bold">{formatCurrency(model.summary.principalBalance)}</span>
          </div>

          <div className="py-0.5 border-t border-slate-200">
            <div className="font-bold mb-0.5">Add: Penalties:</div>
            <div className="pl-4 space-y-0.5 text-slate-700">
              <div className="flex justify-between">
                <span>During Contract Period:</span>
                <span className="font-mono">{formatCurrency(model.summary.penaltiesDuringContract)}</span>
              </div>
              <div className="flex justify-between">
                <span>After Contract Period:</span>
                <span className="font-mono">{formatCurrency(model.summary.penaltiesAfterContract)}</span>
              </div>
              <div className="flex justify-between font-bold text-black pt-1 border-t border-slate-200">
                <span>Total Penalties Due:</span>
                <span className="font-mono">{formatCurrency(model.summary.totalPenalties)}</span>
              </div>
            </div>
          </div>

          {/* Total Amount Due with Accounting Double Bottom Border */}
          <div className="flex justify-between items-center py-2 px-2 bg-slate-50 border-t border-black border-b-4 border-double border-black font-bold text-[10pt]">
            <span>TOTAL AMOUNT DUE:</span>
            <span className="font-mono text-[11pt] text-black">{formatCurrency(model.summary.totalAmountDue)}</span>
          </div>
        </div>

        {/* Signatory Section */}
        <div className="flex flex-col justify-end items-center pb-4 text-center">
          <div className="w-64">
            <div className="text-[9pt] text-slate-500 mb-14">Certified Correct:</div>
            <div className="font-bold text-[9pt] uppercase text-black border-t-2 border-black pt-1 tracking-wider">
              {model.summary.signatoryName}
            </div>
            <div className="text-[9pt] text-slate-700 font-medium">
              {model.summary.signatoryTitle}
            </div>
            <div className="text-[8pt] text-slate-500 mt-0.5">
              Credit & Collection Department
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExcelSoaDocument;
