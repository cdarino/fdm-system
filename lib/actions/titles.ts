"use server";

import { createScope } from "@/lib/actions/action-handler";
import type { ActionResult } from "@/lib/actions/action-result";
import { requireAnyPermission } from "@/lib/actions/auth-guard";
import { uuidSchema } from "@/lib/validations/client";
import {
  createLandTitleSchema,
  updateLandTitleSchema,
  getLandTitlesParamsSchema,
} from "@/lib/validations/title";
import type { AccountAwaitingTitle, CreateLandTitleInput, LandTitle } from "@/lib/types/title";
import type { PaginatedResult } from "@/lib/types/client";

// The client's documents ride along so title lists can show release packet progress.
const TITLE_SELECT =
  "*, client:client_id(client_id, full_name, status, address, documents:client_document(document_type, property_id)), property:property_id(property_id, location, block_number, lot_number)";

const titleBase = createScope();
const titleCreate = createScope(["legal.create"]);
const titleUpdate = createScope(["legal.update"]);
const titleDelete = createScope(["legal.delete"]);

export async function getLandTitles(
  params?: unknown
): Promise<PaginatedResult<LandTitle>> {
  return titleBase.query({
    schema: getLandTitlesParamsSchema,
    input: params,
    handler: async (validatedParams, { supabase }) => {
      await requireAnyPermission(["legal.read", "properties.read"]);

      const page = Math.max(1, validatedParams?.page ?? 1);
      const limit = Math.max(1, validatedParams?.limit ?? 10);
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from("land_title")
        .select(TITLE_SELECT, { count: "exact" });

      if (validatedParams?.client_id) {
        query = query.eq("client_id", validatedParams.client_id);
      }
      if (validatedParams?.property_id) {
        query = query.eq("property_id", validatedParams.property_id);
      }
      if (validatedParams?.status) {
        query = query.eq("status", validatedParams.status);
      }
      if (validatedParams?.search) {
        query = query.ilike("title_number", `%${validatedParams.search}%`);
      }

      const sortBy = validatedParams?.sortBy ?? "created_at";
      const ascending = validatedParams?.sortOrder === "asc";
      query = query.order(sortBy, { ascending }).range(from, to);

      const { data, error, count } = await query.returns<LandTitle[]>();
      if (error) {
        throw new Error(`Failed to fetch land titles: ${error.message}`);
      }

      const totalCount = count ?? 0;
      return {
        data: data ?? [],
        totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      };
    },
  });
}

export async function getLandTitleByPropertyId(
  propertyId: string
): Promise<LandTitle | null> {
  return titleBase.query({
    schema: uuidSchema,
    input: propertyId,
    handler: async (validPropertyId, { supabase }) => {
      await requireAnyPermission(["legal.read", "properties.read"]);

      const { data, error } = await supabase
        .from("land_title")
        .select(TITLE_SELECT)
        .eq("property_id", validPropertyId)
        .maybeSingle<LandTitle>();

      if (error) {
        throw new Error(`Failed to fetch land title: ${error.message}`);
      }

      return data ?? null;
    },
  });
}

interface RawClearedAccount {
  account_id: string;
  cleared_at: string;
  property: {
    property_id: string;
    location: string;
    block_number: number;
    lot_number: number;
    land_title: { title_id: string }[] | { title_id: string } | null;
  } | null;
  parties: { is_primary: boolean; client: { client_id: string; full_name: string } | null }[];
}

/**
 * Accounts Billing has cleared whose lot has no land title yet. This is the
 * Legal page's work queue: each one needs a title record.
 */
export async function getAccountsAwaitingTitle(): Promise<AccountAwaitingTitle[]> {
  return titleBase.query(async ({ supabase }) => {
    await requireAnyPermission(["legal.read"]);

    const { data, error } = await supabase
      .from("ledger_account")
      .select(
        "account_id, cleared_at, property:property_id(property_id, location, block_number, lot_number, land_title(title_id)), parties:account_party(is_primary, client:client_id(client_id, full_name))"
      )
      .eq("status", "Active")
      .not("cleared_at", "is", null)
      .order("cleared_at", { ascending: false })
      .returns<RawClearedAccount[]>();

    if (error) {
      throw new Error(`Failed to fetch cleared accounts: ${error.message}`);
    }

    return (data ?? []).flatMap((row) => {
      const property = row.property;
      if (!property) return [];

      const title = Array.isArray(property.land_title) ? property.land_title[0] : property.land_title;
      if (title) return [];

      const party = row.parties.find((p) => p.is_primary) ?? row.parties[0];
      const coBuyers = row.parties
        .filter((p) => p !== party && p.client)
        .map((p) => p.client!.full_name);
      return [
        {
          account_id: row.account_id,
          cleared_at: row.cleared_at,
          property: {
            property_id: property.property_id,
            location: property.location,
            block_number: property.block_number,
            lot_number: property.lot_number,
          },
          client: party?.client ?? null,
          co_buyers: coBuyers,
        },
      ];
    });
  });
}

/**
 * Legal creates the title for a lot whose account Billing has cleared. The
 * client comes from that account, so the title is always linked to the buyer
 * of record for the lot. New titles start at "Cleared by Billing".
 */
export async function createLandTitle(
  input: CreateLandTitleInput
): Promise<ActionResult<LandTitle>> {
  return titleCreate.run({
    schema: createLandTitleSchema,
    input,
    handler: async ({ property_id, title_holder, title_number }, { supabase }) => {
      const { data: account, error: accountError } = await supabase
        .from("ledger_account")
        .select("account_id, cleared_at, parties:account_party(client_id, is_primary)")
        .eq("property_id", property_id)
        .eq("status", "Active")
        .maybeSingle<{
          account_id: string;
          cleared_at: string | null;
          parties: { client_id: string; is_primary: boolean }[];
        }>();

      if (accountError) {
        throw new Error(`Failed to check the lot's account: ${accountError.message}`);
      }
      if (!account) {
        throw new Error("This lot has no active account, so there is nothing for Billing to clear.");
      }
      if (!account.cleared_at) {
        throw new Error("Billing has not cleared this account yet. A title can only be created once it is cleared.");
      }

      const buyer = account.parties.find((p) => p.is_primary) ?? account.parties[0];
      if (!buyer) {
        throw new Error("This account has no client on record.");
      }

      const { data, error } = await supabase
        .from("land_title")
        .insert({
          property_id,
          client_id: buyer.client_id,
          title_holder,
          title_number,
        })
        .select(TITLE_SELECT)
        .single<LandTitle>();

      if (error?.code === "23505") {
        throw new Error("This lot already has a title record.");
      }
      if (error || !data) {
        throw new Error(`Failed to create land title: ${error?.message ?? "Unknown error"}`);
      }

      return data;
    },
  });
}

export async function updateLandTitle(
  titleId: string,
  input: unknown
): Promise<ActionResult<LandTitle>> {
  return titleUpdate.run({
    schema: updateLandTitleSchema,
    input,
    handler: async (validatedUpdates, { supabase }) => {
      const { data, error } = await supabase
        .from("land_title")
        .update(validatedUpdates)
        .eq("title_id", titleId)
        .select(TITLE_SELECT)
        .single<LandTitle>();

      if (error || !data) {
        throw new Error(`Failed to update land title: ${error?.message ?? "Unknown error"}`);
      }

      return data;
    },
  });
}

export async function deleteLandTitle(
  titleId: string
): Promise<ActionResult<void>> {
  return titleDelete.run({
    schema: uuidSchema,
    input: titleId,
    handler: async (validTitleId, { supabase }) => {
      const { error } = await supabase
        .from("land_title")
        .delete()
        .eq("title_id", validTitleId);

      if (error) {
        throw new Error(`Failed to delete land title: ${error.message}`);
      }
    },
  });
}
