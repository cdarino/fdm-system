import { z } from "zod";

export const createUserSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  roleIds: z.array(z.string()).default([]),
});

export const updateUserProfileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
});

export type CreateUserFormData = z.infer<typeof createUserSchema>;
export type UpdateUserProfileFormData = z.infer<typeof updateUserProfileSchema>;
