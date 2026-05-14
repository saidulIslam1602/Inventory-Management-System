import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessManagerHub } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { checkApiRateLimit } from "@/lib/api-rate-limit";
import type { DocCategory } from "@prisma/client";

const VALID_CATEGORIES = new Set<string>(["CONTRACT", "INVOICE", "OTHER"]);
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

/** Allowlisted extensions → canonical MIME (ignores browser-supplied type). */
const EXT_TO_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".txt": "text/plain",
  ".csv": "text/csv",
};

function safeFilename(raw: string): string {
  // Strip path components, keep basename only, collapse dangerous chars
  const base = raw.split(/[\\/]/).pop() ?? "document";
  return base.replace(/[^\w.\-() ]/g, "_").slice(0, 255);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessManagerHub(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const limited = await checkApiRateLimit(req, {
    store: "api:documents:upload",
    limit: 30,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  const categoryRaw = formData.get("category");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 20 MB)" }, { status: 413 });
  }

  // Extension allowlist — determine server-side MIME, ignore browser-supplied type
  const dotIdx = file.name.lastIndexOf(".");
  const ext = dotIdx >= 0 ? file.name.slice(dotIdx).toLowerCase() : "";
  const canonicalMime = EXT_TO_MIME[ext];
  if (!canonicalMime) {
    return NextResponse.json(
      {
        error: `File type "${ext || "(none)"}" is not allowed. Accepted: PDF, Word, Excel, image, TXT, CSV.`,
      },
      { status: 415 }
    );
  }

  const category: DocCategory = VALID_CATEGORIES.has(String(categoryRaw))
    ? (String(categoryRaw) as DocCategory)
    : "OTHER";

  const name = safeFilename(file.name);

  let content: Uint8Array<ArrayBuffer>;
  try {
    content = new Uint8Array(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }

  try {
    const doc = await prisma.managedDocument.create({
      data: {
        name,
        category,
        mimeType: canonicalMime,
        sizeBytes: file.size,
        content,
        uploadedById: session.user.id,
      },
      select: { id: true, name: true, category: true, sizeBytes: true, createdAt: true },
    });

    return NextResponse.json({
      id: doc.id,
      name: doc.name,
      category: doc.category,
      sizeBytes: doc.sizeBytes,
      createdAt: doc.createdAt.toISOString(),
    });
  } catch {
    return NextResponse.json(
      { error: "Could not save document. Please try again." },
      { status: 500 }
    );
  }
}
