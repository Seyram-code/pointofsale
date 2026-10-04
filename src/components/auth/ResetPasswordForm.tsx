"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { KeyRound, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api/client";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);

  async function resetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!token) {
      setError("This reset link is missing its security token. Request a new link.");
      return;
    }

    setSaving(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setComplete(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not reset your password. Request a new link and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (complete) {
    return (
      <div className="space-y-4 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
          <LockKeyhole className="size-6" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-fg">Password updated</h2>
          <p className="mt-1 text-sm text-fg-secondary">Your password has been changed. Sign in with your new password.</p>
        </div>
        <Link className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700" href="/login">Return to sign in</Link>
      </div>
    );
  }

  return (
    <form onSubmit={resetPassword} className="space-y-4">
      {!token && <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-fg-secondary" role="alert">This reset link is incomplete. Return to sign in and request a new one.</p>}
      <Input
        label="New password"
        name="new-password"
        type="password"
        autoComplete="new-password"
        autoCapitalize="none"
        required
        minLength={6}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        hint="At least 6 characters, with uppercase, lowercase, and a number."
        leftIcon={<KeyRound className="size-4" />}
        disabled={!token || saving}
      />
      <Input
        label="Confirm new password"
        name="confirm-password"
        type="password"
        autoComplete="new-password"
        autoCapitalize="none"
        required
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        disabled={!token || saving}
      />
      {error && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
      <Button type="submit" fullWidth loading={saving} disabled={!token} leftIcon={<LockKeyhole className="size-4" />}>
        Set new password
      </Button>
      <p className="text-center text-sm text-fg-muted"><Link className="font-medium text-brand-600 hover:underline" href="/login">Back to sign in</Link></p>
    </form>
  );
}