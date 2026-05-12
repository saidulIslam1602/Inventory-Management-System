/**
 * Login route — wraps the client form in Suspense for useSearchParams (Next.js static generation).
 */

import { Suspense } from "react";
import { LoginForm } from "./login-form";

function LoginFallback() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground text-sm">Loading…</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
