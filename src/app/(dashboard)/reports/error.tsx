"use client";

import { useEffect } from "react";
import { PageError } from "@/components/shared/page-error";

export default function ReportsPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Reports error:", error);
  }, [error]);

  return (
    <PageError
      error={error}
      reset={reset}
      title="Reports failed to load"
      description="This page encountered an error. Please try again."
    />
  );
}
