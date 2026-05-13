"use server";

import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendPasswordResetOtpEmail } from "@/lib/email/send-password-reset-otp";
import { isDigestEmailConfigured } from "@/lib/email/nodemailer-transport";
import { generateNumericOtp, hashOtp, verifyOtpAgainstHash } from "@/lib/auth/otp";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordWithOtpSchema,
} from "@/lib/validations/auth";
import { UserMessage } from "@/lib/user-messages";
import type { ActionResult } from "@/types";

const OTP_TTL_MIN = 15;
const OTP_MAX_ATTEMPT = 5;
const RESEND_SECONDS = 60;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Anti-enumeration: same copy whether the account exists. */
const FORGOT_SENT_MESSAGE =
  "If an account exists for that email, we sent a 6-digit code. Check your inbox.";

async function briefDelay(): Promise<void> {
  await new Promise((r) => setTimeout(r, 80));
}

export async function requestPasswordResetOtp(
  formData: unknown
): Promise<ActionResult<{ devOtp?: string }>> {
  const parsed = forgotPasswordSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? UserMessage.validation.invalidInput,
    };
  }

  if (!isDigestEmailConfigured()) {
    return {
      success: false,
      error: "Password reset email is not configured on this server. Contact your administrator.",
    };
  }

  const emailNorm = normalizeEmail(parsed.data.email);

  const user = await prisma.user.findFirst({
    where: { email: { equals: emailNorm, mode: "insensitive" } },
    select: { id: true, email: true, isActive: true },
  });

  if (!user?.isActive) {
    await briefDelay();
    return { success: true, data: { devOtp: undefined }, message: FORGOT_SENT_MESSAGE };
  }

  const recent = await prisma.passwordResetOtp.findFirst({
    where: { emailNorm },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (recent && Date.now() - recent.createdAt.getTime() < RESEND_SECONDS * 1000) {
    return {
      success: false,
      error: `Please wait ${RESEND_SECONDS} seconds before requesting another code.`,
    };
  }

  await prisma.passwordResetOtp.deleteMany({
    where: { emailNorm, consumedAt: null },
  });

  const code = generateNumericOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60_000);

  await prisma.passwordResetOtp.create({
    data: {
      emailNorm,
      codeHash: hashOtp(code),
      expiresAt,
    },
  });

  try {
    await sendPasswordResetOtpEmail({
      to: user.email,
      code,
      minutesValid: OTP_TTL_MIN,
    });
  } catch {
    await prisma.passwordResetOtp.deleteMany({ where: { emailNorm, consumedAt: null } });
    return { success: false, error: "We could not send the email. Try again later." };
  }

  const devOtp = process.env.NODE_ENV === "development" ? code : undefined;
  return { success: true, data: { devOtp }, message: FORGOT_SENT_MESSAGE };
}

export async function resetPasswordWithOtp(formData: unknown): Promise<ActionResult> {
  const parsed = resetPasswordWithOtpSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? UserMessage.validation.invalidInput,
    };
  }

  const emailNorm = normalizeEmail(parsed.data.email);

  const record = await prisma.passwordResetOtp.findFirst({
    where: {
      emailNorm,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record || record.attempts >= OTP_MAX_ATTEMPT) {
    return { success: false, error: "That code is invalid or expired. Request a new one." };
  }

  if (!verifyOtpAgainstHash(parsed.data.code, record.codeHash)) {
    await prisma.passwordResetOtp.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return { success: false, error: "That code is incorrect." };
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: emailNorm, mode: "insensitive" } },
    select: { id: true, isActive: true },
  });

  if (!user?.isActive) {
    return { success: false, error: "That code is invalid or expired. Request a new one." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);

  try {
    await prisma.$transaction([
      prisma.passwordResetOtp.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, mustChangePassword: false },
      }),
    ]);
  } catch {
    return { success: false, error: "Could not update your password. Try again." };
  }

  return {
    success: true,
    data: undefined,
    message: "Password updated. You can sign in with your new password.",
  };
}

export async function changePassword(formData: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: UserMessage.auth.signInRequired };
  }

  const userRow = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, mustChangePassword: true },
  });

  if (!userRow?.passwordHash) {
    return { success: false, error: "Password sign-in is not available for this account." };
  }

  const parsed = changePasswordSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? UserMessage.validation.invalidInput,
    };
  }

  if (!userRow.mustChangePassword) {
    const current = parsed.data.currentPassword;
    if (!current?.length) {
      return { success: false, error: "Enter your current password." };
    }
    const ok = await bcrypt.compare(current, userRow.passwordHash);
    if (!ok) {
      return { success: false, error: "Current password is incorrect." };
    }
  }

  if (parsed.data.newPassword !== parsed.data.confirmPassword) {
    return { success: false, error: "New passwords must match." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  return { success: true, data: undefined, message: "Your password was updated." };
}
