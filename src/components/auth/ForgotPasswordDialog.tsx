"use client";

import { useState } from "react";
import { LifeBuoy } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { publicEnv } from "@/lib/config/env";

/**
 * Password resets are manager-initiated rather than self-service: shop-floor
 * staff often share a store email, so a reset link is not a safe channel.
 */
export function ForgotPasswordDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline dark:text-brand-400"
      >
        Forgot password?
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Reset your password"
        size="sm"
        footer={
          <Button onClick={() => setOpen(false)} fullWidth className="sm:w-auto">
            Got it
          </Button>
        }
      >
        <div className="flex gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
            <LifeBuoy className="size-5" />
          </span>
          <div className="space-y-3 text-sm text-fg-secondary">
            <p>
              For security, passwords are reset by a store manager or administrator — not by email link.
            </p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>Ask your manager to open Employees in the back office.</li>
              <li>They issue a temporary password for your staff code.</li>
              <li>You will be asked to set a new password at your next sign-in.</li>
            </ol>
            {publicEnv.supportContact && (
              <p className="rounded-lg bg-muted p-3">
                Need more help? Contact{" "}
                <span className="font-medium text-fg">{publicEnv.supportContact}</span>
              </p>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
