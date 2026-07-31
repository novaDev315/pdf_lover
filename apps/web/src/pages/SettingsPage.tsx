/**
 * Settings Page - Comprehensive settings management
 * Allows users to configure appearance, viewer, AI, processing, data, and shortcuts
 */

import * as React from 'react';
import {
  Sun,
  Moon,
  Monitor,
  Palette,
  Eye,
  Bot,
  Cog,
  Shield,
  Keyboard,
  Info,
  ExternalLink,
  Github,
  FileText,
  Trash2,
  Download,
  Upload,
  RotateCcw,
  Database,
  ChevronRight,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import {
  useSettingsStore,
  type Theme,
  type FontSize,
  type AccentColor,
  type ViewerTool,
  type PageDisplayMode,
} from '@/store/settings-store';
import { cn, formatFileSize } from '@/lib/utils';
import { db } from '@/lib/storage';
import webPackage from '../../package.json';
import { useApiCapabilities } from '@/hooks/useApiCapabilities';

/**
 * Settings section navigation
 */
interface SettingsSection {
  id: string;
  label: string;
  icon: React.ElementType;
}

const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'viewer', label: 'PDF Viewer', icon: Eye },
  { id: 'ai', label: 'AI Settings', icon: Bot },
  { id: 'processing', label: 'Processing', icon: Cog },
  { id: 'privacy', label: 'Privacy', icon: Shield },
  { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard },
  { id: 'about', label: 'About', icon: Info },
];

/**
 * Theme option button
 */
interface ThemeOptionProps {
  value: Theme;
  label: string;
  icon: React.ElementType;
  selected: boolean;
  onClick: () => void;
}

function ThemeOption({ value: _value, label, icon: Icon, selected, onClick }: ThemeOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
        selected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50 bg-background'
      )}
    >
      <Icon className={cn('h-6 w-6', selected ? 'text-primary' : 'text-muted-foreground')} />
      <span className={cn('text-sm font-medium', selected ? 'text-primary' : 'text-foreground')}>
        {label}
      </span>
    </button>
  );
}

/**
 * Select button for single choice options
 */
interface SelectButtonProps<T extends string> {
  value: T;
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function SelectButton<T extends string>({ value: _value, label, selected, onClick, disabled = false }: SelectButtonProps<T>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className={cn(
        'px-4 py-2 rounded-md text-sm font-medium transition-all',
        disabled && 'cursor-not-allowed opacity-50',
        selected
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
      )}
    >
      {label}
    </button>
  );
}

/**
 * Toggle switch component
 */
interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}

function ToggleSwitch({ checked, onChange, label, description }: ToggleSwitchProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="space-y-0.5">
        <label className="text-sm font-medium text-foreground">{label}</label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-input'
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  );
}

/**
 * Color picker for accent color
 */
interface ColorPickerProps {
  value: AccentColor;
  onChange: (color: AccentColor) => void;
}

const ACCENT_COLORS: { value: AccentColor; color: string; label: string }[] = [
  { value: 'blue', color: 'bg-blue-500', label: 'Blue' },
  { value: 'purple', color: 'bg-purple-500', label: 'Purple' },
  { value: 'green', color: 'bg-green-500', label: 'Green' },
  { value: 'orange', color: 'bg-orange-500', label: 'Orange' },
  { value: 'pink', color: 'bg-pink-500', label: 'Pink' },
  { value: 'red', color: 'bg-red-500', label: 'Red' },
];

function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="flex gap-2">
      {ACCENT_COLORS.map((color) => (
        <button
          key={color.value}
          type="button"
          onClick={() => onChange(color.value)}
          title={color.label}
          aria-label={`${color.label} accent color`}
          aria-pressed={value === color.value}
          className={cn(
            'w-8 h-8 rounded-full transition-transform',
            color.color,
            value === color.value ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105'
          )}
        />
      ))}
    </div>
  );
}

/**
 * Keyboard shortcut row
 */
interface ShortcutRowProps {
  action: string;
  keys: string[];
}

function ShortcutRow({ action, keys }: ShortcutRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-foreground">{action}</span>
      <div className="flex gap-1">
        {keys.map((key, index) => (
          <React.Fragment key={key}>
            <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded border">
              {key}
            </kbd>
            {index < keys.length - 1 && (
              <span className="text-muted-foreground">+</span>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/**
 * Keyboard shortcuts data
 */
const KEYBOARD_SHORTCUTS: ShortcutRowProps[] = [
  { action: 'Zoom In', keys: ['Ctrl', '+'] },
  { action: 'Zoom Out', keys: ['Ctrl', '-'] },
  { action: 'Fit to Width', keys: ['Ctrl', '1'] },
  { action: 'Fit to Page', keys: ['Ctrl', '0'] },
  { action: 'Next Page', keys: ['Right'] },
  { action: 'Previous Page', keys: ['Left'] },
  { action: 'First Page', keys: ['Home'] },
  { action: 'Last Page', keys: ['End'] },
  { action: 'Search', keys: ['Ctrl', 'F'] },
  { action: 'Print', keys: ['Ctrl', 'P'] },
  { action: 'Toggle Sidebar', keys: ['Ctrl', 'B'] },
  { action: 'Toggle Thumbnails', keys: ['Ctrl', 'T'] },
  { action: 'Undo', keys: ['Ctrl', 'Z'] },
  { action: 'Redo', keys: ['Ctrl', 'Shift', 'Z'] },
];

/**
 * OCR language options
 */
const OCR_LANGUAGES = [
  { value: 'eng', label: 'English' },
  { value: 'fra', label: 'French' },
  { value: 'deu', label: 'German' },
  { value: 'spa', label: 'Spanish' },
  { value: 'ita', label: 'Italian' },
  { value: 'por', label: 'Portuguese' },
  { value: 'chi_sim', label: 'Chinese (Simplified)' },
  { value: 'chi_tra', label: 'Chinese (Traditional)' },
  { value: 'jpn', label: 'Japanese' },
  { value: 'kor', label: 'Korean' },
  { value: 'ara', label: 'Arabic' },
  { value: 'rus', label: 'Russian' },
];

/**
 * AI model options
 */
const LOCAL_AI_MODELS = [
  { value: 'Xenova/flan-t5-small', label: 'Flan-T5 Small (Fast)' },
  { value: 'Xenova/flan-t5-base', label: 'Flan-T5 Base (Balanced)' },
] as const;

/**
 * Settings Page Component
 */
export function SettingsPage() {
  const [activeSection, setActiveSection] = React.useState('appearance');
  const [storageUsage, setStorageUsage] = React.useState<{ used: number; total: number } | null>(null);
  const [dataActionStatus, setDataActionStatus] = React.useState<string | null>(null);
  const sectionRefs = React.useRef<Record<string, HTMLElement | null>>({});
  const importInputRef = React.useRef<HTMLInputElement>(null);
  const capabilities = useApiCapabilities();
  const openRouterAvailable = capabilities.data?.ai.openRouterConfigured === true;

  // Settings store
  const {
    theme,
    appearance,
    viewer,
    ai,
    processing,
    setTheme,
    updateAppearanceSettings,
    updateViewerSettings,
    updateAISettings,
    updateProcessingSettings,
    resetAllSettings,
  } = useSettingsStore();

  // Calculate storage usage
  React.useEffect(() => {
    async function calculateStorage() {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        try {
          const estimate = await navigator.storage.estimate();
          setStorageUsage({
            used: estimate.usage || 0,
            total: estimate.quota || 0,
          });
        } catch {
          // Storage API not available
        }
      }
    }
    calculateStorage();
  }, []);

  // Scroll to section
  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    window.requestAnimationFrame(() => {
      sectionRefs.current[sectionId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  // Handle clear all data
  const handleClearData = async () => {
    if (window.confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
      try {
        await db.clearAllData();
        localStorage.clear();
        resetAllSettings();
        window.location.reload();
      } catch (error) {
        setDataActionStatus(error instanceof Error ? error.message : 'Failed to clear PDFLover data');
      }
    }
  };

  // Handle export data
  const handleExportData = async () => {
    try {
      const data = await db.exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pdflover-archive-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setDataActionStatus('Archive exported successfully.');
    } catch (error) {
      setDataActionStatus(error instanceof Error ? error.message : 'Failed to export PDFLover data');
    }
  };

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const archive = event.target.files?.[0];
    event.target.value = '';
    if (!archive) return;
    if (!window.confirm('Replace current PDFLover data with this archive?')) return;

    try {
      await db.importData(await archive.text());
      await useSettingsStore.persist.rehydrate();
      window.location.reload();
    } catch (error) {
      setDataActionStatus(error instanceof Error ? error.message : 'Failed to import PDFLover data');
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Settings</h1>
          <p className="mt-2 text-surface-600 dark:text-surface-400">
            Customize your PDF workspace, processing preferences, and local data.
          </p>
        </div>
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <nav className="shrink-0 lg:w-64" aria-label="Settings sections">
            <div className="lg:hidden">
              <label
                htmlFor="settings-section"
                className="mb-2 block text-sm font-medium text-foreground"
              >
                Show settings for
              </label>
              <select
                id="settings-section"
                value={activeSection}
                onChange={(event) => scrollToSection(event.target.value)}
                className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                {SETTINGS_SECTIONS.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-muted-foreground">
                Choose one section at a time to keep this page easy to scan.
              </p>
            </div>

            <Card className="sticky top-24 hidden lg:block">
              <CardContent className="p-2">
                {SETTINGS_SECTIONS.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      activeSection === section.id
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <section.icon className="h-4 w-4" />
                    {section.label}
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  </button>
                ))}
              </CardContent>
            </Card>
          </nav>

          {/* Settings Content */}
          <div className="flex-1 space-y-8">
            {/* Appearance Section */}
            <section
              id="appearance"
              className={cn('scroll-mt-24', activeSection !== 'appearance' && 'hidden lg:block')}
              ref={(el) => { sectionRefs.current['appearance'] = el; }}
            >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Appearance
                </CardTitle>
                <CardDescription>
                  Customize how PDFLover looks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Theme */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">Theme</label>
                  <div className="grid grid-cols-3 gap-4">
                    <ThemeOption
                      value="light"
                      label="Light"
                      icon={Sun}
                      selected={theme === 'light'}
                      onClick={() => setTheme('light')}
                    />
                    <ThemeOption
                      value="dark"
                      label="Dark"
                      icon={Moon}
                      selected={theme === 'dark'}
                      onClick={() => setTheme('dark')}
                    />
                    <ThemeOption
                      value="system"
                      label="System"
                      icon={Monitor}
                      selected={theme === 'system'}
                      onClick={() => setTheme('system')}
                    />
                  </div>
                </div>

                {/* Accent Color */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">Accent Color</label>
                  <ColorPicker
                    value={appearance.accentColor}
                    onChange={(color) => updateAppearanceSettings({ accentColor: color })}
                  />
                </div>

                {/* Font Size */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">Font Size</label>
                  <div className="flex gap-2">
                    {(['small', 'medium', 'large'] as FontSize[]).map((size) => (
                      <SelectButton
                        key={size}
                        value={size}
                        label={size.charAt(0).toUpperCase() + size.slice(1)}
                        selected={appearance.fontSize === size}
                        onClick={() => updateAppearanceSettings({ fontSize: size })}
                      />
                    ))}
                  </div>
                </div>

                {/* Sidebar Default State */}
                <ToggleSwitch
                  checked={appearance.sidebarOpen}
                  onChange={(checked) => updateAppearanceSettings({ sidebarOpen: checked })}
                  label="Sidebar Open by Default"
                  description="Show sidebar when opening the app"
                />
              </CardContent>
            </Card>
            </section>

            {/* PDF Viewer Section */}
            <section
              id="viewer"
              className={cn('scroll-mt-24', activeSection !== 'viewer' && 'hidden lg:block')}
              ref={(el) => { sectionRefs.current['viewer'] = el; }}
            >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  PDF Viewer
                </CardTitle>
                <CardDescription>
                  Configure PDF viewing preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Default Zoom */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">Default Zoom Level</label>
                  <div className="flex gap-2">
                    <SelectButton
                      value="width"
                      label="Fit Width"
                      selected={viewer.pageFit === 'width'}
                      onClick={() => updateViewerSettings({ pageFit: 'width' })}
                    />
                    <SelectButton
                      value="page"
                      label="Fit Page"
                      selected={viewer.pageFit === 'page'}
                      onClick={() => updateViewerSettings({ pageFit: 'page' })}
                    />
                    <SelectButton
                      value="height"
                      label="100%"
                      selected={viewer.pageFit === 'height'}
                      onClick={() => updateViewerSettings({ pageFit: 'height', defaultZoom: 1.0 })}
                    />
                  </div>
                </div>

                {/* Page Display */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">Page Display</label>
                  <div className="flex gap-2">
                    {(['single', 'continuous'] as PageDisplayMode[]).map((mode) => (
                      <SelectButton
                        key={mode}
                        value={mode}
                        label={mode.charAt(0).toUpperCase() + mode.slice(1)}
                        selected={viewer.pageDisplay === mode}
                        onClick={() => updateViewerSettings({ pageDisplay: mode })}
                      />
                    ))}
                  </div>
                </div>

                {/* Default Tool */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">Default Tool</label>
                  <div className="flex gap-2">
                    {(['hand', 'select'] as ViewerTool[]).map((tool) => (
                      <SelectButton
                        key={tool}
                        value={tool}
                        label={tool === 'hand' ? 'Hand (Pan)' : 'Select (Text)'}
                        selected={viewer.defaultTool === tool}
                        onClick={() => updateViewerSettings({ defaultTool: tool })}
                      />
                    ))}
                  </div>
                </div>

                {/* Show Thumbnails */}
                <ToggleSwitch
                  checked={viewer.showThumbnails}
                  onChange={(checked) => updateViewerSettings({ showThumbnails: checked })}
                  label="Show Thumbnails by Default"
                  description="Display page thumbnails sidebar"
                />

                {/* Enable Annotations */}
                <ToggleSwitch
                  checked={viewer.enableAnnotations}
                  onChange={(checked) => updateViewerSettings({ enableAnnotations: checked })}
                  label="Enable Annotations"
                  description="Allow adding annotations to PDFs"
                />
              </CardContent>
            </Card>
            </section>

            {/* AI Settings Section */}
            <section
              id="ai"
              className={cn('scroll-mt-24', activeSection !== 'ai' && 'hidden lg:block')}
              ref={(el) => { sectionRefs.current['ai'] = el; }}
            >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  AI Settings
                </CardTitle>
                <CardDescription>
                  Configure AI chat and document analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* AI Provider */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">AI Provider</label>
                  <div className="flex gap-2">
                    <SelectButton
                      value="local"
                      label="Local (Privacy-First)"
                      selected={ai.provider === 'local'}
                      onClick={() => updateAISettings({ provider: 'local' })}
                    />
                    <SelectButton
                      value="openrouter"
                      label="OpenRouter (Cloud)"
                      selected={ai.provider === 'openrouter'}
                      onClick={() => updateAISettings({ provider: 'openrouter' })}
                      disabled={!openRouterAvailable}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {ai.provider === 'local'
                      ? 'AI runs locally in your browser. No data is sent to external servers.'
                      : 'Uses the server-configured OpenRouter connection. Document context is sent only when you choose cloud AI.'}
                  </p>
                  {!capabilities.isLoading && !openRouterAvailable && (
                    <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100" role="status">
                      Cloud AI is unavailable because OpenRouter is not configured on this backend. Local AI remains available.
                    </p>
                  )}
                </div>

                {/* Default Model */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">Default Model</label>
                  {ai.provider === 'local' ? (
                    <div className="flex flex-wrap gap-2">
                      {LOCAL_AI_MODELS.map((model) => (
                        <SelectButton
                          key={model.value}
                          value={model.value}
                          label={model.label}
                          selected={ai.localModelId === model.value}
                          onClick={() => updateAISettings({ localModelId: model.value })}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        value={ai.openRouterModelId}
                        onChange={(event) => updateAISettings({ openRouterModelId: event.target.value })}
                        placeholder="openrouter/auto"
                      />
                      <p className="text-xs text-muted-foreground">
                        Use <code>openrouter/auto</code> or enter an exact model slug from OpenRouter.
                      </p>
                    </div>
                  )}
                </div>

                <p className="text-sm text-muted-foreground">
                  Document search indexes are created on demand when you ask a question.
                </p>
              </CardContent>
            </Card>
            </section>

            {/* Processing Section */}
            <section
              id="processing"
              className={cn('scroll-mt-24', activeSection !== 'processing' && 'hidden lg:block')}
              ref={(el) => { sectionRefs.current['processing'] = el; }}
            >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cog className="h-5 w-5" />
                  Processing
                </CardTitle>
                <CardDescription>
                  Configure default PDF processing options
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Compression Level */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">Default Compression Level</label>
                  <div className="flex flex-wrap gap-2">
                    {(['low', 'medium', 'high', 'maximum'] as const).map((level) => (
                      <SelectButton
                        key={level}
                        value={level}
                        label={level.charAt(0).toUpperCase() + level.slice(1)}
                        selected={processing.defaultCompressionLevel === level}
                        onClick={() => updateProcessingSettings({ defaultCompressionLevel: level })}
                      />
                    ))}
                  </div>
                </div>

                {/* Image Quality */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">Default Image Quality</label>
                  <div className="flex flex-wrap gap-2">
                    {(['low', 'medium', 'high', 'maximum'] as const).map((quality) => (
                      <SelectButton
                        key={quality}
                        value={quality}
                        label={quality.charAt(0).toUpperCase() + quality.slice(1)}
                        selected={processing.defaultImageQuality === quality}
                        onClick={() => updateProcessingSettings({ defaultImageQuality: quality })}
                      />
                    ))}
                  </div>
                </div>

                {/* Image DPI */}
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-sm font-medium text-foreground">Default Image DPI</label>
                    <span className="text-sm text-muted-foreground">{processing.defaultImageDpi} DPI</span>
                  </div>
                  <Slider
                    value={[processing.defaultImageDpi]}
                    onValueChange={([value]) => updateProcessingSettings({ defaultImageDpi: value })}
                    min={72}
                    max={300}
                    step={1}
                  />
                </div>

                {/* OCR Language */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">OCR Default Language</label>
                  <select
                    value={processing.ocrLanguage}
                    onChange={(e) => updateProcessingSettings({ ocrLanguage: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    {OCR_LANGUAGES.map((lang) => (
                      <option key={lang.value} value={lang.value}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>

                <p className="text-sm text-muted-foreground">
                  Temporary processing files are always removed automatically; library files remain until you delete them.
                </p>
              </CardContent>
            </Card>
            </section>

            {/* Privacy Section */}
            <section
              id="privacy"
              className={cn('scroll-mt-24', activeSection !== 'privacy' && 'hidden lg:block')}
              ref={(el) => { sectionRefs.current['privacy'] = el; }}
            >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Privacy
                </CardTitle>
                <CardDescription>
                  Manage your data and privacy settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Storage Usage */}
                {storageUsage && (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <label className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        Storage Usage
                      </label>
                      <span className="text-sm text-muted-foreground">
                        {formatFileSize(storageUsage.used)} / {formatFileSize(storageUsage.total)}
                      </span>
                    </div>
                    <Progress
                      value={(storageUsage.used / storageUsage.total) * 100}
                      className="h-2"
                    />
                  </div>
                )}

                {/* Data Actions */}
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" onClick={handleExportData}>
                    <Download className="h-4 w-4 mr-2" />
                    Export All Data
                  </Button>
                  <Button variant="outline" onClick={() => importInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Import Archive
                  </Button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="sr-only"
                    onChange={handleImportData}
                  />
                  <Button variant="outline" onClick={resetAllSettings}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset Settings
                  </Button>
                  <Button variant="destructive" onClick={handleClearData}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All Data
                  </Button>
                </div>

                {dataActionStatus && (
                  <p role="status" className="text-sm text-muted-foreground">
                    {dataActionStatus}
                  </p>
                )}

                <p className="text-sm text-muted-foreground">
                  PDFLover does not send analytics or crash reports. Cloud AI is used only when you select an OpenRouter model, through the backend proxy.
                </p>
              </CardContent>
            </Card>
            </section>

            {/* Keyboard Shortcuts Section */}
            <section
              id="shortcuts"
              className={cn('scroll-mt-24', activeSection !== 'shortcuts' && 'hidden lg:block')}
              ref={(el) => { sectionRefs.current['shortcuts'] = el; }}
            >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Keyboard className="h-5 w-5" />
                  Keyboard Shortcuts
                </CardTitle>
                <CardDescription>
                  View all available keyboard shortcuts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border">
                  {KEYBOARD_SHORTCUTS.map((shortcut) => (
                    <ShortcutRow
                      key={shortcut.action}
                      action={shortcut.action}
                      keys={shortcut.keys}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
            </section>

            {/* About Section */}
            <section
              id="about"
              className={cn('scroll-mt-24', activeSection !== 'about' && 'hidden lg:block')}
              ref={(el) => { sectionRefs.current['about'] = el; }}
            >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  About
                </CardTitle>
                <CardDescription>
                  Information about PDFLover
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Version Info */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">PDFLover</h3>
                  <p className="text-sm text-muted-foreground">
                    Version {webPackage.version}
                  </p>
                  <dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-[8rem_1fr]">
                    <dt>Web build</dt>
                    <dd className="font-mono">{import.meta.env.VITE_BUILD_SHA || 'development'}</dd>
                    <dt>Built</dt>
                    <dd>{import.meta.env.VITE_BUILD_TIME || 'local development'}</dd>
                    <dt>API version</dt>
                    <dd className="font-mono">{capabilities.data?.serviceVersion || 'unavailable'}</dd>
                  </dl>
                  <p className="text-sm text-muted-foreground">
                    A local-first PDF processing platform. Browser-capable operations stay local;
                    server-only operations and cloud AI run only when explicitly selected.
                  </p>
                </div>

                {/* Links */}
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" asChild>
                    <a
                      href="https://github.com/novaDev315/pdf_lover"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Github className="h-4 w-4 mr-2" />
                      GitHub
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </Button>
                  <Button variant="outline" asChild>
                    <a
                      href="https://github.com/novaDev315/pdf_lover#readme"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Documentation
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </Button>
                </div>

                {/* License */}
                <div className="pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    PDFLover is open source software licensed under the MIT License.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Built with React, PDF.js, pdf-lib, and Transformers.js
                  </p>
                </div>
              </CardContent>
            </Card>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
