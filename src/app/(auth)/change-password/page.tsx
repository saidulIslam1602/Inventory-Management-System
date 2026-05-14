import { Suspense } from "react";
import { ChangePasswordForm } from "./change-password-form";

function Fallback() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground text-sm">Loading…</p>
    </div>
  );
}

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <ChangePasswordForm />
    </Suspense>
  );
}
