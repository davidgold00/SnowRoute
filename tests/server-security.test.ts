import { describe, expect, it } from "vitest";

import {
  createBoundedCache,
  enforceRateLimit,
  readJsonBody,
} from "../lib/server-security";

describe("server security helpers", () => {
  it("rejects non-json request bodies", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: {
        "content-type": "text/plain",
      },
      body: "hello",
    });

    const result = await readJsonBody(request, {
      maxBytes: 128,
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.response.status).toBe(415);
    }
  });

  it("rejects oversized json request bodies", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        payload: "x".repeat(2048),
      }),
    });

    const result = await readJsonBody(request, {
      maxBytes: 256,
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.response.status).toBe(413);
    }
  });

  it("enforces a per-client rate limit window", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const request = new Request("http://localhost/api/test", {
      headers: {
        "x-forwarded-for": "203.0.113.7",
      },
    });

    expect(
      enforceRateLimit(request, "unit-rate-limit", {
        maxRequests: 2,
        windowMs: 60_000,
      }),
    ).toBeNull();
    expect(
      enforceRateLimit(request, "unit-rate-limit", {
        maxRequests: 2,
        windowMs: 60_000,
      }),
    ).toBeNull();

    const limited = enforceRateLimit(request, "unit-rate-limit", {
      maxRequests: 2,
      windowMs: 60_000,
    });

    expect(limited?.status).toBe(429);

    process.env.NODE_ENV = previousNodeEnv;
  });

  it("bounds cache size and evicts the oldest entry when full", () => {
    const cache = createBoundedCache<number>(2);

    cache.set("first", 1, 60_000);
    cache.set("second", 2, 60_000);
    cache.set("third", 3, 60_000);

    expect(cache.get("first")).toBeNull();
    expect(cache.get("second")).toBe(2);
    expect(cache.get("third")).toBe(3);
  });
});
