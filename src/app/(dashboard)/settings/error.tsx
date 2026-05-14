"use client";

import { useEffect } from "react";
import { PageError } from "@/components/shared/page-error";

export default function SettingsPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Settings error:", error);
  }, [error]);

  return (
    <PageError
      error={error}
      reset={reset}
      title="Settings failed to load"
      description="This page encountered an error. Please try again."
    />
  );
}
