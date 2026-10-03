import type { Metadata } from "next";
import Link from "next/link";
import { Building2, BriefcaseBusiness, KeyRound, Mail, ShieldCheck, Store } from "lucide-react";
import { requireSession } from "@/lib/auth/guard";
import { ROLE_LABELS } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "My profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { user } = await requireSession("/profile");

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-card p-6 shadow-[var(--shadow-panel)]">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-16 items-center justify-center rounded-full bg-brand-500/10 text-xl font-bold text-brand-600 ring-1 ring-brand-500/20">
              {user.fullName
                .split(" ")
                .map((part) => part[0])
                .slice(0, 2)
                .join("")
                .toUpperCase() || "U"}
            </div>
            <div>
              <p className="text-2xl font-semibold text-fg">{user.fullName}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
                <span className="rounded-full bg-brand-500/10 px-2.5 py-1 text-brand-600">{ROLE_LABELS[user.role]}</span>
                {user.storeName && <span className="rounded-full bg-muted px-2.5 py-1">{user.storeName}</span>}
              </div>
            </div>
          </div>

          {user.role !== "SUPER_ADMIN" && user.storeId ? (
            <Link
              href="/subscription"
              className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500"
            >
              View subscription
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-card p-6 shadow-[var(--shadow-panel)]">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-brand-500/10 p-2 text-brand-600">
              <BriefcaseBusiness className="size-5" />
            </div>
            <h2 className="text-lg font-semibold text-fg">Account details</h2>
          </div>

          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-3 rounded-xl bg-muted/60 p-3">
              <Mail className="mt-0.5 size-4 text-fg-muted" />
              <div>
                <p className="text-xs uppercase tracking-wide text-fg-muted">Email</p>
                <p className="mt-1 font-medium text-fg">{user.email ?? "No email assigned"}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-muted/60 p-3">
              <KeyRound className="mt-0.5 size-4 text-fg-muted" />
              <div>
                <p className="text-xs uppercase tracking-wide text-fg-muted">Staff code</p>
                <p className="mt-1 font-medium text-fg">{user.staffCode || "Not assigned"}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-muted/60 p-3">
              <ShieldCheck className="mt-0.5 size-4 text-fg-muted" />
              <div>
                <p className="text-xs uppercase tracking-wide text-fg-muted">Role</p>
                <p className="mt-1 font-medium text-fg">{ROLE_LABELS[user.role]}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-card p-6 shadow-[var(--shadow-panel)]">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-brand-500/10 p-2 text-brand-600">
              <Store className="size-5" />
            </div>
            <h2 className="text-lg font-semibold text-fg">Business access</h2>
          </div>

          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-3 rounded-xl bg-muted/60 p-3">
              <Building2 className="mt-0.5 size-4 text-fg-muted" />
              <div>
                <p className="text-xs uppercase tracking-wide text-fg-muted">Store</p>
                <p className="mt-1 font-medium text-fg">{user.storeName || "No store linked"}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-muted/60 p-3">
              <ShieldCheck className="mt-0.5 size-4 text-fg-muted" />
              <div>
                <p className="text-xs uppercase tracking-wide text-fg-muted">Plan</p>
                <p className="mt-1 font-medium text-fg">{user.role === "SUPER_ADMIN" ? "Platform owner" : user.plan || "Starter"}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-muted/60 p-3">
              <KeyRound className="mt-0.5 size-4 text-fg-muted" />
              <div>
                <p className="text-xs uppercase tracking-wide text-fg-muted">Password status</p>
                <p className="mt-1 font-medium text-fg">{user.mustChangePassword ? "Password reset required" : "Password current"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
