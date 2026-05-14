"use client";

import { useEffect } from "react";
import { PageError } from "@/components/shared/page-error";

export default function PurchaseOrdersPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Purchase Orders error:", error);
  }, [error]);

  return (
    <PageError
      error={error}
      reset={reset}
      title="Purchase Orders failed to load"
      description="This page encountered an error. Please try again."
    />
  );
}
