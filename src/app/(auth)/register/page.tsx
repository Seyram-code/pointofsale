import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { getPlatformPlanPricing } from "@/lib/services/plan-pricing.service";

export const metadata: Metadata = { title: "Create your shop account" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const pricing = await getPlatformPlanPricing();
  return <div><h1 className="text-2xl font-semibold text-fg">Create your shop account</h1><p className="mt-1.5 mb-6 text-sm text-fg-muted">Launch your own VidyPOS portal with a 14-day free trial.</p><RegisterForm pricing={pricing} /></div>;
}