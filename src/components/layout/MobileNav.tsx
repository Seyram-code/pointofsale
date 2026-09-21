"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { mobileNavItems } from "@/lib/config/navigation";
import { useCurrentUser } from "@/components/providers/SessionProvider";

export function MobileNav() {
  const user = useCurrentUser();
  const pathname = usePathname();
  const items = mobileNavItems(user.permissions, user.role);

  if (user.role === "SUPER_ADMIN" || items.length === 0) return null;

  return (
    <nav className="safe-bottom no-print sticky bottom-0 z-30 flex border-t border-line bg-card lg:hidden">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
              active ? "text-brand-600 dark:text-brand-400" : "text-fg-muted",
            )}
          >
            <item.icon className="size-5" />
            <span className="max-w-full truncate px-1">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
