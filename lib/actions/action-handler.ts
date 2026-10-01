import "server-only";

import type { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/actions/auth-guard";
import { getUserInfo } from "@/lib/user";
import {
  type ActionResult,
  actionSuccess,
  actionError,
  actionZodError,
} from "@/lib/actions/action-result";

export interface ActionContext {
  supabase: SupabaseClient;
  userId: string;
}

export interface ScopeOptions {
  admin?: boolean;
}

export interface RunActionOptions<TSchema extends z.ZodTypeAny, TResult> {
  permissions?: string[];
  schema?: TSchema;
  input?: unknown;
  handler: (
    data: z.infer<TSchema>,
    ctx: ActionContext
  ) => Promise<TResult>;
}

export interface QueryOptions<TSchema extends z.ZodTypeAny = z.ZodTypeAny, TResult = unknown> {
  permissions?: string[];
  schema?: TSchema;
  input?: unknown;
  handler: (
    data: z.infer<TSchema>,
    ctx: ActionContext
  ) => Promise<TResult>;
}

export function createScope(
  basePermissions: string[] = [],
  scopeOptions?: ScopeOptions
) {
  const resolveContext = async (extraPermissions: string[] = []): Promise<ActionContext> => {
    const allPermissions = Array.from(new Set([...basePermissions, ...extraPermissions]));
    let callerId = "";

    if (allPermissions.length > 0) {
      for (const permission of allPermissions) {
        callerId = await requirePermission(permission);
      }
    } else {
      const user = await getUserInfo();
      callerId = user?.id ?? "";
    }

    const supabase = scopeOptions?.admin
      ? createAdminClient()
      : await createSupabaseServerClient();
    return { supabase, userId: callerId };
  };

  const run = async <TSchema extends z.ZodTypeAny = z.ZodTypeAny, TResult = void>(
    options: RunActionOptions<TSchema, TResult>
  ): Promise<ActionResult<TResult>> => {
    try {
      let validatedData = options.input as z.infer<TSchema>;
      if (options.schema) {
        const parsed = options.schema.safeParse(options.input);
        if (!parsed.success) {
          return actionZodError(parsed.error);
        }
        validatedData = parsed.data;
      }

      const ctx = await resolveContext(options.permissions);
      const result = await options.handler(validatedData, ctx);
      return actionSuccess(result);
    } catch (error) {
      return actionError(error instanceof Error ? error.message : "Action failed");
    }
  };

  async function query<TResult>(
    handler: (ctx: ActionContext) => Promise<TResult>
  ): Promise<TResult>;
  async function query<TSchema extends z.ZodTypeAny, TResult>(
    options: QueryOptions<TSchema, TResult>
  ): Promise<TResult>;
  async function query<TResult>(
    options: Omit<QueryOptions<z.ZodTypeAny, TResult>, "schema" | "input"> & {
      handler: (data: undefined, ctx: ActionContext) => Promise<TResult>;
    }
  ): Promise<TResult>;
  async function query<TResult>(
    handlerOrOptions:
      | ((ctx: ActionContext) => Promise<TResult>)
      | QueryOptions<z.ZodTypeAny, TResult>
  ): Promise<TResult> {
    if (typeof handlerOrOptions === "function") {
      const ctx = await resolveContext();
      return handlerOrOptions(ctx);
    }
    let validatedData: unknown = handlerOrOptions.input;
    if (handlerOrOptions.schema) {
      const parsed = handlerOrOptions.schema.safeParse(handlerOrOptions.input);
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? "Validation failed";
        throw new Error(`Validation error: ${message}`);
      }
      validatedData = parsed.data;
    }
    const ctx = await resolveContext(handlerOrOptions.permissions);
    return handlerOrOptions.handler(validatedData, ctx);
  }

  return {
    extend: (additionalPermissions: string[], extendOptions?: ScopeOptions) => {
      return createScope(
        [...basePermissions, ...additionalPermissions],
        extendOptions ?? scopeOptions
      );
    },

    query,

    execute: query,

    run,

    createAction: <TSchema extends z.ZodTypeAny, TResult>(
      options: Omit<RunActionOptions<TSchema, TResult>, "input">
    ) => {
      return (input: unknown): Promise<ActionResult<TResult>> => {
        return run({ ...options, input });
      };
    },
  };
}
