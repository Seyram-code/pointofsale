"use client";

import { useEffect, useState } from "react";
import { KeyRound, Power, Save, UserPlus, X } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";

type StaffRole = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "SUPERVISOR" | "CASHIER" | "STOCK_KEEPER" | "ACCOUNTANT";

interface EmployeeRecord {
  id: string;
  employeeNumber: string;
  position: string | null;
  department: string | null;
  employmentType: string;
  user: { id: string; fullName: string; email: string; staffCode: string; role: StaffRole; status: string };
}

const roleOptions = [
  { value: "ADMIN", label: "Administrator" },
  { value: "MANAGER", label: "Store Manager" },
  { value: "SUPERVISOR", label: "Supervisor" },
  { value: "CASHIER", label: "Cashier" },
  { value: "STOCK_KEEPER", label: "Stock Keeper" },
  { value: "ACCOUNTANT", label: "Accountant" },
];

function roleLabel(role: StaffRole) {
  return roleOptions.find((option) => option.value === role)?.label ?? role;
}

export function EmployeeManagement({ initialEmployees, canManageAdmins }: { initialEmployees: EmployeeRecord[]; canManageAdmins: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [resetFor, setResetFor] = useState<EmployeeRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [role, setRole] = useState<StaffRole>("CASHIER");
  const [preview, setPreview] = useState({ staffCode: "Generating...", employeeNumber: "Generating..." });
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    setPreview({ staffCode: "Generating...", employeeNumber: "Generating..." });
    api.get<{ staffCode: string; employeeNumber: string }>(`/employees?role=${encodeURIComponent(role)}`)
      .then((identifiers) => !cancelled && setPreview(identifiers))
      .catch(() => !cancelled && setPreview({ staffCode: "Unavailable", employeeNumber: "Unavailable" }));
    return () => { cancelled = true; };
  }, [role]);

  async function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api.post("/employees", Object.fromEntries(form.entries()));
      toast.success("Employee added", "The employee account was created successfully.");
      window.setTimeout(() => window.location.reload(), 600);
    } catch (submissionError) {
      setError(submissionError instanceof ApiClientError ? submissionError.message : "Unable to create employee.");
      setBusy(false);
    }
  }

  async function submitReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resetFor) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api.post(`/employees/${resetFor.user.id}/password`, { password: form.get("password") });
      setResetFor(null);
      toast.success("Password updated", "The employee password was reset successfully.");
    } catch (submissionError) {
      setError(submissionError instanceof ApiClientError ? submissionError.message : "Unable to reset password.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(employee: EmployeeRecord) {
    const disabled = employee.user.status === "ACTIVE";
    if (!window.confirm(`${disabled ? "Disable" : "Enable"} ${employee.user.fullName}'s account?`)) return;
    setBusy(true);
    setError("");
    try {
      await api.post(`/employees/${employee.user.id}/status`, { disabled });
      toast.success(disabled ? "Employee disabled" : "Employee enabled", `${employee.user.fullName}'s account was updated successfully.`);
      window.setTimeout(() => window.location.reload(), 600);
    } catch (statusError) {
      setError(statusError instanceof ApiClientError ? statusError.message : "Unable to update employee status.");
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Employees"
        description="Create staff accounts, assign roles and manage passwords."
        actions={<Button leftIcon={<UserPlus className="size-4" />} onClick={() => setShowForm((value) => !value)}>{showForm ? "Close form" : "Add employee"}</Button>}
      />

      {showForm && (
        <Card className="mb-5">
          <CardHeader><CardTitle>Add employee account</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submitCreate} className="grid gap-4 sm:grid-cols-2">
              <Input label="Full name" name="fullName" required placeholder="e.g. Ama Owusu" />
              <Input label="Email" name="email" type="email" required placeholder="ama@store.com" />
              <Select label="Role" name="role" required options={canManageAdmins ? roleOptions : roleOptions.filter((option) => option.value !== "ADMIN")} value={role} onChange={(event) => setRole(event.target.value as StaffRole)} />
              <Input label="Password" name="password" type="password" required minLength={6} hint="At least 6 characters with upper, lower, number and symbol" />
              <Input label="Position" name="position" placeholder="e.g. Till operator" />
              <Input label="Department" name="department" placeholder="e.g. Front office" />
              <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
                <Input label="Staff short code" value={preview.staffCode} readOnly className="text-fg-muted" hint="Role prefix plus four digits, for example CSH0223" />
                <Input label="Employee ID" value={preview.employeeNumber} readOnly className="text-fg-muted" hint="For example EMP0223" />
              </div>
              <p className="text-sm text-fg-muted sm:col-span-2">The system assigns the actual staff code and employee ID when the account is created.</p>
              {error && <p role="alert" className="sm:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger dark:bg-red-950/40">{error}</p>}
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" loading={busy} leftIcon={<Save className="size-4" />}>Create account</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} leftIcon={<X className="size-4" />}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Employees list</CardTitle></CardHeader>
        <CardContent className="p-0">
          {initialEmployees.length === 0 ? (
            <div className="px-4 py-12 text-center"><p className="font-medium text-fg">No employees yet</p><p className="mt-1 text-sm text-fg-muted">Employee accounts will appear here after they are created.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead><tr className="border-b border-line bg-muted/60"><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-fg-muted">Employee</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-fg-muted">Role</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-fg-muted">Status</th><th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-fg-muted">Actions</th></tr></thead>
                <tbody>{initialEmployees.map((employee) => <tr key={employee.id} className="border-b border-line last:border-0"><td className="px-4 py-3"><p className="font-medium text-fg">{employee.user.fullName}</p><p className="text-xs text-fg-muted">{employee.employeeNumber} · {employee.user.staffCode} · {employee.user.email}</p></td><td className="px-4 py-3 text-fg">{roleLabel(employee.user.role)}</td><td className="px-4 py-3"><Badge variant={employee.user.status === "ACTIVE" ? "success" : "neutral"} size="sm">{employee.user.status}</Badge></td><td className="px-4 py-3"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" leftIcon={<KeyRound className="size-4" />} onClick={() => { setError(""); setResetFor(employee); }}>Reset password</Button><Button size="sm" variant={employee.user.status === "ACTIVE" ? "danger" : "success"} leftIcon={<Power className="size-4" />} loading={busy} onClick={() => void toggleStatus(employee)}>{employee.user.status === "ACTIVE" ? "Disable" : "Enable"}</Button></div></td></tr>)}</tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {resetFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <Card className="w-full max-w-md">
            <CardHeader><div className="flex items-center justify-between"><CardTitle>Reset password</CardTitle><Button size="icon" variant="ghost" aria-label="Close" onClick={() => setResetFor(null)}><X className="size-4" /></Button></div></CardHeader>
            <CardContent><p className="mb-4 text-sm text-fg-secondary">Set a new password for <strong>{resetFor.user.fullName}</strong>. Their active sessions will be signed out.</p><form onSubmit={submitReset} className="space-y-4"><Input label="New password" name="password" type="password" required minLength={6} hint="At least 6 characters with upper, lower, number and symbol" />{error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger dark:bg-red-950/40">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setResetFor(null)}>Cancel</Button><Button type="submit" loading={busy} leftIcon={<KeyRound className="size-4" />}>Set password</Button></div></form></CardContent>
          </Card>
        </div>
      )}
    </>
  );
}