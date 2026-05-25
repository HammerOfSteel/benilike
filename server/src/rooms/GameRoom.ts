import { Room, Client } from 'colyseus'
import { GameState, Player } from './GameState'
import {
  WORKFORCE_ROLES,
  OPPOSITION_ROLES,
  DEFAULT_REPUTATION,
  type RoomOptions,
} from '../../../shared/src/types'

const OPPOSITION_RATIO = 0.25  // ~1-in-4 players are Opposition

const BOT_NAMES = [
  'AGENT-7', 'UNIT-X', 'PROTO-9', 'GHOST-3', 'SIGMA-1',
  'DELTA-4', 'ECHO-2', 'ZETA-6', 'OMEGA-8', 'KILO-5',
]

export class GameRoom extends Room<GameState> {
  maxClients = 10
  private botCleanup: (() => void) | null = null
  private taskUsers = new Set<string>()

  onCreate(options: Partial<RoomOptions>) {
    this.setState(new GameState())
    this.state.mapSize  = options.mapSize ?? 'medium'
    this.state.mapSeed  = Math.random().toString(36).slice(2, 8).toUpperCase()

    // ── Message handlers ──────────────────────────────────────────────────────

    this.onMessage('move', (client: Client, data: { x: number; z: number; facing?: number }) => {
      const player = this.state.players.get(client.sessionId)
      if (!player) return
      player.x      = data.x
      player.z      = data.z
      player.facing = data.facing ?? player.facing
    })

    this.onMessage('interact', (_client: Client, _data: { targetId: string }) => {
      // Implemented in Phase 1
    })

    this.onMessage('start_game', (client: Client) => {
      // Only the first client (host) can start
      const players = Array.from(this.state.players.values())
      const host = players.find(p => !p.isBot)
      if (host?.sessionId !== client.sessionId) return
      if (this.state.phase !== 'waiting') return

      this.state.phase = 'playing'
      this.broadcast('game_start', {
        seed:    this.state.mapSeed,
        mapSize: this.state.mapSize,
      })
      console.log(`[GameRoom] Game started by ${client.sessionId}`)
    })

    this.onMessage('task_start', (client: Client) => {
      this.taskUsers.add(client.sessionId)
    })

    this.onMessage('task_stop', (client: Client) => {
      this.taskUsers.delete(client.sessionId)
    })

    // Task progress tick
    this.clock.setInterval(() => {
      if (this.state.phase !== 'playing') return
      let changed = false
      for (const sid of this.taskUsers) {
        const player = this.state.players.get(sid)
        if (!player) continue
        if (player.faction === 'workforce') {
          this.state.terminalProgress = Math.min(100, this.state.terminalProgress + 2)
        } else {
          this.state.terminalProgress = Math.max(0, this.state.terminalProgress - 2)
        }
        changed = true
      }
      if (changed) this.checkEndConditions()
    }, 200)

    const botCount = Math.min(Math.max(0, options.botCount ?? 0), 9)
    if (botCount > 0) this.spawnBots(botCount)

    console.log(`[GameRoom] Created room "${options.roomName ?? 'Office'}" · seed ${this.state.mapSeed} · bots ${botCount}`)
  }

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

    // Move bots randomly every 2 s using Colyseus clock
    const interval = this.clock.setInterval(() => {
      this.state.players.forEach((p) => {
        if (!p.isBot) return
        p.x      = Math.max(-15, Math.min(15, p.x + (Math.random() - 0.5) * 3))
        p.z      = Math.max(-15, Math.min(15, p.z + (Math.random() - 0.5) * 3))
        p.facing = Math.random() * Math.PI * 2
      })
    }, 2000)

    this.botCleanup = () => interval.clear()
  }

  onJoin(client: Client, options: { name?: string }) {
    const player = new Player()
    player.sessionId = client.sessionId
    player.name      = (options.name ?? `Operative-${client.sessionId.slice(0, 4)}`).slice(0, 20)
    this.state.players.set(client.sessionId, player)

    this.assignRole(player)

    // Tell this client their assigned role/faction
    client.send('role_assigned', { role: player.role, faction: player.faction })

    // Broadcast join incident to all
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
      // Give 10 s to reconnect before removing
      try {
        await this.allowReconnection(client, 10)
        player.connected = true
        return
      } catch {
        // Reconnection window expired — fall through to removal
      }
    }

    this.broadcast('incident', {
      message:  `${player.name} disconnected`,
      severity: 'warn',
      time:     timestamp(),
    })
    this.state.players.delete(client.sessionId)

    this.checkEndConditions()
  }

  onDispose() {
    if (this.botCleanup) this.botCleanup()
    console.log(`[GameRoom] ${this.roomId} disposed`)
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private assignRole(player: Player) {
    const all            = Array.from(this.state.players.values())
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
    // Dispose after 30 s
    this.clock.setTimeout(() => this.disconnect(), 30_000)
  }
}

function timestamp() {
  return new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}
