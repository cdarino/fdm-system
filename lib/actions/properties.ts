"use server";

import { createScope } from "@/lib/actions/action-handler";
import type { ActionResult } from "@/lib/actions/action-result";
import { uuidSchema } from "@/lib/validations/client";
import {
  createPropertyLotSchema,
  getPropertyLotsParamsSchema,
  updatePropertyLotActionSchema,
  assignPropertyClientActionSchema,
  assignPropertyPartiesActionSchema,
  addAccountPartyActionSchema,
  removeAccountPartyActionSchema,
} from "@/lib/validations/property";
import type { PaginatedResult } from "@/lib/types/client";
import type {
  PropertyLot,
  PropertyLotWithClient,
  PropertyStatus,
  AssignPartyInput,
  AssignPropertyOptions,
  GetPropertyLotsParams,
} from "@/lib/types/property";
import {
  LOT_WITH_CLIENT_SELECT,
  mapLotWithAccount,
  type RawLotRow,
} from "@/lib/property-lots";

const property = createScope(["properties.read"]);
const propertyCreate = property.extend(["properties.create"]);
const propertyWrite = property.extend(["properties.update"]);
const propertyDelete = property.extend(["properties.delete"]);

export async function getPropertyLots(
  params?: GetPropertyLotsParams
): Promise<PaginatedResult<PropertyLotWithClient>> {
  return property.query({
    schema: getPropertyLotsParamsSchema,
    input: params,
    handler: async (validatedParams, { supabase }) => {
      const page = Math.max(1, validatedParams?.page ?? 1);
      const limit = Math.max(1, validatedParams?.limit ?? 10);
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from("property_lot")
        .select(LOT_WITH_CLIENT_SELECT, { count: "exact" });

      if (validatedParams?.search) {
        query = query.ilike("location", `%${validatedParams.search}%`);
      }

      if (validatedParams?.status) {
        query = query.eq("status", validatedParams.status);
      }

      // Filter lots through active ledger account party
      if (validatedParams?.client_id) {
        const { data: partyRows } = await supabase
          .from("account_party")
          .select("ledger_account!inner(property_id, status)")
          .eq("client_id", validatedParams.client_id)
          .eq("ledger_account.status", "Active");

        const matchedPropertyIds = (partyRows ?? [])
          .map((row) => (row.ledger_account as { property_id?: string } | null)?.property_id)
          .filter((id): id is string => Boolean(id));

        query = query.in(
          "property_id",
          matchedPropertyIds.length > 0 ? matchedPropertyIds : ["00000000-0000-0000-0000-000000000000"]
        );
      }

      if (validatedParams?.location) {
        query = query.ilike("location", `%${validatedParams.location}%`);
      }

      if (validatedParams?.block_number !== undefined) {
        query = query.eq("block_number", validatedParams.block_number);
      }

      if (validatedParams?.lot_number !== undefined) {
        query = query.eq("lot_number", validatedParams.lot_number);
      }

      const sortBy = validatedParams?.sortBy ?? "created_at";
      const ascending = validatedParams?.sortOrder === "asc";
      query = query.order(sortBy, { ascending }).range(from, to);

      const { data, error, count } = await query.returns<RawLotRow[]>();
      if (error) {
        throw new Error(`Failed to fetch property lots: ${error.message}`);
      }

      const totalCount = count ?? 0;
      const lots = (data ?? []).map(mapLotWithAccount);

      return {
        data: lots,
        totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      };
    },
  });
}

export async function getPropertyLotById(
  propertyId: string
): Promise<PropertyLotWithClient> {
  return property.query({
    schema: uuidSchema,
    input: propertyId,
    handler: async (validPropertyId, { supabase }) => {
      const { data, error } = await supabase
        .from("property_lot")
        .select(LOT_WITH_CLIENT_SELECT)
        .eq("property_id", validPropertyId)
        .single<RawLotRow>();

      if (error || !data) {
        throw new Error(`Property lot not found: ${error?.message ?? "Unknown error"}`);
      }

      return mapLotWithAccount(data);
    },
  });
}

export async function createPropertyLot(
  input: unknown
): Promise<ActionResult<PropertyLot>> {
  return propertyCreate.run({
    schema: createPropertyLotSchema,
    input,
    handler: async (validatedInput, { supabase }) => {
      let location = validatedInput.location;
      if (!location && validatedInput.site_id) {
        const { data: site } = await supabase
          .from("site")
          .select("name")
          .eq("site_id", validatedInput.site_id)
          .single<{ name: string }>();
        location = site?.name ?? "Unknown Location";
      }

      if (!location) {
        throw new Error("Location or site is required to create a property lot");
      }

      const { data, error } = await supabase
        .from("property_lot")
        .insert({
          location,
          block_number: validatedInput.block_number,
          lot_number: validatedInput.lot_number,
          area_size: validatedInput.area_size,
          price_per_sqm: validatedInput.price_per_sqm,
          status: validatedInput.status ?? "Open",
          site_id: validatedInput.site_id ?? null,
        })
        .select()
        .single<PropertyLot>();

      if (error || !data) {
        throw new Error(`Failed to create property lot: ${error?.message ?? "Unknown error"}`);
      }

      return data;
    },
  });
}

export async function updatePropertyLot(
  propertyId: string,
  input: unknown
): Promise<ActionResult<PropertyLot>> {
  return propertyWrite.run({
    schema: updatePropertyLotActionSchema,
    input: { propertyId, ...(typeof input === "object" && input !== null ? input : {}) },
    handler: async (validatedInput, { supabase }) => {
      const { propertyId: id, ...updates } = validatedInput;

      const { data, error } = await supabase
        .from("property_lot")
        .update(updates)
        .eq("property_id", id)
        .select()
        .single<PropertyLot>();

      if (error || !data) {
        throw new Error(`Failed to update property lot: ${error?.message ?? "Unknown error"}`);
      }

      return data;
    },
  });
}

export async function archivePropertyLot(propertyId: string): Promise<ActionResult<PropertyLot>> {
  return propertyWrite.run({
    schema: uuidSchema,
    input: propertyId,
    handler: async (validPropertyId, { supabase }) => {
      const { data, error } = await supabase
        .from("property_lot")
        .update({ is_archived: true, archived_at: new Date().toISOString() })
        .eq("property_id", validPropertyId)
        .select()
        .single<PropertyLot>();

      if (error || !data) {
        throw new Error(`Failed to archive property lot: ${error?.message ?? "Unknown error"}`);
      }

      return data;
    },
  });
}

export async function unarchivePropertyLot(propertyId: string): Promise<ActionResult<PropertyLot>> {
  return propertyWrite.run({
    schema: uuidSchema,
    input: propertyId,
    handler: async (validPropertyId, { supabase }) => {
      const { data, error } = await supabase
        .from("property_lot")
        .update({ is_archived: false, archived_at: null })
        .eq("property_id", validPropertyId)
        .select()
        .single<PropertyLot>();

      if (error || !data) {
        throw new Error(`Failed to unarchive property lot: ${error?.message ?? "Unknown error"}`);
      }

      return data;
    },
  });
}

export async function deletePropertyLot(propertyId: string): Promise<ActionResult<void>> {
  return propertyDelete.run({
    schema: uuidSchema,
    input: propertyId,
    handler: async (validPropertyId, { supabase }) => {
      // Clean up ledger accounts associated with this lot
      await supabase.from("ledger_account").delete().eq("property_id", validPropertyId);

      const { error } = await supabase
        .from("property_lot")
        .delete()
        .eq("property_id", validPropertyId);

      if (error) {
        throw new Error(`Failed to delete property lot: ${error.message}`);
      }
    },
  });
}

export async function assignPropertyClient(
  propertyId: string,
  clientId: string | null,
  status?: PropertyStatus,
  options?: AssignPropertyOptions
): Promise<ActionResult<PropertyLotWithClient>> {
  return propertyWrite.run({
    schema: assignPropertyClientActionSchema,
    input: {
      propertyId,
      clientId,
      status,
      total_contract_price: options?.total_contract_price,
    },
    handler: async (validatedData, { supabase }) => {
      const { propertyId: targetLotId, clientId: targetClientId } = validatedData;

      // Cancel active ledger account and reset to Open if clearing client
      if (!targetClientId) {
        await supabase
          .from("ledger_account")
          .update({ status: "Cancelled" })
          .eq("property_id", targetLotId)
          .eq("status", "Active");

        const { data: clearedLot, error: clearErr } = await supabase
          .from("property_lot")
          .update({ status: validatedData.status ?? "Open" })
          .eq("property_id", targetLotId)
          .select()
          .single<PropertyLot>();

        if (clearErr || !clearedLot) {
          throw new Error(`Failed to unassign property lot: ${clearErr?.message ?? "Unknown error"}`);
        }

        return {
          ...clearedLot,
          client: null,
          client_id: null,
          active_account: null,
        };
      }

      const { data: lot, error: lotErr } = await supabase
        .from("property_lot")
        .select("area_size, price_per_sqm")
        .eq("property_id", targetLotId)
        .single<{ area_size: number; price_per_sqm: number }>();

      if (lotErr || !lot) {
        throw new Error(`Property lot not found: ${lotErr?.message ?? "Unknown error"}`);
      }

      const tcp = validatedData.total_contract_price ?? Number(lot.area_size) * Number(lot.price_per_sqm);

      // Retrieve or create the single active ledger account for this lot
      const { data: existingAccount } = await supabase
        .from("ledger_account")
        .select("account_id")
        .eq("property_id", targetLotId)
        .eq("status", "Active")
        .maybeSingle<{ account_id: string }>();

      let activeAccountId = existingAccount?.account_id;

      if (!activeAccountId) {
        const { data: newAccount, error: accErr } = await supabase
          .from("ledger_account")
          .insert({
            property_id: targetLotId,
            status: "Active",
            total_contract_price: tcp,
            remaining_balance: tcp,
          })
          .select("account_id")
          .single<{ account_id: string }>();

        if (accErr || !newAccount) {
          throw new Error(`Failed to create ledger account: ${accErr?.message ?? "Unknown error"}`);
        }
        activeAccountId = newAccount.account_id;
      }

      // Set this client as primary account party
      const { error: partyErr } = await supabase
        .from("account_party")
        .upsert(
          {
            account_id: activeAccountId,
            client_id: targetClientId,
            role: "Principal Buyer",
            ownership_percentage: 100.0,
            is_primary: true,
          },
          { onConflict: "account_id,client_id" }
        );

      if (partyErr) {
        throw new Error(`Failed to assign client to ledger party: ${partyErr.message}`);
      }

      const nextStatus = validatedData.status ?? "Reserved";
      const { error: lotUpdateErr } = await supabase
        .from("property_lot")
        .update({ status: nextStatus })
        .eq("property_id", targetLotId);

      if (lotUpdateErr) {
        throw new Error(`Failed to update lot status: ${lotUpdateErr.message}`);
      }

      return getPropertyLotById(targetLotId);
    },
  });
}

export async function assignPropertyParties(
  propertyId: string,
  parties: AssignPartyInput[],
  status?: PropertyStatus,
  options?: AssignPropertyOptions
): Promise<PropertyLotWithClient> {
  return propertyWrite.execute({
    schema: assignPropertyPartiesActionSchema,
    input: {
      propertyId,
      parties,
      status,
      total_contract_price: options?.total_contract_price,
    },
    handler: async (validatedData, { supabase }) => {
      const { propertyId: targetLotId, parties: validParties } = validatedData;

      const { data: lot, error: lotErr } = await supabase
        .from("property_lot")
        .select("area_size, price_per_sqm")
        .eq("property_id", targetLotId)
        .single<{ area_size: number; price_per_sqm: number }>();

      if (lotErr || !lot) {
        throw new Error(`Property lot not found: ${lotErr?.message ?? "Unknown error"}`);
      }

      const tcp = validatedData.total_contract_price ?? Number(lot.area_size) * Number(lot.price_per_sqm);

      // Archive any existing active account
      await supabase
        .from("ledger_account")
        .update({ status: "Cancelled" })
        .eq("property_id", targetLotId)
        .eq("status", "Active");

      // Create new active ledger account
      const { data: newAccount, error: accErr } = await supabase
        .from("ledger_account")
        .insert({
          property_id: targetLotId,
          status: "Active",
          total_contract_price: tcp,
          remaining_balance: tcp,
        })
        .select("account_id")
        .single<{ account_id: string }>();

      if (accErr || !newAccount) {
        throw new Error(`Failed to create ledger account: ${accErr?.message ?? "Unknown error"}`);
      }

      // Ensure exactly one party is marked primary
      const hasExplicitPrimary = validParties.some((p) => p.is_primary);
      const partyRows = validParties.map((p, idx) => ({
        account_id: newAccount.account_id,
        client_id: p.client_id,
        role: p.role || (idx === 0 ? "Principal Buyer" : "Co-Owner"),
        ownership_percentage: p.ownership_percentage ?? (100 / validParties.length),
        is_primary: hasExplicitPrimary ? Boolean(p.is_primary) : idx === 0,
      }));

      const { error: partiesErr } = await supabase
        .from("account_party")
        .insert(partyRows);

      if (partiesErr) {
        throw new Error(`Failed to assign account parties: ${partiesErr.message}`);
      }

      const nextStatus = validatedData.status ?? "Reserved";
      const { error: lotUpdateErr } = await supabase
        .from("property_lot")
        .update({ status: nextStatus })
        .eq("property_id", targetLotId);

      if (lotUpdateErr) {
        throw new Error(`Failed to update lot status: ${lotUpdateErr.message}`);
      }

      return getPropertyLotById(targetLotId);
    },
  });
}

export async function addAccountParty(
  accountId: string,
  input: AssignPartyInput
): Promise<void> {
  return propertyWrite.execute({
    schema: addAccountPartyActionSchema,
    input: { accountId, ...input },
    handler: async (validatedData, { supabase }) => {
      if (validatedData.is_primary) {
        await supabase
          .from("account_party")
          .update({ is_primary: false })
          .eq("account_id", validatedData.accountId);
      }

      const { error } = await supabase
        .from("account_party")
        .insert({
          account_id: validatedData.accountId,
          client_id: validatedData.client_id,
          role: validatedData.role,
          ownership_percentage: validatedData.ownership_percentage,
          is_primary: validatedData.is_primary,
        });

      if (error) {
        throw new Error(`Failed to add account party: ${error.message}`);
      }
    },
  });
}

export async function removeAccountParty(
  accountId: string,
  clientId: string
): Promise<void> {
  return propertyWrite.execute({
    schema: removeAccountPartyActionSchema,
    input: { accountId, clientId },
    handler: async (validatedData, { supabase }) => {
      const { error } = await supabase
        .from("account_party")
        .delete()
        .eq("account_id", validatedData.accountId)
        .eq("client_id", validatedData.clientId);

      if (error) {
        throw new Error(`Failed to remove account party: ${error.message}`);
      }
    },
  });
}
