import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const webRoot = resolve(process.cwd(), 'apps/web')
const nginx = readFileSync(resolve(webRoot, 'nginx.conf'), 'utf8')
const dockerfile = readFileSync(resolve(webRoot, 'Dockerfile'), 'utf8')

describe('web security headers', () => {
  it('re-includes security headers in every location that defines cache headers', () => {
    const locationBlocks = [...nginx.matchAll(/location[^{}]+\{([^{}]*)\}/g)].map((match) => match[1] ?? '')
    const cacheHeaderLocations = locationBlocks.filter((block) => block.includes('add_header Cache-Control'))

    expect(cacheHeaderLocations.length).toBeGreaterThan(0)
    for (const block of cacheHeaderLocations) {
      expect(block).toContain('include /etc/nginx/pdflover-security-headers.conf;')
    }
  })

  it('copies the shared header configuration into the production image', () => {
    expect(nginx).toContain('include /etc/nginx/pdflover-security-headers.conf;')
    expect(dockerfile).toContain('COPY apps/web/nginx-security-headers.conf /etc/nginx/pdflover-security-headers.conf')
  })
})
