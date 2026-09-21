import {
  BarChart3,
  Boxes,
  Building2,
  CalendarDays,
  ClipboardList,
  FileClock,
  LayoutDashboard,
  Package,
  Receipt,
  RotateCcw,
  Settings,
  ShoppingCart,
  CreditCard,
  Shield,
  Store,
  Truck,
  Users,
  UserSquare,
  UserRound,
  Wallet,
  Repeat,
  FileWarning,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { UserRole } from "@prisma/client";
import { PERMISSIONS, type Permission } from "@/lib/auth/permissions";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
  role?: UserRole;
  /** Shown in the mobile bottom bar (max 5 recommended). */
  primary?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Main",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, primary: true },
      { label: "Platform Dashboard", href: "/platform", icon: Shield, role: "SUPER_ADMIN", primary: true },
      { label: "Total registered businesses", href: "/platform/total-registered-businesses", icon: Building2, role: "SUPER_ADMIN", primary: true },
      { label: "Active businesses", href: "/platform/active-businesses", icon: Store, role: "SUPER_ADMIN", primary: true },
      { label: "Trial businesses", href: "/platform/trial-businesses", icon: CalendarDays, role: "SUPER_ADMIN", primary: true },
      { label: "Expired subscriptions", href: "/platform/expired-subscriptions", icon: FileWarning, role: "SUPER_ADMIN", primary: true },
      { label: "Monthly recurring revenue", href: "/platform/monthly-recurring-revenue", icon: CreditCard, role: "SUPER_ADMIN", primary: true },
      { label: "New registrations", href: "/platform/new-registrations", icon: Users, role: "SUPER_ADMIN", primary: true },
      { label: "Business reports", href: "/platform/reports", icon: FileClock, role: "SUPER_ADMIN", primary: true },
      { label: "Active users", href: "/platform/active-users", icon: UserRound, role: "SUPER_ADMIN", primary: true },
      { label: "Total transactions", href: "/platform/total-transactions", icon: ShoppingCart, role: "SUPER_ADMIN", primary: true },
      { label: "Total sales processed", href: "/platform/total-sales-processed", icon: BarChart3, role: "SUPER_ADMIN", primary: true },
      { label: "Payment revenue", href: "/platform/payment-revenue", icon: Receipt, role: "SUPER_ADMIN", primary: true },
      { label: "Subscription revenue", href: "/platform/subscription-revenue", icon: Repeat, role: "SUPER_ADMIN", primary: true },
      { label: "POS Sales", href: "/pos", icon: ShoppingCart, permission: PERMISSIONS.POS_ACCESS, primary: true },
      { label: "Products", href: "/products", icon: Package, permission: PERMISSIONS.PRODUCTS_VIEW, primary: true },
      { label: "Inventory", href: "/inventory", icon: Boxes, permission: PERMISSIONS.INVENTORY_VIEW },
      { label: "Sales", href: "/sales", icon: Receipt, permission: PERMISSIONS.SALES_VIEW, primary: true },
      { label: "Customers", href: "/customers", icon: Users, permission: PERMISSIONS.CUSTOMERS_VIEW },
      { label: "Suppliers", href: "/suppliers", icon: Truck, permission: PERMISSIONS.SUPPLIERS_VIEW },
      { label: "Reports", href: "/reports", icon: BarChart3, permission: PERMISSIONS.REPORTS_DAILY, primary: true },
      { label: "Employees", href: "/employees", icon: UserSquare, permission: PERMISSIONS.EMPLOYEES_VIEW },
      { label: "Returns", href: "/returns", icon: RotateCcw, permission: PERMISSIONS.RETURNS_VIEW },
      { label: "Settings", href: "/settings", icon: Settings, permission: PERMISSIONS.SETTINGS_VIEW },
      { label: "Subscription", href: "/subscription", icon: CreditCard },
    ],
  },
  {
    title: "System",
    items: [
      { label: "System Staff", href: "/system-staff", icon: UserSquare, role: "SUPER_ADMIN" },
    ],
  },
  {
    title: "More",
    items: [
      { label: "Shifts", href: "/shifts", icon: Wallet, permission: PERMISSIONS.SHIFTS_OPEN },
      {
        label: "Purchase Orders",
        href: "/purchase-orders",
        icon: ClipboardList,
        permission: PERMISSIONS.PURCHASE_ORDERS_VIEW,
      },
      { label: "Audit Logs", href: "/audit-logs", icon: FileClock, permission: PERMISSIONS.AUDIT_LOGS_VIEW },
    ],
  },
];

export function visibleSections(permissions: readonly string[], role?: UserRole): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.role && item.role !== role) {
        return false;
      }
      if (role === "SUPER_ADMIN") {
        return item.role === "SUPER_ADMIN";
      }
      return !item.permission || permissions.includes(item.permission);
    }),
  })).filter((section) => section.items.length > 0);
}

export function mobileNavItems(permissions: readonly string[], role?: UserRole): NavItem[] {
  const items = NAV_SECTIONS.flatMap((section) => section.items);

  if (role === "SUPER_ADMIN") {
    return items.filter((item) => item.role === "SUPER_ADMIN" && item.primary).slice(0, 5);
  }

  return items
    .filter((item) => !item.role || item.role === role)
    .filter((item) => item.primary && (!item.permission || permissions.includes(item.permission)))
    .slice(0, 5);
}
