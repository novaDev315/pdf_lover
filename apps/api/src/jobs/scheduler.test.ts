import { describe, expect, it } from 'vitest';
import { JobScheduler } from './scheduler.js';

describe('JobScheduler', () => {
  it('enforces global and per-client concurrency', async () => {
    const scheduler = new JobScheduler(2, 1);
    let active = 0;
    let peak = 0;
    let releaseFirst!: () => void;
    const firstDone = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const order: string[] = [];

    scheduler.enqueue('a1', 'a', async () => {
      active++;
      peak = Math.max(peak, active);
      order.push('a1');
      await firstDone;
      active--;
    });
    scheduler.enqueue('a2', 'a', async () => {
      active++;
      peak = Math.max(peak, active);
      order.push('a2');
      active--;
    });
    scheduler.enqueue('b1', 'b', async () => {
      active++;
      peak = Math.max(peak, active);
      order.push('b1');
      active--;
    });

    await Promise.resolve();
    expect(order).toEqual(['a1', 'b1']);
    releaseFirst();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(order).toEqual(['a1', 'b1', 'a2']);
    expect(peak).toBe(2);
    scheduler.close();
  });
});
