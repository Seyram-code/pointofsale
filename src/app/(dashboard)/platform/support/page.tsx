import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/guard";
import { SupportTicketsView } from "@/components/support/SupportTicketsView";

export const metadata: Metadata = { title: "Support Tickets" };

export default async function PlatformSupportPage() {
  const { user } = await requireSession("/platform/support");
  if (user.role !== "SUPER_ADMIN") redirect("/support");
  return <SupportTicketsView isSuperAdmin />;
}
