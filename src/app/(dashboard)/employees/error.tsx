"use client";

import { useEffect } from "react";
import { PageError } from "@/components/shared/page-error";

export default function EmployeesPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Employees error:", error);
  }, [error]);

  return (
    <PageError
      error={error}
      reset={reset}
      title="Employees failed to load"
      description="This page encountered an error. Please try again."
    />
  );
}
