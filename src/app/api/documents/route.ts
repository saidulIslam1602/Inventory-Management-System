import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessManagerHub } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessManagerHub(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const docs = await prisma.managedDocument.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        name: true,
        category: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
        uploadedBy: { select: { name: true } },
      },
    });

    return NextResponse.json(
      docs.map((d) => ({
        id: d.id,
        name: d.name,
        category: d.category,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        createdAt: d.createdAt.toISOString(),
        uploaderName: d.uploadedBy.name ?? null,
      }))
    );
  } catch {
    return NextResponse.json({ error: "Failed to load documents." }, { status: 500 });
  }
}
