import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { ToolHeader } from '@/components/layout/ToolHeader'

describe('ToolHeader', () => {
  it('renders the shared tool navigation and accessible back action', () => {
    render(
      <MemoryRouter>
        <ToolHeader title="Convert PDF" />
      </MemoryRouter>,
    )

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to all PDF tools' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent('Convert PDF')
    expect(screen.getByText('Convert PDF')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Library' })).toHaveAttribute('href', '/files')
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('href', '/history')
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
  })
})
