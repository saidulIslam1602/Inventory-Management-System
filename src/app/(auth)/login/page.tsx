/**
 * Login route — wraps the client form in Suspense for useSearchParams (Next.js static generation).
 */

import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { publicAuthOrigin } from "@/lib/auth-cookie-policy";

function LoginFallback() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground text-sm">Loading…</p>
    </div>
  );
}

export default function LoginPage() {
  const expectedAuthOrigin = publicAuthOrigin();
  const showOriginMismatchHint = process.env.NODE_ENV === "development";

  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm
        expectedAuthOrigin={expectedAuthOrigin}
        showOriginMismatchHint={showOriginMismatchHint}
      />
    </Suspense>
  );
}
