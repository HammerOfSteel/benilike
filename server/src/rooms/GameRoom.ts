import { Room, Client } from 'colyseus'
import { GameState, Player } from './GameState'
import {
  WORKFORCE_ROLES,
  OPPOSITION_ROLES,
  ABILITY_COOLDOWNS_MS,
  type PlayerRole,
  type RoomOptions,
} from '../../../shared/src/types'

const OPPOSITION_RATIO = 0.25

const BOT_NAMES = [
  'AGENT-7', 'UNIT-X', 'PROTO-9', 'GHOST-3', 'SIGMA-1',
  'DELTA-4', 'ECHO-2', 'ZETA-6', 'OMEGA-8', 'KILO-5',
]

interface ActiveEffects {
  hotfixUntil:     number   // DevOps: 2x repair speed
  speedBoostUntil: number   // Management: +30% move speed (broadcast to clients)
  frozenUntil:     number   // Finance: opposition cooldowns x2
  marketingUntil:  number   // Marketing: opposition hack rate halved
  lockdownUntil:   number   // Admin: opposition can't use terminal
  trapActiveUntil: number   // Saboteur: trap triggered, reverses workforce repair
  insiderUsed:     Set<string>
}

export class GameRoom extends Room<GameState> {
  maxClients = 10
  private botCleanup: (() => void) | null = null
  private taskUsers = new Set<string>()
  private abilityCooldowns = new Map<string, number>()
  private effects: ActiveEffects = {
    hotfixUntil:     0,
    speedBoostUntil: 0,
    frozenUntil:     0,
    marketingUntil:  0,
    lockdownUntil:   0,
    trapActiveUntil: 0,
    insiderUsed:     new Set(),
  }

  private botAI = new Map<string, { mode: 'wander' | 'work'; workUntil: number }>()

  onCreate(options: Partial<RoomOptions>) {
    this.setState(new GameState())
    this.state.mapSize  = options.mapSize ?? 'medium'
    this.state.mapSeed  = Math.random().toString(36).slice(2, 8).toUpperCase()

    // ── Message handlers ────────────────────────────────────────────────────

    this.onMessage('move', (client: Client, data: { x: number; z: number; facing?: number }) => {
      const player = this.state.players.get(client.sessionId)
      if (!player) return
      player.x      = data.x
      player.z      = data.z
      player.facing = data.facing ?? player.facing
    })

    this.onMessage('start_game', (client: Client) => {
      const players = Array.from(this.state.players.values())
      const host = players.find(p => !p.isBot)
      if (host?.sessionId !== client.sessionId) return
      if (this.state.phase !== 'waiting') return

      this.state.phase = 'playing'

      // Insiders start disguised as Workforce from game start
      this.state.players.forEach(p => {
        if (p.role === 'insider') p.disguised = true
      })

      this.broadcast('game_start', { seed: this.state.mapSeed, mapSize: this.state.mapSize })
      this.broadcastEffects()
      console.log(`[GameRoom] Game started by ${client.sessionId}`)
    })

    this.onMessage('task_start', (client: Client) => {
      const player = this.state.players.get(client.sessionId)
      if (!player) return
      // Admin lockdown blocks opposition from using terminal
      if (player.faction === 'opposition' && this.effects.lockdownUntil > this.clock.currentTime) {
        client.send('incident', {
          message: 'SERVER ROOM LOCKED — Admin lockdown active',
          severity: 'danger',
          time: timestamp(),
        })
        return
      }
      this.taskUsers.add(client.sessionId)
    })

    this.onMessage('task_stop', (client: Client) => {
      this.taskUsers.delete(client.sessionId)
    })

    this.onMessage('use_ability', (client: Client) => {
      const player = this.state.players.get(client.sessionId)
      if (!player || this.state.phase !== 'playing') return

      const now = this.clock.currentTime
      const baseCd = ABILITY_COOLDOWNS_MS[player.role as PlayerRole] ?? 60_000

      // Finance freeze doubles opposition cooldowns
      const effectiveCd = (player.faction === 'opposition' && this.effects.frozenUntil > now)
        ? baseCd * 2 : baseCd

      const lastUsed = this.abilityCooldowns.get(client.sessionId) ?? 0
      if (now - lastUsed < effectiveCd) return  // still on cooldown

      // Insider: once per match
      if (player.role === 'insider' && this.effects.insiderUsed.has(client.sessionId)) return

      this.abilityCooldowns.set(client.sessionId, now)
      this.broadcast('ability_used', { sessionId: client.sessionId, role: player.role })
      this.executeAbility(player, client.sessionId)
    })

    // ── Task progress tick ───────────────────────────────────────────────────
    this.clock.setInterval(() => {
      if (this.state.phase !== 'playing') return
      const now = this.clock.currentTime
      let changed = false

      // Check if Saboteur trap should trigger (Workforce starts repairing)
      const workforceWorking = Array.from(this.taskUsers).some(sid => {
        const p = this.state.players.get(sid)
        return p?.faction === 'workforce'
      })
      if (workforceWorking && this.state.trapPlanted) {
        this.state.trapPlanted = false
        this.effects.trapActiveUntil = now + 6_000
        this.broadcastEffects()
      }

      const hotfix  = this.effects.hotfixUntil > now
      const trapped = this.effects.trapActiveUntil > now
      const mktBlitz = this.effects.marketingUntil > now

      for (const sid of this.taskUsers) {
        const player = this.state.players.get(sid)
        if (!player) continue
        const rate = hotfix && player.faction === 'workforce' ? 4 : 2
        if (player.faction === 'workforce') {
          this.state.terminalProgress = trapped
            ? Math.max(0,   this.state.terminalProgress - rate)
            : Math.min(100, this.state.terminalProgress + rate)
        } else {
          const hackRate = mktBlitz ? 1 : 2  // Marketing halves hack rate
          this.state.terminalProgress = Math.max(0, this.state.terminalProgress - hackRate)
        }
        changed = true
      }

      if (changed) {
        this.checkEndConditions()
        // Sync lock/trap schema flags
        const effectsChanged =
          (this.state.lockdownActive !== (this.effects.lockdownUntil > now)) ||
          (this.state.trapPlanted !== this.state.trapPlanted) // already synced above
        if (effectsChanged) {
          this.state.lockdownActive = this.effects.lockdownUntil > now
        }
      }
    }, 200)

    // Sync lockdown state every second
    this.clock.setInterval(() => {
      const lockNow = this.effects.lockdownUntil > this.clock.currentTime
      if (this.state.lockdownActive !== lockNow) {
        this.state.lockdownActive = lockNow
        if (!lockNow) this.broadcastEffects() // broadcast when lockdown ends
      }
    }, 1_000)

    const botCount = Math.min(Math.max(0, options.botCount ?? 0), 9)
    if (botCount > 0) this.spawnBots(botCount)

    console.log(`[GameRoom] Created room "${options.roomName ?? 'Office'}" · seed ${this.state.mapSeed} · bots ${botCount}`)
  }

  // ── Ability execution ────────────────────────────────────────────────────────

  private executeAbility(player: Player, sessionId: string) {
    const now = this.clock.currentTime

    switch (player.role as PlayerRole) {

      // Workforce ──────────────────────────────────────────────────

      case 'it':
        this.state.terminalProgress = Math.min(100, this.state.terminalProgress + 20)
        this.checkEndConditions()
        break

      case 'devops':
        this.effects.hotfixUntil = now + 8_000
        this.broadcastEffects()
        this.clock.setTimeout(() => this.broadcastEffects(), 8_000)
        break

      case 'hr': {
        // Reveal non-disguised opposition to all workforce
        const opp = Array.from(this.state.players.values())
          .filter(p => p.faction === 'opposition' && !p.disguised)
          .map(p => ({ sessionId: p.sessionId, x: p.x, z: p.z }))
        this.state.players.forEach((p, sid) => {
          if (p.faction === 'workforce' && p.connected && !p.isBot) {
            const c = this.clients.find(cl => cl.sessionId === sid)
            c?.send('hr_ping', { positions: opp, duration: 5_000 })
          }
        })
        break
      }

      case 'finance':
        this.effects.frozenUntil = now + 10_000
        this.broadcastEffects()
        this.clock.setTimeout(() => this.broadcastEffects(), 10_000)
        break

      case 'marketing':
        this.effects.marketingUntil = now + 8_000
        this.broadcastEffects()
        this.clock.setTimeout(() => this.broadcastEffects(), 8_000)
        break

      case 'admin':
        this.effects.lockdownUntil = now + 12_000
        this.state.lockdownActive  = true
        this.broadcastEffects()
        this.clock.setTimeout(() => {
          this.state.lockdownActive = false
          this.broadcastEffects()
        }, 12_000)
        // Kick out any opposition currently at terminal
        this.state.players.forEach((p, sid) => {
          if (p.faction === 'opposition') this.taskUsers.delete(sid)
        })
        break

      case 'management':
        this.effects.speedBoostUntil = now + 10_000
        this.broadcastEffects()
        this.clock.setTimeout(() => this.broadcastEffects(), 10_000)
        break

      // Opposition ──────────────────────────────────────────────────

      case 'hacker':
        this.state.terminalProgress = Math.max(0, this.state.terminalProgress - 20)
        this.checkEndConditions()
        break

      case 'social_engineer':
        player.disguised = true
        this.clock.setTimeout(() => {
          player.disguised = false
        }, 15_000)
        break

      case 'spy': {
        const wf = Array.from(this.state.players.values())
          .filter(p => p.faction === 'workforce')
          .map(p => ({ sessionId: p.sessionId, x: p.x, z: p.z }))
        this.state.players.forEach((p, sid) => {
          if (p.faction === 'opposition' && p.connected && !p.isBot) {
            const c = this.clients.find(cl => cl.sessionId === sid)
            c?.send('spy_sweep', { positions: wf, duration: 3_000 })
          }
        })
        break
      }

      case 'saboteur':
        this.state.trapPlanted = true
        this.broadcastEffects()
        break

      case 'insider':
        this.effects.insiderUsed.add(sessionId)
        player.disguised     = false    // reveal themselves
        this.effects.lockdownUntil = 0  // bypass any active lockdown
        this.state.lockdownActive  = false
        this.broadcastEffects()
        break
    }
  }

  private broadcastEffects() {
    const now = this.clock.currentTime
    this.broadcast('effect_update', {
      hotfixActive:    this.effects.hotfixUntil > now,
      speedBoostActive: this.effects.speedBoostUntil > now,
      frozenActive:    this.effects.frozenUntil > now,
      marketingActive: this.effects.marketingUntil > now,
      lockdownActive:  this.effects.lockdownUntil > now,
      trapPlanted:     this.state.trapPlanted,
    })
  }

  // ── Bot spawning ─────────────────────────────────────────────────────────────

  private spawnBots(count: number) {
    for (let i = 0; i < count; i++) {
      const bot        = new Player()
      bot.sessionId    = `bot_${i}`
      bot.name         = BOT_NAMES[i] ?? `BOT-${i}`
      bot.isBot        = true
      bot.connected    = true
      bot.x            = (Math.random() - 0.5) * 20
      bot.z            = (Math.random() - 0.5) * 20
      bot.facing       = Math.random() * Math.PI * 2
      this.state.players.set(bot.sessionId, bot)
      this.assignRole(bot)
      this.broadcast('incident', {
        message:  `${bot.name} connected — ${bot.role}/${bot.faction} [BOT]`,
        severity: 'info',
        time:     timestamp(),
      })
    }

    const interval = this.clock.setInterval(() => {
      if (this.state.phase !== 'playing') {
        // Before/after game — just wander
        this.state.players.forEach((p) => {
          if (!p.isBot) return
          p.x      = Math.max(-11.5, Math.min(11.5, p.x + (Math.random() - 0.5) * 3))
          p.z      = Math.max(-15.5, Math.min(9.0,  p.z + (Math.random() - 0.5) * 3))
          p.facing = Math.random() * Math.PI * 2
        })
        return
      }

      const TERM_X = 0, TERM_Z = -11.5, INTERACT_R = 2.0
      const now = this.clock.currentTime

      this.state.players.forEach((p) => {
        if (!p.isBot) return

        let ai = this.botAI.get(p.sessionId) ?? { mode: 'wander' as const, workUntil: 0 }
        const dx = TERM_X - p.x
        const dz = TERM_Z - p.z
        const dist = Math.sqrt(dx * dx + dz * dz)

        if (ai.mode === 'work') {
          if (now > ai.workUntil) {
            // Done — stop working and wander away
            ai.mode = 'wander'
            this.taskUsers.delete(p.sessionId)
            p.x = Math.max(-11.5, Math.min(11.5, p.x + (Math.random() - 0.5) * 5))
            p.z = Math.max(-8.0,  Math.min(9.0,  p.z + 3 + Math.random() * 3))
            p.facing = Math.random() * Math.PI * 2
          } else if (dist > INTERACT_R) {
            // Approaching terminal
            const speed = 2.5
            p.x = Math.max(-11.5, Math.min(11.5, p.x + (dx / dist) * speed))
            p.z = Math.max(-15.5, Math.min(9.0,  p.z + (dz / dist) * speed))
            p.facing = Math.atan2(dx, dz)
          } else {
            // At terminal — register as task user
            this.taskUsers.add(p.sessionId)
            p.facing = Math.atan2(-p.x, TERM_Z - p.z)
          }
        } else {
          // Wander — 25% chance each tick to start working
          if (Math.random() < 0.25) {
            ai.mode = 'work'
            ai.workUntil = now + 5_000 + Math.random() * 10_000
          } else {
            p.x      = Math.max(-11.5, Math.min(11.5, p.x + (Math.random() - 0.5) * 3))
            p.z      = Math.max(-15.5, Math.min(9.0,  p.z + (Math.random() - 0.5) * 3))
            p.facing = Math.random() * Math.PI * 2
          }
        }

        this.botAI.set(p.sessionId, ai)
      })
    }, 2000)

    this.botCleanup = () => interval.clear()
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  onJoin(client: Client, options: { name?: string }) {
    const player = new Player()
    player.sessionId = client.sessionId
    player.name      = (options.name ?? `Operative-${client.sessionId.slice(0, 4)}`).slice(0, 20)
    this.state.players.set(client.sessionId, player)

    this.assignRole(player)
    client.send('role_assigned', { role: player.role, faction: player.faction })

    this.broadcast('incident', {
      message:  `${player.name} connected — ${player.role}/${player.faction}`,
      severity: 'info',
      time:     timestamp(),
    })

    console.log(`[GameRoom] ${player.name} joined as ${player.role} (${player.faction}) — ${this.state.players.size}/${this.maxClients}`)
  }

  async onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId)
    if (!player) return

    player.connected = false

    if (!consented) {
      try {
        await this.allowReconnection(client, 10)
        player.connected = true
        return
      } catch {
        // Reconnection window expired
      }
    }

    this.broadcast('incident', {
      message:  `${player.name} disconnected`,
      severity: 'warn',
      time:     timestamp(),
    })
    this.state.players.delete(client.sessionId)
    this.taskUsers.delete(client.sessionId)
    this.checkEndConditions()
  }

  onDispose() {
    if (this.botCleanup) this.botCleanup()
    console.log(`[GameRoom] ${this.roomId} disposed`)
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private assignRole(player: Player) {
    const all             = Array.from(this.state.players.values())
    const oppositionCount = all.filter(p => p.faction === 'opposition').length
    const total           = all.length

    const assignOpposition = total > 2 && oppositionCount / total < OPPOSITION_RATIO

    if (assignOpposition) {
      player.faction = 'opposition'
      player.role    = OPPOSITION_ROLES[Math.floor(Math.random() * OPPOSITION_ROLES.length)]
    } else {
      player.faction = 'workforce'
      player.role    = WORKFORCE_ROLES[Math.floor(Math.random() * WORKFORCE_ROLES.length)]
    }
  }

  private checkEndConditions() {
    if (this.state.phase !== 'playing') return
    if (this.state.terminalProgress >= 100) {
      this.endGame('workforce', 'Terminal fully repaired')
    } else if (this.state.terminalProgress <= 0) {
      this.endGame('opposition', 'Terminal successfully hacked')
    }
  }

  private endGame(winner: string, reason: string) {
    this.state.phase  = 'ended'
    this.state.winner = winner
    this.broadcast('game_end', { winner, reason })
    console.log(`[GameRoom] Game ended — ${winner} wins: ${reason}`)
    this.clock.setTimeout(() => this.disconnect(), 30_000)
  }
}

function timestamp() {
  return new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}
