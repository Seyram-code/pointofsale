import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopActivationForm } from "@/components/auth/ShopActivationForm";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Activate your shop" };

export default function ActivateShopPage() {
  return <Suspense fallback={<Skeleton className="h-72 w-full rounded-card" />}><ShopActivationForm /></Suspense>;
}