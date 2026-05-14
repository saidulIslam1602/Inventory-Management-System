import { AlertTriangle } from "lucide-react";

/**
 * Full-width notice for planned downtime / maintenance (server-rendered).
 */
export function MaintenanceBanner({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="border-warning/40 bg-warning/15 text-warning-foreground border-b px-4 py-2.5 text-center text-sm leading-snug"
    >
      <div className="mx-auto flex max-w-[1440px] items-start justify-center gap-2 sm:items-center">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 sm:mt-0" aria-hidden />
        <span className="text-left sm:text-center">{message}</span>
      </div>
    </div>
  );
}
