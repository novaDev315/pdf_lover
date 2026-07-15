import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsPage } from '@/pages/SettingsPage';

const originalScrollIntoView = Element.prototype.scrollIntoView;

vi.mock('@/lib/storage', () => ({
  db: {
    clearAllData: vi.fn(),
    exportData: vi.fn(),
    importData: vi.fn(),
  },
}));

describe('SettingsPage navigation', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class ResizeObserverMock {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    Element.prototype.scrollIntoView = originalScrollIntoView;
    vi.unstubAllGlobals();
  });

  it('shows one selected settings section at a time on narrow layouts', () => {
    const { container } = render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    const sectionPicker = screen.getByRole('combobox', {
      name: 'Show settings for',
    });
    const appearanceSection = container.querySelector('#appearance');
    const aiSection = container.querySelector('#ai');

    expect(sectionPicker).toHaveValue('appearance');
    expect(appearanceSection).not.toHaveClass('hidden');
    expect(aiSection).toHaveClass('hidden', 'lg:block');

    fireEvent.change(sectionPicker, { target: { value: 'ai' } });

    expect(sectionPicker).toHaveValue('ai');
    expect(appearanceSection).toHaveClass('hidden', 'lg:block');
    expect(aiSection).not.toHaveClass('hidden');
    expect(aiSection?.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });
  });
});
