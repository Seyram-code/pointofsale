"use client";

import { useEffect, useRef, useState } from "react";
import { Clipboard, KeyRound, Power, Save, UserPlus, X } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type StaffRole = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "SUPERVISOR" | "CASHIER" | "STOCK_KEEPER" | "ACCOUNTANT";

interface EmployeeRecord {
  id: string;
  employeeNumber: string;
  position: string | null;
  department: string | null;
  employmentType: string;
  user: { id: string; fullName: string; email: string | null; staffCode: string; role: StaffRole; status: string };
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
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [createdAccessCode, setCreatedAccessCode] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [staffAccessCode, setStaffAccessCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const createInFlight = useRef(false);
  const [error, setError] = useState("");
  const [role, setRole] = useState<StaffRole>("CASHIER");
  const [preview, setPreview] = useState({ staffCode: "Generating...", employeeNumber: "Generating..." });
  const [statusConfirmation, setStatusConfirmation] = useState<{ employee: EmployeeRecord; disabled: boolean } | null>(null);
  const toast = useToast();

  async function generateAccessCode(name: string) {
    if (!name.trim() || staffAccessCode || codeLoading) return;
    setCodeLoading(true);
    setError("");
    try {
      const result = await api.get<{ accessCode: string }>(`/employees?role=${encodeURIComponent(role)}&includeAccessCode=1`);
      setStaffAccessCode(result.accessCode);
    } catch (generationError) {
      setError(generationError instanceof ApiClientError ? generationError.message : "Unable to generate a staff access code.");
    } finally {
      setCodeLoading(false);
    }
  }

  function closeCreateForm() {
    setShowForm(false);
    setFullName("");
    setStaffAccessCode("");
    setError("");
  }

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
    if (createInFlight.current) return;
    createInFlight.current = true;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const createdEmployee = await api.post<{ staffAccessCode: string }>("/employees", Object.fromEntries(form.entries()));
      setCreatedAccessCode(createdEmployee.staffAccessCode);
      setShowForm(false);
      setFullName("");
      setStaffAccessCode("");
      toast.success("Employee added", "The employee account was created successfully.");
      router.refresh();
      createInFlight.current = false;
    } catch (submissionError) {
      const message = submissionError instanceof ApiClientError ? submissionError.message : "Unable to create employee.";
      setError(message);
      if (submissionError instanceof ApiClientError && submissionError.code === "CONFLICT" && message.includes("already created")) {
        setShowForm(false);
        setFullName("");
        setStaffAccessCode("");
        router.refresh();
      }
      setBusy(false);
      createInFlight.current = false;
    }
  }

  async function resetAccessCode(employee: EmployeeRecord) {
    setBusy(true);
    setError("");
    try {
      const result = await api.post<{ accessCode: string }>(`/employees/${employee.user.id}/access-code`);
      setCreatedAccessCode(result.accessCode);
      toast.success("Access code reset", `A new sign-in code was generated for ${employee.user.fullName}.`);
    } catch (submissionError) {
      setError(submissionError instanceof ApiClientError ? submissionError.message : "Unable to reset access code.");
    } finally {
      setBusy(false);
    }
  }

  async function revealAccessCode(employee: EmployeeRecord) {
    setBusy(true);
    setError("");
    try {
      const result = await api.get<{ accessCode: string }>(`/employees/${employee.user.id}/access-code/reveal`);
      setCreatedAccessCode(result.accessCode);
    } catch (revealError) {
      const message = revealError instanceof ApiClientError ? revealError.message : "Unable to view the staff access code.";
      if (revealError instanceof ApiClientError && revealError.status === 404) {
        setError(`${employee.user.fullName}'s existing code cannot be recovered. Reset the access code to generate a new one.`);
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(employee: EmployeeRecord) {
    const disabled = employee.user.status === "ACTIVE";
    setStatusConfirmation({ employee, disabled });
  }

  async function confirmStatusChange() {
    if (!statusConfirmation) return;
    const { employee, disabled } = statusConfirmation;
    setStatusConfirmation(null);
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
        description="Create staff accounts, assign roles and manage access codes."
        actions={<Button leftIcon={<UserPlus className="size-4" />} onClick={() => showForm ? closeCreateForm() : setShowForm(true)}>{showForm ? "Close form" : "Add employee"}</Button>}
      />

      {showForm && (
        <Card className="mb-5">
          <CardHeader><CardTitle>Add employee account</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submitCreate} className="grid gap-4 sm:grid-cols-2">
              <Input label="Full name" name="fullName" required placeholder="e.g. Ama Owusu" value={fullName} onChange={(event) => {
                const nextName = event.target.value;
                const startingNameEntry = !fullName.trim() && Boolean(nextName.trim());
                setFullName(nextName);
                if (startingNameEntry) void generateAccessCode(nextName);
              }} />
              <Select label="Role" name="role" required options={canManageAdmins ? roleOptions : roleOptions.filter((option) => option.value !== "ADMIN")} value={role} onChange={(event) => setRole(event.target.value as StaffRole)} />
              <Input
                label="Staff access code"
                name="staffAccessCode"
                value={codeLoading ? "Generating..." : staffAccessCode}
                readOnly
                required
                className="font-mono uppercase text-fg-muted"
                hint={staffAccessCode ? "Generated automatically for this employee" : "Enter the employee name to generate a code"}
              />
              {fullName.trim() && !staffAccessCode && !codeLoading && (
                <Button type="button" size="sm" variant="ghost" className="justify-self-start" onClick={() => void generateAccessCode(fullName)}>
                  Retry code generation
                </Button>
              )}
              <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
                <Input label="Staff short code" value={preview.staffCode} readOnly className="text-fg-muted" hint="Role prefix plus four digits, for example CSH0223" />
                <Input label="Employee ID" value={preview.employeeNumber} readOnly className="text-fg-muted" hint="For example EMP0223" />
              </div>
              <p className="text-sm text-fg-muted sm:col-span-2">The sign-in code is generated when you enter the employee&apos;s name and cannot be edited.</p>
              {error && <p role="alert" className="sm:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger dark:bg-red-950/40">{error}</p>}
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" loading={busy} leftIcon={<Save className="size-4" />}>Create account</Button>
                <Button type="button" variant="outline" onClick={closeCreateForm} leftIcon={<X className="size-4" />}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {createdAccessCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="staff-code-title">
          <Card className="w-full max-w-md">
            <CardHeader><div className="flex items-center justify-between"><CardTitle id="staff-code-title">Staff access code</CardTitle><Button size="icon" variant="ghost" aria-label="Close" onClick={() => setCreatedAccessCode(null)}><X className="size-4" /></Button></div></CardHeader>
            <CardContent>
              <p className="text-sm text-fg-secondary">This is the employee&apos;s staff-only sign-in credential. Share it securely.</p>
              <p className="my-4 break-all rounded-lg border border-line bg-muted px-3 py-3 font-mono text-sm text-fg">{createdAccessCode}</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreatedAccessCode(null)}>Close</Button>
                <Button leftIcon={<Clipboard className="size-4" />} onClick={() => {
                  void navigator.clipboard.writeText(createdAccessCode).then(() => toast.success("Code copied", "The staff access code is on your clipboard."));
                }}>Copy code</Button>
              </div>
            </CardContent>
          </Card>
        </div>
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
                <tbody>{initialEmployees.map((employee) => <tr key={employee.id} className="border-b border-line last:border-0"><td className="px-4 py-3"><p className="font-medium text-fg">{employee.user.fullName}</p><p className="text-xs text-fg-muted">{employee.employeeNumber} · {employee.user.staffCode}{employee.user.email ? ` · ${employee.user.email}` : ""}</p></td><td className="px-4 py-3 text-fg">{roleLabel(employee.user.role)}</td><td className="px-4 py-3"><Badge variant={employee.user.status === "ACTIVE" ? "success" : "neutral"} size="sm">{employee.user.status}</Badge></td><td className="px-4 py-3"><div className="flex justify-end gap-2">{canManageAdmins && <Button size="sm" variant="outline" leftIcon={<KeyRound className="size-4" />} loading={busy} onClick={() => void revealAccessCode(employee)}>View access code</Button>}<Button size="sm" variant="outline" leftIcon={<KeyRound className="size-4" />} loading={busy} onClick={() => void resetAccessCode(employee)}>Reset access code</Button><Button size="sm" variant={employee.user.status === "ACTIVE" ? "danger" : "success"} leftIcon={<Power className="size-4" />} loading={busy} onClick={() => void toggleStatus(employee)}>{employee.user.status === "ACTIVE" ? "Disable" : "Enable"}</Button></div></td></tr>)}</tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={statusConfirmation !== null}
        title={statusConfirmation?.disabled ? `Disable ${statusConfirmation.employee.user.fullName}'s account?` : `Enable ${statusConfirmation?.employee.user.fullName}'s account?`}
        message={statusConfirmation?.disabled ? "This will block the employee from signing in until the account is enabled again." : "This will restore the employee's ability to sign in."}
        confirmLabel={statusConfirmation?.disabled ? "Disable account" : "Enable account"}
        destructive={statusConfirmation?.disabled}
        loading={busy}
        onCancel={() => setStatusConfirmation(null)}
        onConfirm={() => void confirmStatusChange()}
      />
    </>
  );
}