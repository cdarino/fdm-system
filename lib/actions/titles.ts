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
import type { LandTitle } from "@/lib/types/title";
import type { PaginatedResult } from "@/lib/types/client";

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
        .select("*, client:client_id(client_id, full_name, status, address)", { count: "exact" });

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
        .select("*, client:client_id(client_id, full_name, status, address)")
        .eq("property_id", validPropertyId)
        .maybeSingle<LandTitle>();

      if (error) {
        throw new Error(`Failed to fetch land title: ${error.message}`);
      }

      return data ?? null;
    },
  });
}

export async function createLandTitle(
  input: unknown
): Promise<ActionResult<LandTitle>> {
  return titleCreate.run({
    schema: createLandTitleSchema,
    input,
    handler: async (validatedInput, { supabase }) => {
      const { data, error } = await supabase
        .from("land_title")
        .insert({
          property_id: validatedInput.property_id,
          client_id: validatedInput.client_id,
          title_number: validatedInput.title_number ?? null,
          status: validatedInput.status ?? "Processing",
        })
        .select("*, client:client_id(client_id, full_name, status, address)")
        .single<LandTitle>();

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
        .select("*, client:client_id(client_id, full_name, status, address)")
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
