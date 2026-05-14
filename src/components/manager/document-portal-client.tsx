"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  FileText,
  FileCheck2,
  FileBadge,
  FileUp,
  Send,
  Trash2,
  Download,
  Loader2,
  FolderOpen,
  ChevronDown,
  AlertCircle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── types ────────────────────────────────────────────────────────────────────

type DocCategory = "CONTRACT" | "INVOICE" | "OTHER";

interface DocMeta {
  id: string;
  name: string;
  category: DocCategory;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploaderName: string | null;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  error?: boolean;
}

type FilterTab = "ALL" | DocCategory;

// ─── helpers ──────────────────────────────────────────────────────────────────

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB — mirrors server limit

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".png",
  ".jpg",
  ".jpeg",
  ".txt",
  ".csv",
]);

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

const CATEGORY_LABELS: Record<DocCategory, string> = {
  CONTRACT: "Contract",
  INVOICE: "Invoice",
  OTHER: "Other",
};

const CATEGORY_ICON: Record<DocCategory, React.ElementType> = {
  CONTRACT: FileCheck2,
  INVOICE: FileBadge,
  OTHER: FileText,
};

const CATEGORY_COLOR: Record<DocCategory, string> = {
  CONTRACT: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  INVOICE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  OTHER: "bg-muted text-muted-foreground",
};

const TABS: { label: string; value: FilterTab }[] = [
  { label: "All", value: "ALL" },
  { label: "Contracts", value: "CONTRACT" },
  { label: "Invoices", value: "INVOICE" },
  { label: "Other", value: "OTHER" },
];

// ─── inline banner ────────────────────────────────────────────────────────────

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2 text-xs">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} className="hover:opacity-70">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: DocCategory }) {
  const Icon = CATEGORY_ICON[category];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        CATEGORY_COLOR[category]
      )}
    >
      <Icon className="h-3 w-3" />
      {CATEGORY_LABELS[category]}
    </span>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

interface DocumentPortalClientProps {
  userName: string;
}

export function DocumentPortalClient({ userName }: DocumentPortalClientProps) {
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [filter, setFilter] = useState<FilterTab>("ALL");
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadCategory, setUploadCategory] = useState<DocCategory>("OTHER");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hello! I'm your document assistant. You can ask me questions across your uploaded contracts, invoices, and other files. (AI integration coming soon — ask away and I'll be ready when connected.)",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── load documents ──

  const loadDocs = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data: DocMeta[] = await res.json();
        setDocs(data);
      } else {
        const body = await res.json().catch(() => ({}));
        setListError((body as { error?: string }).error ?? "Failed to load documents.");
      }
    } catch {
      setListError("Network error — could not load documents.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    startTransition(() => {
      void loadDocs();
    });
  }, [loadDocs]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── upload ──

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Client-side guards (server enforces the same rules)
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError(
        `File is too large. Maximum allowed size is ${formatBytes(MAX_UPLOAD_BYTES)}.`
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const ext = fileExtension(file.name);
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      setUploadError(
        `File type "${ext || "(none)"}" is not allowed. Accepted: PDF, Word, Excel, image, TXT, CSV.`
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("category", uploadCategory);
      const res = await fetch("/api/documents/upload", { method: "POST", body: form });
      if (res.ok) {
        await loadDocs();
      } else {
        const body = await res.json().catch(() => ({}));
        setUploadError((body as { error?: string }).error ?? "Upload failed. Please try again.");
      }
    } catch {
      setUploadError("Network error — upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ── delete ──

  async function handleDelete(id: string) {
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (res.ok) {
        // Only remove from state after confirmed server delete
        setDocs((prev) => prev.filter((d) => d.id !== id));
      } else {
        const body = await res.json().catch(() => ({}));
        setDeleteError((body as { error?: string }).error ?? "Could not delete document.");
      }
    } catch {
      setDeleteError("Network error — delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  // ── download ──

  function handleDownload(doc: DocMeta) {
    const a = document.createElement("a");
    a.href = `/api/documents/${doc.id}/download`;
    a.download = doc.name;
    a.click();
  }

  // ── chat ──

  async function handleSend() {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await fetch("/api/documents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, docIds: docs.map((d) => d.id) }),
      });
      if (res.ok) {
        const { reply } = (await res.json()) as { reply: string };
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      } else {
        const body = await res.json().catch(() => ({}));
        const errText = (body as { error?: string }).error ?? "Chat request failed.";
        setMessages((prev) => [...prev, { role: "assistant", content: errText, error: true }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Network error — could not reach the assistant.",
          error: true,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  // ── filtered docs ──

  const filtered = filter === "ALL" ? docs : docs.filter((d) => d.category === filter);

  // ── render ──

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* ── Top bar ── */}
      <header className="border-border bg-card flex shrink-0 items-center justify-between border-b px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground gap-1.5"
            onClick={() => window.close()}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Manager Hub
          </Button>
          <div className="bg-border h-5 w-px" />
          <div className="flex items-center gap-2">
            <div className="bg-primary flex h-7 w-7 items-center justify-center rounded-lg">
              <FolderOpen className="text-primary-foreground h-4 w-4" />
            </div>
            <span className="text-foreground font-semibold">Document Portal</span>
          </div>
        </div>
        <span className="text-muted-foreground text-sm">{userName}</span>
      </header>

      {/* ── Body ── */}
      <div className="flex min-h-0 flex-1">
        {/* ── Left: document list ── */}
        <aside className="border-border bg-muted/10 flex w-80 shrink-0 flex-col border-r xl:w-96">
          {/* Upload bar */}
          <div className="border-border space-y-2 border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value as DocCategory)}
                  className="border-border bg-background text-foreground w-full appearance-none rounded-md border px-3 py-1.5 pr-7 text-sm focus:outline-none focus:ring-2"
                >
                  <option value="CONTRACT">Contract</option>
                  <option value="INVOICE">Invoice</option>
                  <option value="OTHER">Other</option>
                </select>
                <ChevronDown className="text-muted-foreground pointer-events-none absolute right-2 top-2 h-4 w-4" />
              </div>
              <Button
                size="sm"
                className="shrink-0 gap-1.5"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4" />
                )}
                Upload
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt,.csv"
                onChange={handleUpload}
              />
            </div>
            {uploadError && (
              <ErrorBanner message={uploadError} onDismiss={() => setUploadError(null)} />
            )}
            {deleteError && (
              <ErrorBanner message={deleteError} onDismiss={() => setDeleteError(null)} />
            )}
          </div>

          {/* Filter tabs */}
          <div className="border-border flex gap-1 border-b px-3 py-2">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  filter === tab.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {tab.label}
                {tab.value !== "ALL" && (
                  <span className="ml-1 tabular-nums opacity-70">
                    ({docs.filter((d) => d.category === tab.value).length})
                  </span>
                )}
                {tab.value === "ALL" && (
                  <span className="ml-1 tabular-nums opacity-70">({docs.length})</span>
                )}
              </button>
            ))}
          </div>

          {/* Document list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
              </div>
            ) : listError ? (
              <div className="px-4 py-6">
                <ErrorBanner message={listError} onDismiss={() => void loadDocs()} />
                <p className="text-muted-foreground mt-2 text-center text-xs">
                  Click the X to retry.
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-14 text-sm">
                <FileText className="h-8 w-8 opacity-30" />
                {docs.length === 0
                  ? "No documents yet. Upload one above."
                  : "No documents in this category."}
              </div>
            ) : (
              <ul className="divide-border divide-y">
                {filtered.map((doc) => {
                  const Icon = CATEGORY_ICON[doc.category];
                  return (
                    <li key={doc.id} className="hover:bg-muted/30 px-4 py-3 transition-colors">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <Icon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium leading-snug" title={doc.name}>
                            {doc.name}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <CategoryBadge category={doc.category} />
                            <span className="text-muted-foreground text-xs">
                              {formatBytes(doc.sizeBytes)}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {formatDate(doc.createdAt)}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            title="Download"
                            onClick={() => handleDownload(doc)}
                            className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <button
                            title="Delete"
                            disabled={deletingId === doc.id}
                            onClick={() => void handleDelete(doc.id)}
                            className="text-muted-foreground hover:text-destructive rounded p-1 transition-colors disabled:opacity-40"
                          >
                            {deletingId === doc.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* ── Right: chat ── */}
        <section className="flex flex-1 flex-col overflow-hidden">
          {/* Chat header */}
          <div className="border-border bg-card border-b px-5 py-3">
            <div className="flex items-center gap-2">
              <Bot className="text-primary h-5 w-5" />
              <span className="font-semibold">Document Chat</span>
              <span className="border-border rounded-full border px-2 py-0.5 text-xs">
                AI stub — coming soon
              </span>
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Ask questions across all your uploaded documents. The AI will have full context once
              connected.
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}
              >
                {msg.role === "assistant" && (
                  <div
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                      msg.error ? "bg-destructive" : "bg-primary"
                    )}
                  >
                    <Bot
                      className={cn(
                        "h-4 w-4",
                        msg.error ? "text-destructive-foreground" : "text-primary-foreground"
                      )}
                    />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : msg.error
                        ? "bg-destructive/10 text-destructive border-destructive/20 rounded-tl-sm border"
                        : "bg-muted text-foreground rounded-tl-sm"
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex gap-3">
                <div className="bg-primary mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                  <Bot className="text-primary-foreground h-4 w-4" />
                </div>
                <div className="bg-muted flex items-center gap-1.5 rounded-2xl rounded-tl-sm px-4 py-3">
                  <span className="bg-muted-foreground h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.3s]" />
                  <span className="bg-muted-foreground h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.15s]" />
                  <span className="bg-muted-foreground h-1.5 w-1.5 animate-bounce rounded-full" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input bar */}
          <div className="border-border bg-card border-t px-4 py-3">
            {docs.length === 0 && (
              <p className="text-muted-foreground mb-2 text-center text-xs">
                Upload at least one document to enable document chat.
              </p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSend();
              }}
              className="flex gap-2"
            >
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={
                  docs.length === 0
                    ? "Upload a document first…"
                    : "Ask a question about your documents…"
                }
                disabled={docs.length === 0 || chatLoading}
                className="border-border bg-background placeholder:text-muted-foreground focus:ring-primary flex-1 rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 disabled:opacity-50"
              />
              <Button
                type="submit"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl"
                disabled={!chatInput.trim() || chatLoading || docs.length === 0}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
