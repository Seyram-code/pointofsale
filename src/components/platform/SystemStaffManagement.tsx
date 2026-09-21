"use client";

import { useState } from "react";
import { KeyRound, Power, Save, Trash2, UserPlus } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";

type SystemStaff = {
  id: string;
  fullName: string;
  email: string;
  staffCode: string;
  status: string;
  lastLoginAt: string | Date | null;
  createdAt: string | Date;
};

export function SystemStaffManagement({ initialStaff = [] }: { initialStaff?: SystemStaff[] }) {
  const [staff, setStaff] = useState(initialStaff);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [statusConfirmation, setStatusConfirmation] = useState<{ member: SystemStaff; disabled: boolean } | null>(null);
  const toast = useToast();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const created = await api.post<SystemStaff>("/system-staff", Object.fromEntries(form.entries()));
      setStaff((current) => [...current, created].sort((a, b) => a.fullName.localeCompare(b.fullName)));
      formElement.reset();
      setShowForm(false);
      toast.success("System staff added", `${created.fullName} can now sign in to the platform portal.`);
    } catch (submissionError) {
      setError(submissionError instanceof ApiClientError ? submissionError.message : "Unable to create system staff.");
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(member: SystemStaff) {
    const password = window.prompt(`Enter a new password for ${member.fullName}:`);
    if (!password) return;
    setBusy(true);
    setError("");
    try {
      await api.post(`/system-staff/${member.id}/password`, { password });
      toast.success("Password updated", `${member.fullName} must use the new password at next sign-in.`);
    } catch (actionError) {
      setError(actionError instanceof ApiClientError ? actionError.message : "Unable to update password.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(member: SystemStaff) {
    const disabled = member.status === "ACTIVE";
    setStatusConfirmation({ member, disabled });
  }

  async function confirmStatusChange() {
    if (!statusConfirmation) return;
    const { member, disabled } = statusConfirmation;
    setBusy(true);
    setError("");
    try {
      const result = await api.post<{ id: string; status: string }>(`/system-staff/${member.id}/status`, { disabled });
      setStaff((current) => current.map((item) => item.id === member.id ? { ...item, status: result.status } : item));
      toast.success(disabled ? "Account suspended" : "Account enabled", `${member.fullName}'s access was updated.`);
      setStatusConfirmation(null);
    } catch (actionError) {
      setError(actionError instanceof ApiClientError ? actionError.message : "Unable to update account status.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteStaff(member: SystemStaff) {
    if (!window.confirm(`Delete ${member.fullName}'s system staff account? This will revoke access immediately.`)) return;
    setBusy(true);
    setError("");
    try {
      await api.delete(`/system-staff/${member.id}`);
      setStaff((current) => current.filter((item) => item.id !== member.id));
      toast.success("System staff deleted", `${member.fullName}'s platform access was revoked.`);
    } catch (actionError) {
      setError(actionError instanceof ApiClientError ? actionError.message : "Unable to delete system staff.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="System Staff"
        description="Manage staff accounts that can access the super-admin platform portal."
        actions={<Button leftIcon={<UserPlus className="size-4" />} onClick={() => setShowForm((value) => !value)}>{showForm ? "Close form" : "Add system staff"}</Button>}
      />

      {showForm && (
        <Card className="mb-5">
          <CardHeader><CardTitle>Add system staff account</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
              <Input label="Full name" name="fullName" required placeholder="e.g. Ama Mensah" />
              <Input label="Email" name="email" type="email" required placeholder="ama@mypos.com" />
              <Input label="Password" name="password" type="password" required minLength={6} hint="Use upper, lower, number and symbol characters" />
              <div className="flex items-end text-sm text-fg-muted">This account receives platform-level access only.</div>
              {error && <p role="alert" className="sm:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger dark:bg-red-950/40">{error}</p>}
              <div className="sm:col-span-2"><Button type="submit" loading={busy} leftIcon={<Save className="size-4" />}>Create system staff</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Platform access accounts</CardTitle></CardHeader>
        <CardContent className="p-0">
          {staff.length === 0 ? <div className="px-4 py-12 text-center text-sm text-fg-muted">No system staff accounts yet.</div> : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead><tr className="border-b border-line bg-muted/60"><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-fg-muted">Staff</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-fg-muted">Code</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-fg-muted">Status</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-fg-muted">Last sign in</th><th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-fg-muted">Actions</th></tr></thead>
                <tbody>{staff.map((member) => <tr key={member.id} className="border-b border-line last:border-0"><td className="px-4 py-3"><p className="font-medium text-fg">{member.fullName}</p><p className="text-xs text-fg-muted">{member.email}</p></td><td className="px-4 py-3 text-fg-secondary">{member.staffCode}</td><td className="px-4 py-3"><Badge variant={member.status === "ACTIVE" ? "success" : "neutral"} size="sm">{member.status}</Badge></td><td className="px-4 py-3 text-fg-secondary">{member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleDateString("en-GB") : "Never"}</td><td className="px-4 py-3"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" leftIcon={<KeyRound className="size-4" />} loading={busy} onClick={() => void changePassword(member)}>Change password</Button><Button size="sm" variant={member.status === "ACTIVE" ? "danger" : "success"} leftIcon={<Power className="size-4" />} loading={busy} onClick={() => void toggleStatus(member)}>{member.status === "ACTIVE" ? "Suspend" : "Enable"}</Button><Button size="icon" variant="ghost" aria-label={`Delete ${member.fullName}`} onClick={() => void deleteStaff(member)} disabled={busy}><Trash2 className="size-4 text-danger" /></Button></div></td></tr>)}</tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={statusConfirmation !== null}
        title={statusConfirmation?.disabled ? `Suspend ${statusConfirmation.member.fullName}'s account?` : `Enable ${statusConfirmation?.member.fullName}'s account?`}
        message={statusConfirmation?.disabled ? "This will revoke the account's active sessions and block platform sign-in until it is enabled again." : "This will restore the account's ability to sign in to the platform portal."}
        confirmLabel={statusConfirmation?.disabled ? "Suspend account" : "Enable account"}
        destructive={statusConfirmation?.disabled}
        loading={busy}
        onCancel={() => setStatusConfirmation(null)}
        onConfirm={() => void confirmStatusChange()}
      />
    </>
  );
}
