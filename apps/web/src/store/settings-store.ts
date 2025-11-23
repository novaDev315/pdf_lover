/**
 * User Settings State Management
 * Manages user preferences with localStorage persistence
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { AIProvider } from '@pdflover/shared';

/**
 * Theme options
 */
export type Theme = 'light' | 'dark' | 'system';

/**
 * Font size options
 */
export type FontSize = 'small' | 'medium' | 'large';

/**
 * Accent color options
 */
export type AccentColor = 'blue' | 'purple' | 'green' | 'orange' | 'pink' | 'red';

/**
 * Default viewer tool
 */
export type ViewerTool = 'hand' | 'select';

/**
 * Page display mode
 */
export type PageDisplayMode = 'single' | 'continuous';

/**
 * Appearance settings
 */
export interface AppearanceSettings {
  /** Accent color */
  accentColor: AccentColor;
  /** Font size */
  fontSize: FontSize;
  /** Sidebar default state */
  sidebarOpen: boolean;
}

/**
 * PDF viewer settings
 */
export interface ViewerSettings {
  /** Default zoom level (0.5 - 3.0) */
  defaultZoom: number;
  /** Page fit mode */
  pageFit: 'width' | 'height' | 'page';
  /** Show page thumbnails sidebar */
  showThumbnails: boolean;
  /** Show page outline/bookmarks sidebar */
  showOutline: boolean;
  /** Scroll mode */
  scrollMode: 'vertical' | 'horizontal' | 'wrapped';
  /** Spread mode */
  spreadMode: 'none' | 'odd' | 'even';
  /** Enable text selection */
  enableTextSelection: boolean;
  /** Enable annotations */
  enableAnnotations: boolean;
  /** Page display mode */
  pageDisplay: PageDisplayMode;
  /** Default tool */
  defaultTool: ViewerTool;
}

/**
 * AI settings
 */
export interface AISettings {
  /** Default AI provider */
  provider: AIProvider;
  /** OpenRouter API key (encrypted in storage) */
  openRouterApiKey: string | null;
  /** Default model ID for local inference */
  localModelId: string;
  /** Default model ID for OpenRouter */
  openRouterModelId: string;
  /** Default temperature (0-2) */
  defaultTemperature: number;
  /** Default max tokens */
  defaultMaxTokens: number;
  /** Enable streaming responses */
  enableStreaming: boolean;
  /** RAG chunk size */
  ragChunkSize: number;
  /** RAG chunk overlap */
  ragChunkOverlap: number;
  /** RAG top K results */
  ragTopK: number;
  /** Auto-index documents for AI search */
  autoIndexDocuments: boolean;
}

/**
 * Processing settings
 */
export interface ProcessingSettings {
  /** Default compression level */
  defaultCompressionLevel: 'low' | 'medium' | 'high' | 'maximum';
  /** Default image DPI for conversion */
  defaultImageDpi: number;
  /** Default image quality */
  defaultImageQuality: 'low' | 'medium' | 'high' | 'maximum';
  /** Auto-generate thumbnails */
  autoGenerateThumbnails: boolean;
  /** Auto-extract text */
  autoExtractText: boolean;
  /** OCR language */
  ocrLanguage: string;
  /** Auto-cleanup temp files */
  autoCleanupTempFiles: boolean;
}

/**
 * Privacy settings
 */
export interface PrivacySettings {
  /** Enable analytics (anonymous usage data) */
  enableAnalytics: boolean;
  /** Enable crash reporting */
  enableCrashReporting: boolean;
  /** Clear data on exit */
  clearDataOnExit: boolean;
  /** Allow cloud sync */
  allowCloudSync: boolean;
}

/**
 * Settings state interface
 */
export interface SettingsState {
  /** UI theme */
  theme: Theme;
  /** Language code (ISO 639-1) */
  language: string;
  /** Appearance settings */
  appearance: AppearanceSettings;
  /** Viewer settings */
  viewer: ViewerSettings;
  /** AI settings */
  ai: AISettings;
  /** Processing settings */
  processing: ProcessingSettings;
  /** Privacy settings */
  privacy: PrivacySettings;
  /** First run flag */
  isFirstRun: boolean;
  /** Settings version for migrations */
  version: number;
}

/**
 * Settings actions interface
 */
export interface SettingsActions {
  /** Set theme */
  setTheme: (theme: Theme) => void;
  /** Set language */
  setLanguage: (language: string) => void;
  /** Set AI provider */
  setAIProvider: (provider: AIProvider) => void;
  /** Set OpenRouter API key */
  setApiKey: (apiKey: string | null) => void;
  /** Update appearance settings */
  updateAppearanceSettings: (settings: Partial<AppearanceSettings>) => void;
  /** Update viewer settings */
  updateViewerSettings: (settings: Partial<ViewerSettings>) => void;
  /** Update AI settings */
  updateAISettings: (settings: Partial<AISettings>) => void;
  /** Update processing settings */
  updateProcessingSettings: (settings: Partial<ProcessingSettings>) => void;
  /** Update privacy settings */
  updatePrivacySettings: (settings: Partial<PrivacySettings>) => void;
  /** Reset viewer settings to defaults */
  resetViewerSettings: () => void;
  /** Reset AI settings to defaults */
  resetAISettings: () => void;
  /** Reset all settings to defaults */
  resetAllSettings: () => void;
  /** Mark first run as complete */
  completeFirstRun: () => void;
}

/**
 * Combined settings store type
 */
export type SettingsStore = SettingsState & SettingsActions;

/**
 * Default appearance settings
 */
const defaultAppearanceSettings: AppearanceSettings = {
  accentColor: 'blue',
  fontSize: 'medium',
  sidebarOpen: true,
};

/**
 * Default viewer settings
 */
const defaultViewerSettings: ViewerSettings = {
  defaultZoom: 1.0,
  pageFit: 'width',
  showThumbnails: true,
  showOutline: false,
  scrollMode: 'vertical',
  spreadMode: 'none',
  enableTextSelection: true,
  enableAnnotations: true,
  pageDisplay: 'continuous',
  defaultTool: 'hand',
};

/**
 * Default AI settings
 */
const defaultAISettings: AISettings = {
  provider: 'local',
  openRouterApiKey: null,
  localModelId: 'Xenova/flan-t5-small',
  openRouterModelId: 'anthropic/claude-3-haiku',
  defaultTemperature: 0.7,
  defaultMaxTokens: 2048,
  enableStreaming: true,
  ragChunkSize: 512,
  ragChunkOverlap: 50,
  ragTopK: 5,
  autoIndexDocuments: true,
};

/**
 * Default processing settings
 */
const defaultProcessingSettings: ProcessingSettings = {
  defaultCompressionLevel: 'medium',
  defaultImageDpi: 150,
  defaultImageQuality: 'high',
  autoGenerateThumbnails: true,
  autoExtractText: true,
  ocrLanguage: 'eng',
  autoCleanupTempFiles: true,
};

/**
 * Default privacy settings
 */
const defaultPrivacySettings: PrivacySettings = {
  enableAnalytics: false,
  enableCrashReporting: false,
  clearDataOnExit: false,
  allowCloudSync: false,
};

/**
 * Initial state for the settings store
 */
const initialState: SettingsState = {
  theme: 'system',
  language: 'en',
  appearance: defaultAppearanceSettings,
  viewer: defaultViewerSettings,
  ai: defaultAISettings,
  processing: defaultProcessingSettings,
  privacy: defaultPrivacySettings,
  isFirstRun: true,
  version: 1,
};

/**
 * Settings storage key
 */
const STORAGE_KEY = 'pdflover-settings';

/**
 * User settings store with localStorage persistence
 * Manages all user preferences and application settings
 */
export const useSettingsStore = create<SettingsStore>()(
  persist(
    immer((set) => ({
      ...initialState,

      setTheme: (theme: Theme) => {
        set((state) => {
          state.theme = theme;
        });
      },

      setLanguage: (language: string) => {
        set((state) => {
          state.language = language;
        });
      },

      setAIProvider: (provider: AIProvider) => {
        set((state) => {
          state.ai.provider = provider;
        });
      },

      setApiKey: (apiKey: string | null) => {
        set((state) => {
          state.ai.openRouterApiKey = apiKey;
        });
      },

      updateAppearanceSettings: (settings: Partial<AppearanceSettings>) => {
        set((state) => {
          state.appearance = { ...state.appearance, ...settings };
        });
      },

      updateViewerSettings: (settings: Partial<ViewerSettings>) => {
        set((state) => {
          state.viewer = { ...state.viewer, ...settings };
        });
      },

      updateAISettings: (settings: Partial<AISettings>) => {
        set((state) => {
          state.ai = { ...state.ai, ...settings };
        });
      },

      updateProcessingSettings: (settings: Partial<ProcessingSettings>) => {
        set((state) => {
          state.processing = { ...state.processing, ...settings };
        });
      },

      updatePrivacySettings: (settings: Partial<PrivacySettings>) => {
        set((state) => {
          state.privacy = { ...state.privacy, ...settings };
        });
      },

      resetViewerSettings: () => {
        set((state) => {
          state.viewer = defaultViewerSettings;
        });
      },

      resetAISettings: () => {
        set((state) => {
          state.ai = defaultAISettings;
        });
      },

      resetAllSettings: () => {
        set(() => ({
          ...initialState,
          isFirstRun: false, // Preserve first run state
        }));
      },

      completeFirstRun: () => {
        set((state) => {
          state.isFirstRun = false;
        });
      },
    })),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      migrate: (persistedState: unknown, version: number) => {
        // Handle migrations for future schema changes
        const state = persistedState as SettingsState;
        if (version === 0) {
          // Migration from version 0 to 1
          return {
            ...initialState,
            ...state,
            version: 1,
          };
        }
        return state;
      },
      partialize: (state) => ({
        // Only persist these fields
        theme: state.theme,
        language: state.language,
        appearance: state.appearance,
        viewer: state.viewer,
        ai: state.ai,
        processing: state.processing,
        privacy: state.privacy,
        isFirstRun: state.isFirstRun,
        version: state.version,
      }),
    }
  )
);

/**
 * Selector: Get effective theme (resolve 'system' to actual theme)
 */
export const selectEffectiveTheme = (state: SettingsStore): 'light' | 'dark' => {
  if (state.theme === 'system') {
    // Check system preference
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }
  return state.theme;
};

/**
 * Selector: Check if API key is configured
 */
export const selectHasApiKey = (state: SettingsStore): boolean => {
  return state.ai.openRouterApiKey !== null && state.ai.openRouterApiKey.length > 0;
};

/**
 * Selector: Get current AI model ID based on provider
 */
export const selectCurrentModelId = (state: SettingsStore): string => {
  return state.ai.provider === 'local' ? state.ai.localModelId : state.ai.openRouterModelId;
};

/**
 * Selector: Check if cloud features are enabled
 */
export const selectCloudEnabled = (state: SettingsStore): boolean => {
  return state.privacy.allowCloudSync;
};
