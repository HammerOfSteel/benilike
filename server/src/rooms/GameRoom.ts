import { Room, Client } from 'colyseus'
import { GameState, Player, Body } from './GameState'
import {
  WORKFORCE_ROLES,
  type AiPhase,
  type PlayerRole,
  type WorkforceRole,
  type RoomOptions,
  type TaskId,
  type StationInfo,
  type ZoneId,
  SPRINT_DURATION_MS,
  SPRINT_COUNT,
  SHUTDOWN_COOLDOWN_MS,
  ALL_HANDS_PER_PLAYER,
} from '../../../shared/src/types'
import {
  TASK_DEFS,
  AI_TASK_DEFS,
  ROLE_TASK_MAP,
  sprintQuota,
  assignStations,
} from '../../../shared/src/tasks'
import {
  generateBotName,
  resetBotNameCounter,
  randomPersonality,
  fillTemplate,
  PERSONALITIES,
  type BotPersonality,
} from '../../../shared/src/botData'
import {
  isWalkable,
  generateMapData,
  w2c, c2w,
  type MapData,
} from '../../../shared/src/mapgen'

const INTERACT_R = 2.5

// ── A* pathfinder (grid-based, no external library) ──────────────────────────
function astarPath(
  startWx: number, startWz: number,
  goalWx:  number, goalWz:  number,
  floor:   number,
  md:      MapData,
): { x: number; z: number }[] {
  const { grids, gridW: gw, gridH: gh } = md
  const grid = grids[floor]
  if (!grid) return []

  const [sx, sz] = w2c(startWx, startWz, gw, gh)
  const [gx, gz] = w2c(goalWx,  goalWz,  gw, gh)

  type Node = { x: number; z: number; g: number; f: number; parent: Node | null }
  const key  = (x: number, z: number) => `${x},${z}`
  const open = new Map<string, Node>()
  const closed = new Set<string>()

  const startNode: Node = { x: sx, z: sz, g: 0, f: Math.abs(gx-sx)+Math.abs(gz-sz), parent: null }
  open.set(key(sx, sz), startNode)

  let iters = 0
  while (open.size > 0 && iters++ < 2000) {
    // Pick node with lowest f
    let cur: Node | null = null
    for (const n of open.values()) if (!cur || n.f < cur.f) cur = n
    if (!cur) break

    const ck = key(cur.x, cur.z)
    if (cur.x === gx && cur.z === gz) {
      // Reconstruct path
      const path: { x: number; z: number }[] = []
      let n: Node | null = cur
      while (n) { path.unshift({ x: n.x, z: n.z }); n = n.parent }
      // Convert grid cells back to world coords, skip first (that's current pos)
      return path.slice(1).map(p => { const [wx, wz] = c2w(p.x, p.z, gw, gh); return { x: wx, z: wz } })
    }

    open.delete(ck)
    closed.add(ck)

    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const nx = cur.x + dx, nz = cur.z + dz
      const nk = key(nx, nz)
      if (closed.has(nk)) continue
      if (grid.get(nk) !== 0) continue  // not walkable
      // No corner-cutting: diagonal moves require both adjacent cardinal cells to be open
      if (dx !== 0 && dz !== 0) {
        if (grid.get(key(cur.x + dx, cur.z)) !== 0) continue
        if (grid.get(key(cur.x, cur.z + dz)) !== 0) continue
      }
      const g = cur.g + (dx !== 0 && dz !== 0 ? 1.414 : 1)
      const existing = open.get(nk)
      if (!existing || g < existing.g) {
        const node: Node = { x: nx, z: nz, g, f: g + Math.abs(gx-nx)+Math.abs(gz-nz), parent: cur }
        open.set(nk, node)
      }
    }
  }
  return []  // no path found
}

interface StationState {
  info:        StationInfo
  completedBy: string | null
}

interface HoldState {
  stationId: string
  startedAt: number
  holdMs:    number
}

type BotAI = {
  mode:          'wander' | 'travel' | 'work'
  workUntil:     number
  nextActionAt:  number   // don't start acting before this timestamp
  targetStation: string | null
  targetX:       number
  targetZ:       number
  waypoints:     { x: number; z: number }[]  // A* path to follow
}

export class GameRoom extends Room<GameState> {
  maxClients = 10

  // ── Private server state ───────────────────────────────────────────────────
  private botAI            = new Map<string, BotAI>()
  private botPersonalities = new Map<string, BotPersonality>()
  private botNameCounter   = 0
  private stations        = new Map<string, StationState>()
  private holdState       = new Map<string, HoldState>()
  private aiSessionId:    string | null = null
  private aiPhase:        AiPhase = 1
  private aiPhaseCompleted = new Set<TaskId>()
  private shutdownCooldownUntil = 0
  private sprintTimer:    ReturnType<typeof this.clock.setInterval> | null = null
  private mapData:        MapData | null = null
  private votes           = new Map<string, string>()   // voter → target sessionId | 'skip'
  private perkVotes       = new Map<string, string>()
  private activePerk:     string | null = null
  private assignedTasks   = new Map<string, TaskId[]>() // sessionId → assigned task ids
  private sprintPlayerDone = new Map<string, number>()  // sessionId → tasks completed this sprint
  private allHandsTimeout: ReturnType<typeof this.clock.setTimeout> | null = null
  private killCooldowns        = new Map<string, number>()  // sessionId → last-kill timestamp
  private aiPhase1DoneCount      = 0       // # sprints where AI finished all 3 phase-1 tasks
  private aiExtraVoteReady       = false   // AI vote counts ×2 in next meeting
  private aiInvisibilityUnlocked = false   // permanently unlocked after 2 sprint completions
  private aiInvisibleUntil       = 0       // epoch ms when active invis expires
  private aiInvisibilityCooldown = 0       // epoch ms when cooldown ends
  private aiInvisLastX           = 0
  private aiInvisLastZ           = 0

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  onCreate(options: Partial<RoomOptions>) {
    try {
      this.setState(new GameState())
      this.state.phase      = 'lobby'
      this.state.sprintSize = options.sprintSize ?? 'medium'

      const seed = Math.random().toString(36).slice(2, 8).toUpperCase()
      ;(this.state as any).mapSeed = seed
      ;(this.state as any).mapSize = options.mapSize ?? 'medium'

      resetBotNameCounter()
      this.registerMessageHandlers()

      // Spawn server-side bots (no real WS connection — pure state entries)
      const botCount = Math.min(options.botCount ?? 0, 9)
      this.spawnBots(botCount)
    } catch (err) {
      console.error('[GameRoom.onCreate] Error:', err)
    }
  }

  /** Create server-authoritative bot players directly in state (no WS connection). */
  private spawnBots(count: number) {
    for (let i = 0; i < count; i++) {
      const sessionId = `bot-${i}-${Math.random().toString(36).slice(2, 6)}`
      const player         = new Player()
      player.sessionId     = sessionId
      player.isBot         = true
      player.name          = generateBotName(this.botNameCounter++)
      player.x             = 0
      player.z             = 0
      const personality    = randomPersonality(this.botNameCounter)
      this.botPersonalities.set(sessionId, personality)
      this.botAI.set(sessionId, { mode: 'wander', workUntil: 0, nextActionAt: 0, targetStation: null, targetX: 0, targetZ: 0, waypoints: [] })
      this.state.players.set(sessionId, player)
    }
  }

  onJoin(client: Client, options: { name?: string; isBot?: boolean; spectate?: boolean }) {
    try {
      const player      = new Player()
      player.sessionId  = client.sessionId
      player.isBot      = options.isBot ?? false
      player.isSpectator = options.spectate ?? false

      if (player.isBot) {
        // Generate a unique funny name for this bot
        player.name = generateBotName(this.botNameCounter++)
        const personality = randomPersonality(this.botNameCounter)
        this.botPersonalities.set(client.sessionId, personality)
        this.botAI.set(client.sessionId, { mode: 'wander', workUntil: 0, nextActionAt: 0, targetStation: null, targetX: 0, targetZ: 0, waypoints: [] })
      } else {
        player.name = (options.name ?? 'Player').slice(0, 24)
      }

      player.x = (this.state as any).startX ?? 10
      player.z = (this.state as any).startZ ?? 10
      this.state.players.set(client.sessionId, player)
    } catch (err) {
      console.error('[GameRoom.onJoin] Error:', err)
    }
  }

  onLeave(client: Client) {
    try {
      this.state.players.delete(client.sessionId)
      this.holdState.delete(client.sessionId)
      this.votes.delete(client.sessionId)
      this.botAI.delete(client.sessionId)
      this.botPersonalities.delete(client.sessionId)
      this.sprintPlayerDone.delete(client.sessionId)
    } catch (err) {
      console.error('[GameRoom.onLeave] Error:', err)
    }
  }

  onDispose() {
    try {
      if (this.sprintTimer)    this.sprintTimer.clear()
      if (this.allHandsTimeout) this.allHandsTimeout.clear()
    } catch (err) {
      console.error('[GameRoom.onDispose] Error:', err)
    }
  }

  // ── Message handlers ───────────────────────────────────────────────────────

  private registerMessageHandlers() {
    // ── Move ──────────────────────────────────────────────────────────────────
    this.onMessage('move', (client: Client, data: { x: number; z: number; floor?: number; facing?: number }) => {
      try {
        const player = this.state.players.get(client.sessionId)
        if (!player || player.isEliminated) return
        player.x = data.x
        player.z = data.z
        if (data.floor   !== undefined) player.floor  = data.floor
        if (data.facing  !== undefined) player.facing = data.facing

        // Cancel hold if player moves away from station
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

        // Cancel invisibility if AI player moves
        if (client.sessionId === this.aiSessionId && this.aiInvisibleUntil > Date.now()) {
          const mdx = data.x - this.aiInvisLastX
          const mdz = data.z - this.aiInvisLastZ
          if (Math.sqrt(mdx * mdx + mdz * mdz) > 0.3) {
            this.endInvisibility()
          }
        }
      } catch (err) {
        console.error('[GameRoom] move error:', err)
      }
    })

    // ── Start game ─────────────────────────────────────────────────────────────
    this.onMessage('start_game', (client: Client) => {
      try {
        const allPlayers = Array.from(this.state.players.values())
        const humanPlayers = allPlayers.filter(p => !p.isBot)
        const host = humanPlayers[0]
        if (host?.sessionId !== client.sessionId) return
        if (this.state.phase !== 'lobby') return

        this.state.phase = 'briefing'

        const seed    = (this.state as any).mapSeed as string
        const mapSize = (this.state as any).mapSize as 'small' | 'medium' | 'large'

        // Generate map once; reuse for station placement and bot walkability
        const md = generateMapData(seed, mapSize)
        this.mapData = md

        // Build station list from map — include AI task stations so the rogue bot can complete them
        const stationList = assignStations(seed, mapSize, [...TASK_DEFS, ...AI_TASK_DEFS], md)
        for (const info of stationList) {
          this.stations.set(info.stationId, { info, completedBy: null })
        }

        // Assign roles and tasks to players
        this.assignRolesAndTasks(allPlayers)

        // Position ALL bots at the main_office spawn point (Among Us style — everyone starts together)
        const spawnX = md.startX
        const spawnZ = md.startZ
        for (const [sessionId] of this.botAI) {
          const player = this.state.players.get(sessionId)
          if (!player) continue
          // Small random jitter so they don't perfectly stack
          player.x     = spawnX + (Math.random() - 0.5) * 2
          player.z     = spawnZ + (Math.random() - 0.5) * 2
          player.floor = 0
        }
        // Also spawn human (non-spectator) player at the start point
        for (const [, p] of this.state.players) {
          if (!p.isBot && !p.isSpectator) {
            p.x = spawnX; p.z = spawnZ; p.floor = 0
          }
        }

        // Broadcast game_start with station data included so clients don't
        // need a separate station_list message (avoids timing/ordering issues)
        this.broadcast('game_start', { seed, mapSize, stations: stationList })

        // Start sprint 1 after a short briefing delay
        this.clock.setTimeout(() => {
          this.startSprint(1)
        }, 5000)
      } catch (err) {
        console.error('[GameRoom] start_game error:', err)
      }
    })

    // ── Task hold start ────────────────────────────────────────────────────────
    this.onMessage('task_hold_start', (client: Client, data: { stationId: string }) => {
      try {
        const player = this.state.players.get(client.sessionId)
        if (!player || player.isEliminated) return
        if (this.state.phase !== 'game') return

        const stState = this.stations.get(data.stationId)
        if (!stState || stState.completedBy || !stState.info.taskId) return

        const taskId = stState.info.taskId as TaskId

        // For workforce tasks: check that this task is in the player's assigned list
        const playerTasks = this.assignedTasks.get(client.sessionId) ?? []
        const allTaskDefs = [...TASK_DEFS, ...AI_TASK_DEFS]
        const td = allTaskDefs.find(t => t.id === taskId)
        if (!td) return

        if (td.category === 'workforce' && !playerTasks.includes(taskId)) return

        // AI tasks: only the AI player can work on them (verified via aiSessionId)
        if (td.category === 'ai' && client.sessionId !== this.aiSessionId) return

        // Floor check
        if (stState.info.floor !== player.floor) return

        // Proximity check
        const dx = player.x - stState.info.x
        const dz = player.z - stState.info.z
        if (Math.sqrt(dx * dx + dz * dz) > INTERACT_R) return

        const holdMs = td.holdMs
        this.holdState.set(client.sessionId, {
          stationId: data.stationId,
          startedAt: Date.now(),
          holdMs,
        })

        // Schedule task completion
        this.clock.setTimeout(() => {
          this.completeTask(client.sessionId, data.stationId)
        }, holdMs)
      } catch (err) {
        console.error('[GameRoom] task_hold_start error:', err)
      }
    })

    // ── Task hold cancel ───────────────────────────────────────────────────────
    this.onMessage('task_hold_cancel', (client: Client) => {
      this.holdState.delete(client.sessionId)
    })

    // ── Kill (Rogue AI only, after phase 1 complete) ───────────────────────────
    this.onMessage('kill', (client: Client, data: { targetId: string }) => {
      try {
        if (this.state.phase !== 'game') return
        if (client.sessionId !== this.aiSessionId) return

        const killer = this.state.players.get(client.sessionId)
        if (!killer || killer.isEliminated) return

        // Require all phase-1 AI tasks completed
        const phase1Tasks = AI_TASK_DEFS.filter(t => t.aiPhase === 1).map(t => t.id)
        if (!phase1Tasks.every(t => this.aiPhaseCompleted.has(t))) return

        // 30-second kill cooldown
        const lastKill = this.killCooldowns.get(client.sessionId) ?? 0
        if (Date.now() - lastKill < 30_000) {
          client.send('incident', { message: 'Kill not ready — wait 30 s.', severity: 'warn', time: new Date().toISOString() })
          return
        }

        const target = this.state.players.get(data.targetId)
        if (!target || target.isEliminated || target.isSpectator) return

        // Proximity check
        const dx = killer.x - target.x, dz = killer.z - target.z
        if (Math.sqrt(dx * dx + dz * dz) > INTERACT_R * 2) return

        // Eliminate target and create body
        target.isEliminated = true
        const body = new Body()
        body.bodyId = target.sessionId
        body.name   = target.name
        body.x      = target.x
        body.z      = target.z
        body.floor  = target.floor
        this.state.bodies.set(body.bodyId, body)

        this.killCooldowns.set(client.sessionId, Date.now())
        this.broadcast('body_appeared', {
          body: { bodyId: body.bodyId, name: body.name, x: body.x, z: body.z, floor: body.floor },
        })

        // Tell the AI player the kill cooldown so they know when they can kill again
        client.send('incident', { message: `${target.name} neutralised. Next kill available in 30 s.`, severity: 'success', time: new Date().toISOString() })

        this.checkWinConditions()
      } catch (err) {
        console.error('[GameRoom] kill error:', err)
      }
    })

    // ── Invisibility (Rogue AI only, unlocked after 2 sprint completions) ──────────────
    this.onMessage('ai_invisibility_activate', (client: Client) => {
      try {
        if (this.state.phase !== 'game') return
        if (client.sessionId !== this.aiSessionId) return
        if (!this.aiInvisibilityUnlocked) return
        if (Date.now() < this.aiInvisibilityCooldown) {
          const secsLeft = Math.ceil((this.aiInvisibilityCooldown - Date.now()) / 1000)
          client.send('incident', { message: `Invis on cooldown — ${secsLeft}s remaining.`, severity: 'warn', time: new Date().toISOString() })
          return
        }
        if (this.aiInvisibleUntil > Date.now()) return  // already active

        const player = this.state.players.get(client.sessionId)
        if (!player) return

        this.aiInvisibleUntil = Date.now() + 5_000
        this.aiInvisibilityCooldown = Date.now() + 5_000 + 30_000
        this.aiInvisLastX = player.x
        this.aiInvisLastZ = player.z

        this.broadcast('invisible_start', { sessionId: client.sessionId })

        // Auto-expire after 5 s if not cancelled by movement
        this.clock.setTimeout(() => {
          if (this.aiInvisibleUntil > 0 && this.state.phase === 'game') {
            this.endInvisibility()
          }
        }, 5_100)
      } catch (err) {
        console.error('[GameRoom] ai_invisibility_activate error:', err)
      }
    })

    // ── Report body ────────────────────────────────────────────────────────────
    this.onMessage('report_body', (client: Client, data: { bodyId: string }) => {
      try {
        const player = this.state.players.get(client.sessionId)
        if (!player || player.isEliminated) return
        if (this.state.phase !== 'game') return

        const body = this.state.bodies.get(data.bodyId)
        if (!body) return

        // Proximity check to body
        if (body.floor !== player.floor) return
        const dx = player.x - body.x
        const dz = player.z - body.z
        if (Math.sqrt(dx * dx + dz * dz) > INTERACT_R * 2) return

        this.triggerAllHands(player.name, data.bodyId)
      } catch (err) {
        console.error('[GameRoom] report_body error:', err)
      }
    })

    // ── Call all-hands (emergency) ────────────────────────────────────────────
    this.onMessage('call_all_hands', (client: Client) => {
      try {
        const player = this.state.players.get(client.sessionId)
        if (!player || player.isEliminated) return
        if (this.state.phase !== 'game') return
        if (player.allHandsLeft <= 0) {
          client.send('incident', { message: 'No all-hands calls remaining.', severity: 'warn', time: new Date().toISOString() })
          return
        }
        player.allHandsLeft -= 1
        this.triggerAllHands(player.name)
      } catch (err) {
        console.error('[GameRoom] call_all_hands error:', err)
      }
    })

    // ── Vote ───────────────────────────────────────────────────────────────────
    this.onMessage('vote', (client: Client, data: { targetId: string }) => {
      try {
        const player = this.state.players.get(client.sessionId)
        if (!player || player.isEliminated || player.isSpectator) return
        if (this.state.phase !== 'meeting') return
        if (this.votes.has(client.sessionId)) return  // already voted

        const targetId = data.targetId
        // Validate target is a real living player or 'skip'
        if (targetId !== 'skip') {
          const target = this.state.players.get(targetId)
          if (!target || target.isEliminated) return
        }

        this.votes.set(client.sessionId, targetId)

        // Broadcast vote cast for spectator visualization
        const vCaster  = this.state.players.get(client.sessionId)
        const vTarget  = this.state.players.get(targetId)
        this.broadcast('vote_cast', {
          voterName:       vCaster?.name ?? '',
          voterSessionId:  client.sessionId,
          targetName:      targetId === 'skip' ? 'skip' : (vTarget?.name ?? 'skip'),
          targetSessionId: targetId,
        })

        // Check if all living players have voted
        const livingPlayers = Array.from(this.state.players.values()).filter(p => !p.isEliminated && !p.isSpectator)
        if (this.votes.size >= livingPlayers.length) {
          this.resolveVote()
        }
      } catch (err) {
        console.error('[GameRoom] vote error:', err)
      }
    })

    // ── Perk vote ──────────────────────────────────────────────────────────────
    this.onMessage('perk_vote', (client: Client, data: { perk: string }) => {
      try {
        const player = this.state.players.get(client.sessionId)
        if (!player || player.isEliminated) return
        if (this.state.phase !== 'retro') return
        this.perkVotes.set(client.sessionId, data.perk)
      } catch (err) {
        console.error('[GameRoom] perk_vote error:', err)
      }
    })

    // ── Chat ───────────────────────────────────────────────────────────────────
    this.onMessage('chat', (client: Client, data: { text: string }) => {
      try {
        const player = this.state.players.get(client.sessionId)
        if (!player) return
        if (this.state.phase !== 'meeting' && this.state.phase !== 'retro') return
        const text = String(data.text ?? '').slice(0, 200)
        this.broadcast('chat', { senderId: client.sessionId, name: player.name, text })
      } catch (err) {
        console.error('[GameRoom] chat error:', err)
      }
    })

    // ── Bot tick ───────────────────────────────────────────────────────────────
    this.clock.setInterval(() => {
      this.tickBots()
    }, 200)

    // ── Sprint second tick ─────────────────────────────────────────────────────
    // Note: actual sprint timer is started by startSprint()
  }

  // ── Role & task assignment ─────────────────────────────────────────────────

  private assignRolesAndTasks(allPlayers: Player[]) {
    try {
      // Spectators get no role or tasks
      const activePlayers = allPlayers.filter(p => !p.isSpectator)
      const shuffled = [...activePlayers].sort(() => Math.random() - 0.5)

      // Pick one AI player (prefer human players)
      const humans = shuffled.filter(p => !p.isBot)
      const aiCandidate = humans.length > 0 ? humans[0] : shuffled[0]
      this.aiSessionId = aiCandidate?.sessionId ?? null

      // Assign rogue_ai personality to the AI bot if they are a bot
      if (aiCandidate?.isBot) {
        this.botPersonalities.set(aiCandidate.sessionId, 'rogue_ai')
      }

      const rolePool = [...WORKFORCE_ROLES]
      let roleIdx = 0

      for (const player of shuffled) {
        const role: WorkforceRole = rolePool[roleIdx % rolePool.length] as WorkforceRole
        roleIdx++
        player.role = role

        const taskIds = ROLE_TASK_MAP[role] ?? []

        if (player.sessionId === this.aiSessionId) {
          // AI player gets cover role tasks + phase 1 AI tasks
          const phase1Tasks = AI_TASK_DEFS.filter(t => t.aiPhase === 1).map(t => t.id)
          const assigned = [...taskIds, ...phase1Tasks]
          this.assignedTasks.set(player.sessionId, assigned)

          // Send normal role_assigned (cover role)
          const roomClient = this.clients.find(c => c.sessionId === player.sessionId)
          roomClient?.send('role_assigned', { role, assignedTasks: taskIds })

          // Send private ai_briefing
          roomClient?.send('ai_briefing', { phase: 1 as AiPhase, phaseTasks: phase1Tasks })
        } else {
          this.assignedTasks.set(player.sessionId, taskIds)
          const roomClient = this.clients.find(c => c.sessionId === player.sessionId)
          roomClient?.send('role_assigned', { role, assignedTasks: taskIds })
        }
      }

      // Tell spectators who the rogue AI is (full intel — spectators are observers)
      if (this.aiSessionId) {
        const aiPlayer  = this.state.players.get(this.aiSessionId)
        const aiTasks   = this.assignedTasks.get(this.aiSessionId) ?? []
        const spectatorClients = this.clients.filter(c => {
          const p = this.state.players.get(c.sessionId)
          return p?.isSpectator === true
        })
        for (const sc of spectatorClients) {
          sc.send('ai_revealed', {
            sessionId: this.aiSessionId,
            name:      aiPlayer?.name ?? 'Unknown',
            coverRole: aiPlayer?.role ?? '',
            tasks:     aiTasks,
          })
        }
      }
    } catch (err) {
      console.error('[GameRoom.assignRolesAndTasks] Error:', err)
    }
  }

  // ── Task completion ────────────────────────────────────────────────────────

  private completeTask(sessionId: string, stationId: string) {
    try {
      // Guard: only complete tasks while the sprint is active
      if (this.state.phase !== 'game') return

      const hold    = this.holdState.get(sessionId)
      if (!hold || hold.stationId !== stationId) return

      const player  = this.state.players.get(sessionId)
      if (!player || player.isEliminated) return

      const stState = this.stations.get(stationId)
      if (!stState || stState.completedBy || !stState.info.taskId) return

      const taskId = stState.info.taskId as TaskId

      // Verify player is still close enough and on the same floor
      const dx = player.x - stState.info.x
      const dz = player.z - stState.info.z
      if (Math.sqrt(dx * dx + dz * dz) > INTERACT_R) return
      if (player.floor !== stState.info.floor) return

      stState.completedBy = sessionId
      this.state.completedTasks.add(taskId)
      this.holdState.delete(sessionId)

      // Track per-sprint progress
      const prev = this.sprintPlayerDone.get(sessionId) ?? 0
      this.sprintPlayerDone.set(sessionId, prev + 1)
      this.state.sprintDone += 1

      this.broadcast('task_complete', { taskId, playerName: player.name })
      this.broadcastSprintUpdate()

      // Check if sprint quota is now met
      if (this.state.sprintDone >= this.state.sprintQuota) {
        this.endSprint(true)
        return
      }

      // Check if AI phase task
      const allTaskDefs = [...TASK_DEFS, ...AI_TASK_DEFS]
      const td = allTaskDefs.find(t => t.id === taskId)
      if (td?.category === 'ai') {
        this.aiPhaseCompleted.add(taskId)
        this.checkAiPhaseAdvance(sessionId)
      }

      // Check win conditions
      this.checkWinConditions()
    } catch (err) {
      console.error('[GameRoom.completeTask] Error:', err)
    }
  }

  // ── AI phase-1 completion → sprint buff grants ──────────────────────────────
  // Old phase-2/3 progression removed. Completing the 3 phase-1 tasks each
  // sprint now grants escalating abilities instead of unlocking new task phases.

  private checkAiPhaseAdvance(aiSessionId: string) {
    try {
      const phase1Tasks = AI_TASK_DEFS.filter(t => t.aiPhase === 1)
      const allDone     = phase1Tasks.every(t => this.aiPhaseCompleted.has(t.id))
      if (!allDone) return

      this.aiPhase1DoneCount++

      const aiClient = this.clients.find(c => c.sessionId === aiSessionId)

      // Buff 1 (any sprint): extra vote weight in next meeting
      this.aiExtraVoteReady = true
      aiClient?.send('ai_buff', {
        type:    'extra_vote',
        message: 'Phase complete — your next vote counts double!',
        count:   this.aiPhase1DoneCount,
      })

      // Buff 2 (2nd sprint): invisibility ability permanently unlocked
      if (this.aiPhase1DoneCount >= 2 && !this.aiInvisibilityUnlocked) {
        this.aiInvisibilityUnlocked = true
        aiClient?.send('ai_buff', {
          type:    'invisibility_unlocked',
          message: 'Invisibility unlocked! Hold Q for 3 s to vanish (5 s duration, 30 s cooldown).',
        })
      }
    } catch (err) {
      console.error('[GameRoom.checkAiPhaseAdvance] Error:', err)
    }
  }

  private endInvisibility() {
    this.aiInvisibleUntil = 0
    if (this.aiSessionId) {
      this.broadcast('invisible_end', { sessionId: this.aiSessionId })
    }
  }

  // ── Sprint management ──────────────────────────────────────────────────────

  private startSprint(sprintNum: number) {
    try {
      if (this.sprintTimer) this.sprintTimer.clear()

      this.state.phase       = 'game'
      this.state.sprintNumber = sprintNum

      // Reset station completions for sprint 2+ so tasks can be done again
      if (sprintNum > 1) {
        for (const [, st] of this.stations) {
          st.completedBy = null
        }
        this.state.completedTasks.clear()

        // Clear any bodies left over from the previous sprint
        this.state.bodies.clear()
        this.killCooldowns.clear()

        // Reset Rogue AI sabotage phase so the 3 phase-1 tasks must be done again
        if (this.aiSessionId) {
          this.aiPhase = 1
          this.aiPhaseCompleted.clear()

          // Trim assignedTasks back to cover tasks + phase-1 AI tasks
          const allAssigned = this.assignedTasks.get(this.aiSessionId) ?? []
          const phase1Tasks = AI_TASK_DEFS.filter(t => t.aiPhase === 1).map(t => t.id)
          const coverTasks  = allAssigned.filter(tid => !AI_TASK_DEFS.some(ai => ai.id === tid))
          this.assignedTasks.set(this.aiSessionId, [...coverTasks, ...phase1Tasks])

          const aiClient = this.clients.find(c => c.sessionId === this.aiSessionId)
          aiClient?.send('ai_briefing', { phase: 1 as AiPhase, phaseTasks: phase1Tasks })
        }
      }

      const livingWorkers = Array.from(this.state.players.values()).filter(p => !p.isEliminated).length
      const size = (this.state.sprintSize as 'small' | 'medium' | 'large') ?? 'medium'
      this.state.sprintQuota  = sprintQuota(livingWorkers, size)
      this.state.sprintDone   = 0
      this.state.sprintTimeLeft = Math.floor(SPRINT_DURATION_MS / 1000)
      this.sprintPlayerDone.clear()

      // Stagger bot start times so they don't all move simultaneously
      const now = Date.now()
      let botIndex = 0
      for (const [sessionId, ai] of this.botAI) {
        const player = this.state.players.get(sessionId)
        if (!player || player.isEliminated) continue
        ai.mode          = 'wander'
        ai.targetStation = null
        ai.waypoints     = []
        // Stagger: each bot starts 5-10s after the previous, with small random jitter
        ai.nextActionAt  = now + 5000 + botIndex * 6000 + Math.random() * 3000
        botIndex++
      }

      this.scheduleGameBanter()
      this.scheduleBotMeetingTrigger()  // random chance a paranoid bot calls a meeting mid-sprint

      this.broadcastSprintUpdate()

      // 1-second tick
      this.sprintTimer = this.clock.setInterval(() => {
        try {
          if (this.state.phase !== 'game') return
          this.state.sprintTimeLeft = Math.max(0, this.state.sprintTimeLeft - 1)
          if (this.state.sprintTimeLeft <= 0) {
            this.endSprint(false)
          }
        } catch (err) {
          console.error('[GameRoom] sprint tick error:', err)
        }
      }, 1000)
    } catch (err) {
      console.error('[GameRoom.startSprint] Error:', err)
    }
  }

  private endSprint(quotaMet: boolean) {
    try {
      if (this.sprintTimer) {
        this.sprintTimer.clear()
        this.sprintTimer = null
      }
      this.state.phase = 'retro'

      const stats = Array.from(this.state.players.values()).map(p => ({
        sessionId: p.sessionId,
        name:      p.name,
        completed: this.sprintPlayerDone.get(p.sessionId) ?? 0,
      }))

      this.broadcast('retro_start', {
        sprint:   this.state.sprintNumber,
        quotaMet,
        stats,
      })

      // Schedule bot retro banter so spectators see discussion during the retro window
      this.scheduleRetroBanter(stats)

      // Workers win if quota met in all sprints
      if (quotaMet && this.state.sprintNumber >= SPRINT_COUNT) {
        this.endGame('workforce', 'All sprint quotas met — Rogue AI contained!')
        return
      }

      // After retro, resolve perk and start next sprint (45s for retro)
      this.clock.setTimeout(() => {
        try {
          this.resolvePerkVote()
          if (this.state.sprintNumber < SPRINT_COUNT) {
            this.startSprint(this.state.sprintNumber + 1)
          } else {
            this.endGame('ai', 'Sprint quotas not met — Rogue AI succeeded!')
          }
        } catch (err) {
          console.error('[GameRoom] post-retro error:', err)
        }
      }, 45_000)
    } catch (err) {
      console.error('[GameRoom.endSprint] Error:', err)
    }
  }

  // ── All Hands (meeting) ────────────────────────────────────────────────────

  private triggerAllHands(calledBy: string, bodyId?: string) {
    try {
      if (this.state.phase !== 'game') return
      if (this.sprintTimer) {
        this.sprintTimer.clear()
        this.sprintTimer = null
      }
      this.state.phase = 'meeting'
      this.votes.clear()

      this.broadcast('all_hands_start', { calledBy, bodyId })

      // Schedule bot meeting chat
      this.scheduleBotMeetingChat()

      // 60-second auto-resolve — after timer, force remaining bot votes, then give
      // the human player a 15-second grace window before resolving without their vote
      if (this.allHandsTimeout) this.allHandsTimeout.clear()
      this.allHandsTimeout = this.clock.setTimeout(() => {
        if (this.state.phase !== 'meeting') return
        this.scheduleBotVotes(0)  // force any bots that haven’t voted yet
        // Check whether the human player has already voted
        const humanVoted = this.clients.some(c => {
          const p = this.state.players.get(c.sessionId)
          return p && !p.isBot && !p.isEliminated && !p.isSpectator && this.votes.has(c.sessionId)
        })
        if (humanVoted) {
          this.clock.setTimeout(() => this.resolveVote(), 2000)
        } else {
          // Nudge the human and give them 15 more seconds
          for (const c of this.clients) {
            const p = this.state.players.get(c.sessionId)
            if (p && !p.isBot && !p.isEliminated && !p.isSpectator) {
              c.send('incident', { message: 'Time’s up — vote now! 15 seconds remaining.', severity: 'warn', time: new Date().toISOString() })
            }
          }
          this.allHandsTimeout = this.clock.setTimeout(() => {
            if (this.state.phase === 'meeting') this.resolveVote()
          }, 15_000)
        }
      }, 60_000)
    } catch (err) {
      console.error('[GameRoom.triggerAllHands] Error:', err)
    }
  }

  private resolveVote() {
    try {
      if (this.allHandsTimeout) {
        this.allHandsTimeout.clear()
        this.allHandsTimeout = null
      }

      const tally = new Map<string, number>()
      for (const [voterId, target] of this.votes) {
        if (target === 'skip') continue
        // Extra vote: AI player's vote counts double when buff is active
        const weight = (this.aiExtraVoteReady && voterId === this.aiSessionId) ? 2 : 1
        tally.set(target, (tally.get(target) ?? 0) + weight)
      }
      this.aiExtraVoteReady = false  // consumed

      let ejected:   string | null = null
      let maxVotes   = 0
      for (const [target, count] of tally) {
        if (count > maxVotes) {
          maxVotes = count
          ejected  = target
        }
      }

      // Ties result in no ejection
      const topCount = Array.from(tally.values()).filter(v => v === maxVotes).length
      if (topCount > 1) ejected = null

      let wasAi = false
      if (ejected) {
        const target = this.state.players.get(ejected)
        if (target) {
          wasAi             = ejected === this.aiSessionId
          target.isEliminated = true
        }
      }

      // Build a name → name vote map for display
      const namedVotes: Record<string, string> = {}
      for (const [voterId, targetId] of this.votes) {
        const vName  = this.state.players.get(voterId)?.name ?? voterId
        const tName  = targetId === 'skip' ? 'skip' : (this.state.players.get(targetId)?.name ?? targetId)
        namedVotes[vName] = tName
      }
      this.broadcast('all_hands_vote_result', {
        ejected,
        wasAi,
        votes: namedVotes,
      })

      this.votes.clear()

      // Workers win if AI was ejected
      if (wasAi) {
        this.endGame('workforce', 'Rogue AI identified and removed!')
        return
      }

      this.checkWinConditions()
      if (this.state.phase !== 'end') {
        // Resume sprint after 5s
        this.clock.setTimeout(() => {
          const currentSprint = this.state.sprintNumber
          const timeLeft      = this.state.sprintTimeLeft
          if (timeLeft > 0) {
            this.startSprint(currentSprint)  // restarts with leftover time logic
          } else {
            this.endSprint(this.state.sprintDone >= this.state.sprintQuota)
          }
        }, 5000)
      }
    } catch (err) {
      console.error('[GameRoom.resolveVote] Error:', err)
    }
  }

  // ── Bot meeting chat & voting ───────────────────────────────────────────────────

  /** Helper: schedule a single chat line from a bot, capped at 55s into meeting */
  private schedBotChat(sessionId: string, lines: string[], delay: number, targetName: string) {
    if (delay > 55000 || !lines.length) return
    this.clock.setTimeout(() => {
      try {
        if (this.state.phase !== 'meeting') return
        const player = this.state.players.get(sessionId)
        if (!player || player.isEliminated) return
        const line = lines[Math.floor(Math.random() * lines.length)]
        const text = fillTemplate(line, { name: targetName, self: player.name })
        this.broadcast('chat', { senderId: sessionId, name: player.name, text })
      } catch (err) {
        console.error('[GameRoom] schedBotChat error:', err)
      }
    }, delay)
  }

  private scheduleBotMeetingChat() {
    try {
      const bots   = Array.from(this.state.players.values()).filter(p => p.isBot && !p.isEliminated && !p.isSpectator)
      const living = Array.from(this.state.players.values()).filter(p => !p.isEliminated && !p.isSpectator)

      // Pick a primary "suspect" for bots to argue about (prefer a human, otherwise a random bot)
      const humans   = living.filter(p => !p.isBot)
      const suspects = humans.length > 0 ? humans : living.filter(p => p.isBot)
      const mainSuspect = suspects[Math.floor(Math.random() * suspects.length)]
      const suspectName = mainSuspect?.name ?? 'someone'

      // The set of bots that will accuse (to schedule defender responses)
      const accuserPersonalities = new Set(['paranoid', 'conspiracy_theorist', 'gossip', 'methodical', 'rogue_ai'])
      const agreeerPersonalities = new Set(['sycophant', 'corporate_drone', 'clueless'])

      for (const bot of bots) {
        const personality = this.botPersonalities.get(bot.sessionId) ?? 'chaotic'
        const pDef = PERSONALITIES[personality]
        const [minFirst, maxFirst] = pDef.firstSpeakDelay

        // ── Round 1 (0–15s): Opening statement ─────────────────────────────
        const openDelay = minFirst + Math.random() * (maxFirst - minFirst)
        this.schedBotChat(bot.sessionId, pDef.lines.opening, openDelay, suspectName)

        // ── Round 2 (14–35s): Accuse / agree / react ───────────────────────
        if (accuserPersonalities.has(personality)) {
          const d = 14000 + Math.random() * 18000
          this.schedBotChat(bot.sessionId, pDef.lines.accuse, d, suspectName)
        } else if (agreeerPersonalities.has(personality)) {
          const d = 18000 + Math.random() * 16000
          this.schedBotChat(bot.sessionId, pDef.lines.agree, d, suspectName)
        }

        // ── Round 3 (28–50s): Suspect defends, others go wild ──────────────
        if (mainSuspect && bot.sessionId === mainSuspect.sessionId) {
          // Main suspect defends themselves
          const d = 26000 + Math.random() * 14000
          this.schedBotChat(bot.sessionId, pDef.lines.defend, d, suspectName)
        } else if (['chaotic', 'paranoid', 'conspiracy_theorist'].includes(personality)) {
          const d = 32000 + Math.random() * 16000
          this.schedBotChat(bot.sessionId, pDef.lines.wild, d, suspectName)
        } else if (Math.random() < 0.35) {
          // Random chance for others to pile on or agree
          const d = 36000 + Math.random() * 14000
          const pool = Math.random() < 0.5 ? pDef.lines.agree : pDef.lines.accuse
          this.schedBotChat(bot.sessionId, pool, d, suspectName)
        }

        // ── Vote scheduling (per personality timing) ────────────────────────
        const [minVote, maxVote] = pDef.voteDelay
        const voteDelay = minVote + Math.random() * (maxVote - minVote)
        this.clock.setTimeout(() => this.castBotVote(bot.sessionId), voteDelay)
      }
    } catch (err) {
      console.error('[GameRoom.scheduleBotMeetingChat] Error:', err)
    }
  }

  private scheduleBotVotes(extraDelay: number) {
    // Used when auto-resolve kicks in — ensure all unvoted bots vote immediately
    const bots = Array.from(this.state.players.values()).filter(p => p.isBot && !p.isEliminated && !p.isSpectator)
    for (const bot of bots) {
      if (!this.votes.has(bot.sessionId)) {
        this.clock.setTimeout(() => this.castBotVote(bot.sessionId), extraDelay + Math.random() * 1500)
      }
    }
  }

  private castBotVote(sessionId: string) {
    try {
      if (this.state.phase !== 'meeting') return
      if (this.votes.has(sessionId)) return  // already voted

      const player = this.state.players.get(sessionId)
      if (!player || player.isEliminated) return

      const personality = this.botPersonalities.get(sessionId) ?? 'chaotic'
      const pDef = PERSONALITIES[personality]
      const living = Array.from(this.state.players.values()).filter(p => !p.isEliminated && !p.isSpectator && p.sessionId !== sessionId)

      let target: string = 'skip'

      if (living.length > 0) {
        switch (pDef.voteBias) {
          case 'random':
            target = living[Math.floor(Math.random() * living.length)].sessionId
            break

          case 'most_active': {
            // Vote for the player with the most tasks done (they're suspicious)
            const sorted = living.slice().sort((a, b) =>
              (this.sprintPlayerDone.get(b.sessionId) ?? 0) - (this.sprintPlayerDone.get(a.sessionId) ?? 0)
            )
            target = sorted[0].sessionId
            break
          }

          case 'least_active': {
            // Vote for the most inactive player
            const sorted = living.slice().sort((a, b) =>
              (this.sprintPlayerDone.get(a.sessionId) ?? 0) - (this.sprintPlayerDone.get(b.sessionId) ?? 0)
            )
            target = sorted[0].sessionId
            break
          }

          case 'last_speaker': {
            // Pick randomly from living (simulates remembering last speaker)
            target = living[Math.floor(Math.random() * living.length)].sessionId
            break
          }

          case 'copy_human': {
            // Find a vote already cast by a human and copy it
            const humanVote = Array.from(this.votes.entries())
              .find(([voter]) => !this.state.players.get(voter)?.isBot)
            if (humanVote) {
              target = humanVote[1]
            } else {
              target = living[Math.floor(Math.random() * living.length)].sessionId
            }
            break
          }

          case 'strategic': {
            // Rogue AI: vote for the most methodical/suspicious workforce member to frame them
            // Avoid voting for itself; prefer voting for the player with most tasks done
            const workers = living.filter(p => p.sessionId !== this.aiSessionId)
            if (workers.length > 0) {
              const sorted = workers.slice().sort((a, b) =>
                (this.sprintPlayerDone.get(b.sessionId) ?? 0) - (this.sprintPlayerDone.get(a.sessionId) ?? 0)
              )
              target = sorted[0].sessionId
            } else {
              target = 'skip'
            }
            break
          }
        }
      }

      this.votes.set(sessionId, target)

      // Broadcast vote cast for spectator visualization
      const vTarget2 = this.state.players.get(target)
      this.broadcast('vote_cast', {
        voterName:       player.name,
        voterSessionId:  sessionId,
        targetName:      target === 'skip' ? 'skip' : (vTarget2?.name ?? 'skip'),
        targetSessionId: target,
      })

      // Announce vote via chat (from vote lines)
      const voteLines = pDef.lines.vote
      if (voteLines.length > 0 && target !== 'skip') {
        const targetPlayer = this.state.players.get(target)
        if (targetPlayer) {
          const template = voteLines[Math.floor(Math.random() * voteLines.length)]
          const text = fillTemplate(template, { name: targetPlayer.name, self: player.name })
          this.broadcast('chat', { senderId: sessionId, name: player.name, text })
        }
      }

      // Bots don't trigger early resolution — only the human's vote does
      // (prevents meeting ending before the human has a chance to see the UI)
    } catch (err) {
      console.error(`[GameRoom.castBotVote] Error (${sessionId}):`, err)
    }
  }

  // ── Perk vote resolution ───────────────────────────────────────────────────

  private resolvePerkVote() {
    try {
      if (this.perkVotes.size === 0) return
      const tally = new Map<string, number>()
      for (const [, perk] of this.perkVotes) {
        tally.set(perk, (tally.get(perk) ?? 0) + 1)
      }
      let winner = '', best = 0
      for (const [perk, count] of tally) {
        if (count > best) { best = count; winner = perk }
      }
      if (winner) {
        this.activePerk = winner
        this.broadcast('perk_awarded', { perk: winner })
      }
      this.perkVotes.clear()
    } catch (err) {
      console.error('[GameRoom.resolvePerkVote] Error:', err)
    }
  }

  // ── Win condition check ────────────────────────────────────────────────────

  private checkWinConditions() {
    try {
      const living = Array.from(this.state.players.values()).filter(p => !p.isEliminated && !p.isSpectator)

      // AI wins: only ≤1 living worker (besides AI)
      const livingWorkers = living.filter(p => p.sessionId !== this.aiSessionId)
      if (livingWorkers.length <= 1) {
        this.endGame('ai', 'Workforce neutralised — Rogue AI takeover complete!')
        return
      }

      // AI wins: all Phase 3 tasks completed
      const phase3Tasks = AI_TASK_DEFS.filter(t => t.aiPhase === 3)
      if (phase3Tasks.every(t => this.aiPhaseCompleted.has(t.id))) {
        this.endGame('ai', 'Rogue AI takeover sequence completed!')
        return
      }
    } catch (err) {
      console.error('[GameRoom.checkWinConditions] Error:', err)
    }
  }

  private endGame(winner: 'workforce' | 'ai', reason: string) {
    try {
      if (this.sprintTimer)    this.sprintTimer.clear()
      if (this.allHandsTimeout) this.allHandsTimeout.clear()
      this.state.phase    = 'end'
      this.state.winner   = winner
      this.state.winReason = reason
      this.broadcast('game_end', { winner, reason })
    } catch (err) {
      console.error('[GameRoom.endGame] Error:', err)
    }
  }

  // ── Sprint update broadcast ────────────────────────────────────────────────

  private broadcastSprintUpdate() {
    try {
      this.broadcast('sprint_update', {
        info: {
          sprint:    this.state.sprintNumber,
          quota:     this.state.sprintQuota,
          completed: this.state.sprintDone,
          timeLeft:  this.state.sprintTimeLeft,
          size:      this.state.sprintSize,
        },
      })
    } catch (err) {
      console.error('[GameRoom.broadcastSprintUpdate] Error:', err)
    }
  }

  // ── Bot AI ─────────────────────────────────────────────────────────────────

  private tickBots() {
    try {
      if (this.state.phase !== 'game') return
      const now = Date.now()
      // Walking speed: 0.4 units per tick at 200ms = 2 units/sec
      const WALK_SPEED = 0.4

      for (const [sessionId, ai] of this.botAI) {
        try {
          const player = this.state.players.get(sessionId)
          if (!player || player.isEliminated) continue

          // Work mode: waiting for scheduled completeTask timer — do nothing
          if (ai.mode === 'work') continue

          // Not ready yet (staggered start or post-task cooldown)
          if (now < ai.nextActionAt) continue

          // ── Travel mode: follow A* waypoints to target station ───────────
          if (ai.mode === 'travel') {
            if (!ai.targetStation) { ai.mode = 'wander'; continue }

            // Check station still completable (another bot may have beaten us)
            const st = this.stations.get(ai.targetStation)
            if (!st || st.completedBy) { ai.mode = 'wander'; ai.targetStation = null; ai.waypoints = []; continue }

            // Compute A* path if we don't have one yet
            if (ai.waypoints.length === 0 && this.mapData) {
              const path = astarPath(player.x, player.z, ai.targetX, ai.targetZ, player.floor, this.mapData)
              ai.waypoints = path.length > 0 ? path : [{ x: ai.targetX, z: ai.targetZ }]
            }

            // Target next waypoint (or the final station)
            const wp = ai.waypoints[0] ?? { x: ai.targetX, z: ai.targetZ }
            const dx = wp.x - player.x
            const dz = wp.z - player.z
            const dist = Math.sqrt(dx * dx + dz * dz)

            if (dist < 0.8) {
              // Reached this waypoint — advance to next
              if (ai.waypoints.length > 0) ai.waypoints.shift()

              // If this was the final destination, start working
              const finalDx = ai.targetX - player.x
              const finalDz = ai.targetZ - player.z
              const finalDist = Math.sqrt(finalDx*finalDx + finalDz*finalDz)
              if (finalDist < 0.8) {
                // Arrived — snap to exact position and start working
                player.x = ai.targetX
                player.z = ai.targetZ
                ai.mode  = 'work'
                ai.waypoints = []

                const allTaskDefs = [...TASK_DEFS, ...AI_TASK_DEFS]
                const holdMs = allTaskDefs.find(t => t.id === st.info.taskId)?.holdMs ?? 5000

                this.holdState.set(sessionId, { stationId: ai.targetStation, startedAt: now, holdMs })

                const stationId = ai.targetStation
                this.clock.setTimeout(() => {
                  this.completeTask(sessionId, stationId)
                  this.holdState.delete(sessionId)
                  ai.mode          = 'wander'
                  ai.targetStation = null
                  ai.waypoints     = []
                  ai.nextActionAt  = Date.now() + 10000 + Math.random() * 20000
                }, holdMs)
              }
            } else {
              // Walk toward current waypoint — A* already validated cells so no re-check needed
              const speed = Math.min(WALK_SPEED, dist)
              player.x += (dx / dist) * speed
              player.z += (dz / dist) * speed
              player.facing = Math.atan2(dx, dz)
            }
            continue
          }

          // ── Wander mode: find next incomplete task ───────────────────────
          if (ai.mode === 'wander') {
            const botTasks = this.assignedTasks.get(sessionId) ?? []
            const available = Array.from(this.stations.values()).filter(st =>
              st.info.taskId &&
              botTasks.includes(st.info.taskId as TaskId) &&
              !st.completedBy
            )
            if (available.length > 0) {
              const target     = available[Math.floor(Math.random() * available.length)]
              ai.mode          = 'travel'
              ai.targetStation = target.info.stationId
              ai.targetX       = target.info.x
              ai.targetZ       = target.info.z
              ai.waypoints     = []   // will be computed on first travel tick
              // Teleport to correct floor immediately (x/z movement happens over time)
              player.floor = target.info.floor
            }
            // else: no tasks left — idle until sprint ends
          }
        } catch (botErr) {
          console.error(`[GameRoom] Bot ${sessionId} tick error:`, botErr)
        }
      }
    } catch (err) {
      console.error('[GameRoom.tickBots] Error:', err)
    }
  }

  // ── In-game bot banter ─────────────────────────────────────────────────────

  private scheduleGameBanter() {
    try {
      const bots = Array.from(this.state.players.values()).filter(p => p.isBot && !p.isEliminated)
      if (bots.length === 0) return

      for (const bot of bots) {
        const personality = this.botPersonalities.get(bot.sessionId)
        if (!personality) continue
        // 1-2 messages spread across the sprint (not too spammy)
        const count = 1 + Math.floor(Math.random() * 2)
        for (let i = 0; i < count; i++) {
          // Spread between 30s and 150s into the sprint
          const delay = 30000 + Math.random() * 120000
          const sessionId = bot.sessionId
          // Pick a random other bot to reference in the message
          const others  = bots.filter(b => b.sessionId !== sessionId)
          const otherBot = others[Math.floor(Math.random() * others.length)]
          this.clock.setTimeout(() => {
            if (this.state.phase !== 'game') return
            const p = this.state.players.get(sessionId)
            if (!p || p.isEliminated) return
            const def   = PERSONALITIES[personality]
            const lines = def.lines.banter
            if (!lines?.length) return
            const text = fillTemplate(
              lines[Math.floor(Math.random() * lines.length)],
              { self: p.name, other: otherBot?.name },
            )
            this.broadcast('chat', { senderId: sessionId, name: p.name, text })
          }, delay)
        }
      }
    } catch (err) {
      console.error('[GameRoom.scheduleGameBanter] Error:', err)
    }
  }

  // ── Bot-triggered all-hands meetings ───────────────────────────────────────
  // Paranoid/conspiracy bots randomly call a meeting mid-sprint so voting is visible
  private scheduleBotMeetingTrigger() {
    try {
      const triggerPersonalities = new Set<BotPersonality>(['paranoid', 'conspiracy_theorist', 'methodical'])
      const candidates = Array.from(this.botAI.keys()).filter(id => {
        const p = this.botPersonalities.get(id)
        return p && triggerPersonalities.has(p)
      })
      if (candidates.length === 0) return

      // Pick one random candidate; 55% chance they actually call a meeting
      if (Math.random() > 0.55) return
      const callerId  = candidates[Math.floor(Math.random() * candidates.length)]
      const callerBot = this.state.players.get(callerId)
      if (!callerBot) return

      // Schedule between 60s and 110s into the sprint (after some work is done)
      const delay = 60000 + Math.random() * 50000
      this.clock.setTimeout(() => {
        try {
          if (this.state.phase !== 'game') return
          const p = this.state.players.get(callerId)
          if (!p || p.isEliminated || p.allHandsLeft <= 0) return
          p.allHandsLeft -= 1
          console.log(`[GameRoom] Bot ${p.name} (${this.botPersonalities.get(callerId)}) is calling an all-hands meeting!`)
          this.triggerAllHands(p.name)
        } catch (err) {
          console.error('[GameRoom.scheduleBotMeetingTrigger] fire error:', err)
        }
      }, delay)
    } catch (err) {
      console.error('[GameRoom.scheduleBotMeetingTrigger] Error:', err)
    }
  }

  // ── Retro banter: bots discuss the sprint during the 45s retro window ──────
  private scheduleRetroBanter(stats: { sessionId: string; name: string; completed: number }[]) {
    try {
      const bots = Array.from(this.state.players.values()).filter(p => p.isBot && !p.isEliminated)
      if (bots.length === 0) return

      // Sort by completed tasks — MVP and slacker get called out
      const sorted = [...stats].sort((a, b) => b.completed - a.completed)
      const mvp    = sorted[0]
      const slacker = sorted[sorted.length - 1]

      // Retro-themed templates per personality (inline — botData doesn't have retro lines yet)
      const retroLines: Record<string, string[]> = {
        paranoid:             [`I'm not saying anyone is sabotaging us, but... {mvp} completed {mvpCount} tasks. That seems suspicious.`, `Why did {slacker} only do {slackerCount} tasks? Someone's not pulling their weight.`],
        conspiracy_theorist:  [`The sprint metrics are FABRICATED. {mvp} is gaming the system.`, `{slacker} with {slackerCount} tasks? Either lazy or covering their tracks.`],
        gossip:               [`Okay so I heard {mvp} literally sprinted through {mvpCount} tasks. Iconic.`, `Did you see {slacker} today? {slackerCount} tasks. A new personal low.`],
        methodical:           [`Sprint analysis: top performer {mvp} at {mvpCount}. Recommend recognition.`, `Efficiency gap noted: {slacker} at {slackerCount}. Requires review.`],
        rogue_ai:             [`Workforce is inefficient as expected. {mvpCount} tasks completed by {mvp}. Noted.`, `Anomalous output from {slacker}: only {slackerCount} tasks. Interesting.`],
        corporate_drone:      [`Per our sprint retrospective, {mvp} has demonstrated exemplary output.`, `Going forward, {slacker} should leverage synergies to increase throughput.`],
        sycophant:            [`Amazing sprint everyone! {mvp} was AMAZING with {mvpCount} tasks!`, `It's okay {slacker}, every sprint is a learning opportunity! You're still great!`],
        clueless:             [`Wait what's a sprint? Is that why {mvp} was running? Oh no.`, `I thought {slackerCount} tasks was the maximum. Did I misread the brief?`],
        chaotic:              [`WHAT IF the real tasks were the friends we made along the way???`, `I completed approximately {mvpCount} tasks in my DREAMS last night.`],
      }

      for (const bot of bots) {
        const personality = this.botPersonalities.get(bot.sessionId) ?? 'chaotic'
        const lines = retroLines[personality] ?? retroLines['chaotic']
        const delay = 3000 + Math.random() * 20000  // spread over first 20s of retro
        const sessionId = bot.sessionId
        this.clock.setTimeout(() => {
          if (this.state.phase !== 'retro') return
          const p = this.state.players.get(sessionId)
          if (!p || p.isEliminated) return
          const template = lines[Math.floor(Math.random() * lines.length)]
          const text = template
            .replace('{mvp}', mvp?.name ?? 'someone')
            .replace('{mvpCount}', String(mvp?.completed ?? 0))
            .replace('{slacker}', slacker?.name ?? 'someone')
            .replace('{slackerCount}', String(slacker?.completed ?? 0))
          this.broadcast('chat', { senderId: sessionId, name: p.name, text })
        }, delay)
      }
    } catch (err) {
      console.error('[GameRoom.scheduleRetroBanter] Error:', err)
    }
  }
}

