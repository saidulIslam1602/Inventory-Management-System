"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  acceptUserInvitationSchema,
  type AcceptUserInvitationInput,
} from "@/lib/validations/user-invitation";
import { acceptUserInvitation } from "@/lib/actions/user-invitations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";

export function AcceptInviteForm({ token, maskedEmail }: { token: string; maskedEmail: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AcceptUserInvitationInput>({
    resolver: zodResolver(acceptUserInvitationSchema),
    defaultValues: {
      token,
      name: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(data: AcceptUserInvitationInput) {
    setError(null);
    setSuccess(null);
    const res = await acceptUserInvitation(data);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSuccess(res.message ?? "Account created.");
    setTimeout(() => router.push("/login"), 1400);
  }

  return (
    <AuthFormShell
      title="Accept invitation"
      description={`Create your password for ${maskedEmail}. After this step you can sign in.`}
      footer={
        <Link
          href="/login"
          className="text-muted-foreground hover:text-foreground mt-6 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      }
    >
      {(error ?? success) && (
        <Alert variant={error ? "destructive" : "default"} className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error ?? success}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <input type="hidden" {...register("token")} />

        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" autoComplete="name" {...register("name")} aria-invalid={!!errors.name} />
          {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="newPassword">Password</Label>
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
          <Label htmlFor="confirmPassword">Confirm password</Label>
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
              Creating account…
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>
    </AuthFormShell>
  );
}
