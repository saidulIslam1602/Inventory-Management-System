"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type Resolver, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import {
  createCustomerSchema,
  updateCustomerSchema,
  type CreateCustomerInput,
  type UpdateCustomerInput,
} from "@/lib/validations/customer";
import { createCustomer, updateCustomer } from "@/lib/actions/customers";
import { UserMessage } from "@/lib/user-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

function CustomerCreateForm({ className }: { className?: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateCustomerInput>({
    resolver: zodResolver(createCustomerSchema) as Resolver<CreateCustomerInput>,
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      notes: "",
    },
  });

  async function onSubmit(data: CreateCustomerInput) {
    setServerError(null);
    const r = await createCustomer(data);
    if (!r.success) {
      setServerError(r.error ?? UserMessage.error.generic);
      return;
    }
    router.push(`/customers/${r.data!.id}`);
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
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...register("name")} aria-invalid={!!errors.name} />
        {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email (optional)</Label>
          <Input id="email" type="email" {...register("email")} aria-invalid={!!errors.email} />
          {errors.email && (
            <p className="text-destructive text-xs">{String(errors.email.message)}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input id="phone" {...register("phone")} aria-invalid={!!errors.phone} />
          {errors.phone && (
            <p className="text-destructive text-xs">{String(errors.phone.message)}</p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Address (optional)</Label>
        <Textarea id="address" rows={2} {...register("address")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" rows={3} {...register("notes")} />
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
              Saving…
            </>
          ) : (
            "Create customer"
          )}
        </Button>
      </div>
    </form>
  );
}

function CustomerEditForm({
  customerId,
  initial,
  className,
}: {
  customerId: string;
  initial: CreateCustomerInput & { isActive: boolean };
  className?: string;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<UpdateCustomerInput>({
    resolver: zodResolver(updateCustomerSchema) as Resolver<UpdateCustomerInput>,
    defaultValues: {
      id: customerId,
      name: initial.name,
      email: initial.email ?? "",
      phone: initial.phone ?? "",
      address: initial.address ?? "",
      notes: initial.notes ?? "",
      isActive: initial.isActive,
    },
  });

  async function onSubmit(data: UpdateCustomerInput) {
    setServerError(null);
    const r = await updateCustomer(data);
    if (!r.success) {
      setServerError(r.error ?? UserMessage.error.generic);
      return;
    }
    router.push(`/customers/${data.id}`);
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
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...register("name")} aria-invalid={!!errors.name} />
        {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email (optional)</Label>
          <Input id="email" type="email" {...register("email")} aria-invalid={!!errors.email} />
          {errors.email && (
            <p className="text-destructive text-xs">{String(errors.email.message)}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input id="phone" {...register("phone")} aria-invalid={!!errors.phone} />
          {errors.phone && (
            <p className="text-destructive text-xs">{String(errors.phone.message)}</p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Address (optional)</Label>
        <Textarea id="address" rows={2} {...register("address")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" rows={3} {...register("notes")} />
      </div>
      <Controller
        name="isActive"
        control={control}
        render={({ field }) => (
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <Checkbox
              checked={field.value}
              onCheckedChange={(v) => field.onChange(v === true)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Active</span>
              <span className="text-muted-foreground block text-xs">
                Inactive customers remain in the directory; you can still filter or hide them in
                pickers later.
              </span>
            </span>
          </label>
        )}
      />
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
              Saving…
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </div>
    </form>
  );
}

type CustomerFormProps =
  | { mode: "create"; className?: string }
  | {
      mode: "edit";
      customerId: string;
      initial: CreateCustomerInput & { isActive: boolean };
      className?: string;
    };

export function CustomerForm(props: CustomerFormProps) {
  if (props.mode === "create") {
    return <CustomerCreateForm className={props.className} />;
  }
  return (
    <CustomerEditForm
      customerId={props.customerId}
      initial={props.initial}
      className={props.className}
    />
  );
}
