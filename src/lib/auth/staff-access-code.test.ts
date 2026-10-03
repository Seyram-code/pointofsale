import assert from "node:assert/strict";
import { test } from "node:test";
import { createStaffAccessCode, getStoreAccessCodePrefix, hashStaffAccessCode } from "@/lib/auth/staff-access-code";

test("staff access codes use the store prefix and a three-digit suffix", () => {
  const first = createStaffAccessCode("The Rose Market");
  const second = createStaffAccessCode("The Rose Market");

  assert.equal(getStoreAccessCodePrefix("The Rose Market"), "TRM");
  assert.match(first.accessCode, /^TRM\d{3}$/);
  assert.notEqual(first.accessCode, first.hash);
  assert.equal(first.hash, hashStaffAccessCode(first.accessCode));
  assert.match(second.accessCode, /^TRM\d{3}$/);
  assert.equal(second.hash, hashStaffAccessCode(second.accessCode));
});

test("short shop names still produce a three-character prefix", () => {
  assert.equal(getStoreAccessCodePrefix("Main Branch"), "MAB");
  assert.equal(getStoreAccessCodePrefix("Rose Market"), "ROM");
  assert.equal(getStoreAccessCodePrefix("X"), "XXX");
});