"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, KeyRound, LogIn, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { ForgotPasswordDialog } from "@/components/auth/ForgotPasswordDialog";
import { api, ApiClientError } from "@/lib/api/client";
import { loginSchema } from "@/lib/validations/auth.schema";

const REMEMBER_KEY = "mypos.lastIdentifier";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/dashboard";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Only the identifier is remembered — never the password.
  useEffect(() => {
    const stored = window.localStorage.getItem(REMEMBER_KEY);
    if (stored) {
      setIdentifier(stored);
      setRememberDevice(true);
    }
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = loginSchema.safeParse({ identifier, password, rememberDevice });
    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;
      setFieldErrors({ identifier: flattened.identifier?.[0], password: flattened.password?.[0] });
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/login", parsed.data);

      if (rememberDevice) window.localStorage.setItem(REMEMBER_KEY, parsed.data.identifier);
      else window.localStorage.removeItem(REMEMBER_KEY);

      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      setFormError(
        error instanceof ApiClientError
          ? error.message
          : "Unable to reach the server. Check your connection and try again.",
      );
      setPassword("");
      setLoading(false);
    }
  }

  return (
    <Card className="shadow-[var(--shadow-panel)]">
      <CardContent className="p-5 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {formError && (
            <div
              role="alert"
              aria-live="assertive"
              className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-danger dark:border-red-900 dark:bg-red-950/40"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <Input
            label="Email or staff code"
            placeholder="Email or staff code, e.g. CSH0223"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            disabled={loading}
            leftIcon={<User className="size-4" />}
            value={identifier}
            error={fieldErrors.identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            required
          />

          <Input
            label="Password"
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            enterKeyHint="go"
            disabled={loading}
            leftIcon={<KeyRound className="size-4" />}
            value={password}
            error={fieldErrors.password}
            hint={capsLockOn ? "Caps Lock is on" : undefined}
            onKeyUp={(event) => setCapsLockOn(event.getModifierState("CapsLock"))}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <Checkbox
              label="Remember me"
              checked={rememberDevice}
              disabled={loading}
              onChange={(event) => setRememberDevice(event.target.checked)}
            />
            <ForgotPasswordDialog />
          </div>

          <Button type="submit" size="lg" fullWidth loading={loading} leftIcon={<LogIn className="size-[18px]" />}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
