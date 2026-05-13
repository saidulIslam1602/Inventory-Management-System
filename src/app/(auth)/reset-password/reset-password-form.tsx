"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordWithOtpSchema, type ResetPasswordWithOtpInput } from "@/lib/validations/auth";
import { resetPasswordWithOtp } from "@/lib/actions/password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultEmail = searchParams.get("email") ?? "";

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordWithOtpInput>({
    resolver: zodResolver(resetPasswordWithOtpSchema),
    defaultValues: { email: defaultEmail, code: "", newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(data: ResetPasswordWithOtpInput) {
    setError(null);
    setSuccess(null);
    const res = await resetPasswordWithOtp(data);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSuccess(res.message ?? "Password updated.");
    setTimeout(() => router.push("/login"), 1200);
  }

  return (
    <AuthFormShell
      title="Reset password"
      description="Enter the code from your email and choose a new password."
      footer={
        <div className="mt-6 flex flex-col items-center gap-2 text-center">
          <Link
            href="/forgot-password"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            Request a new code
          </Link>
          <Link
            href="/login"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </div>
      }
    >
      {(error ?? success) && (
        <Alert variant={error ? "destructive" : "default"} className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error ?? success}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@aqila.no"
            autoComplete="email"
            {...register("email")}
            aria-invalid={!!errors.email}
          />
          {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>6-digit code</Label>
          <Controller
            control={control}
            name="code"
            render={({ field }) => (
              <InputOTP
                maxLength={6}
                value={field.value}
                onChange={(v) => field.onChange(v)}
                containerClassName="justify-center"
                aria-invalid={!!errors.code}
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            )}
          />
          {errors.code && <p className="text-destructive text-xs">{errors.code.message}</p>}
        </div>

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
              Updating…
            </>
          ) : (
            "Save new password"
          )}
        </Button>
      </form>
    </AuthFormShell>
  );
}
