/**
 * Tests for shared utility functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateId,
  formatFileSize,
  formatDuration,
  formatDate,
  formatRelativeTime,
  truncate,
  sanitizeFilename,
  generateFilename,
  getFileExtension,
  getMimeType,
  sleep,
  chunk,
  unique,
  clamp,
  isPDFBuffer,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  debounce,
  throttle,
  calculateHash,
  checkBrowserSupport,
} from '../utils/index.js';

describe('generateId', () => {
  it('should generate a UUID-like string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('should generate unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(100);
  });

  it('should match UUID format when crypto.randomUUID is available', () => {
    const id = generateId();
    // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    expect(id).toMatch(/^[a-f0-9-]+$/i);
  });
});

describe('formatFileSize', () => {
  it('should format 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 Bytes');
  });

  it('should format bytes', () => {
    expect(formatFileSize(500)).toBe('500 Bytes');
  });

  it('should format kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('should format megabytes', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1 MB');
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
  });

  it('should format gigabytes', () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
  });

  it('should handle negative numbers', () => {
    expect(formatFileSize(-100)).toBe('Invalid size');
  });

  it('should respect decimal places parameter', () => {
    expect(formatFileSize(1536, 0)).toBe('2 KB');
    expect(formatFileSize(1536, 1)).toBe('1.5 KB');
    expect(formatFileSize(1536, 3)).toBe('1.5 KB');
  });
});

describe('formatDuration', () => {
  it('should format milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms');
  });

  it('should format seconds', () => {
    expect(formatDuration(1000)).toBe('1.0s');
    expect(formatDuration(2500)).toBe('2.5s');
  });

  it('should format minutes and seconds', () => {
    expect(formatDuration(60000)).toBe('1m');
    expect(formatDuration(90000)).toBe('1m 30s');
  });

  it('should format hours and minutes', () => {
    expect(formatDuration(3600000)).toBe('1h');
    expect(formatDuration(3660000)).toBe('1h 1m');
  });

  it('should handle negative numbers', () => {
    expect(formatDuration(-100)).toBe('Invalid duration');
  });
});

describe('formatDate', () => {
  it('should format a Date object', () => {
    const date = new Date('2024-01-15');
    const result = formatDate(date);
    expect(result).toContain('2024');
    expect(result).toContain('15');
  });

  it('should format a date string', () => {
    const result = formatDate('2024-01-15');
    expect(result).toContain('2024');
  });

  it('should format a timestamp', () => {
    const timestamp = new Date('2024-01-15').getTime();
    const result = formatDate(timestamp);
    expect(result).toContain('2024');
  });

  it('should handle invalid dates', () => {
    expect(formatDate('invalid')).toBe('Invalid date');
    expect(formatDate(NaN)).toBe('Invalid date');
  });
});

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should format "just now"', () => {
    const date = new Date('2024-01-15T11:59:30Z');
    expect(formatRelativeTime(date)).toBe('just now');
  });

  it('should format minutes ago', () => {
    const date = new Date('2024-01-15T11:55:00Z');
    expect(formatRelativeTime(date)).toBe('5 minutes ago');
  });

  it('should format hours ago', () => {
    const date = new Date('2024-01-15T10:00:00Z');
    expect(formatRelativeTime(date)).toBe('2 hours ago');
  });

  it('should format days ago', () => {
    const date = new Date('2024-01-12T12:00:00Z');
    expect(formatRelativeTime(date)).toBe('3 days ago');
  });

  it('should format weeks ago', () => {
    const date = new Date('2024-01-01T12:00:00Z');
    expect(formatRelativeTime(date)).toBe('2 weeks ago');
  });

  it('should handle singular forms', () => {
    const oneMinuteAgo = new Date('2024-01-15T11:59:00Z');
    expect(formatRelativeTime(oneMinuteAgo)).toBe('1 minute ago');

    const oneHourAgo = new Date('2024-01-15T11:00:00Z');
    expect(formatRelativeTime(oneHourAgo)).toBe('1 hour ago');
  });

  it('should handle invalid dates', () => {
    expect(formatRelativeTime('invalid')).toBe('Invalid date');
  });
});

describe('truncate', () => {
  it('should not truncate short strings', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('should truncate long strings', () => {
    expect(truncate('hello world', 8)).toBe('hello...');
  });

  it('should use custom suffix', () => {
    expect(truncate('hello world', 9, '---')).toBe('hello ---');
  });

  it('should handle edge cases', () => {
    expect(truncate('hello', 5)).toBe('hello');
    expect(truncate('hello', 4)).toBe('h...');
  });
});

describe('sanitizeFilename', () => {
  it('should remove invalid characters', () => {
    expect(sanitizeFilename('file<name>.pdf')).toBe('file_name_.pdf');
    expect(sanitizeFilename('file:name.pdf')).toBe('file_name.pdf');
    expect(sanitizeFilename('file|name.pdf')).toBe('file_name.pdf');
  });

  it('should replace leading dots', () => {
    expect(sanitizeFilename('.hidden')).toBe('_hidden');
    expect(sanitizeFilename('...hidden')).toBe('_hidden');
  });

  it('should remove trailing dots', () => {
    expect(sanitizeFilename('file.')).toBe('file');
    expect(sanitizeFilename('file...')).toBe('file');
  });

  it('should return "unnamed" for empty result', () => {
    expect(sanitizeFilename('')).toBe('unnamed');
    expect(sanitizeFilename('   ')).toBe('unnamed');
  });

  it('should handle control characters', () => {
    expect(sanitizeFilename('file\x00name.pdf')).toBe('file_name.pdf');
  });
});

describe('generateFilename', () => {
  it('should add suffix before extension', () => {
    expect(generateFilename('document.pdf', '_merged')).toBe('document_merged.pdf');
  });

  it('should handle no extension', () => {
    expect(generateFilename('document', '_merged')).toBe('document_merged');
  });

  it('should change extension when provided', () => {
    expect(generateFilename('document.pdf', '_page1', 'png')).toBe('document_page1.png');
  });

  it('should handle extension with dot', () => {
    expect(generateFilename('document.pdf', '_conv', '.jpg')).toBe('document_conv.jpg');
  });
});

describe('getFileExtension', () => {
  it('should extract extension', () => {
    expect(getFileExtension('file.pdf')).toBe('pdf');
    expect(getFileExtension('file.PDF')).toBe('pdf');
  });

  it('should handle multiple dots', () => {
    expect(getFileExtension('file.name.pdf')).toBe('pdf');
  });

  it('should return empty string for no extension', () => {
    expect(getFileExtension('file')).toBe('');
    expect(getFileExtension('file.')).toBe('');
  });

  it('should handle hidden files', () => {
    expect(getFileExtension('.hidden')).toBe('');
  });
});

describe('getMimeType', () => {
  it('should return correct MIME type for known extensions', () => {
    expect(getMimeType('pdf')).toBe('application/pdf');
    expect(getMimeType('png')).toBe('image/png');
    expect(getMimeType('jpg')).toBe('image/jpeg');
    expect(getMimeType('jpeg')).toBe('image/jpeg');
  });

  it('should handle extension with dot', () => {
    expect(getMimeType('.pdf')).toBe('application/pdf');
  });

  it('should return octet-stream for unknown extensions', () => {
    expect(getMimeType('xyz')).toBe('application/octet-stream');
  });

  it('should be case-insensitive', () => {
    expect(getMimeType('PDF')).toBe('application/pdf');
    expect(getMimeType('PNG')).toBe('image/png');
  });
});

describe('sleep', () => {
  it('should delay execution', async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some tolerance
  });
});

describe('chunk', () => {
  it('should chunk array into specified sizes', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(chunk(arr, 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('should handle empty array', () => {
    expect(chunk([], 2)).toEqual([]);
  });

  it('should handle size larger than array', () => {
    expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
  });

  it('should handle size of 1', () => {
    expect(chunk([1, 2, 3], 1)).toEqual([[1], [2], [3]]);
  });

  it('should handle invalid size', () => {
    expect(chunk([1, 2, 3], 0)).toEqual([[1, 2, 3]]);
    expect(chunk([1, 2, 3], -1)).toEqual([[1, 2, 3]]);
  });
});

describe('unique', () => {
  it('should remove duplicates from primitive array', () => {
    expect(unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
  });

  it('should preserve order', () => {
    expect(unique([3, 1, 2, 1, 3])).toEqual([3, 1, 2]);
  });

  it('should handle empty array', () => {
    expect(unique([])).toEqual([]);
  });

  it('should use key function for objects', () => {
    const arr = [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
      { id: 1, name: 'c' },
    ];
    const result = unique(arr, (item) => item.id);
    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe('a');
  });
});

describe('clamp', () => {
  it('should clamp value to min', () => {
    expect(clamp(5, 10, 20)).toBe(10);
  });

  it('should clamp value to max', () => {
    expect(clamp(25, 10, 20)).toBe(20);
  });

  it('should return value when in range', () => {
    expect(clamp(15, 10, 20)).toBe(15);
  });

  it('should handle edge cases', () => {
    expect(clamp(10, 10, 20)).toBe(10);
    expect(clamp(20, 10, 20)).toBe(20);
  });
});

describe('isPDFBuffer', () => {
  it('should return true for valid PDF magic bytes', () => {
    const buffer = new ArrayBuffer(10);
    const view = new Uint8Array(buffer);
    view[0] = 0x25; // %
    view[1] = 0x50; // P
    view[2] = 0x44; // D
    view[3] = 0x46; // F
    view[4] = 0x2d; // -

    expect(isPDFBuffer(buffer)).toBe(true);
  });

  it('should return false for invalid magic bytes', () => {
    const buffer = new ArrayBuffer(10);
    expect(isPDFBuffer(buffer)).toBe(false);
  });

  it('should return false for buffer too small', () => {
    const buffer = new ArrayBuffer(4);
    expect(isPDFBuffer(buffer)).toBe(false);
  });
});

describe('arrayBufferToBase64', () => {
  it('should convert ArrayBuffer to Base64', () => {
    const buffer = new ArrayBuffer(3);
    const view = new Uint8Array(buffer);
    view[0] = 65; // A
    view[1] = 66; // B
    view[2] = 67; // C

    expect(arrayBufferToBase64(buffer)).toBe('QUJD');
  });

  it('should handle empty buffer', () => {
    const buffer = new ArrayBuffer(0);
    expect(arrayBufferToBase64(buffer)).toBe('');
  });
});

describe('base64ToArrayBuffer', () => {
  it('should convert Base64 to ArrayBuffer', () => {
    const base64 = 'QUJD'; // ABC
    const buffer = base64ToArrayBuffer(base64);
    const view = new Uint8Array(buffer);

    expect(view.length).toBe(3);
    expect(view[0]).toBe(65);
    expect(view[1]).toBe(66);
    expect(view[2]).toBe(67);
  });

  it('should handle empty string', () => {
    const buffer = base64ToArrayBuffer('');
    expect(buffer.byteLength).toBe(0);
  });

  it('should be reversible', () => {
    const original = new Uint8Array([72, 101, 108, 108, 111]); // Hello
    const base64 = arrayBufferToBase64(original.buffer);
    const restored = base64ToArrayBuffer(base64);
    const restoredView = new Uint8Array(restored);

    expect(Array.from(restoredView)).toEqual(Array.from(original));
  });
});

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should delay function execution', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should cancel previous calls when called again', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn();
    vi.advanceTimersByTime(50);
    debouncedFn();
    vi.advanceTimersByTime(50);
    debouncedFn();
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should pass arguments to the original function', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn('arg1', 'arg2');
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('should use the latest arguments', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn('first');
    vi.advanceTimersByTime(50);
    debouncedFn('second');
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('second');
    expect(fn).not.toHaveBeenCalledWith('first');
  });
});

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should execute function immediately on first call', () => {
    const fn = vi.fn();
    const throttledFn = throttle(fn, 100);

    throttledFn();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should ignore calls within the throttle period', () => {
    const fn = vi.fn();
    const throttledFn = throttle(fn, 100);

    throttledFn();
    throttledFn();
    throttledFn();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should allow calls after the throttle period', () => {
    const fn = vi.fn();
    const throttledFn = throttle(fn, 100);

    throttledFn();
    vi.advanceTimersByTime(100);
    throttledFn();

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should pass arguments to the original function', () => {
    const fn = vi.fn();
    const throttledFn = throttle(fn, 100);

    throttledFn('arg1', 'arg2');

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('should use the first call arguments during throttle period', () => {
    const fn = vi.fn();
    const throttledFn = throttle(fn, 100);

    throttledFn('first');
    throttledFn('second');
    throttledFn('third');

    expect(fn).toHaveBeenCalledWith('first');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('calculateHash', () => {
  it('should return a hex string', async () => {
    const buffer = new TextEncoder().encode('Hello World').buffer;
    const hash = await calculateHash(buffer);

    expect(typeof hash).toBe('string');
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  it('should return consistent hash for same input', async () => {
    const buffer = new TextEncoder().encode('Test Data').buffer;
    const hash1 = await calculateHash(buffer);
    const hash2 = await calculateHash(buffer);

    expect(hash1).toBe(hash2);
  });

  it('should return different hash for different input', async () => {
    const buffer1 = new TextEncoder().encode('Data 1').buffer;
    const buffer2 = new TextEncoder().encode('Data 2').buffer;

    const hash1 = await calculateHash(buffer1);
    const hash2 = await calculateHash(buffer2);

    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty buffer', async () => {
    const buffer = new ArrayBuffer(0);
    const hash = await calculateHash(buffer);

    expect(hash).toBeDefined();
    expect(hash.length).toBeGreaterThan(0);
  });
});

describe('checkBrowserSupport', () => {
  it('should return an object with support flags', () => {
    const support = checkBrowserSupport();

    expect(typeof support).toBe('object');
    expect(support).toHaveProperty('indexedDB');
    expect(support).toHaveProperty('webWorkers');
    expect(support).toHaveProperty('fileAPI');
    expect(support).toHaveProperty('crypto');
    expect(support).toHaveProperty('webAssembly');
  });

  it('should return boolean values for all flags', () => {
    const support = checkBrowserSupport();

    Object.values(support).forEach((value) => {
      expect(typeof value).toBe('boolean');
    });
  });
});
