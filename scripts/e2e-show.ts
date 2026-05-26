/**
 * benilike E2E show runner
 *
 * Automates the full game flow in a real Chromium window so you can watch
 * everything work end-to-end.  Two modes:
 *
 *   PLAY mode (default)
 *     You become a human player in a game with bots.  The script walks your
 *     character around the office for --duration seconds.
 *
 *   SPECTATE mode  (--spectate)
 *     Fills the game with bots and joins as a silent observer.  Great for
 *     verifying bot AI, task completion, meetings, and retros without needing
 *     to do anything yourself.
 *
 * Usage:
 *   npm run show                              play mode · medium · 5 bots · 60 s
 *   npm run show -- --spectate                all-bots game · watch 90 s
 *   npm run show -- --spectate --duration 120 watch for 2 minutes
 *   npm run show -- --size small              small map
 *   npm run show -- --size large              large map
 *   npm run show -- --bots 3                  3 bots in play mode (ignored for --spectate)
 *   npm run show -- --players 8               max 8 players
 *   npm run show -- --duration 45             walk / watch for 45 s
 *   npm run show -- --headless                no window (CI / screenshot mode)
 *   npm run show -- --errors-only             suppress non-error console output
 *   npm run show -- --debug                   verbose: WS messages + screen events
 *   npm run show -- --url http://localhost:3000
 *
 * Prerequisite: npm run dev must be running (client + server).
 */

import { chromium, Browser, Page } from 'playwright'

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)

function argVal(flag: string, fallback = ''): string {
  const eqIdx = args.findIndex(a => a.startsWith(`${flag}=`))
  if (eqIdx !== -1) return args[eqIdx].split('=').slice(1).join('=')
  const idx = args.indexOf(flag)
  if (idx !== -1 && idx + 1 < args.length && !args[idx + 1].startsWith('--')) return args[idx + 1]
  return fallback
}

const URL         = argVal('--url',     'http://localhost:3000')
const SIZE        = argVal('--size',    'medium') as 'small' | 'medium' | 'large'
const BOTS        = parseInt(argVal('--bots',    '5'))
const PLAYERS     = parseInt(argVal('--players', '6'))
const SPECTATE    = args.includes('--spectate')
const HEADLESS    = args.includes('--headless')
const ERRORS_ONLY = args.includes('--errors-only')
const DEBUG       = args.includes('--debug')
const DURATION    = parseInt(argVal('--duration', SPECTATE ? '90' : '60'))

// ── ANSI colour helpers ───────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', gray: '\x1b[90m', white: '\x1b[97m',
  magenta: '\x1b[35m', orange: '\x1b[38;5;208m',
}
const log  = (m: string) => console.log(`  ${C.cyan}·${C.reset} ${m}`)
const ok   = (m: string) => console.log(`  ${C.green}✓${C.reset} ${m}`)
const warn = (m: string) => console.log(`  ${C.yellow}!${C.reset} ${m}`)
const err  = (m: string) => console.log(`  ${C.red}✗${C.reset} ${C.bold}${m}${C.reset}`)
const info = (m: string) => console.log(`${C.yellow}▸${C.reset} ${m}`)
const dbg  = (m: string) => { if (DEBUG) console.log(`  ${C.magenta}[DBG]${C.reset} ${m}`) }

// ── In-browser debug spy (WebSocket + screen observer) ───────────────────────
const DEBUG_INIT_SCRIPT = `
(function () {
  if (window.__beniDebugInstalled) return
  window.__beniDebugInstalled = true

  // WebSocket message spy
  const OrigWS = window.WebSocket
  window.WebSocket = function (url, proto) {
    const ws = new OrigWS(url, proto)
    ws.addEventListener('message', ev => {
      try {
        if (ev.data instanceof ArrayBuffer)
          console.debug('[WS\u2190] binary ' + ev.data.byteLength + 'B')
        else
          console.debug('[WS\u2190] ' + String(ev.data).slice(0, 200))
      } catch {}
    })
    const origSend = ws.send.bind(ws)
    ws.send = function (data) {
      try {
        if (data instanceof ArrayBuffer)
          console.debug('[WS\u2192] binary ' + data.byteLength + 'B')
        else
          console.debug('[WS\u2192] ' + String(data).slice(0, 200))
      } catch {}
      return origSend(data)
    }
    return ws
  }
  Object.assign(window.WebSocket, OrigWS)

  // Screen observer — watches for characteristic elements per screen
  const SCREENS = [
    { name: 'MainMenu',  sel: '[class*="menuItem"]' },
    { name: 'NewGame',   sel: '[class*="formGrid"]' },
    { name: 'Lobby',     sel: '[class*="lobbyLayout"]' },
    { name: 'Briefing',  sel: '[class*="briefingOverlay"]' },
    { name: 'Meeting',   sel: '[class*="meetingOverlay"]' },
    { name: 'GameEnd',   sel: '[class*="endCard"]' },
    { name: 'Game',      sel: 'canvas' },
  ]
  let lastScreen = ''
  const obs = new MutationObserver(() => {
    for (const { name, sel } of SCREENS) {
      if (document.querySelector(sel)) {
        if (lastScreen !== name) {
          lastScreen = name
          console.debug('[SCREEN] \u2192 ' + name + '  @' + performance.now().toFixed(0) + 'ms')
        }
        return
      }
    }
  })
  const start = () => obs.observe(document.body, { childList: true, subtree: true })
  document.body ? start() : document.addEventListener('DOMContentLoaded', start)
})()
`

// ── Walk patterns for player mode ─────────────────────────────────────────────
const WALK_PATTERNS: { keys: string[]; ms: number }[] = [
  { keys: ['w'],      ms: 900 },
  { keys: ['d'],      ms: 600 },
  { keys: ['w'],      ms: 1100 },
  { keys: ['a'],      ms: 700 },
  { keys: ['s'],      ms: 500 },
  { keys: ['w', 'd'], ms: 950 },
  { keys: ['s', 'a'], ms: 700 },
  { keys: ['d'],      ms: 1200 },
  { keys: ['w'],      ms: 600 },
  { keys: ['a'],      ms: 800 },
  { keys: ['s'],      ms: 1000 },
  { keys: ['w'],      ms: 800 },
  { keys: ['d'],      ms: 500 },
  { keys: ['w', 'a'], ms: 850 },
]

// ── Helper: click first visible button matching a regex ───────────────────────
async function clickBtn(page: Page, pattern: RegExp, timeoutMs = 8000) {
  const btn = page.locator('button').filter({ hasText: pattern }).first()
  await btn.waitFor({ state: 'visible', timeout: timeoutMs })
  await btn.click()
}

// ── Helper: is a meeting or retro screen currently showing? ───────────────────
async function isMeetingActive(page: Page): Promise<boolean> {
  return page.locator('[class*="meetingOverlay"]').isVisible().catch(() => false)
}

// ── Set bot count via the +/− buttons in NewGameScreen ───────────────────────
async function setBotCount(page: Page, target: number) {
  const minus = page.locator('button').filter({ hasText: /^−$/ }).first()
  const plus  = page.locator('button').filter({ hasText: /^\+$/ }).first()
  if (!(await minus.isVisible({ timeout: 2000 }).catch(() => false))) {
    warn('Bot +/− buttons not found — skipping bot count adjustment')
    return
  }
  // Always reset to 0 first, then build up to target
  for (let i = 0; i < 9; i++) { await minus.click(); await page.waitForTimeout(40) }
  for (let i = 0; i < Math.min(target, 9); i++) { await plus.click(); await page.waitForTimeout(40) }
  ok(`Bot count → ${target}`)
}

// ── Walk loop (play mode) — pauses during meetings/retros ─────────────────────
async function walkLoop(page: Page, durationMs: number) {
  info(`Walking for ${durationMs / 1000}s (WASD)…`)
  await page.mouse.click(720, 450)   // focus canvas

  const end = Date.now() + durationMs
  let patIdx = 0
  let meetingLogged = false

  try {
    while (Date.now() < end) {
      if (await isMeetingActive(page)) {
        if (!meetingLogged) {
          log('All-hands meeting/retro detected — pausing movement until it ends…')
          meetingLogged = true
        }
        await page.waitForTimeout(1500)
        continue
      }
      meetingLogged = false

      const pat = WALK_PATTERNS[patIdx % WALK_PATTERNS.length]
      for (const k of pat.keys) await page.keyboard.down(k)
      const holdMs = Math.min(pat.ms, end - Date.now())
      if (holdMs > 0) await page.waitForTimeout(holdMs)
      for (const k of pat.keys) await page.keyboard.up(k)
      await page.waitForTimeout(60)
      patIdx++
    }
  } catch {
    // Browser closed mid-walk — that's fine
  }
  ok('Walk complete')
}

// ── Watch loop (spectate mode) — periodic screenshots ─────────────────────────
async function watchLoop(page: Page, durationMs: number) {
  info(`Watching for ${durationMs / 1000}s…`)
  const end       = Date.now() + durationMs
  const snapEvery = 20_000
  let nextSnap    = Date.now() + snapEvery
  let snapIdx     = 0

  try {
    while (Date.now() < end) {
      if (await isMeetingActive(page)) {
        log('Meeting/retro in progress — observing…')
        await page.waitForTimeout(3000)
        continue
      }
      if (Date.now() >= nextSnap) {
        snapIdx++
        const path = `/tmp/benilike-spectate-${snapIdx}-${Date.now()}.png`
        await page.screenshot({ path }).catch(() => {})
        log(`Snapshot ${snapIdx}: ${path}`)
        nextSnap = Date.now() + snapEvery
      }
      await page.waitForTimeout(1000)
    }
  } catch {
    // Browser closed — fine
  }
  ok('Watch complete')
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const modeLabel = SPECTATE ? `${C.orange}SPECTATE${C.reset}` : `${C.cyan}PLAY${C.reset}`
  console.log(`\n${C.bold}${C.white}╔══════════════════════════════════════════╗`)
  console.log(`║   benilike  E2E  show  runner              ║`)
  console.log(`╚══════════════════════════════════════════╝${C.reset}`)
  console.log(`  mode=${modeLabel}  size=${C.cyan}${SIZE}${C.reset}  players=${C.cyan}${PLAYERS}${C.reset}  bots=${C.cyan}${SPECTATE ? PLAYERS - 1 : BOTS}${C.reset}  duration=${C.cyan}${DURATION}s${C.reset}  headless=${C.cyan}${HEADLESS}${C.reset}\n`)

  // ── Launch ────────────────────────────────────────────────────────────────
  info('Launching browser…')
  let browser: Browser
  try {
    browser = await chromium.launch({
      headless: HEADLESS,
      args: ['--no-sandbox'],
      slowMo: HEADLESS ? 0 : 40,
    })
  } catch (e) {
    err(`Could not launch browser: ${(e as Error).message}`)
    err('Install Playwright browsers:  npx playwright install chromium')
    process.exit(1)
  }
  ok('Browser launched')

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page    = await context.newPage()

  if (DEBUG) {
    await context.addInitScript(DEBUG_INIT_SCRIPT)
    dbg('In-browser WS spy + screen observer installed')
  }

  const consoleErrors: string[] = []
  page.on('console', msg => {
    const text = msg.text().replace(/%c[^%]*/g, '').trim()
    if (!text) return
    if (msg.type() === 'error') {
      if (/favicon|\.hot-update\.|sockjs|404 \(Not Found\)|ResizeObserver/.test(text)) return
      consoleErrors.push(text)
      err(`[console.error] ${text}`)
    } else if (msg.type() === 'debug') {
      dbg(text.slice(0, 200))
    } else if (!ERRORS_ONLY) {
      const pre = msg.type() === 'warning' ? `${C.yellow}warn${C.reset}` : `${C.gray}log ${C.reset}`
      console.log(`  [${pre}] ${text.slice(0, 140)}`)
    }
  })
  page.on('pageerror', e => { consoleErrors.push(e.message); err(`[page error] ${e.message}`) })

  // ── Navigate to app ────────────────────────────────────────────────────────
  info(`Navigating to ${URL}…`)
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 12_000 })
  } catch (e) {
    err(`Could not reach ${URL}: ${(e as Error).message}`)
    err('Is the dev server running?  →  npm run dev')
    await browser.close()
    process.exit(1)
  }
  ok('Page loaded')

  // ── Main menu → New Game screen ───────────────────────────────────────────
  info('Waiting for main menu…')
  await page.locator('[class*="menuItem"]').first().waitFor({ state: 'visible', timeout: 8000 })
  ok('Main menu ready')
  dbg('pressing N → new-game')
  await page.keyboard.press('n')
  await page.locator('[class*="formGrid"]').waitFor({ state: 'visible', timeout: 5000 })
  ok('New Game screen open')

  // ── Configure game ─────────────────────────────────────────────────────────
  // Map size
  const sizeBtn = page.locator('button').filter({ hasText: new RegExp(`^${SIZE.toUpperCase()}`) }).first()
  if (await sizeBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await sizeBtn.click()
    ok(`Map size: ${SIZE.toUpperCase()}`)
  }

  // Max players (adjust the first range slider)
  const sliders = page.locator('input[type="range"]')
  if (await sliders.first().isVisible({ timeout: 1500 }).catch(() => false)) {
    const clampedPlayers = Math.min(10, Math.max(4, PLAYERS))
    await sliders.first().evaluate((el: { value: string; dispatchEvent: (e: Event) => void }, val: number) => {
      el.value = String(val)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, clampedPlayers)
    ok(`Max players: ${clampedPlayers}`)
  }

  if (SPECTATE) {
    // Toggle spectate mode — bots auto-fill all non-host slots
    await clickBtn(page, /SPECTATE MODE/, 3000)
    ok('Spectate mode ON')
    log(`${PLAYERS - 1} bots will fill the game, you will observe`)
  } else {
    await setBotCount(page, Math.min(BOTS, PLAYERS - 1))
  }

  // ── Create room ─────────────────────────────────────────────────────────────
  info('Creating room…')
  await clickBtn(page, /CREATE ROOM/)

  // Room code appears → server connection confirmed
  await page.locator('[class*="roomCode"]').first().waitFor({ state: 'visible', timeout: 12_000 })
  ok('Room created')

  // NewGameScreen auto-navigates to lobby after 1800 ms — wait for it
  info('Waiting for lobby (auto-navigate in ~1.8 s)…')
  await page.locator('[class*="lobbyLayout"]').waitFor({ state: 'visible', timeout: 10_000 })
  ok('Lobby open')

  // Bots connect almost instantly; give them a moment
  await page.waitForTimeout(1200)

  // ── Start game ─────────────────────────────────────────────────────────────
  info('Starting game…')
  await clickBtn(page, /START GAME/, 8000)
  ok('START GAME sent to server')

  if (SPECTATE) {
    // ─── SPECTATE PATH ──────────────────────────────────────────────────────
    // LobbyScreen detects isSpectator → navigates to 'spectator' (canvas).
    info('Waiting for spectator view…')
    await page.locator('canvas').waitFor({ state: 'visible', timeout: 15_000 })
    ok('Spectator screen active!')

    // Give the 3D world a moment to fully load, then try to follow the first bot
    await page.waitForTimeout(1800)
    // The spectator panel lists players; click the first one to follow
    try {
      const firstEntry = page.locator('div').filter({ hasText: /[A-Z][a-z]+ [A-Z][a-z]+/ }).first()
      if (await firstEntry.isVisible({ timeout: 2000 })) {
        await firstEntry.click()
        log('Clicked first player entry to follow')
      }
    } catch { /* panel might not be open yet */ }

    const openPath = `/tmp/benilike-spectate-open-${Date.now()}.png`
    await page.screenshot({ path: openPath }).catch(() => {})
    ok(`Opening screenshot: ${openPath}`)

    await watchLoop(page, DURATION * 1000)

  } else {
    // ─── PLAY PATH ─────────────────────────────────────────────────────────
    // BriefingScreen auto-dismisses after 10 s countdown; try clicking early
    info('Waiting for briefing…')
    try {
      await page.locator('[class*="briefingOverlay"]').waitFor({ state: 'visible', timeout: 12_000 })
      ok("Briefing screen — clicking LET'S GO")
      await clickBtn(page, /LET.?S GO/, 12_000)
    } catch {
      warn('Briefing not detected — it may have auto-dismissed, continuing…')
    }

    await page.locator('canvas').waitFor({ state: 'visible', timeout: 12_000 })
    await page.waitForTimeout(600)
    ok('In game world!')

    const openPath = `/tmp/benilike-play-open-${Date.now()}.png`
    await page.screenshot({ path: openPath }).catch(() => {})
    ok(`Opening screenshot: ${openPath}`)

    await walkLoop(page, DURATION * 1000)
  }

  // ── Final screenshot ────────────────────────────────────────────────────────
  const finalPath = `/tmp/benilike-final-${Date.now()}.png`
  await page.screenshot({ path: finalPath }).catch(() => {})
  ok(`Final screenshot: ${finalPath}`)

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`\n${C.bold}${'─'.repeat(46)}${C.reset}`)
  if (consoleErrors.length === 0) {
    console.log(`${C.green}${C.bold}  ALL CLEAR${C.reset} — no console errors detected`)
  } else {
    console.log(`${C.red}${C.bold}  ${consoleErrors.length} CONSOLE ERROR(S)${C.reset} captured above`)
    process.exitCode = 1
  }
  console.log()

  if (!HEADLESS) {
    info('Browser stays open — close the window or press Ctrl+C to exit')
    await new Promise<void>(resolve => { browser.on('disconnected', () => resolve()) })
  }

  await browser.close().catch(() => {})
}

main().catch(e => {
  err(`Fatal: ${(e as Error).message}`)
  process.exit(1)
})

