"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CreditCard, LogOut, Menu, Moon, Sun, UserCog } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { useCurrentUser } from "@/components/providers/SessionProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { api } from "@/lib/api/client";

interface AppNotification {
  id: string;
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const user = useCurrentUser();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadNotifications() {
      try {
        const result = await api.get<AppNotification[]>("/notifications");
        if (!cancelled) setNotifications(result);
      } catch {
        // Notifications are helpful but should never block the application shell.
      }
    }
    void loadNotifications();
    return () => {
      cancelled = true;
    };
  }, []);

  async function markNotificationRead(notification: AppNotification) {
    if (notification.readAt) return;
    setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item));
    try {
      await api.patch(`/notifications/${notification.id}/read`);
    } catch {
      // The optimistic state is harmless if a read receipt cannot be saved.
    }
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await api.post("/auth/logout");
    } finally {
      window.location.replace("/login");
    }
  }

  return (
    <header className="safe-top sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-card px-3 sm:px-4">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open menu"
        className="rounded-lg p-2 text-fg-secondary hover:bg-muted lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      <div className="min-w-0 flex-1" />

      <button
        type="button"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label="Toggle colour theme"
        className="rounded-lg p-2 text-fg-secondary hover:bg-muted"
      >
        {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setNotificationsOpen((open) => !open)}
          aria-label="Open notifications"
          aria-expanded={notificationsOpen}
          className="relative rounded-lg p-2 text-fg-secondary hover:bg-muted"
        >
          <Bell className="size-5" />
          {notifications.some((notification) => !notification.readAt) && (
            <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-danger" aria-label="Unread notifications" />
          )}
        </button>
        {notificationsOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setNotificationsOpen(false)} aria-hidden />
            <div className="absolute right-0 z-20 mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-line bg-card shadow-[var(--shadow-panel)]">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <p className="text-sm font-semibold text-fg">Notifications</p>
                <span className="text-xs text-fg-muted">{notifications.filter((notification) => !notification.readAt).length} unread</span>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-fg-muted">You are all caught up.</p>
                ) : notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => void markNotificationRead(notification)}
                    className="block w-full border-b border-line px-4 py-3 text-left last:border-0 hover:bg-muted"
                  >
                    <span className="flex items-start gap-2">
                      {!notification.readAt && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-600" />}
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-fg">{notification.title}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-fg-secondary">{notification.body}</span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-muted"
        >
          <Avatar name={user.fullName} src={user.avatarUrl} size="sm" />
          <span className="hidden text-left sm:block">
            <span className="block max-w-[10rem] truncate text-sm font-medium text-fg">{user.fullName}</span>
            <span className="block text-xs text-fg-muted">{ROLE_LABELS[user.role]}</span>
          </span>
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
            <div
              role="menu"
              className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-card shadow-[var(--shadow-panel)]"
            >
              <div className="border-b border-line p-3">
                <p className="truncate text-sm font-medium text-fg">{user.fullName}</p>
                <p className="truncate text-xs text-fg-muted">{user.email}</p>
                <Badge variant="brand" size="sm" className="mt-2">
                  {ROLE_LABELS[user.role]}
                </Badge>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  router.push("/profile");
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-fg-secondary hover:bg-muted"
              >
                <UserCog className="size-4" /> My profile
              </button>
              {user.role !== "SUPER_ADMIN" && user.storeId && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/subscription");
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-fg-secondary hover:bg-muted"
                >
                  <CreditCard className="size-4" /> Subscription
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={signOut}
                disabled={signingOut}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-danger hover:bg-muted disabled:opacity-60"
              >
                <LogOut className="size-4" /> Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
