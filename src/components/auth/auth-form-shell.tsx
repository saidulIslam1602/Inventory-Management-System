import type { ReactNode } from "react";
import { Zap } from "lucide-react";

/** Narrow auth stack — matches login page visual weight (used for forgot / reset / change password). */
export function AuthFormShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-6 sm:p-8">
      <div className="relative z-[1] w-full max-w-md">
        <div className="mb-8 flex items-center gap-2">
          <div className="bg-primary flex h-10 w-10 items-center justify-center rounded-lg">
            <Zap className="text-primary-foreground h-6 w-6" />
          </div>
          <span className="text-foreground text-lg font-semibold tracking-tight">Aqila IMS</span>
        </div>

        <div className="border-border/80 bg-card/85 ring-foreground/5 supports-[backdrop-filter]:bg-card/75 rounded-2xl border p-6 shadow-md ring-1 backdrop-blur-md sm:p-8">
          <h1 className="text-foreground mb-1 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-muted-foreground mb-8 text-sm leading-relaxed">{description}</p>
          {children}
        </div>

        {footer}

        <p className="text-muted-foreground mt-8 text-center text-xs">
          Aqila IMS v1.0.0 &mdash; Internal use only
        </p>
      </div>
    </div>
  );
}
