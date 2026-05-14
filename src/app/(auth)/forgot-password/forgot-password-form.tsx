"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations/auth";
import { requestPasswordResetOtp } from "@/lib/actions/password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(data: ForgotPasswordInput) {
    setError(null);
    setInfo(null);
    const res = await requestPasswordResetOtp(data);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setInfo(res.message ?? null);
    if (res.data?.devOtp) {
      setInfo(`${res.message ?? ""} (Development only — code: ${res.data.devOtp})`.trim());
    }
  }

  return (
    <AuthFormShell
      title="Forgot password"
      description="Enter your work email. If we find an account, we will send a 6-digit code."
      footer={
        <div className="mt-6 text-center">
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
      {(error ?? info) && (
        <Alert variant={error ? "destructive" : "default"} className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error ?? info}</AlertDescription>
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

        <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending code…
            </>
          ) : (
            "Send reset code"
          )}
        </Button>

        <Button variant="outline" className="w-full" size="lg" asChild>
          <Link href="/reset-password">I have a code</Link>
        </Button>
      </form>
    </AuthFormShell>
  );
}
