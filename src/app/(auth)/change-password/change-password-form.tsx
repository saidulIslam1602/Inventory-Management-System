"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validations/auth";
import { changePassword } from "@/lib/actions/password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";

export function ChangePasswordForm() {
  const router = useRouter();
  const { data: session, update, status } = useSession();
  const forced = session?.user?.mustChangePassword === true;

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  if (status === "loading") {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  async function onSubmit(data: ChangePasswordInput) {
    setError(null);
    setInfo(null);
    const res = await changePassword(data);
    if (!res.success) {
      setError(res.error);
      return;
    }

    await update({ mustChangePassword: false });

    setInfo(res.message ?? "Password saved.");
    const role = session?.user?.role;
    const next = role === "STAFF" ? "/me" : "/dashboard";
    router.push(next);
  }

  return (
    <AuthFormShell
      title={forced ? "Choose a new password" : "Change password"}
      description={
        forced
          ? "Your account was created with a temporary password. Set your own password to continue."
          : "Enter your current password, then choose a new one."
      }
      footer={
        <div className="mt-6 text-center">
          {forced ? null : (
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to dashboard
            </Link>
          )}
        </div>
      }
    >
      {(error ?? info) && (
        <Alert variant={error ? "destructive" : "default"} className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error ?? info}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {!forced && (
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              {...register("currentPassword")}
              aria-invalid={!!errors.currentPassword}
            />
            {errors.currentPassword && (
              <p className="text-destructive text-xs">{errors.currentPassword.message}</p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="newPassword">New password</Label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            {...register("newPassword")}
            aria-invalid={!!errors.newPassword}
          />
          {errors.newPassword && (
            <p className="text-destructive text-xs">{errors.newPassword.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...register("confirmPassword")}
            aria-invalid={!!errors.confirmPassword}
          />
          {errors.confirmPassword && (
            <p className="text-destructive text-xs">{errors.confirmPassword.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save password"
          )}
        </Button>
      </form>
    </AuthFormShell>
  );
}
