/**
 * Tests for Settings store
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import {
  useSettingsStore,
  selectEffectiveTheme,
  selectCurrentModelId,
} from '../../store/settings-store';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useSettingsStore', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    // Reset store to initial state
    act(() => {
      useSettingsStore.getState().resetAllSettings();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('theme settings', () => {
    describe('setTheme', () => {
      it('should set theme to light', () => {
        act(() => {
          useSettingsStore.getState().setTheme('light');
        });

        expect(useSettingsStore.getState().theme).toBe('light');
      });

      it('should set theme to dark', () => {
        act(() => {
          useSettingsStore.getState().setTheme('dark');
        });

        expect(useSettingsStore.getState().theme).toBe('dark');
      });

      it('should set theme to system', () => {
        act(() => {
          useSettingsStore.getState().setTheme('system');
        });

        expect(useSettingsStore.getState().theme).toBe('system');
      });
    });
  });

  describe('language settings', () => {
    describe('setLanguage', () => {
      it('should set language', () => {
        act(() => {
          useSettingsStore.getState().setLanguage('fr');
        });

        expect(useSettingsStore.getState().language).toBe('fr');
      });

      it('should default to en', () => {
        act(() => {
          useSettingsStore.getState().resetAllSettings();
        });

        expect(useSettingsStore.getState().language).toBe('en');
      });
    });
  });

  describe('AI settings', () => {
    describe('setAIProvider', () => {
      it('should set AI provider to local', () => {
        act(() => {
          useSettingsStore.getState().setAIProvider('local');
        });

        expect(useSettingsStore.getState().ai.provider).toBe('local');
      });

      it('should set AI provider to openrouter', () => {
        act(() => {
          useSettingsStore.getState().setAIProvider('openrouter');
        });

        expect(useSettingsStore.getState().ai.provider).toBe('openrouter');
      });
    });

    describe('provider credentials', () => {
      it('should not expose or persist an OpenRouter API key', () => {
        const state = useSettingsStore.getState();
        expect('openRouterApiKey' in state.ai).toBe(false);
        expect('setApiKey' in state).toBe(false);
      });
    });

    describe('updateAISettings', () => {
      it('should update individual AI settings', () => {
        act(() => {
          useSettingsStore.getState().updateAISettings({
            defaultTemperature: 0.5,
            defaultMaxTokens: 4096,
          });
        });

        const state = useSettingsStore.getState();
        expect(state.ai.defaultTemperature).toBe(0.5);
        expect(state.ai.defaultMaxTokens).toBe(4096);
      });

      it('should preserve other AI settings when updating', () => {
        const originalProvider = useSettingsStore.getState().ai.provider;

        act(() => {
          useSettingsStore.getState().updateAISettings({
            defaultTemperature: 0.8,
          });
        });

        expect(useSettingsStore.getState().ai.provider).toBe(originalProvider);
      });
    });

    describe('resetAISettings', () => {
      it('should reset AI settings to defaults', () => {
        act(() => {
          useSettingsStore.getState().setAIProvider('openrouter');
          useSettingsStore.getState().updateAISettings({ defaultTemperature: 1.2 });
          useSettingsStore.getState().resetAISettings();
        });

        const state = useSettingsStore.getState();
        expect(state.ai.provider).toBe('local');
        expect(state.ai.defaultTemperature).toBe(0.7);
      });
    });
  });

  describe('viewer settings', () => {
    describe('updateViewerSettings', () => {
      it('should update viewer settings', () => {
        act(() => {
          useSettingsStore.getState().updateViewerSettings({
            defaultZoom: 1.5,
            pageFit: 'height',
          });
        });

        const state = useSettingsStore.getState();
        expect(state.viewer.defaultZoom).toBe(1.5);
        expect(state.viewer.pageFit).toBe('height');
      });

      it('should preserve other viewer settings', () => {
        const originalScrollMode = useSettingsStore.getState().viewer.scrollMode;

        act(() => {
          useSettingsStore.getState().updateViewerSettings({
            defaultZoom: 2.0,
          });
        });

        expect(useSettingsStore.getState().viewer.scrollMode).toBe(
          originalScrollMode
        );
      });
    });

    describe('resetViewerSettings', () => {
      it('should reset viewer settings to defaults', () => {
        act(() => {
          useSettingsStore.getState().updateViewerSettings({
            defaultZoom: 3.0,
            showThumbnails: false,
          });
          useSettingsStore.getState().resetViewerSettings();
        });

        const state = useSettingsStore.getState();
        expect(state.viewer.defaultZoom).toBe(1.0);
        expect(state.viewer.showThumbnails).toBe(true);
      });
    });
  });

  describe('processing settings', () => {
    describe('updateProcessingSettings', () => {
      it('should update processing settings', () => {
        act(() => {
          useSettingsStore.getState().updateProcessingSettings({
            defaultCompressionLevel: 'high',
            defaultImageDpi: 300,
          });
        });

        const state = useSettingsStore.getState();
        expect(state.processing.defaultCompressionLevel).toBe('high');
        expect(state.processing.defaultImageDpi).toBe(300);
      });
    });
  });

  describe('first run', () => {
    describe('completeFirstRun', () => {
      it('should mark first run as complete', () => {
        act(() => {
          useSettingsStore.getState().completeFirstRun();
        });

        expect(useSettingsStore.getState().isFirstRun).toBe(false);
      });
    });

    describe('resetAllSettings', () => {
      it('should preserve first run status when resetting', () => {
        act(() => {
          useSettingsStore.getState().completeFirstRun();
          useSettingsStore.getState().resetAllSettings();
        });

        // First run should be preserved as false after reset
        expect(useSettingsStore.getState().isFirstRun).toBe(false);
      });
    });
  });

  describe('resetAllSettings', () => {
    it('should reset all settings to defaults', () => {
      act(() => {
        useSettingsStore.getState().setTheme('dark');
        useSettingsStore.getState().setLanguage('de');
        useSettingsStore.getState().setAIProvider('openrouter');
        useSettingsStore.getState().resetAllSettings();
      });

      const state = useSettingsStore.getState();
      expect(state.theme).toBe('system');
      expect(state.language).toBe('en');
      expect(state.ai.provider).toBe('local');
    });
  });
});

describe('selectors', () => {
  beforeEach(() => {
    act(() => {
      useSettingsStore.getState().resetAllSettings();
    });
  });

  describe('selectEffectiveTheme', () => {
    it('should return light when theme is light', () => {
      act(() => {
        useSettingsStore.getState().setTheme('light');
      });

      const state = useSettingsStore.getState();
      expect(selectEffectiveTheme(state)).toBe('light');
    });

    it('should return dark when theme is dark', () => {
      act(() => {
        useSettingsStore.getState().setTheme('dark');
      });

      const state = useSettingsStore.getState();
      expect(selectEffectiveTheme(state)).toBe('dark');
    });

    it('should resolve system theme based on media query', () => {
      act(() => {
        useSettingsStore.getState().setTheme('system');
      });

      const state = useSettingsStore.getState();
      // Our mock returns false for prefers-color-scheme: dark
      expect(selectEffectiveTheme(state)).toBe('light');
    });
  });

  describe('selectCurrentModelId', () => {
    it('should return local model ID when provider is local', () => {
      act(() => {
        useSettingsStore.getState().setAIProvider('local');
      });

      const state = useSettingsStore.getState();
      expect(selectCurrentModelId(state)).toBe(state.ai.localModelId);
    });

    it('should return OpenRouter model ID when provider is openrouter', () => {
      act(() => {
        useSettingsStore.getState().setAIProvider('openrouter');
      });

      const state = useSettingsStore.getState();
      expect(selectCurrentModelId(state)).toBe(state.ai.openRouterModelId);
    });
  });

});
