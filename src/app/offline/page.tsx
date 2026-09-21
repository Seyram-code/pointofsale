import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-app px-5 py-12">
      <section className="w-full max-w-md rounded-2xl border border-line bg-card p-8 text-center shadow-[var(--shadow-panel)]">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">MyPOS</p>
        <h1 className="mt-3 text-2xl font-semibold text-fg">You are offline</h1>
        <p className="mt-2 text-sm text-fg-muted">Reconnect to continue using the live dashboard and point of sale.</p>
        <Link href="/pos" className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
          Try again
        </Link>
      </section>
    </main>
  );
}
