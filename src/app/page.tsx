import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  ChevronRight,
  CreditCard,
  Menu,
  ReceiptText,
  ScanBarcode,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
} from "lucide-react";
import { StoreLogo } from "@/components/brand/StoreLogo";
import { publicEnv } from "@/lib/config/env";
import { getPlatformPlanPricing } from "@/lib/services/plan-pricing.service";
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from "@/lib/config/subscription-plans";

const NAV_LINKS = [
  { href: "#features", label: "Why VidyPOS" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

const SHOP_TYPES = ["Supermarkets", "Provision stores", "Pharmacies", "Restaurants", "Mini marts", "Wholesalers"];

const FEATURES = [
  { icon: ScanBarcode, title: "Instant checkout", body: "Scan products in seconds and complete cash, MoMo and card sales without leaving the till." },
  { icon: Boxes, title: "Smarter stock control", body: "Know what is low, what is moving, and what needs reorder before shelves go empty." },
  { icon: BarChart3, title: "Real-time insights", body: "See sales trends, product performance, and daily takings from one clear dashboard." },
  { icon: CreditCard, title: "Every payment flow", body: "Track payment types and reconcile the day with store-specific visibility and controls." },
  { icon: Users, title: "Customers & suppliers", body: "Keep records, transactions and order context connected across the entire operation." },
  { icon: UserCog, title: "Staff access control", body: "Give each person the permissions they need without exposing sensitive business data." },
];

const STEPS = [
  { title: "Create your portal", body: "Set up your shop, business details and tills in a few guided steps." },
  { title: "Add your team", body: "Invite staff, assign permissions, and start managing products and stock with clarity." },
  { title: "Run smarter sales", body: "Track payment flows, monitor stock, and use your dashboard to make better decisions daily." },
];

const PLANS: Array<{ key: SubscriptionPlan; body: string; featured: boolean }> = [
  { key: "TRIAL", body: "Try every VidyPOS feature free for 14 days", featured: false },
  { key: "STARTER", body: "For small shops getting organised", featured: false },
  { key: "PREMIUM", body: "For growing supermarkets and teams", featured: true },
  { key: "ENTERPRISE", body: "For larger retail operations", featured: false },
];

const FAQS = [
  { question: "Who is VidyPOS for?", answer: "VidyPOS is built for shops, supermarkets, pharmacies and retail teams that need one place to manage checkout, stock, staff and growth." },
  { question: "How do I get started?", answer: "Create your shop portal, add products, set inventory, and bring your team in with the permissions they need." },
  { question: "Can I track different payment methods?", answer: "The POS supports cash, mobile money and card workflows, with payment tracking grouped by till and staff member." },
  { question: "Can I control what each staff member can do?", answer: "Yes. Roles and permissions help limit access to sales, stock, reports and store settings based on responsibility." },
  { question: "How is pricing handled?", answer: "Every shop starts with a 14-day free trial. After that, plans are billed monthly with flexible options for different business sizes." },
  { question: "Where can I get help or learn how my information is used?", answer: "Review our privacy terms in the app and speak with your store administrator for account support and access questions." },
];

export default async function HomePage() {
  const pricing = await getPlatformPlanPricing();
  const pricingByKey = new Map(pricing.map((plan) => [plan.key, plan]));

  return (
    <div className="min-h-dvh bg-slate-950 text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <Link href="/" className="flex items-center gap-2.5">
            <StoreLogo size="sm" />
            <span className="text-lg font-bold tracking-tight text-white">{publicEnv.appName}</span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/plans"
              className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              All plans
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/5 lg:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition-colors hover:bg-brand-400"
            >
              Start free trial
              <ArrowRight className="size-4" />
            </Link>
            <details className="relative lg:hidden">
              <summary
                aria-label="Open menu"
                className="flex size-10 cursor-pointer list-none items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-200 marker:content-none"
              >
                <Menu className="size-5" />
              </summary>
              <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-slate-900 p-2 shadow-2xl shadow-black/30">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-white/5"
                  >
                    {link.label}
                  </a>
                ))}
                <Link href="/plans" className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-white/5">
                  All plans
                </Link>
                <div className="my-2 border-t border-white/10" />
                <Link href="/login" className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/5">
                  Sign in
                </Link>
              </div>
            </details>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-[-8rem] top-[-8rem] h-[32rem] w-[32rem] rounded-full bg-brand-500/20 blur-3xl" />
            <div className="absolute right-[-10rem] top-[-6rem] h-[30rem] w-[30rem] rounded-full bg-accent-500/20 blur-3xl" />
            <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-b from-transparent to-slate-950" />
          </div>

          <div className="mx-auto max-w-7xl px-5 pb-16 pt-16 sm:px-8 sm:pt-20 lg:px-10 lg:pb-24 lg:pt-24">
            <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-500/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-brand-200">
                  <Sparkles className="size-3.5" />
                  Built for modern retail
                </span>

                <h1 className="mt-6 max-w-xl text-4xl font-black tracking-[-0.06em] text-white sm:text-5xl lg:text-7xl">
                  Sell faster.
                  <span className="block bg-gradient-to-r from-brand-300 via-brand-200 to-accent-300 bg-clip-text text-transparent">
                    Grow smarter.
                  </span>
                </h1>

                <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
                  VidyPOS brings POS, stock, staff and reporting together in one clean workflow so your shop can move faster and stay in control.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/register"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-500 px-6 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition-colors hover:bg-brand-400"
                  >
                    Start your 14-day trial
                    <ArrowRight className="size-4" />
                  </Link>
                  <Link
                    href="/plans"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 text-sm font-bold text-white transition-colors hover:bg-white/10"
                  >
                    View plans
                    <ChevronRight className="size-4" />
                  </Link>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-slate-300">
                  {['No setup fee', 'Cash, MoMo and card', 'Secure store portal'].map((item) => (
                    <span key={item} className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-brand-500/15 text-brand-200">
                        <Check className="size-3.5" />
                      </span>
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-500/15 via-accent-500/10 to-transparent blur-2xl" />

                <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-3 shadow-[0_30px_80px_rgba(15,23,42,0.5)] backdrop-blur-sm">
                  <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-950">
                    <Image
                      src="/screenshots/dashboard.webp"
                      alt="VidyPOS dashboard showing sales and store performance insights"
                      width={1440}
                      height={980}
                      sizes="(max-width: 1024px) 90vw, 640px"
                      priority
                      className="block w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-slate-900/70">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-5 py-8 sm:px-8 lg:flex-row lg:px-10">
            <p className="shrink-0 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Built for</p>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 lg:justify-start">
              {SHOP_TYPES.map((type) => (
                <span key={type} className="text-sm font-semibold text-slate-200">
                  {type}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-200">Why VidyPOS</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              One system for selling, stocking and growing.
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-300">
              Designed for busy retail teams that need the right information at the right time, without the clutter.
            </p>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-white/10 bg-slate-900 p-6 transition-all duration-200 hover:-translate-y-1 hover:border-brand-400/40 hover:bg-slate-900/80"
              >
                <div className="flex size-11 items-center justify-center rounded-xl bg-brand-500/10 text-brand-200 ring-1 ring-brand-400/20 transition-colors group-hover:bg-brand-500 group-hover:text-white group-hover:ring-brand-500">
                  <feature.icon className="size-5" />
                </div>
                <h3 className="mt-5 text-xl font-bold tracking-tight text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-white/10 bg-slate-900/60">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:px-10 lg:py-28">
            <div className="relative order-2 lg:order-1">
              <div aria-hidden className="absolute inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-500/20 via-accent-500/10 to-transparent blur-3xl" />
              <div className="relative mx-auto w-full max-w-[20rem] overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 shadow-[0_30px_70px_rgba(2,6,23,0.8)]">
                <Image
                  src="/screenshots/scanner.webp"
                  alt="Customer checkout on a mobile device using the VidyPOS barcode scanner"
                  width={1024}
                  height={1536}
                  sizes="(max-width: 1024px) 90vw, 320px"
                  className="block w-full"
                />
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/10 px-3 py-1.5 text-xs font-semibold text-brand-200">
                <ScanBarcode className="size-3.5" />
                Faster checkout
              </span>
              <h2 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Scan, sell and keep the line moving.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-300">
                VidyPOS makes the counter feel lighter. Customers are scanned, priced and checked out without friction, while the team keeps full visibility of stock and revenue in real time.
              </p>

              <ul className="mt-8 space-y-4">
                {[
                  "Barcode scans instantly match the right product, price and stock level",
                  "Payments are closed in the same flow without extra screens or delays",
                  "Everything stays linked to the right staff member and till for reconciliation",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3 text-slate-200">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-100">
                      <Check className="size-3.5" />
                    </span>
                    <span className="text-sm leading-6">{point}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/register"
                className="mt-9 inline-flex h-11 items-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-bold text-white transition-colors hover:bg-brand-400"
              >
                Start your 14-day trial
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>

        <section className="overflow-hidden border-y border-white/10 bg-slate-950">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:px-10 lg:py-28">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-accent-500/10 px-3 py-1.5 text-xs font-semibold text-accent-200">
                <Boxes className="size-3.5" />
                Inventory intelligence
              </span>
              <h2 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Cut stock losses before they hit your margins.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-300">
                Stay ahead of slow sellers, fast movers and expiring inventory with a system designed to reduce risk and keep shelves ready for customers.
              </p>

              <ul className="mt-8 space-y-4">
                {[
                  "Low-stock reminders help prevent empty shelves and missed sales",
                  "Expiry warnings highlight batches nearing the end of their usable window",
                  "Clear reorder insights make purchasing easier and more predictable",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3 text-slate-200">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-100">
                      <Check className="size-3.5" />
                    </span>
                    <span className="text-sm leading-6">{point}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/register"
                className="mt-9 inline-flex h-11 items-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-bold text-white transition-colors hover:bg-brand-400"
              >
                Start your 14-day trial
                <ArrowRight className="size-4" />
              </Link>
            </div>

            <div className="relative">
              <div aria-hidden className="absolute left-1/2 top-1/2 -z-10 h-[28rem] w-[21rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-brand-500/20 via-accent-500/20 to-transparent blur-3xl" />
              <div className="relative mx-auto w-full max-w-[19rem] overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900 shadow-[0_28px_60px_rgba(15,23,42,0.75)]">
                <Image
                  src="/screenshots/inventory-alerts.webp"
                  alt="Inventory alerts screen with low stock and expiring products"
                  width={1024}
                  height={1536}
                  sizes="(max-width: 640px) 90vw, 304px"
                  className="block w-full"
                />
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-y border-white/10 bg-slate-900/80">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-200">How it works</p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                From setup to sales, without the noise.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-300">
                Launch your retail stack in a few guided steps and start using the data that matters right away.
              </p>
            </div>

            <div className="mt-14 grid gap-5 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <div key={step.title} className="rounded-2xl border border-white/10 bg-slate-900 p-7 shadow-lg shadow-black/10">
                  <span className="flex size-10 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white shadow-lg shadow-brand-500/20">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-5 text-xl font-bold tracking-tight text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="relative overflow-hidden bg-brand-950 px-5 py-20 text-white sm:px-8 lg:px-10 lg:py-28">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-[-12rem] size-[42rem] -translate-x-1/2 rounded-full bg-brand-500/25 blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-200">Simple monthly plans</p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">Start small. Grow when ready.</h2>
              <p className="mt-5 text-lg leading-8 text-white/70">
                Every plan starts with a 14-day free trial. No setup fee, no long contract.
              </p>
            </div>

            <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {PLANS.map((entry) => {
                const plan = SUBSCRIPTION_PLANS[entry.key];
                const livePlan = pricingByKey.get(entry.key);
                const isTrial = entry.key === "TRIAL";
                return (
                  <div
                    key={entry.key}
                    className={`relative flex flex-col rounded-2xl p-6 ${
                      entry.featured
                        ? "bg-white text-slate-900 shadow-2xl shadow-black/30 ring-2 ring-accent-300 lg:-my-5 lg:py-11"
                        : "bg-white/5 ring-1 ring-white/10 backdrop-blur-sm"
                    }`}
                  >
                    {entry.featured && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent-300 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-950">
                        Most popular
                      </span>
                    )}
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    <p className={`mt-2 text-sm ${entry.featured ? "text-slate-500" : "text-white/60"}`}>{entry.body}</p>

                    <p className="mt-7 flex items-baseline gap-1.5 text-4xl font-bold tracking-tight">
                      {livePlan?.monthlyPrice != null && (
                        <span className={`text-base font-semibold ${entry.featured ? "text-slate-400" : "text-white/50"}`}>GHS</span>
                      )}
                      {livePlan?.monthlyPrice == null ? (
                        <span className="text-2xl">{plan.price}</span>
                      ) : (
                        <>
                          {livePlan?.monthlyPrice.toLocaleString("en-GH")}
                          <span className={`text-sm font-medium ${entry.featured ? "text-slate-400" : "text-white/45"}`}>/mo</span>
                        </>
                      )}
                    </p>

                    <ul className={`mt-7 flex-1 space-y-3 border-t pt-6 ${entry.featured ? "border-slate-200" : "border-white/10"}`}>
                      {plan.features.map((feature) => (
                        <li key={feature} className={`flex items-start gap-2.5 text-sm ${entry.featured ? "text-slate-600" : "text-white/70"}`}>
                          <Check className={`mt-0.5 size-4 shrink-0 ${entry.featured ? "text-brand-600" : "text-accent-300"}`} />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <Link
                      href="/register"
                      className={`mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors ${
                        entry.featured
                          ? "bg-brand-600 text-white hover:bg-brand-700"
                          : "bg-white text-brand-950 hover:bg-white/90"
                      }`}
                    >
                      {isTrial ? "Start free trial" : `Choose ${plan.name}`}
                      <ChevronRight className="size-4" />
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-200">FAQ</p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Frequently asked questions
              </h2>
              <p className="mt-5 leading-7 text-slate-300">
                Need more detail? Review the{" "}
                <Link href="/terms" className="font-semibold text-brand-200 underline underline-offset-4">Terms and Conditions</Link> or{" "}
                <Link href="/privacy-policy" className="font-semibold text-brand-200 underline underline-offset-4">Privacy Policy</Link>.
              </p>
            </div>

            <div className="space-y-3">
              {FAQS.map((faq) => (
                <details key={faq.question} className="group rounded-xl border border-white/10 bg-slate-900/70 transition-colors open:bg-slate-900">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-base font-semibold text-white marker:content-none">
                    {faq.question}
                    <ChevronRight className="size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90 group-open:text-brand-200" />
                  </summary>
                  <p className="px-5 pb-5 text-sm leading-6 text-slate-300">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 pb-20 sm:px-8 lg:px-10">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-gradient-to-r from-brand-950 via-brand-900 to-brand-800 px-6 py-14 text-center sm:px-12 lg:py-20">
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="absolute -left-20 top-0 size-72 rounded-full bg-brand-500/30 blur-3xl" />
              <div className="absolute -right-16 bottom-0 size-72 rounded-full bg-brand-400/20 blur-3xl" />
            </div>
            <div className="relative mx-auto max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Ready to see your shop clearly?
              </h2>
              <p className="mt-4 text-lg leading-8 text-white/75">
                Create your portal in minutes and start using a system built for faster selling and stronger decisions.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-bold text-brand-900 transition-colors hover:bg-brand-50 sm:w-auto"
                >
                  Start your 14-day trial
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/plans"
                  className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 text-sm font-bold text-white transition-colors hover:bg-white/10 sm:w-auto"
                >
                  Compare plans
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-slate-900">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-2.5">
                <StoreLogo size="sm" />
                <span className="text-lg font-bold tracking-tight text-white">{publicEnv.appName}</span>
              </div>
              <p className="mt-4 max-w-xs text-sm leading-6 text-slate-300">
                One reliable place for retail teams to sell, manage stock and understand the numbers behind the business.
              </p>
              <p className="mt-5 flex items-center gap-2 text-sm font-medium text-slate-300">
                <ShieldCheck className="size-4 text-brand-200" />
                Secure, store-isolated portals
              </p>
            </div>

            <div>
              <h3 className="text-sm font-bold text-white">Product</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className="transition-colors hover:text-white">
                      {link.label}
                    </a>
                  </li>
                ))}
                <li>
                  <Link href="/plans" className="transition-colors hover:text-white">
                    All plans
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-bold text-white">Account</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                <li>
                  <Link href="/register" className="transition-colors hover:text-white">
                    Create a portal
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="transition-colors hover:text-white">
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link href="/privacy-policy" className="transition-colors hover:text-white">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="transition-colors hover:text-white">
                    Terms and Conditions
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-8 text-sm text-slate-400 sm:flex-row">
            <p>&copy; {new Date().getFullYear()} {publicEnv.appName}. All rights reserved.</p>
            <p className="flex items-center gap-1.5 text-slate-300">
              <ReceiptText className="size-4 text-brand-200" />
              Built for Ghanaian retail
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
