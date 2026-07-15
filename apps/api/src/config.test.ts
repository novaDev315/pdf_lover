import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('loads bounded production settings', () => {
    const config = loadConfig({
      APP_ENV: 'production',
      BACKEND_PORT: '8000',
      CORS_ORIGINS: 'https://web.pdflover.lab.novadev.tech',
      ARTIFACT_TTL_SECONDS: '1800',
      MAX_UPLOAD_BYTES: '104857600',
    });

    expect(config.environment).toBe('production');
    expect(config.port).toBe(8000);
    expect(config.artifactTtlMs).toBe(1_800_000);
    expect(config.corsOrigins).toEqual([
      'https://web.pdflover.lab.novadev.tech',
    ]);
  });

  it('rejects wildcard CORS in production', () => {
    expect(() => loadConfig({ APP_ENV: 'production', CORS_ORIGINS: '*' })).toThrow(
      'CORS_ORIGINS cannot contain * in production',
    );
  });

  it('rejects unsafe or malformed numeric settings', () => {
    expect(() => loadConfig({ BACKEND_PORT: '0' })).toThrow(
      'BACKEND_PORT must be an integer between 1 and 65535',
    );
    expect(() => loadConfig({ ARTIFACT_TTL_SECONDS: '86401' })).toThrow(
      'ARTIFACT_TTL_SECONDS must be an integer between 30 and 86400',
    );
  });
});
