import { test, describe } from "node:test";
import assert from "node:assert";
import {
  generateUniqueDemoToken,
  verifyAdminPassword,
  getPublicOrigin
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

  test("should resolve public origin using x-forwarded headers and never return raw 0.0.0.0", () => {
    // Simulated request behind reverse proxy (e.g. Nginx on production)
    const req1 = new Request("http://0.0.0.0:3000/admin", {
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "itskoop.inaragroups.com"
      }
    });
    assert.strictEqual(getPublicOrigin(req1), "https://itskoop.inaragroups.com");

    // Simulated local dev request
    const req2 = new Request("http://localhost:3000/admin", {
      headers: {
        host: "localhost:3000"
      }
    });
    assert.strictEqual(getPublicOrigin(req2), "http://localhost:3000");
  });
});
