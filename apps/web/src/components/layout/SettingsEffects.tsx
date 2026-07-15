import * as React from 'react';

import { useSettingsStore } from '@/store/settings-store';

/**
 * Applies persisted appearance settings at the document boundary so every
 * route receives the same theme, accent palette, and font scale.
 */
export function SettingsEffects() {
  const theme = useSettingsStore((state) => state.theme);
  const accentColor = useSettingsStore((state) => state.appearance.accentColor);
  const fontSize = useSettingsStore((state) => state.appearance.fontSize);

  React.useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const effectiveTheme = theme === 'system'
        ? (media.matches ? 'dark' : 'light')
        : theme;
      root.classList.remove('light', 'dark');
      root.classList.add(effectiveTheme);
      root.style.colorScheme = effectiveTheme;
    };

    applyTheme();
    if (theme === 'system') media.addEventListener('change', applyTheme);

    return () => media.removeEventListener('change', applyTheme);
  }, [theme]);

  React.useEffect(() => {
    document.documentElement.dataset.accent = accentColor;
  }, [accentColor]);

  React.useEffect(() => {
    document.documentElement.dataset.fontSize = fontSize;
  }, [fontSize]);

  return null;
}

export default SettingsEffects;
