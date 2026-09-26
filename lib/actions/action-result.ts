import type { z } from "zod";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export function actionSuccess<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function actionError<T = never>(
  error: string,
  fieldErrors?: Record<string, string[]>
): ActionResult<T> {
  return { success: false, error, fieldErrors };
}

export function actionZodError<T = never>(error: z.ZodError): ActionResult<T> {
  return {
    success: false,
    error: error.issues[0]?.message ?? "Validation failed",
    fieldErrors: error.flatten().fieldErrors as Record<string, string[]>,
  };
}
