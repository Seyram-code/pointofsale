import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/guard";
import { SupportTicketsView } from "@/components/support/SupportTicketsView";

export const metadata: Metadata = { title: "Help & Support" };

export default async function SupportPage() {
  const { user } = await requireSession("/support");
  return <SupportTicketsView isSuperAdmin={user.role === "SUPER_ADMIN"} />;
}
