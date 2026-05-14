import { Suspense } from "react";
import { ForgotPasswordForm } from "./forgot-password-form";

function Fallback() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground text-sm">Loading…</p>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
