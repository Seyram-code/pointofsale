import { requireSession } from "@/lib/auth/guard";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { AppShell } from "@/components/layout/AppShell";
import { SessionExpiryGuard } from "@/components/layout/SessionExpiryGuard";
import { hasSubscriptionAccess } from "@/lib/services/subscription.service";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  if (session.user.role !== "SUPER_ADMIN" && session.user.storeId && !(await hasSubscriptionAccess(session.user.storeId))) {
    redirect("/subscription?required=1");
  }

  return (
    <SessionProvider user={session.user}>
      <SessionExpiryGuard />
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
