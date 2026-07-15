import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SettingsEffects } from '@/components/layout/SettingsEffects';
import { useSettingsStore } from '@/store/settings-store';

describe('SettingsEffects', () => {
  beforeEach(() => {
    act(() => useSettingsStore.getState().resetAllSettings());
    document.documentElement.className = '';
    delete document.documentElement.dataset.accent;
    delete document.documentElement.dataset.fontSize;
    document.documentElement.style.colorScheme = '';
  });

  afterEach(() => cleanup());

  it('applies theme, accent, and font settings to every route through the root element', async () => {
    render(<SettingsEffects />);

    act(() => {
      useSettingsStore.getState().setTheme('dark');
      useSettingsStore.getState().updateAppearanceSettings({
        accentColor: 'purple',
        fontSize: 'large',
      });
    });

    await waitFor(() => {
      expect(document.documentElement).toHaveClass('dark');
      expect(document.documentElement.dataset.accent).toBe('purple');
      expect(document.documentElement.dataset.fontSize).toBe('large');
      expect(document.documentElement.style.colorScheme).toBe('dark');
    });
  });

  it('removes the old theme class when the selected theme changes', async () => {
    render(<SettingsEffects />);

    act(() => useSettingsStore.getState().setTheme('dark'));
    await waitFor(() => expect(document.documentElement).toHaveClass('dark'));

    act(() => useSettingsStore.getState().setTheme('light'));
    await waitFor(() => {
      expect(document.documentElement).toHaveClass('light');
      expect(document.documentElement).not.toHaveClass('dark');
    });
  });
});
