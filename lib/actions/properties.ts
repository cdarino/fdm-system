"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/actions/auth-guard";
import { getPaginationOffsets, buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import type {
  PropertyLot,
  PropertyLotWithClient,
  PropertyStatus,
  CreatePropertyLotInput,
  UpdatePropertyLotInput,
  GetPropertyLotsParams,
} from "@/lib/types/property";

export async function getPropertyLots(
  params?: GetPropertyLotsParams
): Promise<PaginatedResult<PropertyLotWithClient>> {
  await requirePermission("properties.read");
  const supabase = await createClient();

  const { page, limit, from, to } = getPaginationOffsets(params);

  let query = supabase
    .from("property_lot")
    .select("*, client:client_id(client_id, full_name, status)", { count: "exact" });

  if (params?.search?.trim()) {
    query = query.ilike("location", `%${params.search.trim()}%`);
  }

  if (params?.status) {
    query = query.eq("status", params.status);
  }

  if (params?.client_id) {
    query = query.eq("client_id", params.client_id);
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

  const { data, error, count } = await query.returns<PropertyLotWithClient[]>();
  if (error) {
    throw new Error(`Failed to fetch property lots: ${error.message}`);
  }

  return buildPaginatedResult(data ?? [], count ?? 0, page, limit);
}

export async function getPropertyLotById(
  propertyId: string
): Promise<PropertyLotWithClient> {
  await requirePermission("properties.read");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("property_lot")
    .select("*, client:client_id(client_id, full_name, status)")
    .eq("property_id", propertyId)
    .single<PropertyLotWithClient>();

  if (error || !data) {
    throw new Error(`Property lot not found: ${error?.message ?? "Unknown error"}`);
  }

  return data;
}

export async function createPropertyLot(
  input: CreatePropertyLotInput
): Promise<PropertyLot> {
  await requirePermission("properties.create");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("property_lot")
    .insert({
      location: input.location.trim(),
      block_number: input.block_number,
      lot_number: input.lot_number,
      area_size: input.area_size,
      price_per_sqm: input.price_per_sqm,
      status: input.status ?? "Open",
      client_id: input.client_id ?? null,
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
  const supabase = await createClient();

  const updates: Record<string, unknown> = {};
  if (input.location !== undefined) updates.location = input.location.trim();
  if (input.block_number !== undefined) updates.block_number = input.block_number;
  if (input.lot_number !== undefined) updates.lot_number = input.lot_number;
  if (input.area_size !== undefined) updates.area_size = input.area_size;
  if (input.price_per_sqm !== undefined) updates.price_per_sqm = input.price_per_sqm;
  if (input.status !== undefined) updates.status = input.status;
  if (input.client_id !== undefined) updates.client_id = input.client_id;

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
  const supabase = await createClient();

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
  status?: PropertyStatus
): Promise<PropertyLot> {
  await requirePermission("properties.update");
  const supabase = await createClient();

  // If assigning a client, default status to Reserved; if clearing, default to Open
  const nextStatus = status ?? (clientId ? "Reserved" : "Open");

  const { data, error } = await supabase
    .from("property_lot")
    .update({
      client_id: clientId,
      status: nextStatus,
    })
    .eq("property_id", propertyId)
    .select()
    .single<PropertyLot>();

  if (error || !data) {
    throw new Error(`Failed to update property lot assignment: ${error?.message ?? "Unknown error"}`);
  }

  return data;
}

