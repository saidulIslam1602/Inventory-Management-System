"use client";

import { useEffect } from "react";

/**
 * Global error boundary for the root layout.
 * Must render its own <html> and <body> because it replaces the entire root layout.
 * Only triggered for errors that escape the root layout itself (rare).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root layout error:", error);
  }, [error]);

  return (
    <html lang="no">
      <body className="flex min-h-screen items-center justify-center bg-white p-6 font-sans">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Something went wrong</h1>
          <p className="text-sm text-gray-500">
            An unexpected error occurred. Please try refreshing the page.
          </p>
          {error.digest && <p className="font-mono text-xs text-gray-400">ref: {error.digest}</p>}
          {process.env.NODE_ENV === "development" && error.message ? (
            <pre className="w-full overflow-auto whitespace-pre-wrap rounded border border-gray-200 bg-gray-50 p-3 text-left text-xs text-gray-600">
              {error.message}
            </pre>
          ) : null}
          <button
            onClick={reset}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
