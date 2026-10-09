"use server";

import { createScope } from "@/lib/actions/action-handler";
import type { ActionResult } from "@/lib/actions/action-result";
import { uuidSchema } from "@/lib/validations/client";
import type { LedgerAccount } from "@/lib/types/property";

// Sprint 4 brings the full Billing ledger. Until then, clearing an account is
// a manual confirmation from Billing that the client has fully paid.
const billingUpdate = createScope(["billing.update"]);

/**
 * Billing confirms a client has fully paid. The lot becomes Sold and the
 * account appears on the Legal page so a title can be created for it.
 */
export async function markAccountClearedByBilling(
  accountId: string
): Promise<ActionResult<LedgerAccount>> {
  return billingUpdate.run({
    schema: uuidSchema,
    input: accountId,
    handler: async (validId, { supabase, userId }) => {
      const { data, error } = await supabase
        .from("ledger_account")
        .update({ cleared_at: new Date().toISOString(), cleared_by: userId })
        .eq("account_id", validId)
        .eq("status", "Active")
        .is("cleared_at", null)
        .select()
        .maybeSingle<LedgerAccount>();

      if (error) {
        throw new Error(`Failed to clear account: ${error.message}`);
      }
      if (!data) {
        throw new Error("Only an active account that has not been cleared yet can be cleared.");
      }

      return data;
    },
  });
}

/**
 * Reverses a clearance made by mistake. Not allowed once Legal has created
 * the title, since the release process has then started.
 */
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

      return data;
    },
  });
}
