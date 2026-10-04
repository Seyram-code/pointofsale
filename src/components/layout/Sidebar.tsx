"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Download, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { visibleSections } from "@/lib/config/navigation";
import { useCurrentUser } from "@/components/providers/SessionProvider";
import { publicEnv } from "@/lib/config/env";
import { StoreLogo } from "@/components/brand/StoreLogo";

export interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  restricted?: boolean;
}

export function Sidebar({ mobileOpen, onCloseMobile, restricted = false }: SidebarProps) {
  const user = useCurrentUser();
  const pathname = usePathname();
  const router = useRouter();
  const sections = visibleSections(user.permissions, user.role, user.isEmployee)
    .map((section) => ({
      ...section,
      items: restricted ? section.items.filter((item) => ["/subscription", "/support"].includes(item.href)) : section.items,
    }))
    .filter((section) => section.items.length > 0);

  const content = (
    <>
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-line px-4 lg:px-2 lg:group-hover:px-4">
        <StoreLogo size="sm" />
        <div className="block min-w-0 flex-1 lg:hidden lg:group-hover:block">
          <p className="truncate text-sm font-semibold text-fg">{publicEnv.appName}</p>
          <p className="truncate text-xs text-fg-muted">{user.storeName ?? "No store assigned"}</p>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close menu"
          className="rounded-lg p-2 text-fg-muted hover:bg-muted lg:hidden"
        >
          <X className="size-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4 lg:px-2 lg:group-hover:px-3">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="block px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-muted lg:hidden lg:group-hover:block">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      prefetch={user.role === "SUPER_ADMIN"}
                      onClick={onCloseMobile}
                      onMouseEnter={() => {
                        if (user.role === "SUPER_ADMIN") router.prefetch(item.href);
                      }}
                      onFocus={() => {
                        if (user.role === "SUPER_ADMIN") router.prefetch(item.href);
                      }}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-11 items-center justify-start gap-3 rounded-lg px-3 text-sm font-medium transition-colors lg:justify-center lg:group-hover:justify-start",
                        active ? "bg-brand-600 text-white" : "text-fg-secondary hover:bg-muted hover:text-fg",
                      )}
                      title={item.label}
                    >
                      <item.icon className="size-[18px] shrink-0" />
                      <span className="block truncate lg:hidden lg:group-hover:block">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="shrink-0 border-t border-line p-3 lg:px-2 lg:group-hover:px-3">
        <a
          href="/downloads/VidyPOS-User-Manual.pdf"
          download="VidyPOS-User-Manual.pdf"
          onClick={onCloseMobile}
          className="flex h-11 items-center gap-3 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50 lg:justify-center lg:group-hover:justify-start"
          title="Download manual"
        >
          <Download className="size-[18px] shrink-0" />
          <span className="truncate lg:hidden lg:group-hover:block">Download manual</span>
        </a>
      </div>
    </>
  );

  return (
    <>
      <aside className="group relative z-40 hidden w-16 shrink-0 flex-col border-r border-line bg-card transition-[width] duration-200 ease-out hover:w-64 lg:flex">{content}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={onCloseMobile} aria-hidden />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col border-r border-line bg-card">{content}</aside>
        </div>
      )}
    </>
  );
}
