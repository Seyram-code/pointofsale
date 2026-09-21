import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Store } from "lucide-react";
import { publicEnv } from "@/lib/config/env";
import { SUBSCRIPTION_PLANS } from "@/lib/config/subscription-plans";
import { StoreLogo } from "@/components/brand/StoreLogo";

export const metadata: Metadata = { title: "Plans" };

const planOrder = ["STARTER", "GROWTH", "ENTERPRISE"] as const;

export default function PlansPage() {
  return (
    <main className="min-h-dvh bg-[#f5f7f2] text-[#17221d]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5"><StoreLogo size="sm" /><span className="text-lg font-bold tracking-tight">{publicEnv.appName}</span></Link>
        <Link href="/login" className="text-sm font-semibold text-[#31523f] hover:underline">Sign in</Link>
      </header>
      <section className="mx-auto max-w-6xl px-5 pb-20 pt-12 sm:px-8 sm:pt-16">
        <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#bc7c13]">Plans and monthly amounts</p><h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Choose the right rhythm for your business.</h1><p className="mt-5 text-lg leading-8 text-[#64716a]">Start with a 14-day trial, then update your plan from your account as your shop grows.</p></div>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {planOrder.map((key) => {
            const plan = SUBSCRIPTION_PLANS[key];
            return <article key={key} className={`flex flex-col rounded-xl border p-6 ${key === "GROWTH" ? "border-[#e5ad35] bg-white shadow-[0_20px_45px_-30px_rgba(27,66,45,0.6)]" : "border-[#d5dfd7] bg-white"}`}><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Store className="size-5 text-[#1c724d]" /><h2 className="text-xl font-bold">{plan.name}</h2></div><p className="mt-3 text-sm text-[#64716a]">{plan.description}</p></div>{key === "GROWTH" && <span className="rounded-full bg-[#e5ad35] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#183b2b]">Popular</span>}</div><p className="mt-8 text-3xl font-semibold">{plan.monthlyPrice === null ? "Custom" : <>GHS {plan.monthlyPrice}<span className="text-sm font-normal text-[#64716a]"> / month</span></>}</p><ul className="mt-6 flex-1 space-y-3 border-t border-[#e5ebe6] pt-5">{plan.features.map((feature) => <li key={feature} className="flex items-start gap-2 text-sm text-[#64716a]"><Check className="mt-0.5 size-4 shrink-0 text-[#1c724d]" />{feature}</li>)}</ul><Link href="/register" className="mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#1c724d] text-sm font-bold text-white hover:bg-[#155e3f]">Choose {plan.name} <ArrowRight className="size-4" /></Link></article>;
          })}
        </div>
      </section>
    </main>
  );
}
