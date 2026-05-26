import { create } from 'zustand'
import type { Room } from 'colyseus.js'
import type { PlayerRole, StationInfo, TaskId, BodyInfo, SprintInfo } from '@shared/types'

// ── Lobby player (mapped from Colyseus schema) ────────────────────────────────
export interface LobbyPlayer {
  sessionId:    string
  name:         string
  x:            number
  z:            number
  facing:       number
  role:         string
  connected:    boolean
  isBot:        boolean
  isEliminated: boolean
  isSpectator:  boolean
  allHandsLeft: number
  floor:        number
}

// ── Task completion toast ─────────────────────────────────────────────────────
export interface TaskToast {
  id:         string
  playerName: string
  taskId:     TaskId
  expiresAt:  number
}

// ── Retro data (from retro_start message) ─────────────────────────────────────
export interface RetroData {
  sprint:   number
  quotaMet: boolean
  stats:    Array<{ sessionId: string; name: string; completed: number }>
}

// ── Store shape ───────────────────────────────────────────────────────────────
interface GameRoomStore {
  room:               Room | null
  myRole:             PlayerRole | null
  myAssignedTasks:    TaskId[]
  myIsAi:             boolean
  aiPhase:            number
  aiPhaseTasks:       TaskId[]
  players:            LobbyPlayer[]
  incidents:          { text: string; type: 'info' | 'warn' | 'danger' | 'success'; time: string }[]
  gameEnd:            { winner: string; reason: string } | null
  stations:           StationInfo[]
  completedTasks:     Set<TaskId>
  holdingStationId:   string | null
  holdStartedAt:      number
  toasts:             TaskToast[]
  bodies:             BodyInfo[]
  sprint:             SprintInfo | null
  retroData:          RetroData | null
  mapSeed:            string
  mapSize:            'small' | 'medium' | 'large'
  isSpectator:        boolean
  spectateTarget:     string | null
  aiRevealedId:       string | null
  aiRevealedTasks:    TaskId[]

  setRoom:            (room: Room) => void
  setRole:            (role: PlayerRole, assignedTasks: TaskId[]) => void
  setAiBriefing:      (phase: number, phaseTasks: TaskId[]) => void
  setPlayers:         (players: LobbyPlayer[]) => void
  addIncident:        (text: string, type?: GameRoomStore['incidents'][0]['type'], time?: string) => void
  setGameEnd:         (winner: string, reason: string) => void
  setStations:        (stations: StationInfo[]) => void
  completeTask:       (taskId: TaskId) => void
  setHolding:         (stationId: string | null) => void
  addToast:           (toast: Omit<TaskToast, 'id'>) => void
  clearExpiredToasts: () => void
  addBody:            (body: BodyInfo) => void
  removeBody:         (bodyId: string) => void
  setSprint:          (info: SprintInfo) => void
  setRetroData:       (data: RetroData | null) => void
  setMapConfig:       (seed: string, size: 'small' | 'medium' | 'large') => void
  setSpectator:       (isSpectator: boolean) => void
  setSpectateTarget:  (sessionId: string | null) => void
  setAiRevealed:      (sessionId: string, tasks: TaskId[]) => void
  clearRoom:          () => void
}

export const useGameRoom = create<GameRoomStore>((set) => ({
  room:             null,
  myRole:           null,
  myAssignedTasks:  [],
  myIsAi:           false,
  aiPhase:          0,
  aiPhaseTasks:     [],
  players:          [],
  incidents:        [],
  gameEnd:          null,
  stations:         [],
  completedTasks:   new Set(),
  holdingStationId: null,
  holdStartedAt:    0,
  toasts:           [],
  bodies:           [],
  sprint:           null,
  retroData:        null,
  mapSeed:          '',
  mapSize:          'small' as const,
  isSpectator:      false,
  spectateTarget:   null,
  aiRevealedId:     null,
  aiRevealedTasks:  [],

  setRoom:          (room) => set({ room }),
  setRole:          (myRole, myAssignedTasks) => set({ myRole, myAssignedTasks }),
  setAiBriefing:    (aiPhase, aiPhaseTasks) => set(s => ({
    myIsAi:      true,
    aiPhase,
    aiPhaseTasks: [...s.aiPhaseTasks, ...aiPhaseTasks],
  })),
  setPlayers:       (players) => set({ players }),
  addIncident:      (text, type = 'info', time) => set(s => ({
    incidents: [...s.incidents.slice(-49), {
      text, type,
      time: time ?? new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
    }],
  })),
  setGameEnd:       (winner, reason) => set({ gameEnd: { winner, reason } }),
  setStations:      (stations) => set({ stations }),
  completeTask:     (taskId) => set(s => ({ completedTasks: new Set([...s.completedTasks, taskId]) })),
  setHolding:       (holdingStationId) => set({ holdingStationId, holdStartedAt: holdingStationId ? Date.now() : 0 }),
  addToast:         (toast) => set(s => ({
    toasts: [...s.toasts, { ...toast, id: Math.random().toString(36).slice(2) }],
  })),
  clearExpiredToasts: () => set(s => ({ toasts: s.toasts.filter(t => t.expiresAt > Date.now()) })),
  addBody:          (body) => set(s => ({ bodies: [...s.bodies.filter(b => b.bodyId !== body.bodyId), body] })),
  removeBody:       (bodyId) => set(s => ({ bodies: s.bodies.filter(b => b.bodyId !== bodyId) })),
  setSprint:        (sprint) => set({ sprint }),
  setRetroData:     (retroData) => set({ retroData }),
  setMapConfig:     (mapSeed, mapSize) => set({ mapSeed, mapSize }),
  setSpectator:     (isSpectator) => {
    console.log(`[BENI:store] setSpectator(${isSpectator})`)
    set({ isSpectator })
  },
  setSpectateTarget:(spectateTarget) => set({ spectateTarget }),
  setAiRevealed:    (aiRevealedId, aiRevealedTasks) => set({ aiRevealedId, aiRevealedTasks }),
  clearRoom:        () => {
    console.log('[BENI:store] clearRoom() called — isSpectator → false')
    set({
      room: null, myRole: null, myAssignedTasks: [], myIsAi: false,
      aiPhase: 0, aiPhaseTasks: [], players: [], incidents: [], gameEnd: null,
      stations: [], completedTasks: new Set(), holdingStationId: null,
      holdStartedAt: 0, toasts: [], bodies: [], sprint: null, retroData: null,
      isSpectator: false, spectateTarget: null, aiRevealedId: null, aiRevealedTasks: [],
    })
  },
}))
