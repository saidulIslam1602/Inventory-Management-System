"use client";

/**
 * Login page — Aqila IMS entry point (client).
 * Parent server page wraps this in Suspense for useSearchParams.
 */

import { useEffect, useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { Loader2, AlertCircle, Zap, Info } from "lucide-react";

type LoginFormProps = {
  /** From NEXTAUTH_URL / AUTH_URL — session cookies must match this browser origin. */
  expectedAuthOrigin?: string;
  /** Only in development — show mismatch banner (localhost vs 127.0.0.1, wrong port). */
  showOriginMismatchHint?: boolean;
};

export function LoginForm({ expectedAuthOrigin, showOriginMismatchHint = false }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const urlAuthError = searchParams.get("error");
  const urlErrorMessage =
    urlAuthError === "Configuration"
      ? "The server blocked sign-in because the request host was not trusted. This is now configured—refresh the page and try again."
      : urlAuthError === "RateLimited"
        ? "Too many sign-in attempts from this network. Wait a few minutes and try again."
        : urlAuthError
          ? `Sign-in failed (${urlAuthError}). Try again or contact support.`
          : null;
  const [error, setError] = useState<string | null>(null);
  const [originMismatch, setOriginMismatch] = useState(false);
  const [browserOrigin, setBrowserOrigin] = useState("");

  useEffect(() => {
    if (!showOriginMismatchHint || !expectedAuthOrigin) return;
    queueMicrotask(() => {
      const o = window.location.origin;
      setBrowserOrigin(o);
      setOriginMismatch(o !== expectedAuthOrigin);
    });
  }, [showOriginMismatchHint, expectedAuthOrigin]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginInput) {
    setError(null);
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setError(
          result.error === "RateLimited"
            ? "Too many sign-in attempts from this network. Wait a few minutes and try again."
            : "Invalid email or password. Please try again."
        );
        return;
      }
      const session = await getSession();
      if (session?.user?.mustChangePassword) {
        router.push("/change-password");
        return;
      }
      const role = session?.user?.role;
      const next =
        callbackUrl && callbackUrl !== "/dashboard"
          ? callbackUrl
          : role === "STAFF"
            ? "/me"
            : "/dashboard";
      router.push(next);
    } catch (e) {
      console.error("signIn failed:", e);
      setError(
        e instanceof Error
          ? `Sign-in request failed: ${e.message}. Is the dev server running and PostgreSQL reachable?`
          : "Sign-in request failed. Check the dev server console and database connection."
      );
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="app-login-brand-panel text-sidebar-foreground hidden flex-col justify-between p-12 lg:flex lg:w-1/2">
        <div className="relative z-[1] flex items-center gap-3">
          <div className="bg-primary flex h-10 w-10 items-center justify-center rounded-lg">
            <Zap className="text-primary-foreground h-6 w-6" />
          </div>
          <span className="text-sidebar-foreground text-lg font-semibold tracking-tight">
            Aqila IMS
          </span>
        </div>

        <div className="relative z-[1]">
          <blockquote className="text-sidebar-foreground/80 mb-6 text-2xl font-light leading-relaxed">
            &ldquo;Vi kobler Lofoten sammen&rdquo;
          </blockquote>
          <p className="text-sidebar-foreground/50 text-sm">
            Inventory &amp; Management System for Aqila AS — Lofoten, Norway
          </p>
        </div>

        <div className="relative z-[1] grid grid-cols-2 gap-4">
          {[
            { label: "Locations", value: "4 branches" },
            { label: "Services", value: "Elektro · Alarm · EV" },
            { label: "Founded", value: "1985" },
            { label: "Region", value: "Lofoten" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm backdrop-blur-[2px]"
            >
              <div className="text-sidebar-foreground/50 mb-1 text-xs">{stat.label}</div>
              <div className="text-sidebar-foreground text-sm font-medium">{stat.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="app-login-form-side bg-background relative flex flex-1 items-center justify-center p-6 sm:p-8">
        <div className="relative z-[1] w-full max-w-md">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg">
              <Zap className="text-primary-foreground h-5 w-5" />
            </div>
            <span className="text-foreground font-semibold">Aqila IMS</span>
          </div>

          <div className="border-border/80 bg-card/85 ring-foreground/5 supports-[backdrop-filter]:bg-card/75 rounded-2xl border p-6 shadow-md ring-1 backdrop-blur-md sm:p-8">
            <h1 className="text-foreground mb-1 text-2xl font-semibold tracking-tight">
              Welcome back
            </h1>
            <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
              Sign in to your account to continue
            </p>

            {(error ?? urlErrorMessage) && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error ?? urlErrorMessage}</AlertDescription>
              </Alert>
            )}

            {originMismatch && expectedAuthOrigin && (
              <Alert className="mb-6 border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-100">
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription>
                  You opened <span className="font-mono">{browserOrigin}</span>, but Auth.js is
                  configured for <span className="font-mono">{expectedAuthOrigin}</span>. Cookies
                  won&apos;t match across different hosts (e.g.{" "}
                  <span className="font-mono">localhost</span> vs{" "}
                  <span className="font-mono">127.0.0.1</span>) or ports — sign-in may fail or not
                  stick. Open{" "}
                  <a href={`${expectedAuthOrigin}/login`} className="font-medium underline">
                    {expectedAuthOrigin}/login
                  </a>{" "}
                  in this browser instead (or change <span className="font-mono">NEXTAUTH_URL</span>{" "}
                  in <span className="font-mono">.env</span> to match how you browse).
                </AlertDescription>
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
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...register("password")}
                  aria-invalid={!!errors.password}
                />
                {errors.password && (
                  <p className="text-destructive text-xs">{errors.password.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>

              <p className="text-center text-sm">
                <Link href="/forgot-password" className="text-primary hover:underline">
                  Forgot password?
                </Link>
              </p>
            </form>
          </div>

          {(process.env.NODE_ENV === "development" ||
            process.env.NEXT_PUBLIC_SHOW_LOGIN_DEMO === "true") && (
            <p className="text-muted-foreground mt-8 text-center text-xs leading-relaxed">
              Demo: admin@aqila.no · manager@aqila.no · staff@aqila.no — password{" "}
              <span className="font-mono">Aqila2026!</span>
            </p>
          )}
          <p className="text-muted-foreground mt-2 text-center text-xs">
            Aqila IMS v1.0.0 &mdash; Internal use only
          </p>
        </div>
      </div>
    </div>
  );
}
