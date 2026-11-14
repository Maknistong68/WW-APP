// Phone layout check: opens the app's main screens with sample data at phone
// sizes and reports anything that would be hard to read or tap on a phone:
//   - content still hidden under a bottom bar (tab bar, action bar, camera
//     button) when scrolled to the very end,
//   - things on top of each other (photos, chips, numbers, rows),
//   - text spilling out of its box, or the page scrolling sideways.
// Run: node scripts/layout-check.mjs   (starts its own dev server; exits 1 on problems)
// Options: --only=/tickets (one screen)  --shots=DIR (save a screenshot of each screen with a problem; --all: every screen)
//          --no-scroll (check and shoot the top of each screen instead of its end)
import { createRequire } from 'node:module'
import { createServer } from 'vite'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const SIZES = [
  { width: 360, height: 740, scheme: 'light' },
  { width: 390, height: 844, scheme: 'light' },
  { width: 390, height: 844, scheme: 'dark' },
]
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7)
const shots = process.argv.find((a) => a.startsWith('--shots='))?.slice(8)

/** Screens to check; ids come from the sample data below. */
const ROUTES = [
  '/',
  '/today/tickets',
  '/today/accommodation',
  '/tickets',
  '/tickets?tab=internal',
  '/tickets/t01',
  '/tickets/t03',
  '/dashboard',
  '/dashboard?v=accommodation',
  '/dashboard?v=kpis',
  '/kpis/closure?m=2026-10',
  '/library',
  '/contractors',
  '/contractors/c1',
  '/contractors/c1?tab=trends',
  '/contractors/c1/kpi/closure?m=2026-10',
  '/compare',
  '/entry',
  '/camps',
  '/camps/k1',
  '/audits',
  '/closeouts',
  '/inspection/1',
  '/inspection/2',
  '/inspection/3',
  // the audit by place (walking around), and one question at a time
  '/inspection/2 walk',
  '/inspection/2 one-by-one',
  '/new/accommodation',
  '/new/welfare_audit?wo=w1',
  '/settings',
].filter((r) => !only || r === only)

async function seed(page) {
  await page.evaluate(async () => {
    const { db } = await import('/src/db.ts')
    const now = new Date().toISOString()
    const base = { updatedAt: now }
    await db.contractors.bulkPut([
      { ...base, uuid: 'c1', name: 'Abyatona Contracting Company', active: true, aliases: [], notes: '' },
      { ...base, uuid: 'c2', name: 'SAMA', active: true, aliases: [], notes: '' },
    ])
    await db.workOrders.bulkPut([
      { ...base, uuid: 'w1', contractorUuid: 'c1', number: '882', label: 'Package 1 residential', active: true, notes: '' },
      { ...base, uuid: 'w2', contractorUuid: 'c1', number: '1134', label: '', active: true, notes: '' },
      { ...base, uuid: 'w3', contractorUuid: 'c2', number: '1272', label: '', active: true, notes: '' },
    ])
    const t = (uuid, c, w, openedAt, closedAt, workers, source = 'System') => ({
      ...base, uuid, source, ticketNo: source === 'Internal' ? `CASE-00${uuid.slice(1)}` : `WWCMPL00096${uuid.slice(1)}`, channel: 'Hotline',
      contractorUuid: c, workOrderUuid: w, subcontractor: 'Al Noor Manpower Supply Services', category: 'Salary', issue: 'Unpaid salary and overtime for three months',
      priority: 2, severity: 'High', workers, violations: 1, amountOwed: closedAt ? 12500 : 48000, parentUuid: '', assignedTo: '', status: closedAt ? 'Closed' : 'Open',
      openedAt, closedAt, contractorAction: 'Payment plan agreed with the workers', wwAction: 'Follow up weekly', notes: 'Workers say the overtime from August is still unpaid.',
    })
    await db.tickets.bulkPut([
      t('t01', 'c1', 'w1', '2026-09-20', '2026-10-09', 3),
      t('t02', 'c1', 'w1', '2026-10-03', '2026-10-10', 2),
      t('t03', 'c1', 'w1', '2026-09-01', '', 14),
      t('t04', 'c1', 'w2', '2026-10-01', '2026-10-31', 6),
      t('t05', 'c2', 'w3', '2026-09-10', '2026-10-20', 5),
      t('t06', 'c2', 'w3', '2026-10-12', '', 2),
      t('t07', 'c1', 'w2', '2026-11-02', '2026-11-06', 1),
      t('t08', 'c2', 'w3', '2026-10-25', '', 3, 'Internal'),
    ])
    const mp = (w, c, total, illegal) => ({ ...base, uuid: `m-${w}`, contractorUuid: c, workOrderUuid: w, month: '2026-10', totalWorkers: total, illegalOrFreelance: illegal, visaExpiring30d: 4, paidRecruitmentFees: 1 })
    await db.manpower.bulkPut([mp('w1', 'c1', 1200, 60), mp('w2', 'c1', 300, 0), mp('w3', 'c2', 450, 45)])
    await db.camps.bulkPut([{ ...base, uuid: 'k1', name: 'Camp 3 – Gulf Labour Village', contractorUuid: 'c1', workOrderUuid: 'w1', location: 'Industrial zone, north gate', cycleDays: 90, active: true, notes: '' }])
    const info = {
      typeOfReview: 'Welfare Inspection', reviewDate: '2026-11-03', auditTeam: 'WW team', region: 'North', facilityLocation: 'Industrial zone, north gate', facilityType: 'Camp',
      mapCoordinates: '', googleMapsLink: '', facilityManagement: 'Gulf Facilities Management', occupantsNumber: '640', numberOfRooms: '160', maxOccupancy: '700',
      contractorsCount: '1', contractorNames: 'Abyatona Contracting Company', projectsServed: 'Package 1', facilityRepresentative: 'Camp boss', workOrder: '882',
    }
    const r = (assessment, observation = '') => ({ yesNo: assessment === 'No compliance' ? 'No' : 'Yes', assessment, observation, actionPlan: '' })
    if (!(await db.inspections.get(1))) {
      await db.inspections.add({
        id: 1, uuid: 'ins-1', templateId: 'accommodation', status: 'draft', createdAt: now, updatedAt: now, info, notes: '', campUuid: 'k1',
        responses: { A1: r('Full compliance'), A2: r('No compliance', 'Fire extinguisher in block C expired in September; tag missing.'), A3: r('Partial compliance', 'Two rooms over capacity') },
      })
      // a Worker Welfare audit for WO 882: A answered (a No with its comment), F started
      const a = (assessment, observation = '') => ({ yesNo: '', assessment, observation, actionPlan: '' })
      await db.inspections.add({
        id: 2, uuid: 'aud-1', templateId: 'welfare_audit', status: 'draft', createdAt: now, updatedAt: now, notes: '',
        info: { ...info, typeOfReview: 'Worker Welfare audit', reviewDate: '2026-11-12', facilityType: 'Work order', workOrderUuid: 'w1', contractorUuid: 'c1', project: 'Package 1 residential', auditor: 'WW team', inspectionNo: 'WWA-2026-Q4-882' },
        responses: {
          A1: a('Full compliance'), A2: a('No compliance', 'No evidence of ethical recruitment review or supply-chain audits.'), A3: a('Partial compliance'), A4: a('Full compliance'),
          F1: a('Full compliance'), F2: a('No compliance'),
        },
      })
      // a finished audit: scores only
      const titles = ['Employment practice', 'Worker onboarding', 'Wages and benefits', 'Working hours', 'Accommodation', 'Payment of workers', 'Health and safety', 'Grievances', 'Transport', 'Food', 'Training', 'Equality and non-discrimination', 'Freedom of association', 'Records']
      await db.inspections.add({
        id: 3, uuid: 'aud-2', templateId: 'welfare_audit', status: 'completed', createdAt: now, updatedAt: now, notes: '', responses: {},
        info: { ...info, typeOfReview: 'Worker Welfare audit', reviewDate: '2026-08-20', facilityType: 'Work order', workOrderUuid: 'w2', contractorUuid: 'c1', workOrder: '1134', project: 'Package 2 infrastructure and long name', inspectionNo: 'WWA-2026-Q3-1134' },
        logged: { pct: 87.4, rating: 'Good', findings: 6, sections: titles.map((title, i) => ({ letter: String.fromCharCode(65 + i), title, pct: i === 12 ? null : [100, 92.3, 57.1, 83.3, 88.2, 54.5, 100, 71.4, 100, 85.7, 100, 75, null, 80][i] })) },
      })
      const canvas = new OffscreenCanvas(800, 600)
      const g = canvas.getContext('2d')
      for (let i = 0; i < 4; i++) {
        g.fillStyle = ['#7a9', '#a97', '#79a', '#aa7'][i]
        g.fillRect(0, 0, 800, 600)
        const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.6 })
        await db.photos.add({ uuid: `p-${i}`, inspectionId: 1, itemId: i < 3 ? 'A2' : '@facility', blob, caption: i === 0 ? 'Expired tag' : '', createdAt: now, updatedAt: now })
        await db.photos.add({ uuid: `q-${i}`, inspectionId: 2, itemId: 'A2', blob, caption: '', createdAt: now, updatedAt: now })
      }
    }
  })
}

/** Runs in the page: the problems on the current screen. */
function findProblems(atEnd) {
  const out = []
  const vis = (el) => {
    const s = getComputedStyle(el)
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  const name = (el) => {
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40)
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${text ? ` "${text}"` : ''}`
  }
  const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  const main = document.querySelector('main.page') || document.body
  const inMain = [...main.querySelectorAll('*')].filter((el) => !el.closest('svg') || el.tagName.toLowerCase() === 'svg')

  // 1. page scrolls sideways
  if (document.documentElement.scrollWidth > innerWidth + 1) out.push(`page is ${document.documentElement.scrollWidth - innerWidth}px wider than the screen`)

  // 2. under a bottom bar at the end of the page
  const bars = [...document.querySelectorAll('body *')].filter((el) => {
    const s = getComputedStyle(el)
    if (s.position !== 'fixed' || !vis(el) || el.closest('[data-hidden]')) return false
    const r = el.getBoundingClientRect()
    return r.bottom >= innerHeight - 40 && r.top > innerHeight / 2 && r.height < innerHeight / 2 && !main.contains(el)
  })
  const things = inMain.filter((el) => {
    if (!vis(el) || bars.some((b) => b.contains(el))) return false
    const s = getComputedStyle(el)
    if (s.position === 'fixed') return false
    const tag = el.tagName.toLowerCase()
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    return ownText || ['button', 'a', 'input', 'textarea', 'select', 'img'].includes(tag)
  })
  // mid-page, content passes under floating buttons as it scrolls; only the end of the page must clear them
  for (const b of atEnd ? bars : []) {
    const br = b.getBoundingClientRect()
    for (const el of things) {
      const r = el.getBoundingClientRect()
      if (overlap(r, br) > 8) out.push(`hidden under ${name(b).split(' ')[0]}: ${name(el)}`)
    }
  }

  // 3. siblings on top of each other
  for (const parent of inMain) {
    if (!vis(parent) || parent.tagName.toLowerCase() === 'svg') continue
    const kids = [...parent.children].filter((k) => {
      if (!vis(k)) return false
      const p = getComputedStyle(k).position
      // sticky items are pinned on purpose (scrolled content slides under them)
      return p === 'static' || p === 'relative'
    })
    for (let i = 0; i < kids.length; i++) {
      const a = kids[i].getBoundingClientRect()
      for (let j = i + 1; j < kids.length; j++) {
        const b = kids[j].getBoundingClientRect()
        if (overlap(a, b) > 16) out.push(`overlap: ${name(kids[i])} × ${name(kids[j])}`)
      }
    }
  }

  // 4. text spilling out of its box, or cut off by a card's edge or the screen's
  const scroller = (el) => {
    for (let a = el.parentElement; a; a = a.parentElement) {
      const o = getComputedStyle(a).overflowX
      if (o === 'auto' || o === 'scroll') return true
    }
    return false
  }
  const clipper = (el) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const o = getComputedStyle(a).overflowX
      if (o === 'hidden' || o === 'clip') return a
    }
    return null
  }
  for (const el of things) {
    const s = getComputedStyle(el)
    if (el.tagName.toLowerCase() === 'svg' || scroller(el)) continue
    if (s.overflowX === 'visible' && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) out.push(`text spills (${el.scrollWidth - el.clientWidth}px): ${name(el)}`)
    if (s.textOverflow === 'ellipsis') continue
    const r = el.getBoundingClientRect()
    const c = clipper(el)
    // cut short on purpose with "…" by the box that clips it
    if (c && getComputedStyle(c).textOverflow === 'ellipsis') continue
    const cr = c ? c.getBoundingClientRect() : { left: 0, right: innerWidth }
    if (r.right > Math.min(cr.right, innerWidth) + 1 || r.left < Math.max(cr.left, 0) - 1) out.push(`text cut off: ${name(el)}`)
  }
  return [...new Set(out)]
}

const server = await createServer({ server: { port: 5199, strictPort: false }, logLevel: 'error' })
await server.listen()
const base = server.resolvedUrls.local[0]
const browser = await chromium.launch()
let total = 0
try {
  for (const size of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 2, colorScheme: size.scheme, reducedMotion: 'reduce', hasTouch: true, isMobile: true })
    const page = await ctx.newPage()
    await page.goto(base)
    await page.waitForTimeout(3000)
    await seed(page)
    for (const route of ROUTES) {
      // "/inspection/2 walk": the screen, then what to do on it
      const [path, mode] = route.split(' ')
      await page.evaluate((walk) => localStorage.setItem('ww.auditView', walk ? 'walk' : 'sections'), mode === 'walk' || mode === 'one-by-one')
      await page.goto(`${base}#${path}`)
      await page.waitForTimeout(1800)
      // open the first section of the audit, so its questions are checked too
      if (route === '/inspection/2') {
        await page.locator('#section-A .section-head').click()
        await page.waitForTimeout(500)
      }
      if (mode === 'walk') {
        await page.locator('#place-2 .section-head').click()
        await page.waitForTimeout(500)
      }
      if (mode === 'one-by-one') {
        await page.locator('.focus-start').click()
        await page.waitForTimeout(400)
        // a No: its ready comments, note and camera open
        await page.locator('.audit-focus .audit-answers button', { hasText: 'No' }).click()
        await page.waitForTimeout(500)
      }
      // to the very end, as a person would scroll, then let the bars come back
      if (!process.argv.includes('--no-scroll')) {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
        await page.waitForTimeout(700)
      }
      const problems = await page.evaluate(findProblems, !process.argv.includes('--no-scroll'))
      total += problems.length
      const tag = `${size.width}×${size.height} ${size.scheme}`
      console.log(problems.length ? `✗ ${route} (${tag})` : `✓ ${route} (${tag})`)
      if ((problems.length || process.argv.includes('--all')) && shots) {
        const slug = route.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'
        await page.screenshot({ path: `${shots}/${slug}-${size.width}-${size.scheme}.png` })
      }
      for (const p of problems.slice(0, 12)) console.log(`    ${p}`)
      if (problems.length > 12) console.log(`    … ${problems.length - 12} more`)
    }
    await ctx.close()
  }
} finally {
  await browser.close()
  await server.close()
}
console.log(total ? `\n${total} layout problem(s)` : '\nNo layout problems')
process.exit(total ? 1 : 0)
