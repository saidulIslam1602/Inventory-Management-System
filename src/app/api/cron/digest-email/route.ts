import { NextResponse } from "next/server";
import { runScheduledDigestEmails } from "@/lib/notifications/digest-email-cron";
import {
  runApprovalEscalationEmails,
  runApprovalEscalationInAppNotifications,
} from "@/lib/notifications/approval-escalation";
import { UserMessage } from "@/lib/user-messages";

export const dynamic = "force-dynamic";

/**
 * Daily email digest + approval backlog escalation (in-app + optional email).
 * Secure with Authorization: Bearer CRON_SECRET
 * (Vercel Cron, GitHub Actions, or manual curl).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: UserMessage.api.cronNotConfigured }, { status: 503 });
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: UserMessage.api.unauthorized }, { status: 401 });
  }

  const result = await runScheduledDigestEmails();
  const escalationInApp = await runApprovalEscalationInAppNotifications();
  const escalationEmail = await runApprovalEscalationEmails();
  return NextResponse.json({
    digest: result,
    approvalEscalation: { inApp: escalationInApp, email: escalationEmail },
  });
}
