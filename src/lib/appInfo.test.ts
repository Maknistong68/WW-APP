import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { APP_NAME } from './appInfo'

const read = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8')

describe('One app name everywhere', () => {
  it('fits under the home-screen icon (12 letters or fewer)', () => {
    expect(APP_NAME).toBe('WW Co-pilot')
    expect(APP_NAME.length).toBeLessThanOrEqual(12)
  })
  it('the installed app (manifest) uses it for name and short name', () => {
    const cfg = read('vite.config.ts')
    expect(cfg).toContain(`name: '${APP_NAME}'`)
    expect(cfg).toContain(`short_name: '${APP_NAME}'`)
    expect(cfg).not.toMatch(/WW Inspect|Worker Welfare Inspections/)
  })
  it('the browser tab and the iPhone home screen use it', () => {
    const html = read('index.html')
    expect(html).toContain(`<title>${APP_NAME}</title>`)
    expect(html).toContain(`<meta name="apple-mobile-web-app-title" content="${APP_NAME}" />`)
    expect(html).toContain(`<meta name="application-name" content="${APP_NAME}" />`)
  })
  it('a separate maskable icon, so Android never crops the logo', () => {
    const cfg = read('vite.config.ts')
    expect(cfg).toMatch(/src: 'maskable-512\.png'[^}]*purpose: 'maskable'/)
    expect(cfg).not.toMatch(/src: 'pwa-512\.png'[^}]*purpose: 'maskable'/)
  })
})
