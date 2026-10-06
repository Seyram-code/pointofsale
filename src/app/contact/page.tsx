import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail, MapPin, Phone } from "lucide-react";
import { publicEnv } from "@/lib/config/env";
import { StoreLogo } from "@/components/brand/StoreLogo";
import { ContactForm } from "@/components/brand/ContactForm";

export const metadata: Metadata = {
  title: "Contact VidyPOS",
  description: "Contact the VidyPOS team for help getting started with point of sale and retail management in Ghana.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <main className="min-h-dvh bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-950/90">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label={`${publicEnv.appName} home`}>
            <StoreLogo size="sm" />
            <span className="text-lg font-bold text-white">{publicEnv.appName}</span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white">
            <ArrowLeft className="size-4" /> Back to home
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:py-20">
        <section>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-200">Contact us</p>
          <h1 className="mt-4 text-4xl font-black leading-tight text-white sm:text-5xl">Talk to the VidyPOS team.</h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-slate-300">
            Tell us what your shop needs. We can help with getting started, product questions, or support.
          </p>

          <address className="mt-10 space-y-5 not-italic">
            <a href="mailto:hello@vidyposgh.com" className="flex items-start gap-4 text-slate-200 hover:text-white">
              <Mail className="mt-0.5 size-5 shrink-0 text-brand-200" />
              <span><span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Email</span><span className="mt-1 block font-semibold">hello@vidyposgh.com</span></span>
            </a>
            <a href="tel:+233598925563" className="flex items-start gap-4 text-slate-200 hover:text-white">
              <Phone className="mt-0.5 size-5 shrink-0 text-accent-200" />
              <span><span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Phone</span><span className="mt-1 block font-semibold">059 892 5563</span></span>
            </a>
            <div className="flex items-start gap-4 text-slate-200">
              <MapPin className="mt-0.5 size-5 shrink-0 text-brand-200" />
              <span><span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Location</span><span className="mt-1 block font-semibold">Adenta Barrier, Near ECG substation</span></span>
            </div>
          </address>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 sm:p-7">
          <h2 className="text-xl font-bold text-white">Send us a message</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">Fill in the form and our team will get back to you.</p>
          <ContactForm />
        </section>
      </div>

      <footer className="border-t border-white/10 px-5 py-6 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} {publicEnv.appName}. All rights reserved.
      </footer>
    </main>
  );
}