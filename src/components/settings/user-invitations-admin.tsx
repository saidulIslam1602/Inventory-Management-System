"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { UserRole } from "@prisma/client";
import { Loader2, Mail, UserPlus } from "lucide-react";
import { createUserInvitation, revokeUserInvitation } from "@/lib/actions/user-invitations";
import { UserMessage } from "@/lib/user-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export type PendingInvitationRow = {
  id: string;
  emailNorm: string;
  role: UserRole;
  expiresAt: string;
  invitedByLabel: string;
};

export function UserInvitationsAdmin({
  pendingInvitations,
}: {
  pendingInvitations: PendingInvitationRow[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("VIEWER");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    setDevLink(null);
    setPending(true);
    const r = await createUserInvitation({ email, role });
    setPending(false);
    if (!r.success) {
      setErr(r.error ?? UserMessage.error.generic);
      return;
    }
    setOk(r.message ?? "Invitation sent.");
    setDevLink(r.data?.devInviteUrl ?? null);
    setEmail("");
    router.refresh();
  }

  async function onRevoke(id: string) {
    setErr(null);
    setOk(null);
    setRevokingId(id);
    const r = await revokeUserInvitation({ invitationId: id });
    setRevokingId(null);
    if (!r.success) {
      setErr(r.error ?? UserMessage.error.generic);
      return;
    }
    setOk(r.message ?? "Revoked.");
    router.refresh();
  }

  return (
    <Card className="border-border border shadow-none lg:col-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <UserPlus className="text-primary h-4 w-4" />
          Invite users
        </CardTitle>
        <CardDescription>
          Send a sign-up link by email (SMTP required in production). Recipients choose their
          password. Enterprise SSO / SCIM can replace this later.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          onSubmit={onCreate}
          className="grid max-w-xl gap-4 md:grid-cols-[1fr_140px_auto] md:items-end"
        >
          {err && (
            <Alert variant="destructive" className="md:col-span-3">
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          )}
          {ok && (
            <Alert className="border-success/30 bg-success/8 md:col-span-3">
              <AlertDescription className="text-foreground">{ok}</AlertDescription>
            </Alert>
          )}
          {devLink && (
            <Alert className="md:col-span-3">
              <AlertDescription className="break-all font-mono text-xs">{devLink}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              autoComplete="off"
              placeholder="colleague@aqila.no"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VIEWER">Viewer</SelectItem>
                <SelectItem value="STAFF">Staff</SelectItem>
                <SelectItem value="MANAGER">Manager</SelectItem>
                <SelectItem value="ADMIN">Administrator</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={pending} className="w-full md:w-auto">
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send invite
              </>
            )}
          </Button>
        </form>

        <div>
          <h4 className="text-foreground mb-2 text-sm font-medium">Pending invitations</h4>
          {pendingInvitations.length === 0 ? (
            <p className="text-muted-foreground text-sm">No pending invitations.</p>
          ) : (
            <div className="divide-border divide-y rounded-md border">
              {pendingInvitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <div className="text-foreground text-sm font-medium">{inv.emailNorm}</div>
                    <div className="text-muted-foreground text-xs">
                      Invited by {inv.invitedByLabel} · expires{" "}
                      {new Date(inv.expiresAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      {inv.role.toLowerCase()}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={revokingId === inv.id}
                      onClick={() => onRevoke(inv.id)}
                    >
                      {revokingId === inv.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Revoke"
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
