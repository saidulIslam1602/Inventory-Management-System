"use client";

import { useEffect } from "react";
import { PageError } from "@/components/shared/page-error";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <PageError
      error={error}
      reset={reset}
      title="Unexpected error"
      description="An unexpected error occurred. Please try again or refresh the page."
    />
  );
}
