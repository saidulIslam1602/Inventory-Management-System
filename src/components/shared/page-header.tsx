/**
 * PageHeader — Consistent page title + subtitle + optional right-side actions.
 * Used at the top of each module page.
 */

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6",
        className
      )}
    >
      <div className="min-w-0 space-y-0">
        <h1 className="text-foreground text-2xl font-semibold leading-tight tracking-tight sm:text-[1.75rem]">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}
