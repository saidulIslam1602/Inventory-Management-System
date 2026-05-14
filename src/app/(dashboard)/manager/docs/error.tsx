"use client";

import { useEffect } from "react";
import { PageError } from "@/components/shared/page-error";

export default function DocsPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Docs error:", error);
  }, [error]);

  return (
    <PageError
      error={error}
      reset={reset}
      title="Docs failed to load"
      description="This page encountered an error. Please try again."
    />
  );
}
