"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { UserRole } from "@prisma/client";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  type CreateEmployeeInput,
  type UpdateEmployeeInput,
} from "@/lib/validations/employee";
import { createEmployee, updateEmployee } from "@/lib/actions/employees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type LocationOpt = { id: string; name: string };
type DeptOpt = { id: string; name: string };

const ROLE_OPTIONS: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.STAFF,
  UserRole.VIEWER,
];

interface SharedLists {
  locations: LocationOpt[];
  departments: DeptOpt[];
  className?: string;
}

export function CreateEmployeeForm({ locations, departments, className }: SharedLists) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(createEmployeeSchema) as Resolver<CreateEmployeeInput>,
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      role: UserRole.STAFF,
      employeeCode: undefined,
      hireDate: format(new Date(), "yyyy-MM-dd") as unknown as Date,
      locationId: locations[0]?.id ?? "",
      departmentId: undefined,
      phone: undefined,
      address: undefined,
      photoUrl: undefined,
      isActive: true,
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  async function onSubmit(data: CreateEmployeeInput) {
    setServerError(null);
    const result = await createEmployee(data);
    if (!result.success) {
      setServerError(result.error ?? "Could not create employee.");
      return;
    }
    router.push("/employees");
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" {...register("firstName")} aria-invalid={!!errors.firstName} />
          {errors.firstName && (
            <p className="text-destructive text-xs">{errors.firstName.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" {...register("lastName")} aria-invalid={!!errors.lastName} />
          {errors.lastName && <p className="text-destructive text-xs">{errors.lastName.message}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email (login)</Label>
          <Input id="email" type="email" {...register("email")} aria-invalid={!!errors.email} />
          {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Initial password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register("password")}
            aria-invalid={!!errors.password}
          />
          {errors.password && <p className="text-destructive text-xs">{errors.password.message}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <NativeSelect
            id="role"
            className="w-full"
            {...register("role")}
            aria-invalid={!!errors.role}
          >
            {ROLE_OPTIONS.map((r) => (
              <NativeSelectOption key={r} value={r}>
                {r.charAt(0) + r.slice(1).toLowerCase()}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {errors.role && <p className="text-destructive text-xs">{errors.role.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="employeeCode">Employee code (optional)</Label>
          <Input
            id="employeeCode"
            className="font-mono"
            placeholder="Auto-generated if empty"
            {...register("employeeCode")}
          />
          {errors.employeeCode && (
            <p className="text-destructive text-xs">{errors.employeeCode.message}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="hireDate">Hire date</Label>
          <Input
            id="hireDate"
            type="date"
            {...register("hireDate")}
            aria-invalid={!!errors.hireDate}
          />
          {errors.hireDate && <p className="text-destructive text-xs">{errors.hireDate.message}</p>}
        </div>
        <div className="flex flex-col justify-end space-y-2">
          <div className="flex items-center gap-2 pt-6">
            <input
              id="isActive"
              type="checkbox"
              className="border-border h-4 w-4 rounded"
              {...register("isActive")}
            />
            <Label htmlFor="isActive" className="cursor-pointer font-normal">
              Active employee
            </Label>
          </div>
        </div>
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
        <div className="space-y-2">
          <Label htmlFor="departmentId">Department (optional)</Label>
          <NativeSelect id="departmentId" className="w-full" {...register("departmentId")}>
            <NativeSelectOption value="">— None —</NativeSelectOption>
            {departments.map((d) => (
              <NativeSelectOption key={d.id} value={d.id}>
                {d.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {errors.departmentId && (
            <p className="text-destructive text-xs">{errors.departmentId.message}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input id="phone" {...register("phone")} />
          {errors.phone && <p className="text-destructive text-xs">{errors.phone.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="photoUrl">Photo URL (optional)</Label>
          <Input id="photoUrl" type="url" placeholder="https://…" {...register("photoUrl")} />
          {errors.photoUrl && <p className="text-destructive text-xs">{errors.photoUrl.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address (optional)</Label>
        <Textarea id="address" rows={2} {...register("address")} />
        {errors.address && <p className="text-destructive text-xs">{errors.address.message}</p>}
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
            "Create employee"
          )}
        </Button>
      </div>
    </form>
  );
}

export function EditEmployeeForm({
  employeeId,
  defaultValues,
  locations,
  departments,
  className,
}: SharedLists & {
  employeeId: string;
  defaultValues: {
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
    employeeCode: string;
    hireDate: Date;
    locationId: string;
    departmentId: string | null;
    phone: string | null;
    address: string | null;
    photoUrl: string | null;
    isActive: boolean;
  };
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(updateEmployeeSchema) as Resolver<UpdateEmployeeInput>,
    defaultValues: {
      employeeId,
      firstName: defaultValues.firstName,
      lastName: defaultValues.lastName,
      email: defaultValues.email,
      role: defaultValues.role,
      employeeCode: defaultValues.employeeCode,
      hireDate: format(defaultValues.hireDate, "yyyy-MM-dd") as unknown as Date,
      locationId: defaultValues.locationId,
      departmentId: defaultValues.departmentId ?? undefined,
      phone: defaultValues.phone ?? undefined,
      address: defaultValues.address ?? undefined,
      photoUrl: defaultValues.photoUrl ?? undefined,
      isActive: defaultValues.isActive,
      newPassword: undefined,
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  async function onSubmit(data: UpdateEmployeeInput) {
    setServerError(null);
    const result = await updateEmployee(data);
    if (!result.success) {
      setServerError(result.error ?? "Could not update employee.");
      return;
    }
    router.push("/employees");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={cn("max-w-2xl space-y-6", className)}>
      <input type="hidden" {...register("employeeId")} />
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" {...register("firstName")} aria-invalid={!!errors.firstName} />
          {errors.firstName && (
            <p className="text-destructive text-xs">{errors.firstName.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" {...register("lastName")} aria-invalid={!!errors.lastName} />
          {errors.lastName && <p className="text-destructive text-xs">{errors.lastName.message}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email (login)</Label>
          <Input id="email" type="email" {...register("email")} aria-invalid={!!errors.email} />
          {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="newPassword">New password (optional)</Label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            {...register("newPassword")}
          />
          {errors.newPassword && (
            <p className="text-destructive text-xs">{errors.newPassword.message}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <NativeSelect
            id="role"
            className="w-full"
            {...register("role")}
            aria-invalid={!!errors.role}
          >
            {ROLE_OPTIONS.map((r) => (
              <NativeSelectOption key={r} value={r}>
                {r.charAt(0) + r.slice(1).toLowerCase()}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {errors.role && <p className="text-destructive text-xs">{errors.role.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="employeeCode">Employee code</Label>
          <Input
            id="employeeCode"
            className="font-mono"
            {...register("employeeCode")}
            aria-invalid={!!errors.employeeCode}
          />
          {errors.employeeCode && (
            <p className="text-destructive text-xs">{errors.employeeCode.message}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="hireDate">Hire date</Label>
          <Input
            id="hireDate"
            type="date"
            {...register("hireDate")}
            aria-invalid={!!errors.hireDate}
          />
          {errors.hireDate && <p className="text-destructive text-xs">{errors.hireDate.message}</p>}
        </div>
        <div className="flex flex-col justify-end space-y-2">
          <div className="flex items-center gap-2 pt-6">
            <input
              id="isActive"
              type="checkbox"
              className="border-border h-4 w-4 rounded"
              {...register("isActive")}
            />
            <Label htmlFor="isActive" className="cursor-pointer font-normal">
              Active employee
            </Label>
          </div>
        </div>
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
        <div className="space-y-2">
          <Label htmlFor="departmentId">Department (optional)</Label>
          <NativeSelect id="departmentId" className="w-full" {...register("departmentId")}>
            <NativeSelectOption value="">— None —</NativeSelectOption>
            {departments.map((d) => (
              <NativeSelectOption key={d.id} value={d.id}>
                {d.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {errors.departmentId && (
            <p className="text-destructive text-xs">{errors.departmentId.message}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input id="phone" {...register("phone")} />
          {errors.phone && <p className="text-destructive text-xs">{errors.phone.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="photoUrl">Photo URL (optional)</Label>
          <Input id="photoUrl" type="url" placeholder="https://…" {...register("photoUrl")} />
          {errors.photoUrl && <p className="text-destructive text-xs">{errors.photoUrl.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address (optional)</Label>
        <Textarea id="address" rows={2} {...register("address")} />
        {errors.address && <p className="text-destructive text-xs">{errors.address.message}</p>}
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
            "Save changes"
          )}
        </Button>
      </div>
    </form>
  );
}
