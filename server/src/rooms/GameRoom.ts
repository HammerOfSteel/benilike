import { Room, Client } from 'colyseus'
import { GameState, Player } from './GameState'
import {
  WORKFORCE_ROLES,
  OPPOSITION_ROLES,
  TASK_METER_GAIN,
  METER_DEGRADE_INTERVAL_MS,
  RACK_DEGRADE_INTERVAL_MS,
  type PlayerRole,
  type RoomOptions,
  type TaskId,
  type StationInfo,
  type ZoneId,
} from '../../../shared/src/types'
import { TASK_DEFS, assignStations } from '../../../shared/src/tasks'

const OPPOSITION_RATIO = 0.25
const INTERACT_R       = 2.5

const BOT_NAMES = [
  'AGENT-7', 'UNIT-X', 'PROTO-9', 'GHOST-3', 'SIGMA-1',
  'DELTA-4', 'ECHO-2', 'ZETA-6', 'OMEGA-8', 'KILO-5',
]

interface ActiveEffects {
  workforceSpeedUntil:     number
  lockdownUntil:           number
  rackDegradePausedUntil:  number
  ciPipelineUntil:         number
  ciPipelineDisabled:      boolean
  workforceHoldSlowUntil:  number
  hackerCorruptionUntil:   number
  oppositionHoldSlowUntil: number
  extraOppDegradeUntil:    number
  oppMeterGainMultUntil:   number
  oppMeterGainMult:        number
}

interface StationState {
  info:          StationInfo
  disabledUntil: number
  completedBy:   string | null
}

interface HoldState {
  stationId: string
  startedAt: number
  holdMs:    number
}

type BotAI = {
  mode:          'wander' | 'work'
  workUntil:     number
  targetStation: string | null
}

export class GameRoom extends Room<GameState> {
  maxClients = 10
  private botAI     = new Map<string, BotAI>()
  private stations  = new Map<string, StationState>()
  private holdState = new Map<string, HoldState>()
  private effects: ActiveEffects = {
    workforceSpeedUntil:     0,
    lockdownUntil:           0,
    rackDegradePausedUntil:  0,
    ciPipelineUntil:         0,
    ciPipelineDisabled:      false,
    workforceHoldSlowUntil:  0,
    hackerCorruptionUntil:   0,
    oppositionHoldSlowUntil: 0,
    extraOppDegradeUntil:    0,
    oppMeterGainMultUntil:   0,
    oppMeterGainMult:        1.0,
  }

  onCreate(options: Partial<RoomOptions>) {
    this.setState(new GameState())
    this.state.mapSize = options.mapSize ?? 'medium'
    this.state.mapSeed = Math.random().toString(36).slice(2, 8).toUpperCase()

    // ── Message handlers ─────────────────────────────────────────────────────

    this.onMessage('move', (client: Client, data: { x: number; z: number; floor?: number; facing?: number }) => {
      const player = this.state.players.get(client.sessionId)
      if (!player) return
      player.x = data.x
      player.z = data.z
      if (data.floor   !== undefined) player.floor   = data.floor
      if (data.facing  !== undefined) player.facing  = data.facing

      // Cancel hold if player strays too far
      const hold = this.holdState.get(client.sessionId)
      if (hold) {
        const st = this.stations.get(hold.stationId)
        if (st) {
          const dx = data.x - st.info.x
          const dz = data.z - st.info.z
          if (Math.sqrt(dx * dx + dz * dz) > INTERACT_R) {
            this.holdState.delete(client.sessionId)
          }
        }
      }
    })

    this.onMessage('start_game', (client: Client) => {
      const players = Array.from(this.state.players.values())
      const host = players.filter(p => !p.isBot)[0]
      if (host?.sessionId !== client.sessionId) return
      if (this.state.phase !== 'waiting') return

      this.state.phase = 'playing'

      const mapSize = this.state.mapSize as 'small' | 'medium' | 'large'
      const stationList = assignStations(this.state.mapSeed, mapSize, TASK_DEFS)
      for (const info of stationList) {
        this.stations.set(info.stationId, { info, disabledUntil: 0, completedBy: null })
      }

      this.state.players.forEach(p => { if (p.role === 'insider') p.disguised = true })

      this.broadcast('game_start', { seed: this.state.mapSeed, mapSize })
      this.broadcast('station_list', { stations: stationList })
      this.broadcastEffects()
      console.log(`[GameRoom] Game started · ${stationList.length} stations · seed ${this.state.mapSeed}`)
    })

    this.onMessage('task_hold_start', (client: Client, data: { stationId: string }) => {
      const player = this.state.players.get(client.sessionId)
      if (!player || this.state.phase !== 'playing') return

      const station = this.stations.get(data.stationId)
      if (!station || station.completedBy) return

      // Floor check — player must be on the same floor as the station
      if ((station.info.floor ?? 0) !== (player.floor ?? 0)) return

      if (station.disabledUntil > this.clock.currentTime) {
        client.send('incident', { message: 'Station offline', severity: 'warn', time: ts() })
        return
      }

      // Admin lockdown — block opposition from server room
      if (player.faction === 'opposition' && station.info.zone === 'server_room' &&
          this.effects.lockdownUntil > this.clock.currentTime) {
        client.send('incident', { message: 'SERVER ROOM LOCKED DOWN', severity: 'danger', time: ts() })
        return
      }

      const taskDef = station.info.taskId ? TASK_DEFS.find(t => t.id === station.info.taskId) : null
      if (!taskDef || taskDef.role !== player.role) return

      const now = this.clock.currentTime
      let holdMs = taskDef.holdMs

      if (player.faction === 'workforce') {
        if (this.effects.workforceHoldSlowUntil > now) holdMs *= 2
        if (taskDef.id === 'it_repair_terminal') {
          if (!this.effects.ciPipelineDisabled && this.effects.ciPipelineUntil > now) holdMs = Math.ceil(holdMs / 2)
          if (this.effects.hackerCorruptionUntil > now) holdMs *= 2
        }
      } else {
        if (this.effects.oppositionHoldSlowUntil > now) holdMs *= 2
      }

      this.holdState.set(client.sessionId, { stationId: data.stationId, startedAt: now, holdMs })
    })

    this.onMessage('task_hold_cancel', () => {
      // client.sessionId available via closure not needed here — but we need the param
    })
    // Re-register with correct signature
    this.onMessage('task_hold_cancel', (client: Client) => {
      this.holdState.delete(client.sessionId)
    })

    this.onMessage('badge_renewal_done', (client: Client) => {
      const p = this.state.players.get(client.sessionId) as any
      if (p) { p.badgeLockout = false }
    })

    // ── Hold progress tick (200ms) ───────────────────────────────────────────
    this.clock.setInterval(() => {
      if (this.state.phase !== 'playing') return
      const now = this.clock.currentTime
      for (const [sessionId, hold] of this.holdState) {
        if (now - hold.startedAt >= hold.holdMs) {
          this.holdState.delete(sessionId)
          this.completeTask(sessionId, hold.stationId)
        }
      }
    }, 200)

    // ── Meter degradation ────────────────────────────────────────────────────
    this.clock.setInterval(() => {
      if (this.state.phase !== 'playing') return
      const now = this.clock.currentTime
      this.state.workforceMeter  = Math.max(0, this.state.workforceMeter  - 1)
      this.state.oppositionMeter = Math.max(0, this.state.oppositionMeter - 1)
      if (this.effects.extraOppDegradeUntil > now) {
        this.state.oppositionMeter = Math.max(0, this.state.oppositionMeter - 1)
      }
      this.broadcast('meter_update', { workforce: this.state.workforceMeter, opposition: this.state.oppositionMeter })
    }, METER_DEGRADE_INTERVAL_MS)

    // ── Rack degradation ─────────────────────────────────────────────────────
    this.clock.setInterval(() => {
      if (this.state.phase !== 'playing') return
      if (this.effects.rackDegradePausedUntil > this.clock.currentTime) return
      this.state.rackHealthA = Math.max(0, this.state.rackHealthA - 1)
      this.state.rackHealthB = Math.max(0, this.state.rackHealthB - 1)
      this.state.rackHealthC = Math.max(0, this.state.rackHealthC - 1)
    }, RACK_DEGRADE_INTERVAL_MS)

    // ── Lockdown sync ────────────────────────────────────────────────────────
    this.clock.setInterval(() => {
      const locked = this.effects.lockdownUntil > this.clock.currentTime
      if (this.state.lockdownActive !== locked) {
        this.state.lockdownActive = locked
        if (!locked) this.broadcastEffects()
      }
    }, 1_000)

    const botCount = Math.min(Math.max(0, options.botCount ?? 0), 9)
    if (botCount > 0) this.spawnBots(botCount)

    console.log(`[GameRoom] Created · seed ${this.state.mapSeed} · bots ${botCount}`)
  }

  // ── Task completion ───────────────────────────────────────────────────────

  private completeTask(sessionId: string, stationId: string) {
    const station = this.stations.get(stationId)
    const player  = this.state.players.get(sessionId)
    if (!station || !player || station.completedBy) return

    station.completedBy = sessionId

    const taskDef = station.info.taskId ? TASK_DEFS.find(t => t.id === station.info.taskId) : null
    if (!taskDef) return

    const now = this.clock.currentTime

    if (taskDef.meterGain > 0) {
      if (player.faction === 'workforce') {
        this.state.workforceMeter = Math.min(100, this.state.workforceMeter + taskDef.meterGain)
      } else {
        const mult = this.effects.oppMeterGainMultUntil > now ? this.effects.oppMeterGainMult : 1.0
        this.state.oppositionMeter = Math.min(100, this.state.oppositionMeter + taskDef.meterGain * mult)
      }
    }

    this.applyTaskEffect(taskDef.id, sessionId, player)

    this.broadcast('task_complete', {
      taskId:     taskDef.id,
      role:       player.role,
      effectDesc: taskDef.effectDesc,
      meterGain:  taskDef.meterGain,
    })
    this.broadcast('meter_update', { workforce: this.state.workforceMeter, opposition: this.state.oppositionMeter })
    this.broadcastEffects()
    this.checkWinCondition()

    console.log(`[GameRoom] ${player.name} (${player.role}) completed: ${taskDef.id}`)
  }

  private applyTaskEffect(taskId: TaskId, sessionId: string, player: Player) {
    const now = this.clock.currentTime

    switch (taskId) {
      case 'it_repair_terminal':
        this.effects.hackerCorruptionUntil = 0
        break

      case 'it_fix_server':
        this.state.rackHealthA = Math.min(100, this.state.rackHealthA + 40)
        this.effects.rackDegradePausedUntil = now + 180_000
        break

      case 'devops_ci_pipeline':
        if (!this.effects.ciPipelineDisabled) {
          this.effects.ciPipelineUntil = now + 90_000
          this.clock.setTimeout(() => this.broadcastEffects(), 90_000)
        }
        break

      case 'devops_system_monitor':
        this.state.players.forEach((p, sid) => {
          if (p.role === 'admin' && p.connected && !p.isBot) {
            const c = this.clients.find(cl => cl.sessionId === sid)
            c?.send('monitor_snapshot', {
              rackA: this.state.rackHealthA,
              rackB: this.state.rackHealthB,
              rackC: this.state.rackHealthC,
            })
          }
        })
        break

      case 'hr_security_vetting':
      case 'hr_policy_update':
        this.effects.oppositionHoldSlowUntil = now + 90_000
        this.clock.setTimeout(() => this.broadcastEffects(), 90_000)
        break

      case 'finance_budget_freeze':
        this.effects.extraOppDegradeUntil = now + 120_000
        break

      case 'finance_audit_trail':
        this.state.workforceMeter = Math.min(100, this.state.workforceMeter + 8)
        break

      case 'marketing_pr_campaign':
        this.effects.oppMeterGainMult      = 0.75
        this.effects.oppMeterGainMultUntil = now + 90_000
        this.clock.setTimeout(() => {
          this.effects.oppMeterGainMult = 1.0
          this.broadcastEffects()
        }, 90_000)
        break

      case 'marketing_crisis_control':
        if (this.effects.workforceHoldSlowUntil > now)  this.effects.workforceHoldSlowUntil  = 0
        else if (this.effects.hackerCorruptionUntil > now) this.effects.hackerCorruptionUntil = 0
        break

      case 'admin_lockdown':
        this.effects.lockdownUntil = now + 90_000
        this.state.lockdownActive  = true
        this.clock.setTimeout(() => {
          this.state.lockdownActive = false
          this.broadcastEffects()
        }, 90_000)
        break

      case 'admin_keycard_audit': {
        let lastOpp: Player | null = null
        for (const p of this.state.players.values()) {
          if (p.faction === 'opposition') { lastOpp = p; break }
        }
        const entry = lastOpp
          ? `Badge activity detected — zone unknown — ${ts()}`
          : 'No recent badge activity'
        this.state.players.forEach((p, sid) => {
          if (p.role === 'admin' && p.connected && !p.isBot) {
            const c = this.clients.find(cl => cl.sessionId === sid)
            c?.send('keycard_log', { entry })
          }
        })
        break
      }

      case 'mgmt_sprint_planning':
        this.effects.workforceSpeedUntil = now + 90_000
        this.clock.setTimeout(() => this.broadcastEffects(), 90_000)
        break

      case 'mgmt_resource_allocation':
        this.state.workforceMeter = Math.min(100, this.state.workforceMeter + 10)
        break

      case 'hacker_zero_day':
        this.effects.hackerCorruptionUntil = now + 60_000
        this.clock.setTimeout(() => this.broadcastEffects(), 60_000)
        break

      case 'hacker_network_attack':
        for (const st of this.stations.values()) {
          if (st.info.taskId === 'it_fix_server') st.disabledUntil = now + 180_000
        }
        break

      case 'se_phishing': {
        const wfPlayers = Array.from(this.state.players.values())
          .filter(p => p.faction === 'workforce' && p.connected)
        if (wfPlayers.length > 0) {
          const target = wfPlayers[Math.floor(Math.random() * wfPlayers.length)]
          target.slowed = true
          this.clock.setTimeout(() => { target.slowed = false }, 60_000)
        }
        break
      }

      case 'se_impersonation':
        player.disguised = true
        this.clock.setTimeout(() => { player.disguised = false }, 180_000)
        break

      case 'spy_intercept': {
        let lastZone = 'unknown'
        for (const st of this.stations.values()) {
          if (st.completedBy) {
            const completer = this.state.players.get(st.completedBy)
            if (completer?.faction === 'workforce') lastZone = st.info.zone
          }
        }
        this.state.players.forEach((p, sid) => {
          if (p.faction === 'opposition' && p.connected && !p.isBot) {
            const c = this.clients.find(cl => cl.sessionId === sid)
            c?.send('incident', {
              message: `Intel: Last workforce task in ${lastZone.replace('_', ' ')}`,
              severity: 'info', time: ts(),
            })
          }
        })
        break
      }

      case 'spy_surveillance': {
        let target: { x: number; z: number } | null = null
        for (const p of this.state.players.values()) {
          if (p.faction === 'workforce') { target = { x: p.x, z: p.z }; break }
        }
        if (target) {
          const c = this.clients.find(cl => cl.sessionId === sessionId)
          c?.send('ghost_camera', { targetX: target.x, targetZ: target.z, duration: 30_000 })
        }
        break
      }

      case 'saboteur_server_logs': {
        const c = this.clients.find(cl => cl.sessionId === sessionId)
        c?.send('monitor_snapshot', {
          rackA: this.state.rackHealthA,
          rackB: this.state.rackHealthB,
          rackC: this.state.rackHealthC,
        })
        break
      }

      case 'saboteur_power_cut':
        this.effects.workforceHoldSlowUntil = now + 90_000
        this.clock.setTimeout(() => this.broadcastEffects(), 90_000)
        break

      case 'insider_leak_docs':
        this.state.workforceMeter = Math.max(0, this.state.workforceMeter - 8)
        break

      case 'insider_corrupt_backups':
        this.effects.ciPipelineDisabled = true
        this.effects.ciPipelineUntil    = 0
        break
    }
  }

  private broadcastEffects() {
    const now = this.clock.currentTime
    this.broadcast('effect_update', {
      workforceSpeedActive: this.effects.workforceSpeedUntil > now,
      lockdownActive:       this.effects.lockdownUntil > now,
      workforceHoldSlow:    this.effects.workforceHoldSlowUntil > now,
      oppositionHoldSlow:   this.effects.oppositionHoldSlowUntil > now,
      hackerCorruption:     this.effects.hackerCorruptionUntil > now,
      ciPipelineActive:     !this.effects.ciPipelineDisabled && this.effects.ciPipelineUntil > now,
      badgeRenewalRequired: false,
    })
  }

  // ── Bot spawning ──────────────────────────────────────────────────────────

  private spawnBots(count: number) {
    for (let i = 0; i < count; i++) {
      const bot     = new Player()
      bot.sessionId = `bot_${i}`
      bot.name      = BOT_NAMES[i] ?? `BOT-${i}`
      bot.isBot     = true
      bot.connected = true
      bot.x         = (Math.random() - 0.5) * 16
      bot.z         = (Math.random() - 0.5) * 12
      bot.facing    = Math.random() * Math.PI * 2
      this.state.players.set(bot.sessionId, bot)
      this.assignRole(bot)
      this.broadcast('incident', {
        message: `${bot.name} connected — ${bot.role}/${bot.faction} [BOT]`,
        severity: 'info', time: ts(),
      })
    }

    this.clock.setInterval(() => {
      if (this.state.phase !== 'playing') {
        // Pre-game wander
        this.state.players.forEach(p => {
          if (!p.isBot) return
          p.x = clamp(p.x + (Math.random() - 0.5) * 1.0, -11.5, 11.5)
          p.z = clamp(p.z + (Math.random() - 0.5) * 1.0, -15.5,  9.0)
          p.facing = Math.random() * Math.PI * 2
        })
        return
      }

      const now = this.clock.currentTime
      this.state.players.forEach(p => {
        if (!p.isBot) return
        let ai = this.botAI.get(p.sessionId) ?? { mode: 'wander' as const, workUntil: 0, targetStation: null }

        if (ai.mode === 'work' && ai.targetStation) {
          const st = this.stations.get(ai.targetStation)
          if (!st || st.completedBy || now > ai.workUntil) {
            ai = { mode: 'wander', workUntil: 0, targetStation: null }
            this.holdState.delete(p.sessionId)
          } else {
            const dx   = st.info.x - p.x
            const dz   = st.info.z - p.z
            const dist = Math.sqrt(dx * dx + dz * dz)
            if (dist > INTERACT_R * 0.6) {
              // Walk toward station — max 1.2 units per 500 ms tick (~2.4 u/s)
              const step = Math.min(dist, 1.2)
              p.x      = clamp(p.x + (dx / dist) * step, -11.5, 11.5)
              p.z      = clamp(p.z + (dz / dist) * step, -15.5,  9.0)
              p.facing = Math.atan2(dx, dz)
            } else if (!this.holdState.has(p.sessionId)) {
              // In range — start hold using the actual task's holdMs
              const taskDef = st.info.taskId ? TASK_DEFS.find(t => t.id === st.info.taskId) : null
              const holdMs  = taskDef?.holdMs ?? 4000
              this.holdState.set(p.sessionId, { stationId: ai.targetStation, startedAt: now, holdMs })
            }
          }
        } else {
          // Always find the nearest eligible station (no random 25% gate)
          const myTaskIds = new Set(
            TASK_DEFS.filter(t => t.role === (p.role as PlayerRole)).map(t => t.id)
          )
          let best: StationState | null = null
          let bestDist = Infinity
          for (const st of this.stations.values()) {
            if (st.completedBy || !st.info.taskId || !myTaskIds.has(st.info.taskId)) continue
            if (st.disabledUntil > now) continue
            const dx = st.info.x - p.x
            const dz = st.info.z - p.z
            const d  = dx * dx + dz * dz
            if (d < bestDist) { bestDist = d; best = st }
          }
          if (best) {
            ai = { mode: 'work', workUntil: now + 45_000, targetStation: best.info.stationId }
          } else {
            // Nothing left to do — gentle wander
            p.x = clamp(p.x + (Math.random() - 0.5) * 1.0, -11.5, 11.5)
            p.z = clamp(p.z + (Math.random() - 0.5) * 1.0, -15.5,  9.0)
            p.facing = Math.random() * Math.PI * 2
          }
        }

        this.botAI.set(p.sessionId, ai)
      })
    }, 500)
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  onJoin(client: Client, options: { name?: string }) {
    const player     = new Player()
    player.sessionId = client.sessionId
    player.name      = (options.name ?? `Operative-${client.sessionId.slice(0, 4)}`).slice(0, 20)
    this.state.players.set(client.sessionId, player)
    this.assignRole(player)
    client.send('role_assigned', { role: player.role, faction: player.faction })
    this.broadcast('incident', {
      message: `${player.name} connected — ${player.role}/${player.faction}`,
      severity: 'info', time: ts(),
    })
    console.log(`[GameRoom] ${player.name} joined as ${player.role} (${player.faction})`)
  }

  async onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId)
    if (!player) return
    player.connected = false
    this.holdState.delete(client.sessionId)
    if (!consented) {
      try {
        await this.allowReconnection(client, 10)
        player.connected = true
        return
      } catch { /* expired */ }
    }
    this.broadcast('incident', { message: `${player.name} disconnected`, severity: 'warn', time: ts() })
    this.state.players.delete(client.sessionId)
    this.checkWinCondition()
  }

  onDispose() {
    console.log(`[GameRoom] ${this.roomId} disposed`)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private assignRole(player: Player) {
    const all             = Array.from(this.state.players.values())
    const oppCount        = all.filter(p => p.faction === 'opposition').length
    const assignOpp       = all.length > 2 && oppCount / all.length < OPPOSITION_RATIO
    if (assignOpp) {
      player.faction = 'opposition'
      player.role    = OPPOSITION_ROLES[Math.floor(Math.random() * OPPOSITION_ROLES.length)]
    } else {
      player.faction = 'workforce'
      player.role    = WORKFORCE_ROLES[Math.floor(Math.random() * WORKFORCE_ROLES.length)]
    }
  }

  private checkWinCondition() {
    if (this.state.phase !== 'playing') return
    if (this.state.workforceMeter  >= 100) this.endGame('workforce',  'All workforce tasks complete!')
    if (this.state.oppositionMeter >= 100) this.endGame('opposition', 'All opposition tasks complete!')
  }

  private endGame(winner: string, reason: string) {
    this.state.phase  = 'ended'
    this.state.winner = winner
    this.broadcast('game_end', { winner, reason })
    console.log(`[GameRoom] Game ended — ${winner} wins: ${reason}`)
    this.clock.setTimeout(() => this.disconnect(), 30_000)
  }
}

function ts() {
  return new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}
