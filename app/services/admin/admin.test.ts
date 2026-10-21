import { test, describe } from "node:test";
import assert from "node:assert";
import {
  generateUniqueDemoToken,
  verifyAdminPassword
} from "./admin.server";

describe("Admin Authentication & Tokens", () => {
  test("should verify master admin password correctly", () => {
    assert.strictEqual(verifyAdminPassword("admin@gst2026"), true);
    assert.strictEqual(verifyAdminPassword("wrongpass"), false);
    assert.strictEqual(verifyAdminPassword(""), false);
  });

  test("should generate high-entropy unique demo tokens with demo_ prefix", () => {
    const token1 = generateUniqueDemoToken();
    const token2 = generateUniqueDemoToken();

    assert.ok(token1.startsWith("demo_"));
    assert.ok(token2.startsWith("demo_"));
    assert.notStrictEqual(token1, token2);
    assert.strictEqual(token1.length, 29); // "demo_" (5) + 24 hex chars (12 bytes)
  });
});
