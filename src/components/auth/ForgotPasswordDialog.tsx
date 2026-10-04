"use client";

import { useState } from "react";
import { KeyRound, MailCheck } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api/client";

export function ForgotPasswordDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  function close() {
    setOpen(false);
    setEmail("");
    setMessage("");
    setError("");
  }

  async function requestReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError("");
    try {
      await api.post("/auth/request-password-reset", { email });
      setMessage("If an active account uses that email, a password reset link will be sent shortly. Check your inbox and spam folder.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not request a password reset. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setEmail("");
          setMessage("");
          setError("");
        }}
        className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline dark:text-brand-400"
      >
        Forgot password?
      </button>

      <Modal
        open={open}
        onClose={close}
        title="Reset your password"
        size="sm"
        footer={
          <Button type={message ? "button" : "submit"} form={message ? undefined : "forgot-password-form"} onClick={message ? close : undefined} loading={sending} fullWidth className="sm:w-auto">
            {message ? "Got it" : "Send reset link"}
          </Button>
        }
      >
        {message ? (
          <div className="flex gap-3" role="status">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
              <MailCheck className="size-5" />
            </span>
            <p className="text-sm text-fg-secondary">{message}</p>
          </div>
        ) : (
          <form id="forgot-password-form" onSubmit={requestReset} className="space-y-4">
            <p className="text-sm text-fg-secondary">Enter the personal email address registered to your account. We’ll send a one-time reset link if it matches.</p>
            <Input
              label="Registered email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              leftIcon={<KeyRound className="size-4" />}
              disabled={sending}
            />
            {error && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
          </form>
        )}
      </Modal>
    </>
  );
}
