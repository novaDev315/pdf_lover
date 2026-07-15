import { describe, expect, it } from 'vitest';
import { FixedWindowRateLimiter } from './rate-limit.js';

describe('FixedWindowRateLimiter', () => {
  it('rejects requests beyond the window limit and resets after expiry', () => {
    const limiter = new FixedWindowRateLimiter(2, 1_000);
    limiter.assertAllowed('client', 10_000);
    limiter.assertAllowed('client', 10_100);

    expect(() => limiter.assertAllowed('client', 10_200)).toThrowError(
      expect.objectContaining({ code: 'RATE_LIMITED', statusCode: 429 }),
    );
    expect(() => limiter.assertAllowed('client', 11_000)).not.toThrow();
  });
});
