"use client";

/**
 * Persist named filter presets in localStorage (current URL query string).
 */

import { startTransition, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

type Preset = { name: string; query: string };

function storageKey(id: string): string {
  return `aqila-ims:view:${id}`;
}

function loadPresets(id: string): Preset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(id));
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

function persistPresets(id: string, presets: Preset[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(id), JSON.stringify(presets));
}

export function SavedViewsBar({ storageId }: { storageId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.toString();

  const [presets, setPresets] = useState<Preset[]>([]);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState("");

  useEffect(() => {
    startTransition(() => {
      setPresets(loadPresets(storageId));
    });
  }, [storageId]);

  const applyQuery = (q: string) => {
    router.push(q ? `${pathname}?${q}` : pathname);
  };

  const onSave = () => {
    const n = name.trim();
    if (!n) return;
    const next = [...presets.filter((p) => p.name !== n), { name: n, query }];
    persistPresets(storageId, next);
    setPresets(next);
    setName("");
    setSelected("");
  };

  const onDelete = () => {
    if (!selected) return;
    const next = presets.filter((p) => p.name !== selected);
    persistPresets(storageId, next);
    setPresets(next);
    setSelected("");
  };

  return (
    <div className="border-border bg-muted/10 flex flex-wrap items-end gap-3 rounded-lg border border-dashed px-3 py-2">
      <div className="flex min-w-[200px] flex-wrap items-center gap-2">
        <Label className="text-muted-foreground whitespace-nowrap text-xs">Saved views</Label>
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
  );
}
