import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { StoreLogo } from "@/components/brand/StoreLogo";
import { Skeleton } from "@/components/ui/Skeleton";
import { publicEnv } from "@/lib/config/env";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sign in",
  description: `Sign in to the ${publicEnv.businessName} point of sale.`,
};

export default function LoginPage() {
  return (
    <div>
      <div className="mb-6 flex flex-col items-center text-center sm:mb-7">
        <StoreLogo size="lg" className="lg:hidden" />
        <h1 className="mt-4 text-2xl font-semibold text-fg sm:text-3xl lg:mt-0">{publicEnv.businessName}</h1>
        <p className="mt-1.5 text-sm text-fg-muted">
          {publicEnv.businessTagline} &middot; Sign in to your till or back office
        </p>
      </div>

      <Suspense fallback={<Skeleton className="h-[26rem] w-full rounded-card" />}>
        <LoginForm />
      </Suspense>

      <p className="mt-6 text-center text-xs text-fg-muted">
        Authorised staff only. All sign-in activity is recorded.
      </p>
      <p className="mt-3 text-center text-sm text-fg-muted">New shop, pharmacy or supermarket? <Link href="/register" className="font-medium text-brand-600 hover:underline">Create your portal</Link></p>
    </div>
  );
}
