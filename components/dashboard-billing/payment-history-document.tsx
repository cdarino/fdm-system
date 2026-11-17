import React from "react";
import { Ledger } from "@/lib/types/billing";
import {
  buildPaymentHistoryHeader,
  formatPaymentHistoryAmount,
  formatPaymentHistoryDate,
} from "@/lib/reports/pdf-payment-history";

interface PaymentHistoryDocumentProps {
  ledger: Ledger;
  generatedAt?: Date;
}

export function PaymentHistoryDocument({
  ledger,
  generatedAt = new Date(),
}: PaymentHistoryDocumentProps) {
  const { companyName, reportTitle, subtitle } = buildPaymentHistoryHeader(ledger);

  const hours = generatedAt.getHours();
  const minutes = generatedAt.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  const timeStr = `${displayHours}:${minutes} ${ampm}`;

  const mm = (generatedAt.getMonth() + 1).toString().padStart(2, "0");
  const dd = generatedAt.getDate().toString().padStart(2, "0");
  const yy = generatedAt.getFullYear().toString().slice(-2);
  const dateStr = `${mm}/${dd}/${yy}`;

  const sortedPayments = [...(ledger.payments || [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const totalAmount = sortedPayments.reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0
  );

  return (
    <div
      style={{
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
      className="bg-white text-black p-8 sm:p-12 text-[9pt] max-w-4xl mx-auto print:p-0 print:max-w-none print:w-full leading-tight min-h-[600px] flex flex-col justify-between"
    >
      <div>
        {/* Top-left print timestamp & Centered company heading matching QuickBooks */}
        <div className="relative mb-6">
          <div className="absolute left-0 top-0 text-[8pt] text-black space-y-0.5">
            <div>{timeStr}</div>
            <div>{dateStr}</div>
          </div>
          <div className="text-center space-y-1">
            <div className="text-[11pt] text-black font-normal">{companyName}</div>
            <div className="text-[11pt] font-bold text-black">{reportTitle}</div>
            <div className="text-[10pt] text-black">{subtitle}</div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="mt-4">
          <table className="w-full border-collapse text-[8.5pt]">
            <thead>
              <tr className="border-t border-b border-black text-left font-bold">
                <th className="py-1 px-1 font-bold w-24">Type</th>
                <th className="py-1 px-1 font-bold w-44">Num</th>
                <th className="py-1 px-1 font-bold w-28 text-left">Date</th>
                <th className="py-1 px-1 font-bold">Account</th>
                <th className="py-1 px-1 font-bold text-right w-36">Amount</th>
              </tr>
            </thead>
            <tbody>
              {sortedPayments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-muted-foreground italic">
                    No payment transactions recorded.
                  </td>
                </tr>
              ) : (
                sortedPayments.map((p, idx) => (
                  <tr key={p.id || idx} className="hover:bg-neutral-50 print:hover:bg-transparent">
                    <td className="py-1 px-1">Payment</td>
                    <td className="py-1 px-1 font-mono text-[8pt] truncate max-w-[180px]">
                      {p.receiptNo || "Payment"}
                    </td>
                    <td className="py-1 px-1">{formatPaymentHistoryDate(p.date)}</td>
                    <td className="py-1 px-1">Undeposited Funds</td>
                    <td className="py-1 px-1 text-right font-mono font-medium">
                      {formatPaymentHistoryAmount(p.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {sortedPayments.length > 0 && (
              <tfoot>
                <tr className="border-t border-black font-bold">
                  <td colSpan={4} className="py-1.5 px-1"></td>
                  <td className="py-1.5 px-1 text-right font-mono text-[9pt]">
                    {formatPaymentHistoryAmount(totalAmount)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Page footer */}
      <div className="pt-8 text-right text-[8pt] text-black">
        Page 1 of 1
      </div>
    </div>
  );
}

export default PaymentHistoryDocument;
