import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { AppFooter } from '@/components/layout/AppFooter'

describe('AppFooter', () => {
  it('provides consistent workspace navigation', () => {
    render(
      <MemoryRouter>
        <AppFooter />
      </MemoryRouter>,
    )

    const navigation = screen.getByRole('navigation', { name: 'Footer navigation' })

    expect(navigation).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'All tools' })).toHaveAttribute(
      'href',
      '/#all-tools',
    )
    expect(screen.getByRole('link', { name: 'Library' })).toHaveAttribute('href', '/files')
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('href', '/history')
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
  })
})
