import { z } from "zod";

export const createBillingLedgerSchema = z.object({
  clientId: z.string().uuid("Invalid client ID"),
  propertyId: z.string().uuid("Invalid property ID"),
  contractPrice: z.number().positive("Contract price must be greater than 0"),
  downpayment: z.number().min(0, "Downpayment cannot be negative").default(0),
  dpPaidAtSigning: z.boolean().optional().default(true),
  termMonths: z.number().int().min(1).max(120, "Term cannot exceed 120 months"),
  firstDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "First due date must be YYYY-MM-DD"),
  dueDay: z.number().int().min(1).max(31, "Due day must be between 1 and 31"),
  penaltyRate: z.number().min(0).max(100, "Penalty rate percentage must be between 0 and 100").default(3.5),
});

export const postBillingPaymentSchema = z.object({
  accountId: z.string().uuid("Invalid account ID"),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Payment date must be YYYY-MM-DD"),
  amount: z.number().positive("Payment amount must be greater than 0"),
  receiptNumber: z.string().min(1, "Receipt number is required"),
  paymentMethod: z.enum(["cash", "check", "bank_transfer"]).default("cash"),
  waivePenalty: z.boolean().optional().default(false),
  notes: z.string().optional(),
});

export const voidBillingPaymentSchema = z.object({
  paymentId: z.string().uuid("Invalid payment ID"),
});

export const updateBillingPoliciesSchema = z.object({
  accountId: z.string().uuid("Invalid account ID"),
  penaltyRate: z.number().min(0).max(100),
  enableMaturityAmnesty: z.boolean(),
  amnestyMonths: z.number().int().min(1).max(60).optional(),
  enablePostMaturityReducedRate: z.boolean(),
  postMaturityPenaltyRate: z.number().min(0).max(100).optional(),
});

export const recordBillingNoticeSchema = z.object({
  accountId: z.string().uuid("Invalid account ID"),
  stage: z.enum(["first_notice", "second_notice", "final_demand", "forfeited"]),
  noticeNumber: z.number().int().min(1).max(4),
  noticeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Notice date must be YYYY-MM-DD"),
  title: z.string().min(1, "Notice title is required"),
  trackingNumber: z.string().optional(),
  notes: z.string().optional(),
  overdueAmount: z.number().min(0).default(0),
  arrearsPrincipal: z.number().min(0).default(0),
  penaltyDue: z.number().min(0).default(0),
});

export const forfeitBillingAccountSchema = z.object({
  accountId: z.string().uuid("Invalid account ID"),
  reason: z.string().optional(),
  forfeitedAt: z.string().optional(),
});

export const clearanceInputSchema = z.union([
  z.string().uuid("Invalid account ID").transform((val) => ({ account_id: val })),
  z.object({
    account_id: z.string().uuid("Invalid account ID"),
    remarks: z.string().optional().nullable(),
  }),
]);

export type CreateBillingLedgerInput = z.infer<typeof createBillingLedgerSchema>;
export type PostBillingPaymentInput = z.infer<typeof postBillingPaymentSchema>;
export type VoidBillingPaymentInput = z.infer<typeof voidBillingPaymentSchema>;
export type UpdateBillingPoliciesInput = z.infer<typeof updateBillingPoliciesSchema>;
export type RecordBillingNoticeInput = z.infer<typeof recordBillingNoticeSchema>;
export type ForfeitBillingAccountInput = z.infer<typeof forfeitBillingAccountSchema>;
