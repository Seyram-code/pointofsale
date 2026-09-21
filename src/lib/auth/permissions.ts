import type { UserRole } from "@prisma/client";

/**
 * Permission keys follow `<module>.<action>`. Roles map to a baseline set;
 * individual grants/denies live in the UserPermission table and are layered
 * on top at session-resolution time.
 */
export const PERMISSIONS = {
  // Point of sale
  POS_ACCESS: "pos.access",
  POS_SELL: "pos.sell",
  POS_HOLD_SALE: "pos.hold",
  POS_PRICE_OVERRIDE: "pos.price_override",
  POS_DISCOUNT_APPLY: "pos.discount",
  POS_VOID_SALE: "pos.void",
  POS_OPEN_DRAWER: "pos.open_drawer",
  POS_REPRINT_RECEIPT: "pos.reprint",

  // Sales records
  SALES_VIEW: "sales.view",
  SALES_VIEW_ALL: "sales.view_all",
  SALES_EXPORT: "sales.export",

  // Returns
  RETURNS_CREATE: "returns.create",
  RETURNS_APPROVE: "returns.approve",
  RETURNS_VIEW: "returns.view",

  // Products
  PRODUCTS_VIEW: "products.view",
  PRODUCTS_POS_LOOKUP: "products.pos_lookup",
  PRODUCTS_CREATE: "products.create",
  PRODUCTS_UPDATE: "products.update",
  PRODUCTS_DELETE: "products.delete",
  PRODUCTS_MANAGE_PRICING: "products.pricing",

  // Inventory
  INVENTORY_VIEW: "inventory.view",
  INVENTORY_ADJUST: "inventory.adjust",
  INVENTORY_COUNT: "inventory.count",
  INVENTORY_RECEIVE: "inventory.receive",
  INVENTORY_TRANSFER: "inventory.transfer",

  // Purchasing / suppliers
  SUPPLIERS_VIEW: "suppliers.view",
  SUPPLIERS_MANAGE: "suppliers.manage",
  PURCHASE_ORDERS_VIEW: "purchase_orders.view",
  PURCHASE_ORDERS_MANAGE: "purchase_orders.manage",

  // Customers
  CUSTOMERS_VIEW: "customers.view",
  CUSTOMERS_POS_LOOKUP: "customers.pos_lookup",
  CUSTOMERS_MANAGE: "customers.manage",
  CUSTOMERS_CREDIT_MANAGE: "customers.credit",

  // Employees
  EMPLOYEES_VIEW: "employees.view",
  EMPLOYEES_MANAGE: "employees.manage",

  // Shifts
  SHIFTS_OPEN: "shifts.open",
  SHIFTS_CLOSE: "shifts.close",
  SHIFTS_VIEW_ALL: "shifts.view_all",
  SHIFTS_RECONCILE: "shifts.reconcile",
  SHIFTS_CASH_DROP: "shifts.cash_drop",

  // Reports
  REPORTS_DAILY: "reports.daily",
  REPORTS_WEEKLY: "reports.weekly",
  REPORTS_MONTHLY: "reports.monthly",
  REPORTS_YEARLY: "reports.yearly",
  REPORTS_PROFIT: "reports.profit",
  REPORTS_EXPORT: "reports.export",

  // Administration
  SETTINGS_VIEW: "settings.view",
  SETTINGS_MANAGE: "settings.manage",
  USERS_VIEW: "users.view",
  USERS_MANAGE: "users.manage",
  PERMISSIONS_MANAGE: "permissions.manage",
  AUDIT_LOGS_VIEW: "audit.view",
  STORES_MANAGE: "stores.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

const CASHIER_PERMISSIONS: Permission[] = [
  PERMISSIONS.POS_ACCESS,
  PERMISSIONS.POS_SELL,
  PERMISSIONS.POS_HOLD_SALE,
  PERMISSIONS.POS_REPRINT_RECEIPT,
  PERMISSIONS.PRODUCTS_POS_LOOKUP,
  PERMISSIONS.CUSTOMERS_POS_LOOKUP,
  PERMISSIONS.SALES_VIEW,
  PERMISSIONS.SHIFTS_OPEN,
  PERMISSIONS.SHIFTS_CLOSE,
];

const STOCK_KEEPER_PERMISSIONS: Permission[] = [
  PERMISSIONS.PRODUCTS_VIEW,
  PERMISSIONS.PRODUCTS_CREATE,
  PERMISSIONS.PRODUCTS_UPDATE,
  PERMISSIONS.INVENTORY_VIEW,
  PERMISSIONS.INVENTORY_ADJUST,
  PERMISSIONS.INVENTORY_COUNT,
  PERMISSIONS.INVENTORY_RECEIVE,
  PERMISSIONS.INVENTORY_TRANSFER,
  PERMISSIONS.SUPPLIERS_VIEW,
  PERMISSIONS.PURCHASE_ORDERS_VIEW,
  PERMISSIONS.PURCHASE_ORDERS_MANAGE,
];

const SUPERVISOR_PERMISSIONS: Permission[] = [
  ...CASHIER_PERMISSIONS,
  PERMISSIONS.RETURNS_CREATE,
  PERMISSIONS.PRODUCTS_VIEW,
  PERMISSIONS.INVENTORY_VIEW,
  PERMISSIONS.CUSTOMERS_VIEW,
  PERMISSIONS.CUSTOMERS_MANAGE,
  PERMISSIONS.POS_PRICE_OVERRIDE,
  PERMISSIONS.POS_DISCOUNT_APPLY,
  PERMISSIONS.POS_VOID_SALE,
  PERMISSIONS.POS_OPEN_DRAWER,
  PERMISSIONS.SALES_VIEW_ALL,
  PERMISSIONS.RETURNS_APPROVE,
  PERMISSIONS.RETURNS_VIEW,
  PERMISSIONS.INVENTORY_ADJUST,
  PERMISSIONS.INVENTORY_COUNT,
  PERMISSIONS.SHIFTS_VIEW_ALL,
  PERMISSIONS.SHIFTS_RECONCILE,
  PERMISSIONS.SHIFTS_CASH_DROP,
  PERMISSIONS.REPORTS_DAILY,
];

const ACCOUNTANT_PERMISSIONS: Permission[] = [
  PERMISSIONS.SALES_VIEW,
  PERMISSIONS.SALES_VIEW_ALL,
  PERMISSIONS.SALES_EXPORT,
  PERMISSIONS.RETURNS_VIEW,
  PERMISSIONS.PURCHASE_ORDERS_VIEW,
  PERMISSIONS.SHIFTS_VIEW_ALL,
  PERMISSIONS.SHIFTS_RECONCILE,
  PERMISSIONS.REPORTS_DAILY,
  PERMISSIONS.REPORTS_WEEKLY,
  PERMISSIONS.REPORTS_MONTHLY,
  PERMISSIONS.REPORTS_YEARLY,
  PERMISSIONS.REPORTS_PROFIT,
  PERMISSIONS.REPORTS_EXPORT,
  PERMISSIONS.AUDIT_LOGS_VIEW,
];

const MANAGER_PERMISSIONS: Permission[] = Array.from(
  new Set<Permission>([
    ...SUPERVISOR_PERMISSIONS,
    ...STOCK_KEEPER_PERMISSIONS,
    ...ACCOUNTANT_PERMISSIONS,
    PERMISSIONS.PRODUCTS_DELETE,
    PERMISSIONS.PRODUCTS_MANAGE_PRICING,
    PERMISSIONS.SUPPLIERS_MANAGE,
    PERMISSIONS.CUSTOMERS_CREDIT_MANAGE,
    PERMISSIONS.EMPLOYEES_VIEW,
    PERMISSIONS.EMPLOYEES_MANAGE,
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.SETTINGS_VIEW,
  ]),
);

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  ADMIN: ALL_PERMISSIONS.filter((p) => p !== PERMISSIONS.STORES_MANAGE),
  MANAGER: MANAGER_PERMISSIONS,
  SUPERVISOR: SUPERVISOR_PERMISSIONS,
  CASHIER: CASHIER_PERMISSIONS,
  STOCK_KEEPER: STOCK_KEEPER_PERMISSIONS,
  ACCOUNTANT: ACCOUNTANT_PERMISSIONS,
};

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrator",
  MANAGER: "Store Manager",
  SUPERVISOR: "Supervisor",
  CASHIER: "Cashier",
  STOCK_KEEPER: "Stock Keeper",
  ACCOUNTANT: "Accountant",
};

/** Merges the role baseline with per-user overrides. */
export function resolvePermissions(
  role: UserRole,
  overrides: Array<{ key: string; allowed: boolean }> = [],
): Permission[] {
  const set = new Set<string>(ROLE_PERMISSIONS[role] ?? []);
  for (const override of overrides) {
    if (override.allowed) set.add(override.key);
    else set.delete(override.key);
  }
  return Array.from(set) as Permission[];
}

export function hasPermission(granted: readonly string[], required: Permission | Permission[]): boolean {
  const list = Array.isArray(required) ? required : [required];
  return list.every((p) => granted.includes(p));
}

export function hasAnyPermission(granted: readonly string[], required: Permission[]): boolean {
  return required.some((p) => granted.includes(p));
}
