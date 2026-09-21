"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

export function PlatformOwnerCredentials({
  storeId,
  businessName,
  ownerUserId,
  ownerEmail,
}: {
  storeId: string;
  businessName: string;
  ownerUserId: string | null;
  ownerEmail: string | null;
}) {
  const router = useRouter();
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setFormError("");
    setSaving(true);
    try {
      const response = await fetch(`/api/platform/businesses/${storeId}/owner-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error?.message ?? "Password update failed");

      success("Password changed", `${businessName}'s owner password was updated.`);
      setPassword("");
      setConfirmPassword("");
      setOpen(false);
      router.refresh();
    } catch (passwordError) {
      error("Password update failed", passwordError instanceof Error ? passwordError.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!ownerUserId) {
    return <span className="text-fg-muted">No owner account</span>;
  }

  return (
    <>
      <div className="flex min-w-[210px] items-center gap-3">
        <span className="font-mono text-xs tracking-wider text-fg-muted" aria-label="Password is stored securely">********</span>
        <Button type="button" size="sm" variant="outline" leftIcon={<KeyRound className="size-3.5" />} onClick={() => setOpen(true)}>
          Reset password
        </Button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={`Reset password for ${businessName}`} description={ownerEmail ?? "Business owner account"}>
        <form onSubmit={changePassword} className="space-y-4">
          <Input
            label="New password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            name="newPassword"
            autoFocus
            hint="Use at least 6 characters with uppercase, lowercase, and a number."
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <Input
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            name="confirmPassword"
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          {formError && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</p>}
          <div className="flex justify-end gap-3 border-t border-line pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" loading={saving}>Save password</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
