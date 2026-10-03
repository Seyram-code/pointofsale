import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withRequestTimeout, RequestTimeoutError } from "./request-timeout";

describe("withRequestTimeout", () => {
  it("resolves when the promise completes before the timeout", async () => {
    const value = await withRequestTimeout(Promise.resolve("ok"), 50);
    assert.equal(value, "ok");
  });

  it("rejects with a timeout error when the promise never resolves", async () => {
    await assert.rejects(
      () => withRequestTimeout(new Promise(() => undefined), 25, "Database timed out"),
      (error) => error instanceof RequestTimeoutError && error.message === "Database timed out",
    );
  });
});
