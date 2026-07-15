import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runCommand } from './command.js';

const roots: string[] = [];

async function workingDirectory(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pdflover-command-test-'));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('runCommand', () => {
  it('runs an argument-only command without a shell', async () => {
    const result = await runCommand({
      command: 'printf',
      args: ['%s', 'engine-ready'],
      cwd: await workingDirectory(),
      timeoutMs: 5_000,
    });

    expect(result).toMatchObject({ exitCode: 0, stdout: 'engine-ready', stderr: '' });
  });

  it('terminates a timed-out process group', async () => {
    await expect(runCommand({
      command: process.execPath,
      args: ['-e', 'setTimeout(() => undefined, 10000)'],
      cwd: await workingDirectory(),
      timeoutMs: 25,
    })).rejects.toMatchObject({ code: 'PROCESSING_TIMEOUT' });
  });

  it('does not spawn work for an already-cancelled job', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(runCommand({
      command: 'printf',
      args: ['should-not-run'],
      cwd: await workingDirectory(),
      timeoutMs: 5_000,
      signal: controller.signal,
    })).rejects.toMatchObject({ code: 'JOB_CANCELLED' });
  });
});
