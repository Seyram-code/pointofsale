import { redirect } from "next/navigation";
import Image from "next/image";
import { BarChart3, ScanBarcode, Smartphone } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { StoreLogo } from "@/components/brand/StoreLogo";
import { publicEnv } from "@/lib/config/env";

const HIGHLIGHTS = [
  { icon: ScanBarcode, title: "Scan and sell fast", body: "Barcode-ready checkout built for busy tills." },
  { icon: Smartphone, title: "Cash, MoMo and card", body: "Every payment method Ghanaian shoppers use." },
  { icon: BarChart3, title: "Live business insight", body: "Daily to yearly reports, always up to date." },
];

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session?.user.role === "SUPER_ADMIN") redirect("/platform");
  if (session) redirect("/dashboard");

  return (
    <div className="flex min-h-dvh bg-app">
      {/* Brand panel — desktop only */}
      <aside className="relative hidden w-[46%] max-w-2xl flex-col overflow-hidden bg-brand-800 p-10 text-white lg:flex xl:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-brand-600/40 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-20 size-96 rounded-full bg-accent-500/15 blur-3xl"
        />

        <div className="relative z-10 flex items-center gap-3">
          <StoreLogo size="sm" className="shadow-none" />
          <span className="text-lg font-semibold">{publicEnv.businessName}</span>
        </div>

        <div className="relative z-10 mx-auto mt-10 w-full max-w-lg rounded-3xl border border-white/20 bg-black/15 p-3 shadow-2xl backdrop-blur-sm">
          <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-brand-950">
            <Image
              src="/images/pharmacy.jpeg"
              alt="Bright supermarket aisle with fresh products"
              className="size-full object-cover"
              width={480}
              height={640}
              priority
            />
          </div>
          <div className="px-2 pb-1 pt-4">
            <p className="text-sm font-semibold">A simpler way to run your store</p>
            <p className="mt-1 text-sm text-white/70">Keep sales, stock and customers moving from one clear workspace.</p>
          </div>
        </div>

        <div className="relative z-10 mt-10 max-w-md">
          <h2 className="text-3xl font-semibold leading-tight xl:text-4xl">
            Everything your supermarket needs, in one till.
          </h2>
          <ul className="mt-8 space-y-5">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex gap-3.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <item.icon className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-sm text-white/70">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 mt-auto pt-10 text-xs text-white/60">
          &copy; {new Date().getFullYear()} {publicEnv.businessName}. All prices in Ghana Cedi (GH&#8373;).
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
