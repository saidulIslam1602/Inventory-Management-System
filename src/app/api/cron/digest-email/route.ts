import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron-auth";
import { runScheduledDigestEmails } from "@/lib/notifications/digest-email-cron";
import {
  runApprovalEscalationEmails,
  runApprovalEscalationInAppNotifications,
} from "@/lib/notifications/approval-escalation";
import { UserMessage } from "@/lib/user-messages";

export const dynamic = "force-dynamic";

/**
 * Daily email digest + approval backlog escalation (in-app + optional email).
 * Secure with `Authorization: Bearer CRON_SECRET` and optional `CRON_ALLOWED_IPS`
 * (comma-separated exact client IPs from trusted `x-forwarded-for` / `x-real-ip`).
 *
 * Schedulers: Vercel Cron, GitHub Actions, Kubernetes CronJob, manual curl.
 */
export async function GET(req: Request) {
  const authError = authorizeCronRequest(req);
  if (authError) {
    if (authError.kind === "not_configured") {
      return NextResponse.json({ error: UserMessage.api.cronNotConfigured }, { status: 503 });
    }
    if (authError.kind === "forbidden_ip") {
      return NextResponse.json({ error: UserMessage.api.forbidden }, { status: 403 });
    }
    return NextResponse.json({ error: UserMessage.api.cronUnauthorized }, { status: 401 });
  }

  const result = await runScheduledDigestEmails();
  const escalationInApp = await runApprovalEscalationInAppNotifications();
  const escalationEmail = await runApprovalEscalationEmails();
  return NextResponse.json({
    digest: result,
    approvalEscalation: { inApp: escalationInApp, email: escalationEmail },
  });
}
