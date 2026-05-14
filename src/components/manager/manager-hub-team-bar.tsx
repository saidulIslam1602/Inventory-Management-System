"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { SavedViewsBar } from "@/components/shared/saved-views-bar";

export function ManagerHubTeamBar({
  branches,
  scopeKey,
}: {
  branches: Array<{ id: string; name: string }>;
  scopeKey: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const branchIds = useMemo(() => new Set(branches.map((b) => b.id)), [branches]);

  const selectedLocation = searchParams.get("location");
  const safeValue = selectedLocation && branchIds.has(selectedLocation) ? selectedLocation : "";

  const setBranch = (locationId: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (!locationId) next.delete("location");
    else next.set("location", locationId);
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
  };

  return (
    <div className="space-y-3">
      <div className="border-border bg-muted/10 flex flex-wrap items-end gap-3 rounded-lg border border-dashed px-3 py-2">
        <div className="flex min-w-[200px] flex-col gap-1">
          <Label htmlFor="manager-hub-branch" className="text-muted-foreground text-xs">
            Team / branch
          </Label>
          <NativeSelect
            id="manager-hub-branch"
            className="w-full max-w-[280px]"
            size="sm"
            value={safeValue}
            onChange={(e) => setBranch(e.target.value)}
          >
            <NativeSelectOption value="">All branches</NativeSelectOption>
            {branches.map((b) => (
              <NativeSelectOption key={b.id} value={b.id}>
                {b.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
      <SavedViewsBar
        storageId="manager-hub"
        scopeKey={scopeKey}
        hint={
          <>
            Presets store the query string on <span className="font-mono">/manager</span> (e.g.{" "}
            <span className="font-mono">location</span> for branch focus). Pagination keys are
            stripped when saving.
          </>
        }
      />
    </div>
  );
}
