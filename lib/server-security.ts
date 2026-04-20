import "server-only";

import { NextResponse } from "next/server";

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type RateLimitConfig = {
  maxRequests: number;
  windowMs: number;
};

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

type JsonRequestResult =
  | {
      ok: true;
      body: unknown;
    }
  | {
      ok: false;
      response: NextResponse;
    };

const rateLimitStore = new Map<string, RateLimitRecord>();
const MAX_RATE_LIMIT_KEYS = 500;

export const JSON_SECURITY_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
} as const;

export class PublicHttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code = "REQUEST_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function createJsonErrorResponse(
  status: number,
  message: string,
  extras?: Record<string, string | number>,
) {
  return NextResponse.json(
    {
      message,
      ...(extras ?? {}),
    },
    {
      status,
      headers: JSON_SECURITY_HEADERS,
    },
  );
}

export function createNoStoreJsonResponse(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...JSON_SECURITY_HEADERS,
      ...(init?.headers ?? {}),
    },
  });
}

export function getClientAddress(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function enforceRateLimit(
  request: Request,
  namespace: string,
  config: RateLimitConfig,
) {
  if (process.env.NODE_ENV !== "production") {
    return null;
  }

  const now = Date.now();
  const key = `${namespace}:${getClientAddress(request)}`;

  if (rateLimitStore.size >= MAX_RATE_LIMIT_KEYS) {
    for (const [entryKey, entry] of rateLimitStore.entries()) {
      if (entry.resetAt <= now) {
        rateLimitStore.delete(entryKey);
      }
    }
  }

  const current = rateLimitStore.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });

    return null;
  }

  if (current.count >= config.maxRequests) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((current.resetAt - now) / 1000),
    );

    return createJsonErrorResponse(
      429,
      "Too many requests. Please wait a moment and try again.",
      {
        retryAfterSeconds,
      },
    );
  }

  current.count += 1;
  rateLimitStore.set(key, current);

  return null;
}

export async function readJsonBody(
  request: Request,
  {
    maxBytes,
  }: {
    maxBytes: number;
  },
): Promise<JsonRequestResult> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    return {
      ok: false,
      response: createJsonErrorResponse(
        415,
        "Requests must use application/json.",
      ),
    };
  }

  const contentLengthHeader = request.headers.get("content-length");

  if (contentLengthHeader) {
    const contentLength = Number.parseInt(contentLengthHeader, 10);

    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      return {
        ok: false,
        response: createJsonErrorResponse(
          413,
          "Request body is too large.",
        ),
      };
    }
  }

  let rawBody: string;

  try {
    rawBody = await request.text();
  } catch {
    return {
      ok: false,
      response: createJsonErrorResponse(
        400,
        "Request body could not be read.",
      ),
    };
  }

  if (new TextEncoder().encode(rawBody).length > maxBytes) {
    return {
      ok: false,
      response: createJsonErrorResponse(413, "Request body is too large."),
    };
  }

  try {
    return {
      ok: true,
      body: JSON.parse(rawBody),
    };
  } catch {
    return {
      ok: false,
      response: createJsonErrorResponse(400, "Request body must be valid JSON."),
    };
  }
}

export function createBoundedCache<T>(maxEntries: number) {
  const store = new Map<string, CacheEntry<T>>();

  function sweepExpiredEntries(now: number) {
    for (const [key, entry] of store.entries()) {
      if (entry.expiresAt <= now) {
        store.delete(key);
      }
    }
  }

  return {
    get(key: string) {
      const now = Date.now();
      const entry = store.get(key);

      if (!entry) {
        return null;
      }

      if (entry.expiresAt <= now) {
        store.delete(key);
        return null;
      }

      return entry.value;
    },
    set(key: string, value: T, ttlMs: number) {
      const now = Date.now();
      sweepExpiredEntries(now);

      if (store.size >= maxEntries) {
        const oldestKey = store.keys().next().value;

        if (typeof oldestKey === "string") {
          store.delete(oldestKey);
        }
      }

      store.set(key, {
        value,
        expiresAt: now + ttlMs,
      });
    },
    clear() {
      store.clear();
    },
  };
}

export async function fetchJsonWithTimeout<T>(
  input: string,
  init: RequestInit & {
    timeoutMs: number;
    publicErrorMessage: string;
  },
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), init.timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });

    return response as Response & {
      json(): Promise<T>;
    };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new PublicHttpError(504, init.publicErrorMessage, "UPSTREAM_TIMEOUT");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
