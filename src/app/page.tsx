import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  BatteryFull,
  Boxes,
  Check,
  ChevronRight,
  CreditCard,
  Home,
  Menu,
  ReceiptText,
  ScanBarcode,
  ShieldCheck,
  Signal,
  Sparkles,
  UserCog,
  Users,
  Wifi,
} from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { StoreLogo } from "@/components/brand/StoreLogo";
import { publicEnv } from "@/lib/config/env";
import { getPlatformPlanPricing } from "@/lib/services/plan-pricing.service";
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from "@/lib/config/subscription-plans";

const NAV_LINKS = [
  { href: "#features", label: "Why MyPOS" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

const SHOP_TYPES = ["Supermarkets", "Provision stores", "Pharmacies", "Restaurants", "Mini marts", "Wholesalers"];

// Decorative tab bar for the phone mockup showing the stock-alerts screen.
const PHONE_NAV = [
  { icon: Home, label: "Home", active: false },
  { icon: ReceiptText, label: "Sales", active: false },
  { icon: Boxes, label: "Stock", active: true },
  { icon: ScanBarcode, label: "Scan", active: false },
  { icon: UserCog, label: "Team", active: false },
];

const FEATURES = [
  { icon: ScanBarcode, title: "A faster checkout", body: "Scan products and take Cash, MoMo and card payments without slowing the queue." },
  { icon: Boxes, title: "Stock you can trust", body: "See what is selling, what is running low and what to reorder before the shelf empties." },
  { icon: BarChart3, title: "A clearer business", body: "Daily sales, product performance and staff activity in one calm, useful portal." },
  { icon: CreditCard, title: "Every payment method", body: "Cash, Mobile Money and card workflows recorded against the right till and staff member." },
  { icon: Users, title: "Customers & suppliers", body: "Keep customer records and supplier ledgers alongside your stock.", tag: "Premium" },
  { icon: UserCog, title: "Roles you control", body: "Limit what each staff member can do across sales, products and reporting." },
];

const STEPS = [
  { title: "Create your portal", body: "Register your shop and configure your company details in minutes." },
  { title: "Set up your team", body: "Add tills, staff, products and opening stock with clear roles." },
  { title: "Sell with confidence", body: "Run checkout and keep an eye on the numbers from one place." },
];

/**
 * The four packages in display order. Names, prices and feature bullets all
 * come from `SUBSCRIPTION_PLANS` so this table can never drift from billing.
 */
const PLANS: Array<{ key: SubscriptionPlan; body: string; featured: boolean }> = [
  { key: "TRIAL", body: "Try every MyPOS feature free for 14 days", featured: false },
  { key: "STARTER", body: "For small shops getting organised", featured: false },
  { key: "PREMIUM", body: "For growing supermarkets and teams", featured: true },
  { key: "ENTERPRISE", body: "For larger retail operations", featured: false },
];

const FAQS = [
  { question: "Who is MyPOS for?", answer: "MyPOS is built for shops and supermarkets that need one place to manage checkout, products, stock, staff and sales reporting." },
  { question: "How do I get started?", answer: "Create a shop portal, add your products and opening stock, then invite your team with the access they need." },
  { question: "Can I track different payment methods?", answer: "The point of sale supports cash, mobile money and card payment workflows. Available payment processing depends on the options configured for your account." },
  { question: "Can I control what each staff member can do?", answer: "Yes. MyPOS uses staff roles and permissions so access to areas such as products, sales and reports can be limited by responsibility." },
  { question: "How is pricing handled?", answer: "Every shop starts with a 14-day free trial. After that, plans are billed monthly: Starter at GHS 99, Premium at GHS 130 and Enterprise at GHS 170. You can change plan from your account at any time." },
  { question: "Where can I get help or learn how my information is used?", answer: "Contact your store administrator for account access. Read our Privacy Policy for information handling, or use the support contact provided by your store." },
];

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect("/dashboard");
  const pricing = await getPlatformPlanPricing();
  const pricingByKey = new Map(pricing.map((plan) => [plan.key, plan]));

  return (
    <div className="min-h-dvh bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <Link href="/" className="flex items-center gap-2.5">
            <StoreLogo size="sm" />
            <span className="text-lg font-bold tracking-tight text-slate-900">{publicEnv.appName}</span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">
                {link.label}
              </a>
            ))}
            <Link href="/plans" className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">
              All plans
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 lg:inline-flex">
              Sign in
            </Link>
            <Link href="/register" className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700">
              Start free trial
              <ArrowRight className="size-4" />
            </Link>
            <details className="relative lg:hidden">
              <summary aria-label="Open menu" className="flex size-10 cursor-pointer list-none items-center justify-center rounded-lg border border-slate-200 text-slate-700 marker:content-none">
                <Menu className="size-5" />
              </summary>
              <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                {NAV_LINKS.map((link) => (
                  <a key={link.href} href={link.href} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100">
                    {link.label}
                  </a>
                ))}
                <Link href="/plans" className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100">
                  All plans
                </Link>
                <div className="my-2 border-t border-slate-100" />
                <Link href="/login" className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100">
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
            <div className="absolute -left-40 -top-56 size-[34rem] rounded-full bg-brand-200/50 blur-3xl" />
            <div className="absolute -right-32 -top-32 size-[28rem] rounded-full bg-accent-200/50 blur-3xl" />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-white" />
          </div>

          <div className="mx-auto max-w-7xl px-5 pb-16 pt-16 sm:px-8 sm:pt-24 lg:px-10 lg:pb-24 lg:pt-28">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-brand-700 shadow-sm">
                <Sparkles className="size-3.5" />
                Built for Ghanaian retail
              </span>
              <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">
                Run the shop.
                <br className="hidden sm:block" />{" "}
                <span className="bg-gradient-to-r from-brand-600 to-brand-800 bg-clip-text text-transparent">See the whole picture.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                MyPOS gives shops and supermarkets one reliable place to sell, manage stock, understand the numbers and grow with confidence.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/register" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 text-sm font-bold text-white shadow-lg shadow-brand-600/25 transition-all hover:bg-brand-700 sm:w-auto">
                  Start your 14-day trial
                  <ArrowRight className="size-4" />
                </Link>
                <Link href="/plans" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 text-sm font-bold text-slate-800 transition-colors hover:bg-slate-50 sm:w-auto">
                  View plans
                  <ChevronRight className="size-4" />
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-600">
                {["No setup fee", "Cash, MoMo and card", "Your own portal"].map((point) => (
                  <span key={point} className="flex items-center gap-1.5">
                    <Check className="size-4 text-brand-600" />
                    {point}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
<section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8 lg:px-10">
          <div className="relative rounded-3xl border border-slate-200/80 bg-white p-2 shadow-2xl shadow-slate-900/10">
            <div className="overflow-hidden rounded-[1.25rem] border border-slate-100">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
                <span className="size-2.5 rounded-full bg-slate-300" />
                <span className="size-2.5 rounded-full bg-slate-300" />
                <span className="size-2.5 rounded-full bg-slate-300" />
                <div className="ml-3 flex flex-1 items-center gap-2 rounded-md bg-white px-2.5 py-1 text-[10px] text-slate-400 ring-1 ring-slate-200">
                  <ShieldCheck className="size-3" />
                  portal.mypos.app/dashboard
                </div>
              </div>

              <Image
                src="/screenshots/dashboard.png"
                alt="MyPOS dashboard showing today's sales, transactions, profit and payment method breakdown for a supermarket"
                width={2784}
                height={1638}
                sizes="(max-width: 1152px) 100vw, 1152px"
                className="block w-full"
              />
            </div>

            <div className="absolute -right-3 -top-3 hidden rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-lg sm:block">
              <p className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                <span className="size-2 rounded-full bg-success" />
                Live sales
              </p>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-slate-50/70">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-5 py-8 sm:px-8 lg:flex-row lg:px-10">
            <p className="shrink-0 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Built for</p>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 lg:justify-start">
              {SHOP_TYPES.map((type) => (
                <span key={type} className="text-sm font-semibold text-slate-700">{type}</span>
              ))}
            </div>
          </div>
        </section>
<section id="features" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Why MyPOS</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Everything a shop needs, in one place.
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              From the first scan of the day to the month-end numbers, MyPOS keeps checkout, stock and reporting working together.
            </p>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-xl hover:shadow-slate-900/5"
              >
                <div className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 transition-colors duration-200 group-hover:bg-brand-600 group-hover:text-white group-hover:ring-brand-600">
                  <feature.icon className="size-5" />
                </div>
                <h3 className="mt-5 text-lg font-bold tracking-tight text-slate-900">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{feature.body}</p>
                {feature.tag && (
                  <span className="mt-4 inline-flex rounded-full bg-accent-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-accent-700">
                    {feature.tag}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden border-y border-slate-200 bg-slate-50">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:px-10 lg:py-28">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-accent-100 px-3 py-1.5 text-xs font-semibold text-accent-700">
                <Boxes className="size-3.5" />
                Stock alerts
              </span>
              <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Know what is running out before the shelf empties.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                MyPOS watches stock levels for you and flags anything low or about to expire, so you reorder on time
                instead of losing a sale on an empty shelf.
              </p>

              <ul className="mt-8 space-y-4">
                {[
                  "Low-stock alerts the moment an item drops below its reorder level",
                  "Expiry tracking for batches that are about to go out of date",
                  "Clear reorder quantities and days remaining on every line",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3 text-slate-700">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                      <Check className="size-3.5" />
                    </span>
                    <span className="text-sm leading-6">{point}</span>
                  </li>
                ))}
              </ul>

              <Link href="/register" className="mt-9 inline-flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-bold text-white transition-colors hover:bg-brand-700">
                Start your 14-day trial
                <ArrowRight className="size-4" />
              </Link>
            </div>

            <div className="relative">
              <div
                aria-hidden
                className="absolute left-1/2 top-1/2 -z-10 h-[26rem] w-[21rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-brand-200/60 via-accent-100/50 to-transparent blur-3xl"
              />

              <div className="relative mx-auto w-full max-w-[19rem]">
                <div className="relative rounded-[2.5rem] bg-slate-950 p-2 shadow-2xl shadow-slate-900/30 ring-1 ring-slate-900/10">
                  <span aria-hidden className="absolute -left-1 top-28 h-12 w-1.5 rounded-l-md bg-slate-800" />
                  <span aria-hidden className="absolute -left-1 top-44 h-16 w-1.5 rounded-l-md bg-slate-800" />
                  <span aria-hidden className="absolute -right-1 top-36 h-20 w-1.5 rounded-r-md bg-slate-800" />

                  <div className="overflow-hidden rounded-[2rem] bg-[#101417]">
                    <div className="flex items-center justify-between px-5 pb-1.5 pt-3 text-[11px] font-semibold text-white">
                      <span>9:41</span>
                      <span aria-hidden className="h-5 w-20 rounded-full bg-black" />
                      <span className="flex items-center gap-1">
                        <Signal className="size-3.5" />
                        <Wifi className="size-3.5" />
                        <BatteryFull className="size-4" />
                      </span>
                    </div>

                    <Image
                      src="/screenshots/inventory.png"
                      alt="MyPOS stock alerts on a phone, listing low-stock items and batches expiring within 30 days"
                      width={1192}
                      height={1302}
                      sizes="(max-width: 640px) 90vw, 288px"
                      className="block w-full"
                    />

                    <div className="flex items-stretch justify-between border-t border-white/10 px-2 pb-5 pt-2.5">
                      {PHONE_NAV.map((item) => (
                        <span key={item.label} className="flex flex-1 flex-col items-center gap-1">
                          <item.icon className={`size-5 ${item.active ? "text-brand-400" : "text-slate-500"}`} />
                          <span className={`text-[10px] font-semibold ${item.active ? "text-brand-400" : "text-slate-500"}`}>
                            {item.label}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-600">How it works</p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                From first sale to full control.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                Start with a clean setup, bring your team in, and let the portal turn the daily rush into useful business signals.
              </p>
            </div>

            <div className="mt-14 grid gap-5 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <div key={step.title} className="relative rounded-2xl border border-slate-200 bg-slate-50 p-7 transition-shadow hover:shadow-lg hover:shadow-slate-900/5">
                  <span className="flex size-10 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white shadow-md shadow-brand-600/25">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-5 text-lg font-bold tracking-tight text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
<section id="pricing" className="relative overflow-hidden bg-brand-950 px-5 py-20 text-white sm:px-8 lg:px-10 lg:py-28">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-[-12rem] size-[42rem] -translate-x-1/2 rounded-full bg-brand-600/30 blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-400">Simple monthly plans</p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">Start small. Grow when ready.</h2>
              <p className="mt-5 text-lg leading-8 text-white/60">
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
                        ? "bg-white text-slate-900 shadow-2xl shadow-black/30 ring-2 ring-accent-400 lg:-my-5 lg:py-11"
                        : "bg-white/5 ring-1 ring-white/10 backdrop-blur-sm"
                    }`}
                  >
                    {entry.featured && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent-400 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-950">
                        Most popular
                      </span>
                    )}
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    <p className={`mt-2 text-sm ${entry.featured ? "text-slate-500" : "text-white/55"}`}>{entry.body}</p>

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
                          <Check className={`mt-0.5 size-4 shrink-0 ${entry.featured ? "text-brand-600" : "text-accent-400"}`} />
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
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">FAQ</p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Frequently asked questions
              </h2>
              <p className="mt-5 leading-7 text-slate-600">
                Need more detail? Review the{" "}
                <Link href="/terms" className="font-semibold text-brand-700 underline underline-offset-4">Terms and Conditions</Link> or{" "}
                <Link href="/privacy-policy" className="font-semibold text-brand-700 underline underline-offset-4">Privacy Policy</Link>.
              </p>
            </div>

            <div className="space-y-3">
              {FAQS.map((faq) => (
                <details key={faq.question} className="group rounded-xl border border-slate-200 bg-white transition-colors open:bg-slate-50/60">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-base font-semibold text-slate-900 marker:content-none">
                    {faq.question}
                    <ChevronRight className="size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90 group-open:text-brand-600" />
                  </summary>
                  <p className="px-5 pb-5 text-sm leading-6 text-slate-600">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 pb-20 sm:px-8 lg:px-10">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-brand-900 px-6 py-14 text-center sm:px-12 lg:py-20">
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="absolute -left-20 top-0 size-72 rounded-full bg-brand-600/40 blur-3xl" />
              <div className="absolute -right-16 bottom-0 size-72 rounded-full bg-accent-500/25 blur-3xl" />
            </div>
            <div className="relative mx-auto max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Ready to see your shop clearly?
              </h2>
              <p className="mt-4 text-lg leading-8 text-white/70">
                Create your portal in minutes and try every feature free for 14 days.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/register" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-bold text-brand-900 transition-colors hover:bg-brand-50 sm:w-auto">
                  Start your 14-day trial
                  <ArrowRight className="size-4" />
                </Link>
                <Link href="/plans" className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-white/25 px-6 text-sm font-bold text-white transition-colors hover:bg-white/10 sm:w-auto">
                  Compare plans
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-2.5">
                <StoreLogo size="sm" />
                <span className="text-lg font-bold tracking-tight text-slate-900">{publicEnv.appName}</span>
              </div>
              <p className="mt-4 max-w-xs text-sm leading-6 text-slate-600">
                One reliable place for shops and supermarkets to sell, manage stock and understand the numbers.
              </p>
              <p className="mt-5 flex items-center gap-2 text-sm font-medium text-slate-600">
                <ShieldCheck className="size-4 text-brand-600" />
                Secure, store-isolated portals
              </p>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900">Product</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className="transition-colors hover:text-brand-700">{link.label}</a>
                  </li>
                ))}
                <li><Link href="/plans" className="transition-colors hover:text-brand-700">All plans</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900">Account</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li><Link href="/register" className="transition-colors hover:text-brand-700">Create a portal</Link></li>
                <li><Link href="/login" className="transition-colors hover:text-brand-700">Sign in</Link></li>
                <li><Link href="/privacy-policy" className="transition-colors hover:text-brand-700">Privacy Policy</Link></li>
                <li><Link href="/terms" className="transition-colors hover:text-brand-700">Terms and Conditions</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-8 text-sm text-slate-500 sm:flex-row">
            <p>&copy; {new Date().getFullYear()} {publicEnv.appName}. All rights reserved.</p>
            <p className="flex items-center gap-1.5">
              <ReceiptText className="size-4" />
              Built for Ghanaian retail
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}