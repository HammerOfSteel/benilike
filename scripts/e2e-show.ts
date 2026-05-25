/**
 * benilike E2E show runner
 *
 * Launches a visible Chromium browser, automates the full game flow,
 * and optionally runs a bot that walks around so you can see the map.
 *
 * Usage:
 *   npm run show                           → default: non-headless, solo mode, small map
 *   npm run show -- --headless             → run without window (CI mode)
 *   npm run show -- --size medium          → medium map
 *   npm run show -- --seed "mySeed"        → custom seed (server must be running)
 *   npm run show -- --bot-duration 60      → run bot for 60 seconds (default 30)
 *   npm run show -- --url http://localhost:3000
 *   npm run show -- --errors-only          → print only console errors
 *
 * Prerequisite: npm run dev must be running (client + server)
 */

import { chromium, Browser, Page } from 'playwright'

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const arg  = (flag: string, fallback = '') =>
  (args.find(a => a.startsWith(`${flag}=`))?.split('=').slice(1).join('=')) ??
  (args.includes(flag) ? args[args.indexOf(flag) + 1] ?? fallback : fallback)

const URL          = arg('--url',          'http://localhost:3000')
const SIZE         = arg('--size',         'small')
const SEED         = arg('--seed',         '')
const BOT_DURATION = parseInt(arg('--bot-duration', '30'))
const HEADLESS     = args.includes('--headless')
const ERRORS_ONLY  = args.includes('--errors-only')
const ROOM_NAME    = `show-${Date.now().toString(36)}`

// ── ANSI ──────────────────────────────────────────────────────────────────────
const C = { reset: '\x1b[0m', bold: '\x1b[1m', green: '\x1b[32m', red: '\x1b[31m',
            yellow: '\x1b[33m', cyan: '\x1b[36m', gray: '\x1b[90m', white: '\x1b[97m' }
const log  = (m: string) => console.log(`  ${C.cyan}·${C.reset} ${m}`)
const ok   = (m: string) => console.log(`  ${C.green}✓${C.reset} ${m}`)
const err  = (m: string) => console.log(`  ${C.red}✗${C.reset} ${C.bold}${m}${C.reset}`)
const info = (m: string) => console.log(`${C.yellow}▸${C.reset} ${m}`)

// ── Bot movement (WASD pattern) ───────────────────────────────────────────────
const BOT_PATTERNS: { keys: string[]; ms: number }[] = [
  { keys: ['w'],        ms: 800 },
  { keys: ['d'],        ms: 600 },
  { keys: ['w'],        ms: 1000 },
  { keys: ['a'],        ms: 700 },
  { keys: ['s'],        ms: 500 },
  { keys: ['w', 'd'],   ms: 900 },
  { keys: ['s', 'a'],   ms: 700 },
  { keys: ['d'],        ms: 1200 },
  { keys: ['w'],        ms: 600 },
  { keys: ['a'],        ms: 800 },
  { keys: ['s'],        ms: 1000 },
]

async function botWalk(page: Page, durationMs: number) {
  info(`Bot walking for ${durationMs / 1000}s…`)
  const end = Date.now() + durationMs
  let patIdx = 0
  while (Date.now() < end) {
    const pat = BOT_PATTERNS[patIdx % BOT_PATTERNS.length]
    // Hold the keys
    for (const k of pat.keys) await page.keyboard.down(k)
    const holdMs = Math.min(pat.ms, end - Date.now())
    await page.waitForTimeout(holdMs)
    for (const k of pat.keys) await page.keyboard.up(k)
    await page.waitForTimeout(80)
    patIdx++
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${C.bold}${C.white}╔══════════════════════════════════════╗`)
  console.log(`║   benilike  E2E  show  runner         ║`)
  console.log(`╚══════════════════════════════════════╝${C.reset}`)
  console.log(`  url=${C.cyan}${URL}${C.reset}  size=${C.cyan}${SIZE}${C.reset}  headless=${C.cyan}${HEADLESS}${C.reset}  bot=${C.cyan}${BOT_DURATION}s${C.reset}`)
  console.log()

  // ── Launch browser ──────────────────────────────────────────────────────────
  info('Launching browser…')
  let browser: Browser
  try {
    browser = await chromium.launch({
      headless: HEADLESS,
      args: ['--no-sandbox', '--disable-web-security'],
      slowMo: HEADLESS ? 0 : 60,
    })
  } catch (e) {
    err(`Could not launch browser: ${(e as Error).message}`)
    process.exit(1)
  }
  ok('Browser launched')

  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page    = await context.newPage()

  // ── Console + error capture ─────────────────────────────────────────────────
  const consoleErrors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
      err(`[console.error] ${msg.text()}`)
    } else if (!ERRORS_ONLY) {
      const pre = msg.type() === 'warn' ? `${C.yellow}warn${C.reset}` : `${C.gray}log ${C.reset}`
      console.log(`  [${pre}] ${msg.text().slice(0, 120)}`)
    }
  })
  page.on('pageerror', e => {
    consoleErrors.push(e.message)
    err(`[page error] ${e.message}`)
    if (e.stack) console.error(C.gray + e.stack + C.reset)
  })
  page.on('requestfailed', req => {
    const fail = req.failure()?.errorText
    if (fail && !fail.includes('net::ERR_CONNECTION_REFUSED')) {
      err(`[req failed] ${req.url()} — ${fail}`)
    }
  })

  // ── Navigate ────────────────────────────────────────────────────────────────
  info(`Navigating to ${URL}…`)
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 10_000 })
  } catch (e) {
    err(`Could not reach ${URL}: ${(e as Error).message}`)
    err('Is the dev server running? Try: npm run dev')
    await browser.close()
    process.exit(1)
  }
  ok('Page loaded')

  // ── Click "New Game" ────────────────────────────────────────────────────────
  info('Looking for New Game button…')
  try {
    await page.getByRole('button', { name: /new game/i }).click({ timeout: 5000 })
    ok('Clicked New Game')
  } catch {
    // Try any button containing "new" or "create"
    const btn = page.locator('button').filter({ hasText: /new|create|start/i }).first()
    await btn.click({ timeout: 3000 })
    ok('Clicked first matching button')
  }

  // ── Fill room settings ──────────────────────────────────────────────────────
  await page.waitForTimeout(500)
  info('Filling room settings…')

  // Room name
  const nameInput = page.locator('input[placeholder*="room" i], input[name*="room" i], input[type="text"]').first()
  if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await nameInput.fill(ROOM_NAME)
    ok(`Room name: ${ROOM_NAME}`)
  }

  // Map size selector
  const sizeOpts = page.locator(`[value="${SIZE}"], option[value="${SIZE}"]`)
  if (await sizeOpts.first().isVisible({ timeout: 1000 }).catch(() => false)) {
    await sizeOpts.first().click()
    ok(`Map size: ${SIZE}`)
  } else {
    // Try select element
    const sel = page.locator('select').first()
    if (await sel.isVisible({ timeout: 1000 }).catch(() => false)) {
      await sel.selectOption(SIZE)
      ok(`Map size via select: ${SIZE}`)
    }
  }

  // ── Create / host the room ──────────────────────────────────────────────────
  info('Creating room…')
  const createBtn = page.getByRole('button', { name: /create|host|start/i }).first()
  await createBtn.click({ timeout: 5000 })
  ok('Room created')

  // ── Wait for lobby ──────────────────────────────────────────────────────────
  await page.waitForTimeout(1000)
  info('In lobby — starting game…')

  // Click "Start Game" in lobby
  const startBtn = page.getByRole('button', { name: /start game|begin|launch/i }).first()
  try {
    await startBtn.click({ timeout: 5000 })
    ok('Started game')
  } catch {
    err('Could not find Start Game button — may need manual interaction')
  }

  // ── Wait for briefing / game screen ────────────────────────────────────────
  info('Waiting for game to load…')
  await page.waitForTimeout(3000)

  // Detect if we're on briefing screen (skip button or auto-advance)
  const skipBtn = page.getByRole('button', { name: /skip|ready|ok|continue/i }).first()
  if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipBtn.click()
    ok('Skipped briefing')
    await page.waitForTimeout(1000)
  } else {
    log('Waiting for briefing auto-advance (10s)…')
    await page.waitForTimeout(10_500)
  }

  ok('In game world')

  // ── Capture screenshot ──────────────────────────────────────────────────────
  const screenshotPath = `/tmp/benilike-e2e-${Date.now()}.png`
  await page.screenshot({ path: screenshotPath })
  ok(`Screenshot saved: ${screenshotPath}`)

  // ── Bot walk ────────────────────────────────────────────────────────────────
  if (BOT_DURATION > 0) {
    await page.mouse.click(640, 400)   // focus canvas
    await botWalk(page, BOT_DURATION * 1000)
  }

  // ── Final screenshot ────────────────────────────────────────────────────────
  const finalPath = `/tmp/benilike-e2e-final-${Date.now()}.png`
  await page.screenshot({ path: finalPath })
  ok(`Final screenshot: ${finalPath}`)

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`\n${C.bold}${'─'.repeat(44)}${C.reset}`)
  if (consoleErrors.length === 0) {
    console.log(`${C.green}${C.bold}  NO ERRORS${C.reset} — ${BOT_DURATION}s bot walk complete`)
  } else {
    console.log(`${C.red}${C.bold}  ${consoleErrors.length} CONSOLE ERROR(S)${C.reset} captured above`)
    process.exitCode = 1
  }
  console.log()

  if (!HEADLESS) {
    info(`Browser stays open — close it manually or press Ctrl+C here`)
    // Keep the process alive so user can see the game
    await new Promise(resolve => setTimeout(resolve, 600_000))
  }

  await browser.close()
}

main().catch(e => {
  err(`Fatal: ${e.message}`)
  if (e.stack) console.error(C.gray + e.stack + C.reset)
  process.exit(1)
})
