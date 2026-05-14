import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessManagerHub } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessManagerHub(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const existing = await prisma.managedDocument.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    await prisma.managedDocument.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Could not delete document. Please try again." },
      { status: 500 }
    );
  }
}
