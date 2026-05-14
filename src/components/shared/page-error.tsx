"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PageErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
}

export function PageError({
  error,
  reset,
  title = "Something went wrong",
  description = "This page failed to load. This is usually a temporary issue.",
}: PageErrorProps) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
      <div className="bg-destructive/10 flex h-12 w-12 items-center justify-center rounded-full">
        <AlertTriangle className="text-destructive h-6 w-6" />
      </div>
      <div className="text-center">
        <h2 className="text-foreground mb-1 text-lg font-semibold">{title}</h2>
        <p className="text-muted-foreground mb-4 text-sm">{description}</p>
        {error.digest && (
          <p className="text-muted-foreground/60 mb-3 font-mono text-xs">ref: {error.digest}</p>
        )}
        {process.env.NODE_ENV === "development" && error.message ? (
          <pre className="border-border bg-muted/40 text-muted-foreground mb-4 max-h-40 max-w-lg overflow-auto whitespace-pre-wrap rounded-md border p-3 text-left text-xs">
            {error.message}
          </pre>
        ) : null}
        <Button onClick={reset} variant="outline" size="sm">
          Try again
        </Button>
      </div>
    </div>
  );
}
