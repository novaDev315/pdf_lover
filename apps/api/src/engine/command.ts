import { spawn } from 'node:child_process';
import { ApiError } from '../errors.js';

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const OUTPUT_LIMIT = 256 * 1_024;

function signalProcessGroup(pid: number | undefined, signal: NodeJS.Signals): void {
  if (pid === undefined) return;
  try {
    if (process.platform === 'win32') process.kill(pid, signal);
    else process.kill(-pid, signal);
  } catch {
    // The process may have exited between the state check and cancellation.
  }
}

export function runCommand(options: {
  command: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<CommandResult> {
  if (options.signal?.aborted) {
    return Promise.reject(new ApiError({
      statusCode: 409,
      code: 'JOB_CANCELLED',
      message: 'PDF engine job was cancelled',
    }));
  }

  return new Promise((resolve, reject) => {
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      detached: process.platform !== 'win32',
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        PATH: process.env.PATH,
        HOME: options.cwd,
        LANG: 'C.UTF-8',
      },
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    let pendingError: ApiError | undefined;
    let forceKillTimer: NodeJS.Timeout | undefined;
    let terminationDeadline: NodeJS.Timeout | undefined;

    const finishWithError = (error: ApiError): void => {
      if (settled || pendingError) return;
      pendingError = error;
      clearTimeout(timer);
      signalProcessGroup(child.pid, 'SIGTERM');
      forceKillTimer = setTimeout(() => {
        signalProcessGroup(child.pid, 'SIGKILL');
      }, 1_000);
      forceKillTimer.unref();
      terminationDeadline = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      }, 3_000);
      terminationDeadline.unref();
    };
    const timer = setTimeout(() => {
      finishWithError(new ApiError({
        statusCode: 504,
        code: 'PROCESSING_TIMEOUT',
        message: 'PDF engine exceeded its processing timeout',
        retryable: true,
      }));
    }, options.timeoutMs);
    timer.unref();

    function abort(): void {
      finishWithError(new ApiError({
        statusCode: 409,
        code: 'JOB_CANCELLED',
        message: 'PDF engine job was cancelled',
      }));
    }
    function cleanup(): void {
      clearTimeout(timer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      if (terminationDeadline) clearTimeout(terminationDeadline);
      options.signal?.removeEventListener('abort', abort);
    }
    options.signal?.addEventListener('abort', abort, { once: true });

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
      if (stdout.length > OUTPUT_LIMIT) stdout = stdout.slice(-OUTPUT_LIMIT);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
      if (stderr.length > OUTPUT_LIMIT) stderr = stderr.slice(-OUTPUT_LIMIT);
    });
    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (pendingError) {
        reject(pendingError);
        return;
      }
      reject(new ApiError({
        statusCode: 503,
        code: 'ENGINE_UNAVAILABLE',
        message: error.message.includes('ENOENT')
          ? 'Required PDF engine executable is unavailable'
          : 'PDF engine failed to start',
        retryable: true,
      }));
    });
    child.once('close', (code) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (pendingError) {
        reject(pendingError);
        return;
      }
      resolve({ exitCode: code ?? -1, stdout, stderr });
    });
  });
}
