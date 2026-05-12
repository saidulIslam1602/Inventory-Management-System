"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ProjectStatus } from "@prisma/client";
import { updateProjectStatus } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";

const STATUSES: ProjectStatus[] = [
  ProjectStatus.PLANNING,
  ProjectStatus.IN_PROGRESS,
  ProjectStatus.ON_HOLD,
  ProjectStatus.COMPLETED,
  ProjectStatus.CANCELLED,
];

interface ProjectStatusFormProps {
  projectId: string;
  currentStatus: ProjectStatus;
}

export function ProjectStatusForm({ projectId, currentStatus }: ProjectStatusFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSave() {
    setError(null);
    setPending(true);
    const result = await updateProjectStatus({ projectId, status });
    setPending(false);
    if (!result.success) {
      setError(result.error ?? "Could not update status.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="max-w-xs space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="project-status">Status</Label>
        <NativeSelect
          id="project-status"
          className="w-full"
          value={status}
          onChange={(e) => setStatus(e.target.value as ProjectStatus)}
        >
          {STATUSES.map((s) => (
            <NativeSelectOption key={s} value={s}>
              {s
                .replace(/_/g, " ")
                .toLowerCase()
                .replace(/\b\w/g, (c) => c.toUpperCase())}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <Button
        type="button"
        size="sm"
        onClick={() => void handleSave()}
        disabled={pending || status === currentStatus}
      >
        {pending ? "Saving…" : "Update status"}
      </Button>
    </div>
  );
}
