"use client";

/**
 * Persist named filter presets in localStorage (current URL query string).
 */

import { startTransition, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

type Preset = { name: string; query: string };

/** When `scopeKey` is set (e.g. authenticated user id), presets do not collide on shared workstations. */
function presetBucket(storageId: string, scopeKey?: string): string {
  return scopeKey ? `${storageId}__scope__${scopeKey}` : storageId;
}

function localStorageKey(bucket: string): string {
  return `aqila-ims:view:${bucket}`;
}

/** Dropped when saving / applying presets so pagination does not stick in the bookmark. */
function normalizePresetQuery(q: string): string {
  const p = new URLSearchParams(q);
  p.delete("page");
  return p.toString();
}

function loadPresets(bucket: string): Preset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(localStorageKey(bucket));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is Preset =>
        p != null &&
        typeof p === "object" &&
        typeof (p as Preset).name === "string" &&
        typeof (p as Preset).query === "string"
    );
  } catch {
    return [];
  }
}

function persistPresets(bucket: string, presets: Preset[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(localStorageKey(bucket), JSON.stringify(presets));
}

const DEFAULT_HINT_PRESETS = (
  <>
    Stored presets capture the filters in the address bar on this page. Pagination (
    <span className="font-mono">page</span>) is stripped when saving or loading so you start on page
    1.
  </>
);

export function SavedViewsBar({
  storageId,
  scopeKey,
  hint,
}: {
  storageId: string;
  /** Isolate presets per login (recommended for STAFF on shared PCs). */
  scopeKey?: string;
  hint?: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawQuery = searchParams.toString();
  const query = normalizePresetQuery(rawQuery);

  const bucket = useMemo(() => presetBucket(storageId, scopeKey), [storageId, scopeKey]);

  const [presets, setPresets] = useState<Preset[]>([]);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState("");

  useEffect(() => {
    startTransition(() => {
      setPresets(loadPresets(bucket));
    });
  }, [bucket]);

  const applyQuery = (q: string) => {
    const nq = normalizePresetQuery(q);
    router.push(nq ? `${pathname}?${nq}` : pathname);
  };

  const onSave = () => {
    const n = name.trim();
    if (!n) return;
    const next = [...presets.filter((p) => p.name !== n), { name: n, query }];
    persistPresets(bucket, next);
    setPresets(next);
    setName("");
    setSelected("");
  };

  const onDelete = () => {
    if (!selected) return;
    const next = presets.filter((p) => p.name !== selected);
    persistPresets(bucket, next);
    setPresets(next);
    setSelected("");
  };

  return (
    <div className="space-y-1.5">
      <div className="border-border bg-muted/10 flex flex-wrap items-end gap-3 rounded-lg border border-dashed px-3 py-2">
        <div className="flex min-w-[200px] flex-wrap items-center gap-2">
          <Label className="text-muted-foreground whitespace-nowrap text-xs">
            Saved views
            {scopeKey ? (
              <span className="text-muted-foreground/85 ml-1 font-normal lowercase">
                {" "}
                · Your login
              </span>
            ) : null}
          </Label>
          <NativeSelect
            className="w-full max-w-[220px]"
            size="sm"
            value={selected}
            onChange={(e) => {
              const v = e.target.value;
              setSelected(v);
              if (!v) return;
              const preset = presets.find((p) => p.name === v);
              if (preset) applyQuery(preset.query);
            }}
          >
            <NativeSelectOption value="">Load preset…</NativeSelectOption>
            {presets.map((p) => (
              <NativeSelectOption key={p.name} value={p.name}>
                {p.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Name…"
            className="h-8 w-36"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="button" size="sm" variant="secondary" onClick={onSave}>
            Save current filters
          </Button>
          {selected ? (
            <Button type="button" size="sm" variant="ghost" onClick={onDelete}>
              Remove selected
            </Button>
          ) : null}
        </div>
      </div>
      <p className="text-muted-foreground text-[11px] leading-snug">
        {hint ?? DEFAULT_HINT_PRESETS}
      </p>
    </div>
  );
}
