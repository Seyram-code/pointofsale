import { requireSession } from "@/lib/auth/guard";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { AppShell } from "@/components/layout/AppShell";
import { SessionExpiryGuard } from "@/components/layout/SessionExpiryGuard";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const currentPath = (await headers()).get("x-mypo-pathname");
  const isSupportPage = currentPath === "/support";
  const hasAccess = session.user.role === "SUPER_ADMIN" || !session.user.storeId || session.user.subscriptionActive;

  if (!hasAccess && !isSupportPage) {
    if (session.user.isEmployee) redirect("/forbidden");
    redirect("/subscription?required=1");
  }

  return (
    <SessionProvider user={session.user}>
      <SessionExpiryGuard />
      <AppShell restricted={!hasAccess}>{children}</AppShell>
    </SessionProvider>
  );
}
