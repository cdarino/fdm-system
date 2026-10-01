import "server-only";

import type { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/actions/auth-guard";
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

export interface RunActionOptions<TSchema extends z.ZodTypeAny, TResult> {
  permissions?: string[];
  schema?: TSchema;
  input?: unknown;
  handler: (
    data: z.infer<TSchema>,
    ctx: ActionContext
  ) => Promise<TResult>;
}

export interface QueryOptions<TResult> {
  permissions?: string[];
  handler: (ctx: ActionContext) => Promise<TResult>;
}

export function createScope(basePermissions: string[] = []) {
  const resolveContext = async (extraPermissions: string[] = []): Promise<ActionContext> => {
    const allPermissions = Array.from(new Set([...basePermissions, ...extraPermissions]));
    let callerId = "";

    for (const permission of allPermissions) {
      callerId = await requirePermission(permission);
    }

    const supabase = await createSupabaseServerClient();
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

  const query = async <TResult>(
    handlerOrOptions: ((ctx: ActionContext) => Promise<TResult>) | QueryOptions<TResult>
  ): Promise<TResult> => {
    const options =
      typeof handlerOrOptions === "function"
        ? { handler: handlerOrOptions, permissions: [] }
        : handlerOrOptions;

    const ctx = await resolveContext(options.permissions);
    return options.handler(ctx);
  };

  return {
    extend: (additionalPermissions: string[]) => {
      return createScope([...basePermissions, ...additionalPermissions]);
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
