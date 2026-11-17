"use server";

import { createScope } from "@/lib/actions/action-handler";
import type { ActionResult } from "@/lib/actions/action-result";
import type { SupabaseClient } from "@supabase/supabase-js";
import { forfeitPropertyLot } from "@/lib/actions/properties";
import { evaluateLedger } from "@/lib/billing/ledger-engine";
import {
  Ledger,
  LedgerSummary,
  PaymentRecord,
  OverdueNoticeEvent,
  ContractPolicies,
  OverdueNoticeStage,
  LedgerTitleInfo,
} from "@/lib/types/billing";
import type { TitleStatus } from "@/lib/types/title";
import type { LedgerAccount } from "@/lib/types/property";
import { uuidSchema } from "@/lib/validations/client";
import {
  createBillingLedgerSchema,
  postBillingPaymentSchema,
  voidBillingPaymentSchema,
  updateBillingPoliciesSchema,
  recordBillingNoticeSchema,
  updateBillingNoticeSchema,
  forfeitBillingAccountSchema,
  uploadBillingClearanceDocumentSchema,
} from "@/lib/validations/billing";
import {
  uploadClientDocumentObject,
  removeClientDocumentObject,
} from "@/lib/storage/client-documents";
import { CLIENT_DOCUMENT_COLUMNS, toClientDocument } from "@/lib/attachments";
import type { ClientDocument } from "@/lib/types/client";
import type { FileAttachment } from "@/lib/types/title";

const billing = createScope(["billing.read"]);
const billingCreate = billing.extend(["billing.create"]);
const billingUpdate = billing.extend(["billing.update"]);
const billingDelete = billing.extend(["billing.delete"]);

function getTodayDateStr(): string {
  return new Date().toISOString().split("T")[0];
}

interface RawParty {
  client_id: string;
  role: string;
  is_primary: boolean;
  client: {
    client_id: string;
    full_name: string;
    contact_number?: string | null;
    address?: string | null;
    referred_by?: string | null;
    tin_number?: string | null;
    civil_status?: string | null;
    spouse_name?: string | null;
    status?: string | null;
    contact_info?: { type: string; value: string; is_primary?: boolean }[] | null;
  } | null;
}

interface RawLandTitle {
  title_id: string;
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
}

interface RawProperty {
  property_id: string;
  location?: string | null;
  block_number: number;
  lot_number: number;
  area_size: number;
  price_per_sqm: number;
  title_number?: string | null;
  status?: string | null;
  project_area?: {
    name: string;
  } | null;
  land_title?: RawLandTitle | RawLandTitle[] | null;
}

interface RawPayment {
  payment_id: string;
  payment_date: string;
  amount: number;
  receipt_number: string;
  payment_method: "cash" | "check" | "bank_transfer";
  waive_penalty: boolean;
  notes?: string | null;
}

interface RawNotice {
  notice_id: string;
  stage: OverdueNoticeStage;
  notice_number: number;
  notice_date: string;
  title: string;
  tracking_number?: string | null;
  notes?: string | null;
  overdue_amount: number;
  arrears_principal: number;
  penalty_due: number;
}

interface RawLedgerAccount {
  account_id: string;
  property_id: string;
  total_contract_price: number;
  remaining_balance: number;
  downpayment: number;
  terms_months: number;
  monthly_amortization: number;
  amortization_day: number;
  penalty_rate_percent: number;
  first_due_date: string;
  status: string;
  created_at: string;
  cleared_at: string | null;
  cleared_by: string | null;
  forfeited_at: string | null;
  forfeiture_reason: string | null;
  contract_policies: ContractPolicies | null;
  overdue_notice_stage: OverdueNoticeStage | null;
  parties: RawParty[];
  property: RawProperty | null;
  payments: RawPayment[];
  notices: RawNotice[];
}

// Convert raw database join record into strongly typed Ledger domain entity
function mapRawToLedger(raw: RawLedgerAccount): Ledger {
  const primaryParty = raw.parties?.find((p) => p.is_primary) || raw.parties?.[0];
  const client = {
    clientId: primaryParty?.client?.client_id || "",
    fullName: primaryParty?.client?.full_name || "Unknown Client",
    contactNumber: primaryParty?.client?.contact_number || undefined,
    address: primaryParty?.client?.address || undefined,
    referredBy: primaryParty?.client?.referred_by || undefined,
    tinNumber: primaryParty?.client?.tin_number || undefined,
    civilStatus: primaryParty?.client?.civil_status || undefined,
    spouseName: primaryParty?.client?.spouse_name || undefined,
    status: primaryParty?.client?.status || undefined,
    contactInfo: primaryParty?.client?.contact_info || undefined,
  };

  const property = {
    propertyId: raw.property?.property_id || raw.property_id,
    projectArea: raw.property?.project_area?.name || raw.property?.location || "Unknown Project",
    blockNumber: raw.property?.block_number || 0,
    lotNumber: raw.property?.lot_number || 0,
    lotArea: Number(raw.property?.area_size) || 0,
    pricePerSqm: Number(raw.property?.price_per_sqm) || 0,
    titleNumber: raw.property?.title_number || undefined,
    status: raw.property?.status || undefined,
  };

  const payments: PaymentRecord[] = (raw.payments || []).map((p) => ({
    id: p.payment_id,
    date: p.payment_date,
    amount: Number(p.amount),
    receiptNo: p.receipt_number,
    method: p.payment_method || "cash",
    waivePenalty: Boolean(p.waive_penalty),
    notes: p.notes || undefined,
  }));

  const noticeHistory: OverdueNoticeEvent[] = (raw.notices || []).map((n) => ({
    id: n.notice_id,
    stage: n.stage,
    noticeNumber: n.notice_number,
    date: n.notice_date,
    title: n.title,
    trackingNo: n.tracking_number || undefined,
    notes: n.notes || undefined,
    overdueAmount: Number(n.overdue_amount),
    arrearsPrincipal: Number(n.arrears_principal),
    penaltyDue: Number(n.penalty_due),
  }));

  noticeHistory.sort((a, b) => b.date.localeCompare(a.date));

  const currentStage: OverdueNoticeStage =
    raw.status === "Forfeited"
      ? "forfeited"
      : raw.overdue_notice_stage || noticeHistory[0]?.stage || "none";

  const rawTitle = Array.isArray(raw.property?.land_title)
    ? raw.property?.land_title[0]
    : raw.property?.land_title;

  const titleInfo: LedgerTitleInfo | undefined = rawTitle
    ? {
        titleId: rawTitle.title_id,
        titleNumber: raw.property?.title_number || null,
        status: rawTitle.status as TitleStatus,
        createdAt: rawTitle.created_at || null,
        updatedAt: rawTitle.updated_at || null,
      }
    : undefined;

  return {
    id: raw.account_id,
    client,
    property,
    contractPrice: Number(raw.total_contract_price),
    downpayment: Number(raw.downpayment || 0),
    termMonths: Number(raw.terms_months) || 36,
    monthlyAmortization: Number(raw.monthly_amortization),
    firstDueDate: raw.first_due_date || (raw.created_at ? raw.created_at.split("T")[0] : getTodayDateStr()),
    dueDay: Number(raw.amortization_day) || 25,
    penaltyRate: Number(raw.penalty_rate_percent) > 1 ? Number(raw.penalty_rate_percent) / 100 : Number(raw.penalty_rate_percent) || 0.035,
    createdAt: raw.created_at ? raw.created_at.split("T")[0] : getTodayDateStr(),
    payments,
    policies: raw.contract_policies || undefined,
    overdueEscalation: {
      currentStage,
      history: noticeHistory,
    },
    status: raw.status,
    clearedAt: raw.cleared_at,
    clearedBy: raw.cleared_by,
    titleInfo,
    forfeitedAt: raw.forfeited_at,
    forfeitureReason: raw.forfeiture_reason,
  };
}

export async function getBillingLedgers(asOfDate?: string): Promise<LedgerSummary[]> {
  return billing.query(async ({ supabase }) => {
    const referenceDate = asOfDate || getTodayDateStr();

    const { data, error } = await supabase
      .from("ledger_account")
      .select(`
        account_id,
        property_id,
        total_contract_price,
        remaining_balance,
        downpayment,
        terms_months,
        monthly_amortization,
        amortization_day,
        penalty_rate_percent,
        first_due_date,
        status,
        created_at,
        cleared_at,
        cleared_by,
        forfeited_at,
        forfeiture_reason,
        contract_policies,
        overdue_notice_stage,
        parties:account_party(
          client_id,
          role,
          is_primary,
          client:client(
            client_id,
            full_name,
            address,
            tin_number,
            civil_status,
            spouse_name,
            status,
            contact_info(type, value, is_primary)
          )
        ),
        property:property_lot(
          property_id,
          location,
          block_number,
          lot_number,
          area_size,
          price_per_sqm,
          title_number,
          status,
          project_area(name),
          land_title(
            title_id,
            status,
            created_at,
            updated_at
          )
        ),
        payments:billing_payment(
          payment_id,
          payment_date,
          amount,
          receipt_number,
          payment_method,
          waive_penalty,
          notes
        ),
        notices:billing_notice_event(
          notice_id,
          stage,
          notice_number,
          notice_date,
          title,
          tracking_number,
          notes,
          overdue_amount,
          arrears_principal,
          penalty_due
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch billing ledgers: ${error.message}`);
    }

    const rawList = (data || []) as unknown as RawLedgerAccount[];
    return rawList.map((raw) => evaluateLedger(mapRawToLedger(raw), referenceDate));
  });
}

export async function getBillingLedgerById(
  accountId: string,
  asOfDate?: string
): Promise<{ ledger: Ledger; summary: LedgerSummary }> {
  return billing.query(async ({ supabase }) => {
    const referenceDate = asOfDate || getTodayDateStr();

    const { data, error } = await supabase
      .from("ledger_account")
      .select(`
        account_id,
        property_id,
        total_contract_price,
        remaining_balance,
        downpayment,
        terms_months,
        monthly_amortization,
        amortization_day,
        penalty_rate_percent,
        first_due_date,
        status,
        created_at,
        cleared_at,
        cleared_by,
        forfeited_at,
        forfeiture_reason,
        contract_policies,
        overdue_notice_stage,
        parties:account_party(
          client_id,
          role,
          is_primary,
          client:client(
            client_id,
            full_name,
            address,
            tin_number,
            civil_status,
            spouse_name,
            status,
            contact_info(type, value, is_primary)
          )
        ),
        property:property_lot(
          property_id,
          location,
          block_number,
          lot_number,
          area_size,
          price_per_sqm,
          title_number,
          status,
          project_area(name),
          land_title(
            title_id,
            status,
            created_at,
            updated_at
          )
        ),
        payments:billing_payment(
          payment_id,
          payment_date,
          amount,
          receipt_number,
          payment_method,
          waive_penalty,
          notes
        ),
        notices:billing_notice_event(
          notice_id,
          stage,
          notice_number,
          notice_date,
          title,
          tracking_number,
          notes,
          overdue_amount,
          arrears_principal,
          penalty_due
        )
      `)
      .eq("account_id", accountId)
      .single();

    if (error || !data) {
      throw new Error(`Billing ledger not found: ${error?.message || "Invalid account ID"}`);
    }

    const ledger = mapRawToLedger(data as unknown as RawLedgerAccount);
    const summary = evaluateLedger(ledger, referenceDate);
    return { ledger, summary };
  });
}

export async function getAvailableClientsAndLots(): Promise<{
  clients: { clientId: string; fullName: string; address?: string }[];
  lots: { propertyId: string; projectArea: string; blockNumber: number; lotNumber: number; lotArea: number; pricePerSqm: number; estimatedPrice: number }[];
}> {
  return billing.query(async ({ supabase }) => {
    const [clientsRes, lotsRes] = await Promise.all([
      supabase.from("client").select("client_id, full_name, address").order("full_name"),
      supabase
        .from("property_lot")
        .select(`
          property_id,
          location,
          block_number,
          lot_number,
          area_size,
          price_per_sqm,
          status,
          project_area(name),
          ledger_accounts:ledger_account(account_id, status)
        `)
        .order("block_number")
        .order("lot_number"),
    ]);

    if (clientsRes.error) throw new Error(clientsRes.error.message);
    if (lotsRes.error) throw new Error(lotsRes.error.message);

    const availableLots = (lotsRes.data || [])
      .filter((l) => {
        const activeAcc = l.ledger_accounts?.some((a) => a.status === "Active");
        return !activeAcc;
      })
      .map((l) => {
        const area = Number(l.area_size) || 0;
        const ppsqm = Number(l.price_per_sqm) || 0;
        const projectAreaName = (l.project_area as { name?: string } | null)?.name || l.location || "Project Area";
        return {
          propertyId: l.property_id,
          projectArea: projectAreaName,
          blockNumber: l.block_number,
          lotNumber: l.lot_number,
          lotArea: area,
          pricePerSqm: ppsqm,
          estimatedPrice: +(area * ppsqm).toFixed(2),
        };
      });

    const clients = (clientsRes.data || []).map((c) => ({
      clientId: c.client_id,
      fullName: c.full_name,
      address: c.address || undefined,
    }));

    return { clients, lots: availableLots };
  });
}

export async function createBillingLedger(
  input: unknown
): Promise<ActionResult<{ accountId: string }>> {
  return billingCreate.run({
    schema: createBillingLedgerSchema,
    input,
    handler: async (validatedInput, { supabase }) => {
      const {
        clientId,
        propertyId,
        contractPrice,
        downpayment,
        termMonths,
        firstDueDate,
        dueDay,
        penaltyRate,
      } = validatedInput;

      // Verify client is active
      const { data: clientRow, error: clientErr } = await supabase
        .from("client")
        .select("status, archived_at")
        .eq("client_id", clientId)
        .maybeSingle<{ status: string; archived_at: string | null }>();

      if (clientErr || !clientRow) {
        throw new Error("Client not found.");
      }
      if (clientRow.status !== "Active" || clientRow.archived_at) {
        throw new Error("Cannot assign property to an inactive or archived client.");
      }

      // Verify no active contract exists on the target lot
      const { data: existingActive } = await supabase
        .from("ledger_account")
        .select("account_id")
        .eq("property_id", propertyId)
        .eq("status", "Active")
        .maybeSingle();

      if (existingActive) {
        throw new Error("This property lot already has an active contract ledger.");
      }

      const financedPrincipal = Math.max(0, contractPrice - downpayment);
      const computedMonthly = termMonths > 0 ? +(financedPrincipal / termMonths).toFixed(2) : 0;

      // Create ledger account record
      const { data: account, error: accErr } = await supabase
        .from("ledger_account")
        .insert({
          property_id: propertyId,
          status: "Active",
          total_contract_price: contractPrice,
          remaining_balance: financedPrincipal,
          downpayment,
          terms_months: termMonths,
          monthly_amortization: computedMonthly,
          first_due_date: firstDueDate,
          amortization_day: dueDay,
          penalty_rate_percent: penaltyRate,
          contract_policies: {},
          overdue_notice_stage: "none",
        })
        .select("account_id")
        .single<{ account_id: string }>();

      if (accErr || !account) {
        throw new Error(`Failed to create ledger account: ${accErr?.message || "Unknown error"}`);
      }

      // Link principal client party
      const { error: partyErr } = await supabase.from("account_party").insert({
        account_id: account.account_id,
        client_id: clientId,
        role: "Principal Buyer",
        ownership_percentage: 100.0,
        is_primary: true,
      });

      if (partyErr) {
        throw new Error(`Failed to attach client to ledger account: ${partyErr.message}`);
      }

      // Update property lot status to Reserved
      await supabase
        .from("property_lot")
        .update({ status: "Reserved" })
        .eq("property_id", propertyId);

      return { accountId: account.account_id };
    },
  });
}

async function assertLedgerEditable(
  accountId: string,
  supabase: SupabaseClient
): Promise<void> {
  const { data: account, error: accErr } = await supabase
    .from("ledger_account")
    .select("account_id, property_id, cleared_at")
    .eq("account_id", accountId)
    .maybeSingle<{ account_id: string; property_id: string; cleared_at: string | null }>();

  if (accErr || !account) {
    throw new Error("Target contract ledger account not found.");
  }

  if (account.property_id) {
    const { data: title, error: titleErr } = await supabase
      .from("land_title")
      .select("title_id, status")
      .eq("property_id", account.property_id)
      .maybeSingle<{ title_id: string; status: string }>();

    if (titleErr) {
      throw new Error(`Failed to check legal title status: ${titleErr.message}`);
    }

    if (title && title.status !== "Cleared by Billing") {
      throw new Error("This ledger account is currently in legal processing and is view-only.");
    }
  }

  if (account.cleared_at) {
    throw new Error(
      "This ledger account has been cleared for legal turnover and is view-only. Revert clearance first to make adjustments."
    );
  }
}

export async function postBillingPayment(
  input: unknown
): Promise<ActionResult<{ paymentId: string }>> {
  return billingCreate.run({
    schema: postBillingPaymentSchema,
    input,
    handler: async (validatedInput, { supabase }) => {
      const {
        accountId,
        paymentDate,
        amount,
        receiptNumber,
        paymentMethod,
        waivePenalty,
        notes,
      } = validatedInput;

      await assertLedgerEditable(accountId, supabase);

      // Insert billing payment row
      const { data, error } = await supabase
        .from("billing_payment")
        .insert({
          account_id: accountId,
          payment_date: paymentDate,
          amount,
          receipt_number: receiptNumber.trim().toUpperCase(),
          payment_method: paymentMethod,
          waive_penalty: Boolean(waivePenalty),
          notes: notes?.trim() || null,
        })
        .select("payment_id")
        .single<{ payment_id: string }>();

      if (error || !data) {
        throw new Error(`Failed to record payment: ${error?.message || "Unknown error"}`);
      }

      return { paymentId: data.payment_id };
    },
  });
}

export async function voidBillingPayment(
  input: unknown
): Promise<ActionResult<{ success: boolean }>> {
  return billingDelete.run({
    schema: voidBillingPaymentSchema,
    input,
    handler: async (validatedInput, { supabase }) => {
      const { paymentId } = validatedInput;

      const { data: payment, error: pErr } = await supabase
        .from("billing_payment")
        .select("account_id")
        .eq("payment_id", paymentId)
        .maybeSingle<{ account_id: string }>();

      if (pErr || !payment) {
        throw new Error("Payment record not found.");
      }

      await assertLedgerEditable(payment.account_id, supabase);

      // Void payment record
      const { error } = await supabase
        .from("billing_payment")
        .delete()
        .eq("payment_id", paymentId);

      if (error) {
        throw new Error(`Failed to void payment: ${error.message}`);
      }

      return { success: true };
    },
  });
}

export async function updateBillingPolicies(
  input: unknown
): Promise<ActionResult<{ success: boolean }>> {
  return billingUpdate.run({
    schema: updateBillingPoliciesSchema,
    input,
    handler: async (validatedInput, { supabase }) => {
      const {
        accountId,
        penaltyRate,
        enableMaturityAmnesty,
        amnestyMonths,
        enablePostMaturityReducedRate,
        postMaturityPenaltyRate,
      } = validatedInput;

      await assertLedgerEditable(accountId, supabase);

      const policies: ContractPolicies = {
        enableMaturityAmnesty,
        amnestyMonths: enableMaturityAmnesty ? amnestyMonths || 12 : undefined,
        enablePostMaturityReducedRate,
        postMaturityPenaltyRate: enablePostMaturityReducedRate
          ? postMaturityPenaltyRate ? +(postMaturityPenaltyRate / 100).toFixed(4) : 0.02
          : undefined,
      };

      // Update policies and penalty rate
      const { error } = await supabase
        .from("ledger_account")
        .update({
          penalty_rate_percent: penaltyRate,
          contract_policies: policies,
        })
        .eq("account_id", accountId);

      if (error) {
        throw new Error(`Failed to update contract policies: ${error.message}`);
      }

      return { success: true };
    },
  });
}

export async function recordBillingNotice(
  input: unknown
): Promise<ActionResult<{ noticeId: string }>> {
  return billingUpdate.run({
    schema: recordBillingNoticeSchema,
    input,
    handler: async (validatedInput, { supabase }) => {
      const {
        accountId,
        stage,
        noticeNumber,
        noticeDate,
        title,
        trackingNumber,
        notes,
        overdueAmount,
        arrearsPrincipal,
        penaltyDue,
      } = validatedInput;

      await assertLedgerEditable(accountId, supabase);

      // Insert notice event and advance active escalation stage
      const { data, error } = await supabase
        .from("billing_notice_event")
        .insert({
          account_id: accountId,
          stage,
          notice_number: noticeNumber,
          notice_date: noticeDate,
          title,
          tracking_number: trackingNumber?.trim() || null,
          notes: notes?.trim() || null,
          overdue_amount: overdueAmount,
          arrears_principal: arrearsPrincipal,
          penalty_due: penaltyDue,
        })
        .select("notice_id")
        .single<{ notice_id: string }>();

      if (error || !data) {
        throw new Error(`Failed to record notice event: ${error?.message || "Unknown error"}`);
      }

      await supabase
        .from("ledger_account")
        .update({ overdue_notice_stage: stage })
        .eq("account_id", accountId);

      return { noticeId: data.notice_id };
    },
  });
}

export async function updateBillingNotice(
  input: unknown
): Promise<ActionResult<{ noticeId: string }>> {
  return billingUpdate.run({
    schema: updateBillingNoticeSchema,
    input,
    handler: async (validatedInput, { supabase }) => {
      const {
        noticeId,
        stage,
        noticeNumber,
        noticeDate,
        title,
        trackingNumber,
        notes,
      } = validatedInput;

      const { data: notice, error: nErr } = await supabase
        .from("billing_notice_event")
        .select("account_id")
        .eq("notice_id", noticeId)
        .maybeSingle<{ account_id: string }>();

      if (nErr || !notice) {
        throw new Error("Notice event record not found.");
      }

      await assertLedgerEditable(notice.account_id, supabase);

      // Update notice record details
      const { error } = await supabase
        .from("billing_notice_event")
        .update({
          stage,
          notice_number: noticeNumber,
          notice_date: noticeDate,
          title,
          tracking_number: trackingNumber?.trim() || null,
          notes: notes?.trim() || null,
        })
        .eq("notice_id", noticeId);

      if (error) {
        throw new Error(`Failed to update notice event: ${error.message}`);
      }

      return { noticeId };
    },
  });
}

export async function forfeitBillingAccount(
  input: unknown
): Promise<ActionResult<{ propertyId: string }>> {
  return billingUpdate.run({
    schema: forfeitBillingAccountSchema,
    input,
    handler: async (validatedInput, { supabase }) => {
      const { accountId, reason, forfeitedAt } = validatedInput;

      await assertLedgerEditable(accountId, supabase);

      // Find property linked to this account
      const { data: account, error: accErr } = await supabase
        .from("ledger_account")
        .select("property_id")
        .eq("account_id", accountId)
        .single<{ property_id: string }>();

      if (accErr || !account) {
        throw new Error("Target contract ledger account not found.");
      }

      // Delegate lot forfeiture to the standard property action
      const forfeitResult = await forfeitPropertyLot({
        propertyId: account.property_id,
        reason,
        forfeitedAt,
      });

      if (!forfeitResult.success) {
        throw new Error(forfeitResult.error || "Failed to forfeit property lot.");
      }

      const todayStr = forfeitedAt ? forfeitedAt.split("T")[0] : new Date().toISOString().split("T")[0];

      // Record final notice of forfeiture event
      await supabase.from("billing_notice_event").insert({
        account_id: accountId,
        stage: "forfeited",
        notice_number: 4,
        notice_date: todayStr,
        title: "NOTICE OF FORFEITURE & CONTRACT RESCISSION",
        notes: reason || "Ownership forfeited pursuant to Contract to Sell terms.",
        overdue_amount: 0,
        arrears_principal: 0,
        penalty_due: 0,
      });

      await supabase
        .from("ledger_account")
        .update({ overdue_notice_stage: "forfeited" })
        .eq("account_id", accountId);

      return { propertyId: account.property_id };
    },
  });
}

export async function markAccountClearedByBilling(
  accountId: string
): Promise<ActionResult<LedgerAccount>> {
  return billingUpdate.run({
    schema: uuidSchema,
    input: accountId,
    handler: async (validId, { supabase, userId }) => {
      // Enforce rule that unsettled accounts cannot be cleared
      const { summary } = await getBillingLedgerById(validId);
      if (summary.status !== "settled") {
        throw new Error(
          "Unsettled accounts cannot be cleared. Outstanding contract balance and penalties must be fully settled first."
        );
      }

      const { data, error } = await supabase
        .from("ledger_account")
        .update({ cleared_at: new Date().toISOString(), cleared_by: userId })
        .eq("account_id", validId)
        .in("status", ["Active", "Matured", "Fully Paid"])
        .is("cleared_at", null)
        .select()
        .maybeSingle<LedgerAccount>();

      if (error) {
        throw new Error(`Failed to clear account: ${error.message}`);
      }
      if (!data) {
        throw new Error("Only an active account that has not been cleared yet can be cleared.");
      }

      // Update property lot status to Sold
      if (data.property_id) {
        await supabase
          .from("property_lot")
          .update({ status: "Sold" })
          .eq("property_id", data.property_id)
          .eq("status", "Reserved");
      }

      return data;
    },
  });
}

export async function undoBillingClearance(
  accountId: string
): Promise<ActionResult<LedgerAccount>> {
  return billingUpdate.run({
    schema: uuidSchema,
    input: accountId,
    handler: async (validId, { supabase }) => {
      const { data: account, error: lookupError } = await supabase
        .from("ledger_account")
        .select("property_id")
        .eq("account_id", validId)
        .maybeSingle<{ property_id: string }>();

      if (lookupError) {
        throw new Error(`Failed to load account: ${lookupError.message}`);
      }
      if (!account) {
        throw new Error("Account not found.");
      }

      const { data: title, error: titleError } = await supabase
        .from("land_title")
        .select("title_id")
        .eq("property_id", account.property_id)
        .maybeSingle<{ title_id: string }>();

      if (titleError) {
        throw new Error(`Failed to check the lot's title: ${titleError.message}`);
      }
      if (title) {
        throw new Error("Legal has already created the title for this lot, so the clearance cannot be undone.");
      }

      const { data, error } = await supabase
        .from("ledger_account")
        .update({ cleared_at: null, cleared_by: null })
        .eq("account_id", validId)
        .select()
        .single<LedgerAccount>();

      if (error || !data) {
        throw new Error(`Failed to undo clearance: ${error?.message ?? "Unknown error"}`);
      }

      // Restore property lot status to Reserved
      if (account.property_id) {
        await supabase
          .from("property_lot")
          .update({ status: "Reserved" })
          .eq("property_id", account.property_id)
          .eq("status", "Sold");
      }

      return data;
    },
  });
}

export async function uploadBillingClearanceDocument(
  accountId: string,
  formData: FormData
): Promise<ActionResult<ClientDocument>> {
  return billingUpdate.run({
    schema: uploadBillingClearanceDocumentSchema,
    input: {
      accountId,
      documentType: formData.get("document_type"),
      file: formData.get("file"),
      isAutogenerated: formData.get("is_autogenerated") === "true",
    },
    handler: async ({ accountId: validAccountId, documentType, file, isAutogenerated }, { supabase, userId }) => {
      // Look up primary client and property lot for the account
      const { data: account, error: accountError } = await supabase
        .from("ledger_account")
        .select(`
          property_id,
          parties:account_party(client_id, is_primary)
        `)
        .eq("account_id", validAccountId)
        .maybeSingle<{
          property_id: string;
          parties: { client_id: string; is_primary: boolean }[];
        }>();

      if (accountError || !account) {
        throw new Error(`Ledger account not found: ${accountError?.message ?? "Unknown error"}`);
      }

      const clientId =
        account.parties?.find((p) => p.is_primary)?.client_id ||
        account.parties?.[0]?.client_id;

      if (!clientId) {
        throw new Error("No client is associated with this billing ledger account.");
      }

      // Check existing document of the same category for this lot to replace
      const { data: previous, error: previousError } = await supabase
        .from("file_attachment")
        .select("attachment_id, file_path")
        .eq("client_id", clientId)
        .eq("property_id", account.property_id)
        .eq("file_category", documentType)
        .returns<{ attachment_id: string; file_path: string }[]>();

      if (previousError) {
        throw new Error(`Failed to check existing clearance documents: ${previousError.message}`);
      }

      const filePath = await uploadClientDocumentObject(clientId, file);

      const { data, error } = await supabase
        .from("file_attachment")
        .insert({
          entity_type: "client",
          entity_id: clientId,
          client_id: clientId,
          property_id: account.property_id,
          file_category: documentType,
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          metadata: {
            autogenerated: isAutogenerated,
            source: isAutogenerated ? "autogenerated" : "manual_upload",
          },
          uploaded_by: userId,
        })
        .select(CLIENT_DOCUMENT_COLUMNS)
        .single<FileAttachment>();

      if (error || !data) {
        await removeClientDocumentObject(filePath).catch((cleanupErr) => {
          console.error(`Orphaned object ${filePath} after failed insert:`, cleanupErr);
        });
        throw new Error(`Failed to save clearance document: ${error?.message ?? "Unknown error"}`);
      }

      // Remove replaced previous documents if any exist
      if (previous && previous.length > 0) {
        const oldIds = previous.map((p) => p.attachment_id);
        await supabase.from("file_attachment").delete().in("attachment_id", oldIds);
        await Promise.allSettled(previous.map((p) => removeClientDocumentObject(p.file_path)));
      }

      return toClientDocument(data);
    },
  });
}
