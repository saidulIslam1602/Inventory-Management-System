"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Check, ShoppingBag, Ban } from "lucide-react";
import type { POStatus } from "@prisma/client";
import { advancePOStatus } from "@/lib/actions/purchase-orders";
import { UserMessage } from "@/lib/user-messages";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Props = {
  poId: string;
  status: POStatus;
  canManage: boolean;
  canSubmit: boolean;
};

export function PurchaseOrderWorkflowButtons({ poId, status, canManage, canSubmit }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = React.useState<string | null>(null);

  async function run(action: "submit" | "approve" | "order" | "cancel") {
    setErr(null);
    start(async () => {
      const r = await advancePOStatus(poId, action);
      if (!r.success) setErr(r.error ?? UserMessage.error.generic);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {err && (
        <Alert variant="destructive">
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        {status === "DRAFT" && canSubmit && (
          <Button type="button" size="sm" disabled={pending} onClick={() => run("submit")}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="ml-2">Submit for approval</span>
          </Button>
        )}
        {status === "SUBMITTED" && canManage && (
          <>
            <Button type="button" size="sm" disabled={pending} onClick={() => run("approve")}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              <span className="ml-2">Approve</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run("cancel")}
            >
              <Ban className="h-4 w-4" />
              <span className="ml-2">Reject / cancel</span>
            </Button>
          </>
        )}
        {status === "APPROVED" && canManage && (
          <>
            <Button type="button" size="sm" disabled={pending} onClick={() => run("order")}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShoppingBag className="h-4 w-4" />
              )}
              <span className="ml-2">Mark as ordered</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run("cancel")}
            >
              <Ban className="h-4 w-4" />
              <span className="ml-2">Cancel</span>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
