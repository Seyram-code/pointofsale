import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Store } from "lucide-react";
import { publicEnv } from "@/lib/config/env";
import { SUBSCRIPTION_PLANS } from "@/lib/config/subscription-plans";
import { StoreLogo } from "@/components/brand/StoreLogo";

export const metadata: Metadata = { title: "Plans" };

const planOrder = ["TRIAL", "STARTER", "PREMIUM", "ENTERPRISE"] as const;
const featuredPlan = "PREMIUM";

export default function PlansPage() {
  return (
    <main className="min-h-dvh bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <StoreLogo size="sm" />
            <span className="text-lg font-bold tracking-tight text-white">{publicEnv.appName}</span>
          </Link>
          <Link href="/login" className="text-sm font-semibold text-slate-200 transition-colors hover:text-white">
            Sign in
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-20 pt-12 sm:px-8 sm:pt-16">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-200">Plans and monthly amounts</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] text-white sm:text-5xl">
            Choose the right rhythm for your business.
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            Start with a 14-day trial, then update your plan from your account as your shop grows.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {planOrder.map((key) => {
            const plan = SUBSCRIPTION_PLANS[key];
            const featured = key === featuredPlan;
            const isTrial = key === "TRIAL";
            return (
              <article
                key={key}
                className={`flex flex-col rounded-2xl border p-6 ${
                  featured
                    ? "border-accent-300 bg-white text-slate-900 shadow-[0_25px_60px_rgba(10,18,30,0.35)] ring-2 ring-accent-300"
                    : "border-white/10 bg-slate-900/70"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Store className={`size-5 ${featured ? "text-brand-600" : "text-brand-200"}`} />
                      <h2 className={`text-xl font-bold ${featured ? "text-slate-900" : "text-white"}`}>{plan.name}</h2>
                    </div>
                    <p className={`mt-3 text-sm ${featured ? "text-slate-500" : "text-slate-300"}`}>{plan.description}</p>
                  </div>
                  {featured && (
                    <span className="rounded-full bg-accent-300 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-950">
                      Popular
                    </span>
                  )}
                </div>

                <p className={`mt-8 text-3xl font-bold tracking-tight ${featured ? "text-slate-900" : "text-white"}`}>
                  {plan.monthlyPrice === null ? (
                    plan.price
                  ) : (
                    <>
                      GHS {plan.monthlyPrice.toLocaleString("en-GH")}
                      <span className={`text-sm font-normal ${featured ? "text-slate-500" : "text-slate-400"}`}>
                        {" "}/ month
                      </span>
                    </>
                  )}
                </p>

                <ul className={`mt-6 flex-1 space-y-3 border-t pt-5 ${featured ? "border-slate-200" : "border-white/10"}`}>
                  {plan.features.map((feature) => (
                    <li key={feature} className={`flex items-start gap-2 text-sm ${featured ? "text-slate-600" : "text-slate-200"}`}>
                      <Check className={`mt-0.5 size-4 shrink-0 ${featured ? "text-brand-600" : "text-brand-200"}`} />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/register"
                  className={`mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors ${
                    featured
                      ? "bg-brand-600 text-white hover:bg-brand-700"
                      : "bg-white text-brand-950 hover:bg-brand-50"
                  }`}
                >
                  {isTrial ? "Start free trial" : `Choose ${plan.name}`}
                  <ArrowRight className="size-4" />
                </Link>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
