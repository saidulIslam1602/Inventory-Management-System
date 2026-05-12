"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { projectSchema, type ProjectInput } from "@/lib/validations/project";
import { createProject } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface ProjectFormProps {
  locations: { id: string; name: string }[];
  className?: string;
}

export function ProjectForm({ locations, className }: ProjectFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProjectInput>({
    resolver: zodResolver(projectSchema) as Resolver<ProjectInput>,
    defaultValues: {
      name: "",
      description: "",
      locationId: locations[0]?.id ?? "",
      clientName: "",
      clientPhone: "",
    },
  });

  async function onSubmit(data: ProjectInput) {
    setServerError(null);
    const result = await createProject(data);
    if (!result.success) {
      setServerError(result.error ?? "Could not create project.");
      return;
    }
    router.push("/projects");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={cn("max-w-2xl space-y-6", className)}>
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}
      {Object.keys(errors).length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>Please correct the highlighted fields.</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Project name</Label>
        <Input id="name" {...register("name")} aria-invalid={!!errors.name} />
        {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" rows={3} {...register("description")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="locationId">Location</Label>
          <NativeSelect
            id="locationId"
            className="w-full"
            {...register("locationId")}
            aria-invalid={!!errors.locationId}
          >
            {locations.map((l) => (
              <NativeSelectOption key={l.id} value={l.id}>
                {l.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {errors.locationId && (
            <p className="text-destructive text-xs">{errors.locationId.message}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:col-span-1">
          <div className="space-y-2">
            <Label htmlFor="startDate">Start (optional)</Label>
            <Input id="startDate" type="date" {...register("startDate")} />
            {errors.startDate && (
              <p className="text-destructive text-xs">{String(errors.startDate.message)}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">End (optional)</Label>
            <Input id="endDate" type="date" {...register("endDate")} />
            {errors.endDate && (
              <p className="text-destructive text-xs">{String(errors.endDate.message)}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="clientName">Client (optional)</Label>
          <Input id="clientName" {...register("clientName")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="clientPhone">Client phone (optional)</Label>
          <Input id="clientPhone" {...register("clientPhone")} />
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating…
            </>
          ) : (
            "Create project"
          )}
        </Button>
      </div>
    </form>
  );
}
