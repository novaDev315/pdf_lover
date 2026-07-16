import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { Dashboard } from '@/pages/Dashboard';

const EXPECTED_PATHS = [
  '/merge',
  '/split',
  '/compress',
  '/convert',
  '/security',
  '/watermark',
  '/signature',
  '/chat',
  '/editor',
  '/search',
  '/batch',
  '/extract-images',
  '/extract-tables',
  '/page-numbers',
  '/crop-resize',
  '/compare',
  '/toc',
  '/form-detection',
  '/classify',
  '/key-info',
  '/files',
  '/history',
  '/settings',
] as const;

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
}

describe('Dashboard navigation', () => {
  afterEach(() => cleanup());

  it('provides a visible access path to every routed feature', () => {
    const { container } = renderDashboard();
    const linkedPaths = new Set(
      Array.from(container.querySelectorAll('a[href]')).map((link) => link.getAttribute('href')),
    );

    for (const path of EXPECTED_PATHS) {
      expect(linkedPaths, `missing dashboard link for ${path}`).toContain(path);
    }

    expect(screen.getAllByText('20 PDF tools available')).toHaveLength(1);
  });

  it('filters the complete catalog by task keywords', () => {
    renderDashboard();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search PDF tools' }), {
      target: { value: 'certificate' },
    });

    expect(screen.getByRole('link', { name: 'Open Sign PDF' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open Merge PDFs' })).not.toBeInTheDocument();
  });

  it('focuses tool search with the slash shortcut', () => {
    renderDashboard();

    fireEvent.keyDown(window, { key: '/' });

    expect(screen.getByRole('searchbox', { name: 'Search PDF tools' })).toHaveFocus();
  });
});
