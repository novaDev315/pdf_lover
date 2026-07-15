import { resolve } from 'node:path';

export type AppEnvironment = 'development' | 'test' | 'production';

export interface ApiConfig {
  environment: AppEnvironment;
  host: string;
  port: number;
  corsOrigins: string[];
  tempRoot: string;
  maxUploadBytes: number;
  artifactTtlMs: number;
  cleanupIntervalMs: number;
  globalConcurrency: number;
  clientConcurrency: number;
  processTimeoutMs: number;
  openRouterApiKey?: string;
  openRouterTimeoutMs: number;
}

function integer(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  limits: { min: number; max: number },
): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < limits.min || value > limits.max) {
    throw new Error(
      `${name} must be an integer between ${limits.min} and ${limits.max}`,
    );
  }
  return value;
}

function environment(value: string | undefined): AppEnvironment {
  const normalized = value ?? 'development';
  if (
    normalized !== 'development' &&
    normalized !== 'test' &&
    normalized !== 'production'
  ) {
    throw new Error('APP_ENV must be development, test, or production');
  }
  return normalized;
}

function origins(value: string | undefined, appEnvironment: AppEnvironment): string[] {
  const parsed = (value ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (parsed.length === 0) {
    throw new Error('CORS_ORIGINS must contain at least one origin');
  }
  if (appEnvironment === 'production' && parsed.includes('*')) {
    throw new Error('CORS_ORIGINS cannot contain * in production');
  }

  for (const origin of parsed) {
    if (origin === '*' && appEnvironment !== 'production') continue;
    const url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`CORS_ORIGINS contains an unsupported origin: ${origin}`);
    }
  }
  return [...new Set(parsed)];
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const appEnvironment = environment(env.APP_ENV ?? env.NODE_ENV);
  const ttlSeconds = integer(env, 'ARTIFACT_TTL_SECONDS', 1_800, {
    min: 30,
    max: 86_400,
  });

  return {
    environment: appEnvironment,
    host: env.BACKEND_HOST?.trim() || '0.0.0.0',
    port: integer(env, 'BACKEND_PORT', 8_000, { min: 1, max: 65_535 }),
    corsOrigins: origins(env.CORS_ORIGINS, appEnvironment),
    tempRoot: resolve(env.JOB_TEMP_ROOT?.trim() || '/tmp/pdflover-jobs'),
    maxUploadBytes: integer(env, 'MAX_UPLOAD_BYTES', 104_857_600, {
      min: 1_048_576,
      max: 524_288_000,
    }),
    artifactTtlMs: ttlSeconds * 1_000,
    cleanupIntervalMs: integer(env, 'JOB_CLEANUP_INTERVAL_SECONDS', 60, {
      min: 5,
      max: 3_600,
    }) * 1_000,
    globalConcurrency: integer(env, 'GLOBAL_JOB_CONCURRENCY', 4, {
      min: 1,
      max: 32,
    }),
    clientConcurrency: integer(env, 'CLIENT_JOB_CONCURRENCY', 2, {
      min: 1,
      max: 8,
    }),
    processTimeoutMs: integer(env, 'PROCESS_TIMEOUT_SECONDS', 300, {
      min: 5,
      max: 3_600,
    }) * 1_000,
    openRouterApiKey: env.OPENROUTER_API_KEY?.trim() || undefined,
    openRouterTimeoutMs: integer(env, 'OPENROUTER_TIMEOUT_SECONDS', 90, {
      min: 5,
      max: 300,
    }) * 1_000,
  };
}
