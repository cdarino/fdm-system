import { z } from "zod";
import { uuidSchema } from "@/lib/validations/client";

export const createUserSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  roleIds: z.array(z.string().uuid("Invalid role ID")).default([]),
});

export const updateUserProfileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
});

export const updateUserProfileActionSchema = updateUserProfileSchema.extend({
  userId: uuidSchema,
});

export const toggleUserActionSchema = z.object({
  userId: uuidSchema,
  enable: z.boolean(),
});

export const setUserRolesActionSchema = z.object({
  userId: uuidSchema,
  roleIds: z.array(z.string().uuid("Invalid role ID")).default([]),
});

export type CreateUserFormData = z.input<typeof createUserSchema>;
export type UpdateUserProfileFormData = z.infer<typeof updateUserProfileSchema>;
