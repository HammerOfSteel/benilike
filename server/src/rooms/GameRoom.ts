import { Room, Client } from 'colyseus'
import { GameState, Player } from './GameState'
import {
  WORKFORCE_ROLES,
  OPPOSITION_ROLES,
  DEFAULT_REPUTATION,
  type RoomOptions,
} from '../../../../shared/src/types'

const OPPOSITION_RATIO = 0.25  // ~1-in-4 players are Opposition

export class GameRoom extends Room<GameState> {
  maxClients = 10

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

    console.log(`[GameRoom] Created room "${options.roomName ?? 'Office'}" · seed ${this.state.mapSeed}`)
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

    const players     = Array.from(this.state.players.values())
    const workforce   = players.filter(p => p.faction === 'workforce')
    const opposition  = players.filter(p => p.faction === 'opposition')

    if (opposition.length === 0) {
      this.endGame('workforce', 'All opposition eliminated')
    } else if (opposition.length >= workforce.length) {
      this.endGame('opposition', 'Opposition reached numerical parity')
    } else if (this.state.reputation <= 0) {
      this.endGame('opposition', 'Infrastructure fully compromised')
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
