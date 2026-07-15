import '@testing-library/jest-dom/vitest';
import { vi, beforeAll, afterAll, afterEach } from 'vitest';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:test-url');
global.URL.revokeObjectURL = vi.fn();

// Mock crypto for environments that don't have it
if (typeof globalThis.crypto === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      randomUUID: vi.fn(() => 'test-uuid-1234-5678-9abc-def0'),
      subtle: {
        digest: vi.fn(),
      },
      getRandomValues: vi.fn((arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      }),
    },
  });
}

// Mock performance.now if needed
if (typeof performance === 'undefined') {
  global.performance = {
    now: vi.fn(() => Date.now()),
  } as unknown as Performance;
}

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

if (typeof globalThis.DataTransfer === 'undefined') {
  class DataTransferItemListMock {
    private readonly values: File[] = [];
    [index: number]: { kind: string; type: string; getAsFile: () => File };

    add(file: File) {
      this.values.push(file);
      const item = { kind: 'file', type: file.type, getAsFile: () => file };
      this[this.values.length - 1] = item;
      return item;
    }

    get length(): number {
      return this.values.length;
    }

    [Symbol.iterator]() {
      return Array.from({ length: this.length }, (_, index) => this[index]!)[Symbol.iterator]();
    }

    get files(): File[] {
      return this.values;
    }
  }

  class DataTransferMock {
    readonly items = new DataTransferItemListMock();

    get files(): FileList {
      const files = this.items.files;
      return Object.assign(files, {
        item: (index: number) => files[index] ?? null,
      }) as unknown as FileList;
    }

    readonly types = ['Files'];
    readonly dropEffect = 'none';
    readonly effectAllowed = 'all';
  }

  Object.defineProperty(globalThis, 'DataTransfer', { value: DataTransferMock });
}

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Clean up local storage
beforeAll(() => {
  localStorage.clear();
});

afterAll(() => {
  localStorage.clear();
});
