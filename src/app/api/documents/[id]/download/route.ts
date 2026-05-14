import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessManagerHub } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessManagerHub(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const doc = await prisma.managedDocument.findUnique({
      where: { id },
      select: { name: true, mimeType: true, content: true },
    });

    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    const safeFilename = encodeURIComponent(doc.name).replace(/'/g, "%27");

    return new NextResponse(doc.content, {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `attachment; filename*=UTF-8''${safeFilename}`,
        "Content-Length": String(doc.content.length),
        "Cache-Control": "private, no-store",
        // Prevent the browser from sniffing the content type
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Download failed. Please try again." }, { status: 500 });
  }
}
