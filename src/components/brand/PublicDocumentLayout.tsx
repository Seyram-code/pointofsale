import type { ReactNode } from "react";
import Link from "next/link";
import { StoreLogo } from "@/components/brand/StoreLogo";
import { publicEnv } from "@/lib/config/env";

export function PublicDocumentLayout({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <StoreLogo size="sm" />
            <span className="text-lg font-bold text-white">{publicEnv.appName}</span>
          </Link>
          <Link href="/#faq" className="text-sm font-semibold text-brand-200 transition-colors hover:text-white">
            FAQs
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
        <Link href="/" className="text-sm font-semibold text-brand-200 transition-colors hover:text-white">
          ← Back to home
        </Link>
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-accent-200">VidyPOS · Legal</p>
        <h1 className="mt-3 text-4xl font-black leading-tight tracking-[-0.05em] text-white sm:text-5xl">{title}</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">{intro}</p>
        <p className="mt-5 text-sm text-slate-400">Last updated: September 29, 2026</p>

        <div className="mt-10 max-w-3xl space-y-8 border-t border-white/10 pt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-white [&_p]:mt-3 [&_p]:leading-7 [&_p]:text-slate-300 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_li]:leading-7 [&_li]:text-slate-300">
          {children}
        </div>
      </article>

      <footer className="border-t border-white/10 bg-slate-900">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-x-6 gap-y-3 px-5 py-6 text-sm text-slate-300 sm:px-8">
          <Link href="/privacy-policy" className="transition-colors hover:text-white">Privacy Policy</Link>
          <Link href="/terms" className="transition-colors hover:text-white">Terms and Conditions</Link>
          <Link href="/#faq" className="transition-colors hover:text-white">FAQ</Link>
          <Link href="/" className="ml-auto font-semibold text-brand-200 transition-colors hover:text-white">
            {publicEnv.appName}
          </Link>
        </div>
      </footer>
    </main>
  );
}