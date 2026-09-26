import type { ActionResult } from "@/lib/actions/action-result";

export function unwrap<T>(result: ActionResult<T>): T {
  if (!result.success) {
    const details = result.fieldErrors ? ` (${JSON.stringify(result.fieldErrors)})` : "";
    throw new Error(`ActionResult failed: ${result.error}${details}`);
  }
  return result.data;
}
