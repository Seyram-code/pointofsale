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
import { loginSchema, staffAccessCodeLoginSchema } from "@/lib/validations/auth.schema";

const REMEMBER_KEY = "mypos.lastIdentifier";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/dashboard";
  const expiredSession = searchParams.get("expired") === "1";

  const [identifier, setIdentifier] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [mode, setMode] = useState<"password" | "staff">("password");
  const [password, setPassword] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; accessCode?: string; password?: string }>({});
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

    const parsed = mode === "staff"
      ? staffAccessCodeLoginSchema.safeParse({ mode: "staff", accessCode, rememberDevice })
      : loginSchema.safeParse({ identifier, password, rememberDevice });
    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        identifier: "identifier" in flattened ? flattened.identifier?.[0] : undefined,
        accessCode: "accessCode" in flattened ? flattened.accessCode?.[0] : undefined,
        password: "password" in flattened ? flattened.password?.[0] : undefined,
      });
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/login", parsed.data);

      if (mode === "password" && rememberDevice) window.localStorage.setItem(REMEMBER_KEY, identifier.trim());
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

          {expiredSession && (
            <div
              role="alert"
              aria-live="polite"
              className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
            >
              Your session expired after 5 minutes of inactivity. Please sign in again.
            </div>
          )}

          {mode === "staff" ? (
            <Input
              label="Staff access code"
              placeholder="Paste your staff access code"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={6}
              disabled={loading}
              leftIcon={<KeyRound className="size-4" />}
              value={accessCode}
              error={fieldErrors.accessCode}
              onChange={(event) => setAccessCode(event.target.value.toUpperCase())}
              required
            />
          ) : (
            <>
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
            </>
          )}

          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <Checkbox
              label="Remember me"
              checked={rememberDevice}
              disabled={loading}
              onChange={(event) => setRememberDevice(event.target.checked)}
            />
            {mode === "password" && <ForgotPasswordDialog />}
          </div>

          <Button type="submit" size="lg" fullWidth loading={loading} leftIcon={<LogIn className="size-[18px]" />}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
          <button
            type="button"
            className="w-full py-1 text-sm font-medium text-brand-600 hover:underline disabled:opacity-50"
            disabled={loading}
            onClick={() => {
              setMode((current) => current === "password" ? "staff" : "password");
              setFormError(null);
              setFieldErrors({});
            }}
          >
            {mode === "password" ? "Staff login" : "Use email and password"}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
