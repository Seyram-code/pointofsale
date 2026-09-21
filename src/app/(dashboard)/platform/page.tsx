import { Metadata } from "next";
import { requireSession } from "@/lib/auth/guard";
import { getPlatformOverview } from "@/lib/services/platform.service";
import { PlatformOwnerDashboard } from "@/components/platform/PlatformOwnerDashboard";

export const metadata: Metadata = { title: "Platform Owner" };

export default async function PlatformPage() {
  const { user } = await requireSession("/platform");

  if (user.role !== "SUPER_ADMIN") {
    return (
      <div className="rounded-xl border border-line bg-card p-8">
        <h1 className="text-xl font-semibold text-fg">Platform access required</h1>
        <p className="mt-2 text-sm text-fg-muted">Only the system super admin can view the platform registry.</p>
      </div>
    );
  }

  const overview = await getPlatformOverview();
  return (
    <PlatformOwnerDashboard overview={overview} />
  );
}
