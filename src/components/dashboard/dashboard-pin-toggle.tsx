"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setDashboardProductPinned, setDashboardProjectPinned } from "@/lib/actions/dashboard-pins";

type Kind = "product" | "project";

export function DashboardPinToggle({
  kind,
  entityId,
  initialPinned,
  className,
}: {
  kind: Kind;
  entityId: string;
  initialPinned: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const next = !initialPinned;
      const fn = kind === "product" ? setDashboardProductPinned : setDashboardProjectPinned;
      const r = await fn(entityId, next);
      if (r.success) router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8 shrink-0", className)}
      disabled={pending}
      onClick={handleClick}
      title={initialPinned ? "Remove from dashboard watchlist" : "Pin to dashboard watchlist"}
    >
      <Bookmark className={cn("h-4 w-4", initialPinned && "fill-primary text-primary")} />
      <span className="sr-only">{initialPinned ? "Unpin" : "Pin"}</span>
    </Button>
  );
}
