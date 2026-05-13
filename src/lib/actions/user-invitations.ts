"use server";

import bcrypt from "bcryptjs";
import { AuditEventCategory, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { extractAuditMetaFromNextHeaders, recordAuditEventSafe } from "@/lib/audit/record-event";
import { sendUserInvitationEmail } from "@/lib/email/send-user-invitation";
import { isDigestEmailConfigured } from "@/lib/email/nodemailer-transport";
import { generateInviteTokenRaw, hashInviteToken } from "@/lib/auth/invite-token";
import {
  acceptUserInvitationSchema,
  createUserInvitationSchema,
  revokeUserInvitationSchema,
} from "@/lib/validations/user-invitation";
import { canAccessAdminSettings } from "@/lib/rbac";
import { UserMessage } from "@/lib/user-messages";
import type { ActionResult } from "@/types";

const INVITE_TTL_DAYS = 7;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function appBaseUrl(): string {
  const u = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "";
  return u.replace(/\/$/, "");
}

function roleLabel(role: UserRole): string {
  switch (role) {
    case UserRole.ADMIN:
      return "Administrator";
    case UserRole.MANAGER:
      return "Manager";
    case UserRole.STAFF:
      return "Staff";
    case UserRole.VIEWER:
      return "Viewer";
    default:
      return role;
  }
}

export async function createUserInvitation(
  formData: unknown
): Promise<ActionResult<{ devInviteUrl?: string }>> {
  const session = await auth();
  if (!canAccessAdminSettings(session?.user?.role)) {
    return { success: false, error: UserMessage.permission.denied };
  }

  const parsed = createUserInvitationSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? UserMessage.validation.invalidInput,
    };
  }

  const role = parsed.data.role as UserRole;

  const emailNorm = normalizeEmail(parsed.data.email);
  const smtpOk = isDigestEmailConfigured();
  const isDev = process.env.NODE_ENV === "development";

  if (!smtpOk && !isDev) {
    return {
      success: false,
      error:
        "Email is not configured on this server (SMTP). Configure SMTP before sending invitations.",
    };
  }

  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: emailNorm, mode: "insensitive" } },
    select: { id: true },
  });
  if (existingUser) {
    return { success: false, error: "An account with this email already exists." };
  }

  await prisma.userInvitation.updateMany({
    where: {
      emailNorm,
      consumedAt: null,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  const rawToken = generateInviteTokenRaw();
  const tokenHash = hashInviteToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const base = appBaseUrl();
  const invitePath = `/invite/${encodeURIComponent(rawToken)}`;
  const inviteUrl = base ? `${base}${invitePath}` : invitePath;

  const invitation = await prisma.userInvitation.create({
    data: {
      emailNorm,
      role,
      tokenHash,
      expiresAt,
      invitedById: session!.user!.id,
    },
    select: { id: true },
  });

  if (smtpOk) {
    try {
      await sendUserInvitationEmail({
        to: emailNorm,
        inviteUrl,
        roleLabel: roleLabel(role),
        expiresInDays: INVITE_TTL_DAYS,
      });
    } catch {
      await prisma.userInvitation.deleteMany({ where: { tokenHash } });
      return { success: false, error: "We could not send the invitation email. Try again later." };
    }
  }

  const auditMeta = await extractAuditMetaFromNextHeaders();
  await recordAuditEventSafe({
    actorUserId: session!.user!.id,
    actorEmail: session!.user!.email,
    category: AuditEventCategory.SECURITY,
    action: "user.invitation.send",
    targetType: "UserInvitation",
    targetId: invitation.id,
    summary: `Invitation sent to ${emailNorm} (${role}).`,
    metadata: { emailNorm, role },
    ...auditMeta,
  });

  revalidatePath("/settings");
  revalidatePath("/settings/audit-log");

  const devInviteUrl = !smtpOk && isDev ? inviteUrl : undefined;
  return {
    success: true,
    data: { devInviteUrl },
    message: smtpOk
      ? `Invitation sent to ${emailNorm}.`
      : `Invitation created (development only — SMTP not configured). Share the link manually.`,
  };
}

export async function revokeUserInvitation(formData: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!canAccessAdminSettings(session?.user?.role)) {
    return { success: false, error: UserMessage.permission.denied };
  }

  const parsed = revokeUserInvitationSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? UserMessage.validation.invalidInput,
    };
  }

  const pending = await prisma.userInvitation.findFirst({
    where: {
      id: parsed.data.invitationId,
      consumedAt: null,
      revokedAt: null,
    },
    select: { id: true, emailNorm: true, role: true },
  });

  if (!pending) {
    return { success: false, error: "That invitation is no longer pending." };
  }

  await prisma.userInvitation.update({
    where: { id: pending.id },
    data: { revokedAt: new Date() },
  });

  const auditMeta = await extractAuditMetaFromNextHeaders();
  await recordAuditEventSafe({
    actorUserId: session!.user!.id,
    actorEmail: session!.user!.email,
    category: AuditEventCategory.SECURITY,
    action: "user.invitation.revoke",
    targetType: "UserInvitation",
    targetId: pending.id,
    summary: `Invitation revoked for ${pending.emailNorm}.`,
    metadata: { emailNorm: pending.emailNorm, role: pending.role },
    ...auditMeta,
  });

  revalidatePath("/settings");
  revalidatePath("/settings/audit-log");
  return { success: true, data: undefined, message: "Invitation revoked." };
}

export async function acceptUserInvitation(formData: unknown): Promise<ActionResult> {
  const parsed = acceptUserInvitationSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? UserMessage.validation.invalidInput,
    };
  }

  const tokenHash = hashInviteToken(parsed.data.token);

  type TxOutcome =
    | { ok: true; newUserId: string; emailNorm: string; role: UserRole }
    | { ok: false; code: "INVALID" | "EMAIL_TAKEN" };

  let outcome: TxOutcome;
  try {
    outcome = await prisma.$transaction(async (tx): Promise<TxOutcome> => {
      const invite = await tx.userInvitation.findFirst({
        where: {
          tokenHash,
          consumedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      if (!invite) {
        return { ok: false, code: "INVALID" };
      }

      const clash = await tx.user.findFirst({
        where: { email: { equals: invite.emailNorm, mode: "insensitive" } },
        select: { id: true },
      });
      if (clash) {
        return { ok: false, code: "EMAIL_TAKEN" };
      }

      const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
      const name = parsed.data.name.trim();

      const createdUser = await tx.user.create({
        data: {
          email: invite.emailNorm,
          name,
          passwordHash,
          role: invite.role,
          mustChangePassword: false,
        },
      });

      await tx.userInvitation.update({
        where: { id: invite.id },
        data: { consumedAt: new Date() },
      });

      return {
        ok: true,
        newUserId: createdUser.id,
        emailNorm: invite.emailNorm,
        role: invite.role,
      };
    });
  } catch {
    return { success: false, error: "Could not complete sign-up. Try again." };
  }

  if (!outcome.ok) {
    if (outcome.code === "INVALID") {
      return {
        success: false,
        error: "This invitation is invalid or has expired. Ask your administrator for a new link.",
      };
    }
    if (outcome.code === "EMAIL_TAKEN") {
      return {
        success: false,
        error: "An account with this email already exists. Sign in instead.",
      };
    }
    return { success: false, error: "Could not complete sign-up. Try again." };
  }

  const auditMeta = await extractAuditMetaFromNextHeaders();
  await recordAuditEventSafe({
    actorUserId: outcome.newUserId,
    actorEmail: outcome.emailNorm,
    category: AuditEventCategory.SECURITY,
    action: "user.invitation.accepted",
    targetType: "User",
    targetId: outcome.newUserId,
    summary: `Invitation accepted; account created (${outcome.emailNorm}, ${outcome.role}).`,
    metadata: { role: outcome.role },
    ...auditMeta,
  });

  return {
    success: true,
    data: undefined,
    message: "Your account is ready. You can sign in.",
  };
}
