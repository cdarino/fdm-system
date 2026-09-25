"use server";

import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/actions/auth-guard";
import type { PaginatedResult } from "@/lib/types/client";
import type {
  PropertyLot,
  PropertyLotWithClient,
  PropertyStatus,
  LedgerAccountWithParties,
  CreatePropertyLotInput,
  UpdatePropertyLotInput,
  AssignPartyInput,
  AssignPropertyOptions,
  GetPropertyLotsParams,
} from "@/lib/types/property";
import {
  LOT_WITH_CLIENT_SELECT,
  mapLotWithAccount,
  type RawLotRow,
} from "@/lib/property-lots";

export async function getPropertyLots(
  params?: GetPropertyLotsParams
): Promise<PaginatedResult<PropertyLotWithClient>> {
  await requirePermission("properties.read");
  const supabase = await createSupabaseServerClient();

  const page = Math.max(1, params?.page ?? 1);
  const limit = Math.max(1, params?.limit ?? 10);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("property_lot")
    .select(LOT_WITH_CLIENT_SELECT, { count: "exact" });

  if (params?.search?.trim()) {
    query = query.ilike("location", `%${params.search.trim()}%`);
  }

  if (params?.status) {
    query = query.eq("status", params.status);
  }

  // Filter lots through active ledger account party
  if (params?.client_id) {
    const { data: partyRows } = await supabase
      .from("account_party")
      .select("ledger_account!inner(property_id, status)")
      .eq("client_id", params.client_id)
      .eq("ledger_account.status", "Active");

    const matchedPropertyIds = (partyRows ?? [])
      .map((row) => (row.ledger_account as { property_id?: string } | null)?.property_id)
      .filter((id): id is string => Boolean(id));

    query = query.in(
      "property_id",
      matchedPropertyIds.length > 0 ? matchedPropertyIds : ["00000000-0000-0000-0000-000000000000"]
    );
  }

  if (params?.location?.trim()) {
    query = query.ilike("location", `%${params.location.trim()}%`);
  }

  if (params?.block_number !== undefined) {
    query = query.eq("block_number", params.block_number);
  }

  if (params?.lot_number !== undefined) {
    query = query.eq("lot_number", params.lot_number);
  }

  const sortBy = params?.sortBy ?? "created_at";
  const ascending = params?.sortOrder === "asc";
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
}

export async function getPropertyLotById(
  propertyId: string
): Promise<PropertyLotWithClient> {
  await requirePermission("properties.read");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("property_lot")
    .select(LOT_WITH_CLIENT_SELECT)
    .eq("property_id", propertyId)
    .single<RawLotRow>();

  if (error || !data) {
    throw new Error(`Property lot not found: ${error?.message ?? "Unknown error"}`);
  }

  return mapLotWithAccount(data);
}

export async function createPropertyLot(
  input: CreatePropertyLotInput
): Promise<PropertyLot> {
  await requirePermission("properties.create");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("property_lot")
    .insert({
      location: input.location.trim(),
      block_number: input.block_number,
      lot_number: input.lot_number,
      area_size: input.area_size,
      price_per_sqm: input.price_per_sqm,
      status: input.status ?? "Open",
      // Geometry is set later by the lot editor; a lot may belong to a site
      // before it has been drawn, which is what makes an "undrawn lots on this
      // site" work queue possible.
      site_id: input.site_id ?? null,
    })
    .select()
    .single<PropertyLot>();

  if (error || !data) {
    throw new Error(`Failed to create property lot: ${error?.message ?? "Unknown error"}`);
  }

  return data;
}

export async function updatePropertyLot(
  propertyId: string,
  input: UpdatePropertyLotInput
): Promise<PropertyLot> {
  await requirePermission("properties.update");
  const supabase = await createSupabaseServerClient();

  const updates: Record<string, unknown> = {};
  if (input.location !== undefined) updates.location = input.location.trim();
  if (input.block_number !== undefined) updates.block_number = input.block_number;
  if (input.lot_number !== undefined) updates.lot_number = input.lot_number;
  if (input.area_size !== undefined) updates.area_size = input.area_size;
  if (input.price_per_sqm !== undefined) updates.price_per_sqm = input.price_per_sqm;
  if (input.status !== undefined) updates.status = input.status;

  const { data, error } = await supabase
    .from("property_lot")
    .update(updates)
    .eq("property_id", propertyId)
    .select()
    .single<PropertyLot>();

  if (error || !data) {
    throw new Error(`Failed to update property lot: ${error?.message ?? "Unknown error"}`);
  }

  return data;
}

export async function deletePropertyLot(propertyId: string): Promise<void> {
  await requirePermission("properties.delete");
  const supabase = await createSupabaseServerClient();

  // Clean up ledger accounts associated with this lot
  await supabase.from("ledger_account").delete().eq("property_id", propertyId);

  const { error } = await supabase
    .from("property_lot")
    .delete()
    .eq("property_id", propertyId);

  if (error) {
    throw new Error(`Failed to delete property lot: ${error.message}`);
  }
}

export async function assignPropertyClient(
  propertyId: string,
  clientId: string | null,
  status?: PropertyStatus,
  options?: AssignPropertyOptions
): Promise<PropertyLotWithClient> {
  await requirePermission("properties.update");
  const supabase = await createSupabaseServerClient();

  // Cancel active ledger account and reset to Open if clearing client
  if (!clientId) {
    await supabase
      .from("ledger_account")
      .update({ status: "Cancelled" })
      .eq("property_id", propertyId)
      .eq("status", "Active");

    const { data: clearedLot, error: clearErr } = await supabase
      .from("property_lot")
      .update({ status: status ?? "Open" })
      .eq("property_id", propertyId)
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
    .eq("property_id", propertyId)
    .single<{ area_size: number; price_per_sqm: number }>();

  if (lotErr || !lot) {
    throw new Error(`Property lot not found: ${lotErr?.message ?? "Unknown error"}`);
  }

  const tcp = options?.total_contract_price ?? Number(lot.area_size) * Number(lot.price_per_sqm);

  // Retrieve or create the single active ledger account for this lot
  const { data: existingAccount } = await supabase
    .from("ledger_account")
    .select("account_id")
    .eq("property_id", propertyId)
    .eq("status", "Active")
    .maybeSingle<{ account_id: string }>();

  let activeAccountId = existingAccount?.account_id;

  if (!activeAccountId) {
    const { data: newAccount, error: accErr } = await supabase
      .from("ledger_account")
      .insert({
        property_id: propertyId,
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
        client_id: clientId,
        role: "Principal Buyer",
        ownership_percentage: 100.00,
        is_primary: true,
      },
      { onConflict: "account_id,client_id" }
    );

  if (partyErr) {
    throw new Error(`Failed to assign client to ledger party: ${partyErr.message}`);
  }

  const nextStatus = status ?? "Reserved";
  const { error: lotUpdateErr } = await supabase
    .from("property_lot")
    .update({ status: nextStatus })
    .eq("property_id", propertyId);

  if (lotUpdateErr) {
    throw new Error(`Failed to update lot status: ${lotUpdateErr.message}`);
  }

  return getPropertyLotById(propertyId);
}

export async function assignPropertyParties(
  propertyId: string,
  parties: AssignPartyInput[],
  status?: PropertyStatus,
  options?: AssignPropertyOptions
): Promise<PropertyLotWithClient> {
  await requirePermission("properties.update");
  const supabase = await createSupabaseServerClient();

  if (!parties || parties.length === 0) {
    throw new Error("At least one party must be specified when assigning property parties.");
  }

  const { data: lot, error: lotErr } = await supabase
    .from("property_lot")
    .select("area_size, price_per_sqm")
    .eq("property_id", propertyId)
    .single<{ area_size: number; price_per_sqm: number }>();

  if (lotErr || !lot) {
    throw new Error(`Property lot not found: ${lotErr?.message ?? "Unknown error"}`);
  }

  const tcp = options?.total_contract_price ?? Number(lot.area_size) * Number(lot.price_per_sqm);

  // Archive any existing active account
  await supabase
    .from("ledger_account")
    .update({ status: "Cancelled" })
    .eq("property_id", propertyId)
    .eq("status", "Active");

  // Create new active ledger account
  const { data: newAccount, error: accErr } = await supabase
    .from("ledger_account")
    .insert({
      property_id: propertyId,
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
  const hasExplicitPrimary = parties.some((p) => p.is_primary);
  const partyRows = parties.map((p, idx) => ({
    account_id: newAccount.account_id,
    client_id: p.client_id,
    role: p.role?.trim() || (idx === 0 ? "Principal Buyer" : "Co-Owner"),
    ownership_percentage: p.ownership_percentage ?? (100 / parties.length),
    is_primary: hasExplicitPrimary ? Boolean(p.is_primary) : idx === 0,
  }));

  const { error: partiesErr } = await supabase
    .from("account_party")
    .insert(partyRows);

  if (partiesErr) {
    throw new Error(`Failed to assign account parties: ${partiesErr.message}`);
  }

  const nextStatus = status ?? "Reserved";
  const { error: lotUpdateErr } = await supabase
    .from("property_lot")
    .update({ status: nextStatus })
    .eq("property_id", propertyId);

  if (lotUpdateErr) {
    throw new Error(`Failed to update lot status: ${lotUpdateErr.message}`);
  }

  return getPropertyLotById(propertyId);
}

export async function addAccountParty(
  accountId: string,
  input: AssignPartyInput
): Promise<void> {
  await requirePermission("properties.update");
  const supabase = await createSupabaseServerClient();

  if (input.is_primary) {
    await supabase
      .from("account_party")
      .update({ is_primary: false })
      .eq("account_id", accountId);
  }

  const { error } = await supabase
    .from("account_party")
    .insert({
      account_id: accountId,
      client_id: input.client_id,
      role: input.role?.trim() ?? "Co-Owner",
      ownership_percentage: input.ownership_percentage ?? 0,
      is_primary: Boolean(input.is_primary),
    });

  if (error) {
    throw new Error(`Failed to add account party: ${error.message}`);
  }
}

export async function removeAccountParty(
  accountId: string,
  clientId: string
): Promise<void> {
  await requirePermission("properties.update");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("account_party")
    .delete()
    .eq("account_id", accountId)
    .eq("client_id", clientId);

  if (error) {
    throw new Error(`Failed to remove account party: ${error.message}`);
  }
}
