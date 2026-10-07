import assert from "node:assert/strict";
import { test } from "node:test";
import { canAccessNotification } from "@/lib/auth/notification-access";
import type { AuthenticatedSession } from "@/lib/auth/types";

test("staff members can only read notifications for their own user or same store", () => {
  const session = {
    user: {
      id: "user-1",
      storeId: "store-1",
      businessId: "business-1",
      role: "MANAGER",
      permissions: [],
      subscriptionActive: true,
    },
  } as unknown as AuthenticatedSession;

  assert.equal(canAccessNotification(session, { userId: "user-1", storeId: "store-1" }), true);
  assert.equal(canAccessNotification(session, { userId: "user-2", storeId: "store-1" }), false);
  assert.equal(canAccessNotification(session, { userId: null, storeId: "store-1" }), true);
  assert.equal(canAccessNotification(session, { userId: null, storeId: "store-2" }), false);
});
