import { ApiError } from './errors.js';

interface Bucket {
  count: number;
  resetAt: number;
}

export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  assertAllowed(key: string, now = Date.now()): void {
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }
    if (current.count >= this.limit) {
      throw new ApiError({
        statusCode: 429,
        code: 'RATE_LIMITED',
        message: 'Too many requests; retry after the current rate-limit window',
        retryable: true,
        details: { retryAfterSeconds: Math.ceil((current.resetAt - now) / 1_000) },
      });
    }
    current.count += 1;
  }
}
