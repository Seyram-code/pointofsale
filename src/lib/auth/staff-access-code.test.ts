import assert from "node:assert/strict";
import { test } from "node:test";
import { createStaffAccessCode, createUniqueStaffAccessCode, getStoreAccessCodePrefix, hashStaffAccessCode } from "@/lib/auth/staff-access-code";
import { staffAccessCodeLoginSchema } from "@/lib/validations/auth.schema";

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

test("staff login accepts generated access codes with digits in the store prefix", () => {
  const { accessCode } = createStaffAccessCode("Shop 9 Express");

  assert.match(accessCode, /^S9E\d{3}$/);
  assert.equal(staffAccessCodeLoginSchema.safeParse({ mode: "staff", accessCode }).success, true);
  assert.equal(staffAccessCodeLoginSchema.safeParse({ mode: "staff", accessCode: "S9E419" }).success, true);
});

test("generated access codes avoid hashes already used in the database", () => {
  const usedHashes = [hashStaffAccessCode("ACS909"), hashStaffAccessCode("ACS910")];
  const candidate = createUniqueStaffAccessCode("Adom Cold Store", usedHashes);

  assert.notEqual(candidate.hash, usedHashes[0]);
  assert.notEqual(candidate.hash, usedHashes[1]);
  assert.match(candidate.accessCode, /^ACS\d{3}$/);
});