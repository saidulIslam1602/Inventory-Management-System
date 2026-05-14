import { Suspense } from "react";
import { ResetPasswordForm } from "./reset-password-form";

function Fallback() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground text-sm">Loading…</p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
