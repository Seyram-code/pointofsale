import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-app px-6 text-center">
      <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-red-50 text-danger dark:bg-red-950/40">
        <ShieldAlert className="size-7" />
      </span>
      <h1 className="text-xl font-semibold text-fg">Access denied</h1>
      <p className="mt-1.5 max-w-sm text-sm text-fg-muted">
        You do not have permission to view this page. Ask a manager if you believe this is a mistake.
      </p>
      <Link
        href="/dashboard"
        className="mt-5 inline-flex h-11 items-center rounded-lg border border-line-strong bg-card px-4 text-sm font-medium text-fg hover:bg-muted"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
