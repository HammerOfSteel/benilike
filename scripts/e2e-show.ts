/**
 * benilike E2E show runner
 *
 * Launches a visible Chromium browser, automates the full game flow,
 * and optionally runs a bot that walks around so you can see the map.
 *
 * Usage:
 *   npm run show                           → default: non-headless, small map, 30s bot
 *   npm run show -- --headless             → run without window (CI / screenshot mode)
 *   npm run show -- --size medium          → medium map
 *   npm run show -- --bot-duration 60      → run bot for 60 seconds
 *   npm run show -- --url http://localhost:3000
 *   npm run show -- --errors-only          → suppress non-error console output
 *
 * Prerequisite: npm run dev must be running (client + server).
 */

import { chromium, Browser, Page } from 'playwright'

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const arg  = (flag: string, fallback = '') =>
  (args.find(a => a.startsWith(`${flag}=`))?.split('=').slice(1).join('=')) ??
  (args.includes(flag) ? args[args.indexOf(flag) + 1] ?? fallback : fallback)

const URL          = arg('--url',          'http://localhost:3000')
const SIZE         = arg('--size',         'small') as 'small' | 'medium' | 'large'
const BOT_DURATION = parseInt(arg('--bot-duration', '30'))
const HEADLESS     = args.includes('--headless')
const ERRORS_ONLY  = args.includes('--errors-only')

// ── ANSI ──────────────────────────────────────────────────────────────────────
const C = { reset: '\x1b[0m', bold: '\x1b[1m', green: '\x1b[32m', red: '\x1b[31m',
            yellow: '\x1b[33m', cyan: '\x1b[36m', gray: '\x1b[90m', white: '\x1b[97m' }
const log  = (m: string) => console.log(`  ${C.cyan}·${C.reset} ${m}`)
const ok   = (m: string) => console.log(`  ${C.green}✓${C.reset} ${m}`)
const err  = (m: string) => console.log(`  ${C.red}✗${C.reset} ${C.bold}${m}${C.reset}`)
const info = (m: string) => console.log(`${C.yellow}▸${C.reset} ${m}`)

// ── Bot movement ──────────────────────────────────────────────────────────────
const BOT_PATTERNS: { keys: string[]; ms: number }[] = [
  { keys: ['w'],      ms: 900 },
  { keys: ['d'],      ms: 600 },
  { keys: ['w'],      ms: 1100 },
  { keys: ['a'],      ms: 700 },
  { keys: ['s'],      ms: 500 },
  { keys: ['w','d'],  ms: 950 },
  { keys: ['s','a'],  ms: 700 },
  { keys: ['d'],      ms: 1200 },
  { keys: ['w'],      ms: 600 },
  { keys: ['a'],      ms: 800 },
  { keys: ['s'],      ms: 1000 },
]

async function botWalk(page: Page, durationMs: number) {
  info(`Bot walking for ${durationMs / 1000}s…`)
  const end = Date.now() + durationMs
  let patIdx = 0
  try {
    while (Date.now() < end) {
      const pat = BOT_PATTERNS[patIdx % BOT_PATTERNS.length]
      for (const k of pat.keys) await page.keyboard.down(k)
      const holdMs = Math.min(pat.ms, end - Date.now())
      if (holdMs > 0) await page.waitForTimeout(holdMs)
      for (const k of pat.keys) await page.keyboard.up(k)
      await page.waitForTimeout(80)
      patIdx++
    }
  } catch {
    // browser was closed mid-walk — that's fine, just stop
  }
}

// ── Helper: click a button whose visible text matches a pattern ───────────────
async function clickBtn(page: Page, pattern: RegExp, timeoutMs = 5000) {
  const btn = page.locator('button').filter({ hasText: pattern }).first()
  await btn.waitFor({ state: 'visible', timeout: timeoutMs })
  await btn.click()
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${C.bold}${C.white}╔══════════════════════════════════════╗`)
  console.log(`║   benilike  E2E  show  runner         ║`)
  console.log(`╚══════════════════════════════════════╝${C.reset}`)
  console.log(`  url=${C.cyan}${URL}${C.reset}  size=${C.cyan}${SIZE}${C.reset}  headless=${C.cyan}${HEADLESS}${C.reset}  bot=${C.cyan}${BOT_DURATION}s${C.reset}\n`)

  // ── Launch browser ──────────────────────────────────────────────────────────
  info('Launching browser…')
  let browser: Browser
  try {
    browser = await chromium.launch({
      headless: HEADLESS,
      args: ['--no-sandbox'],
      slowMo: HEADLESS ? 0 : 50,
    })
  } catch (e) {
    err(`Could not launch browser: ${(e as Error).message}`)
    process.exit(1)
  }
  ok('Browser launched')

  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page    = await context.newPage()

  // ── Console / error forwarding ──────────────────────────────────────────────
  const consoleErrors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      // Ignore 404s for known dev assets (favicon, hot-reload pings, etc.)
      const text = msg.text()
      if (/favicon|\.hot-update\.|sockjs|404 \(Not Found\)/.test(text)) return
      consoleErrors.push(text)
      err(`[console.error] ${text}`)
    } else if (!ERRORS_ONLY) {
      const pre = msg.type() === 'warning' ? `${C.yellow}warn${C.reset}` : `${C.gray}log ${C.reset}`
      const text = msg.text().replace(/%c[^%]*/g, '').trim()
      if (text) console.log(`  [${pre}] ${text.slice(0, 120)}`)
    }
  })
  page.on('pageerror', e => {
    consoleErrors.push(e.message)
    err(`[page error] ${e.message}`)
  })

  // ── Navigate ────────────────────────────────────────────────────────────────
  info(`Navigating to ${URL}…`)
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 10_000 })
  } catch (e) {
    err(`Could not reach ${URL}: ${(e as Error).message}`)
    err('Is the dev server running?  →  npm run dev')
    await browser.close()
    process.exit(1)
  }
  ok('Page loaded')

  // ── Main Menu: press N to go to New Game ────────────────────────────────────
  info('Opening New Game screen…')
  await page.waitForTimeout(400)          // let boot animation settle
  await page.keyboard.press('n')
  ok('Navigated to New Game')

  // ── New Game: fill room name ────────────────────────────────────────────────
  await page.waitForTimeout(300)
  const nameInput = page.locator('input[type="text"]').first()
  if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await nameInput.selectText().catch(() => {})
    await nameInput.fill(`show-${Date.now().toString(36)}`)
    ok('Room name filled')
  }

  // ── New Game: select map size ───────────────────────────────────────────────
  const sizeLabel = SIZE.toUpperCase()
  const sizeBtn = page.locator('button').filter({ hasText: new RegExp(`^${sizeLabel}`) }).first()
  if (await sizeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await sizeBtn.click()
    ok(`Map size: ${sizeLabel}`)
  }

  // ── New Game: click [ CREATE ROOM ] ────────────────────────────────────────
  info('Creating room…')
  await clickBtn(page, /CREATE ROOM/)
  ok('Room created — waiting for code…')

  // ── New Game: click [ OPEN LOBBY ] once code appears ───────────────────────
  await clickBtn(page, /OPEN LOBBY/, 10_000)
  ok('Lobby opened')

  // ── Lobby: click [ START GAME ] ────────────────────────────────────────────
  info('Starting game…')
  await page.waitForTimeout(500)
  await clickBtn(page, /START GAME/, 8000)
  ok('Game started')

  // ── Briefing: click LET'S GO button ────────────────────────────────────────
  info('Waiting for briefing…')
  try {
    await clickBtn(page, /LET'S GO|LETS GO/, 15_000)
    ok('Briefing dismissed')
  } catch {
    log('Briefing not found or already passed')
  }
  await page.waitForTimeout(1500)

  // ── In game world ───────────────────────────────────────────────────────────
  ok('In game world!')
  const screenshotPath = `/tmp/benilike-e2e-${Date.now()}.png`
  await page.screenshot({ path: screenshotPath }).catch(() => {})
  ok(`Screenshot: ${screenshotPath}`)

  // ── Bot walk ────────────────────────────────────────────────────────────────
  if (BOT_DURATION > 0 && !HEADLESS) {
    await page.mouse.click(640, 400)
    await botWalk(page, BOT_DURATION * 1000)
    const finalPath = `/tmp/benilike-e2e-final-${Date.now()}.png`
    await page.screenshot({ path: finalPath }).catch(() => {})
    ok(`Final screenshot: ${finalPath}`)
  } else if (BOT_DURATION > 0) {
    // headless — run bot and capture
    await page.mouse.click(640, 400)
    await botWalk(page, BOT_DURATION * 1000)
    const finalPath = `/tmp/benilike-e2e-final-${Date.now()}.png`
    await page.screenshot({ path: finalPath }).catch(() => {})
    ok(`Final screenshot: ${finalPath}`)
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`\n${C.bold}${'─'.repeat(44)}${C.reset}`)
  if (consoleErrors.length === 0) {
    console.log(`${C.green}${C.bold}  ALL CLEAR${C.reset} — no console errors detected`)
  } else {
    console.log(`${C.red}${C.bold}  ${consoleErrors.length} CONSOLE ERROR(S)${C.reset} captured above`)
    process.exitCode = 1
  }
  console.log()

  if (!HEADLESS) {
    info('Browser stays open — close it or press Ctrl+C to exit')
    await new Promise<void>(resolve => {
      browser.on('disconnected', (_b: unknown) => resolve())
    })
  }

  await browser.close().catch(() => {})
}

main().catch(e => {
  err(`Fatal: ${(e as Error).message}`)
  process.exit(1)
})
