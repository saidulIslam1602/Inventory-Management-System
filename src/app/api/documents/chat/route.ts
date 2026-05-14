/**
 * Document Chat — AI stub.
 *
 * To wire in a real provider:
 *   1. Install: npm install openai
 *   2. Add OPENAI_API_KEY to .env
 *   3. Replace the stub body below with an OpenAI streaming response,
 *      loading each doc's text via `prisma.managedDocument.findMany({ where: { id: { in: docIds } } })`
 *      and passing content as context messages.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { canAccessManagerHub } from "@/lib/rbac";

const chatBodySchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(2000, "Message too long"),
  docIds: z.array(z.string().cuid()).max(200, "Too many document IDs").default([]),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessManagerHub(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = chatBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 }
    );
  }

  const { message, docIds } = parsed.data;

  try {
    // ── Stub response ──────────────────────────────────────────────────────────
    // Replace this block with a real LLM call when OPENAI_API_KEY is available.
    const reply =
      docIds.length === 0
        ? "No documents are uploaded yet. Please upload a contract, invoice, or other file first, then ask me anything about them."
        : `I can see ${docIds.length} document${docIds.length === 1 ? "" : "s"} in your portal. ` +
          `AI responses are not yet active — add an OPENAI_API_KEY to your environment to enable full document chat. ` +
          `Your question was: "${message}"`;

    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({ error: "Chat request failed. Please try again." }, { status: 500 });
  }
}
