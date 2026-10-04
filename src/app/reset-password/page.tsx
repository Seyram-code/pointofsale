import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { StoreLogo } from "@/components/brand/StoreLogo";
import { Skeleton } from "@/components/ui/Skeleton";
import { publicEnv } from "@/lib/config/env";

export const metadata: Metadata = {
  title: "Reset your password",
  description: `Choose a new password for your ${publicEnv.appName} account.`,
};

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-app px-4 py-10">
      <div className="w-full max-w-md">
        <header className="mb-6 flex flex-col items-center text-center">
          <StoreLogo size="lg" />
          <h1 className="mt-4 text-2xl font-semibold text-fg">Reset your password</h1>
          <p className="mt-1.5 text-sm text-fg-muted">Choose a new password for your {publicEnv.businessName} account.</p>
        </header>
        <section className="rounded-xl border border-line bg-card p-5 shadow-[var(--shadow-panel)] sm:p-6">
          <Suspense fallback={<Skeleton className="h-56 w-full rounded-lg" />}>
            <ResetPasswordForm />
          </Suspense>
        </section>
      </div>
    </main>
  );
}