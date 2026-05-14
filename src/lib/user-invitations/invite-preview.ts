import { prisma } from "@/lib/db";
import { hashInviteToken, maskEmailNorm } from "@/lib/auth/invite-token";

export async function getInvitationPreviewForToken(rawToken: string): Promise<{
  maskedEmail: string;
} | null> {
  const tokenHash = hashInviteToken(rawToken);
  const row = await prisma.userInvitation.findFirst({
    where: {
      tokenHash,
      consumedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { emailNorm: true },
  });
  if (!row) return null;
  return { maskedEmail: maskEmailNorm(row.emailNorm) };
}
