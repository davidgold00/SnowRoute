import "server-only";

import { createHash } from "node:crypto";

export type RateLimitPolicy = {
  scope: "geocode" | "analysis";
  limit: number;
  windowSeconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  backend: "redis" | "memory";
};

type MemoryWindow = {
  count: number;
  expiresAt: number;
};

const memoryWindows = new Map<string, MemoryWindow>();
const REDIS_TIMEOUT_MS = 1_500;
let warnedAboutFallback = false;

export const RATE_LIMIT_POLICIES = {
  geocode: { scope: "geocode", limit: 45, windowSeconds: 60 },
  analysis: { scope: "analysis", limit: 8, windowSeconds: 10 * 60 },
} satisfies Record<string, RateLimitPolicy>;

function getAnonymousClientKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwardedFor || request.headers.get("x-real-ip") || "unknown";
  const salt = process.env.RATE_LIMIT_SALT ?? "snowroute-local-development";

  return createHash("sha256")
    .update(`${salt}:${address}`)
    .digest("hex")
    .slice(0, 32);
}

function memoryRateLimit(key: string, policy: RateLimitPolicy): RateLimitResult {
  const now = Date.now();
  const existing = memoryWindows.get(key);
  const current = existing && existing.expiresAt > now
    ? { ...existing, count: existing.count + 1 }
    : { count: 1, expiresAt: now + policy.windowSeconds * 1000 };

  memoryWindows.set(key, current);

  if (memoryWindows.size > 2_000) {
    for (const [candidateKey, window] of memoryWindows) {
      if (window.expiresAt <= now) {
        memoryWindows.delete(candidateKey);
      }
    }

    while (memoryWindows.size > 1_800) {
      const oldestKey = memoryWindows.keys().next().value as string | undefined;

      if (!oldestKey) {
        break;
      }

      memoryWindows.delete(oldestKey);
    }
  }

  return {
    allowed: current.count <= policy.limit,
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - current.count),
    retryAfterSeconds: Math.max(1, Math.ceil((current.expiresAt - now) / 1000)),
    backend: "memory",
  };
}

async function redisRateLimit(
  key: string,
  policy: RateLimitPolicy,
): Promise<RateLimitResult | null> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    return null;
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), REDIS_TIMEOUT_MS);
  const script = [
    "local count = redis.call('INCR', KEYS[1])",
    "if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end",
    "return {count, redis.call('TTL', KEYS[1])}",
  ].join(" ");

  try {
    const response = await fetch(redisUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        "EVAL",
        script,
        "1",
        `snowroute:rate:${policy.scope}:${key}`,
        String(policy.windowSeconds),
      ]),
      signal: abortController.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { result?: unknown };

    if (
      !Array.isArray(payload.result) ||
      typeof payload.result[0] !== "number" ||
      typeof payload.result[1] !== "number"
    ) {
      return null;
    }

    const [count, ttl] = payload.result;

    return {
      allowed: count <= policy.limit,
      limit: policy.limit,
      remaining: Math.max(0, policy.limit - count),
      retryAfterSeconds: Math.max(1, ttl),
      backend: "redis",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function enforceRateLimit(
  request: Request,
  policy: RateLimitPolicy,
): Promise<RateLimitResult> {
  const clientKey = getAnonymousClientKey(request);
  const sharedResult = await redisRateLimit(clientKey, policy);

  if (sharedResult) {
    return sharedResult;
  }

  if (process.env.NODE_ENV === "production" && !warnedAboutFallback) {
    warnedAboutFallback = true;
    console.warn(JSON.stringify({
      event: "rate_limit_degraded",
      message: "Shared rate-limit storage is unavailable; using a per-instance fallback.",
    }));
  }

  return memoryRateLimit(`${policy.scope}:${clientKey}`, policy);
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(result.retryAfterSeconds),
    ...(result.allowed ? {} : { "Retry-After": String(result.retryAfterSeconds) }),
  };
}
