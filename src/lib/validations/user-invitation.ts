import { z } from "zod";

export const userInvitationRoleSchema = z.enum(["ADMIN", "MANAGER", "STAFF", "VIEWER"]);

export const createUserInvitationSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  role: userInvitationRoleSchema,
});

export type CreateUserInvitationInput = z.infer<typeof createUserInvitationSchema>;

export const acceptUserInvitationSchema = z
  .object({
    token: z.string().min(20, "Invalid invitation link"),
    name: z.string().min(1, "Enter your name").max(120),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm your password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });

export type AcceptUserInvitationInput = z.infer<typeof acceptUserInvitationSchema>;

export const revokeUserInvitationSchema = z.object({
  invitationId: z.string().min(1),
});
