"use client";

import { useEffect } from "react";
import { PageError } from "@/components/shared/page-error";

export default function ManagerPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Manager error:", error);
  }, [error]);

  return (
    <PageError
      error={error}
      reset={reset}
      title="Manager failed to load"
      description="This page encountered an error. Please try again."
    />
  );
}
