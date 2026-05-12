/**
 * Recent in-app notifications for the signed-in user (header preview).
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserMessage } from "@/lib/user-messages";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: UserMessage.api.unauthorized }, { status: 401 });
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: {
      id: true,
      title: true,
      message: true,
      actionHref: true,
      isRead: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    notifications: notifications.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    })),
  });
}
