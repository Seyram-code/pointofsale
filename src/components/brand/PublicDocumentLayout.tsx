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
    <main className="min-h-dvh bg-[#f5f7f2] text-[#17221d]">
      <header className="border-b border-[#dfe7e0] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <StoreLogo size="sm" />
            <span className="text-lg font-bold">{publicEnv.appName}</span>
          </Link>
          <Link href="/#faq" className="text-sm font-semibold text-[#1c724d] hover:underline">
            FAQs
          </Link>
        </div>
      </header>
      <article className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
        <Link href="/" className="text-sm font-semibold text-[#1c724d] hover:underline">← Back to home</Link>
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-[#bc7c13]">MyPOS · Legal</p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">{title}</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[#64716a]">{intro}</p>
        <p className="mt-5 text-sm text-[#64716a]">Last updated: September 29, 2026</p>
        <div className="mt-10 max-w-3xl space-y-8 border-t border-[#d5dfd7] pt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#17221d] [&_p]:mt-3 [&_p]:leading-7 [&_p]:text-[#526159] [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_li]:leading-7 [&_li]:text-[#526159]">
          {children}
        </div>
      </article>
      <footer className="border-t border-[#dfe7e0] bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-x-6 gap-y-3 px-5 py-6 text-sm text-[#64716a] sm:px-8">
          <Link href="/privacy-policy" className="hover:text-[#17221d]">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-[#17221d]">Terms and Conditions</Link>
          <Link href="/#faq" className="hover:text-[#17221d]">FAQ</Link>
          <Link href="/" className="ml-auto font-semibold text-[#31523f]">{publicEnv.appName}</Link>
        </div>
      </footer>
    </main>
  );
}