import { create } from 'zustand'
import type { Room } from 'colyseus.js'
import type { PlayerRole, Faction, EffectUpdate, StationInfo, TaskId } from '@shared/types'

export interface LobbyPlayer {
  sessionId: string
  name:      string
  x:         number
  z:         number
  facing:    number
  faction:   string
  role:      string
  connected: boolean
  isBot:     boolean
  disguised: boolean
  slowed:    boolean
  floor:     number
}

export interface TaskToast {
  id:         string
  role:       string
  effectDesc: string
  meterGain:  number
  expiresAt:  number
}

export type ActiveEffects = EffectUpdate

const DEFAULT_EFFECTS: ActiveEffects = {
  workforceSpeedActive:  false,
  lockdownActive:        false,
  workforceHoldSlow:     false,
  oppositionHoldSlow:    false,
  hackerCorruption:      false,
  ciPipelineActive:      false,
  badgeRenewalRequired:  false,
}

interface GameRoomStore {
  room:             Room | null
  myRole:           PlayerRole | null
  myFaction:        Faction | null
  players:          LobbyPlayer[]
  incidents:        { text: string; type: 'info' | 'warn' | 'danger' | 'success'; time: string }[]
  workforceMeter:   number
  oppositionMeter:  number
  gameEnd:          { winner: string; reason: string } | null
  activeEffects:    ActiveEffects
  stations:         StationInfo[]
  completedTasks:   Set<TaskId>
  holdingStationId: string | null
  holdStartedAt:    number
  toasts:           TaskToast[]
  monitorSnapshot:  { rackA: number; rackB: number; rackC: number } | null
  mapSeed:          string
  mapSize:          'small' | 'medium' | 'large'

  setRoom:            (room: Room) => void
  setRole:            (role: PlayerRole, faction: Faction) => void
  setPlayers:         (players: LobbyPlayer[]) => void
  addIncident:        (text: string, type?: GameRoomStore['incidents'][0]['type'], time?: string) => void
  setMeters:          (workforce: number, opposition: number) => void
  setGameEnd:         (winner: string, reason: string) => void
  setActiveEffects:   (e: ActiveEffects) => void
  setStations:        (stations: StationInfo[]) => void
  completeTask:       (taskId: TaskId) => void
  setHolding:         (stationId: string | null) => void
  addToast:           (toast: Omit<TaskToast, 'id'>) => void
  clearExpiredToasts: () => void
  setMonitorSnapshot: (s: { rackA: number; rackB: number; rackC: number } | null) => void
  setMapConfig:       (seed: string, size: 'small' | 'medium' | 'large') => void
  clearRoom:          () => void
}

export const useGameRoom = create<GameRoomStore>((set) => ({
  room:             null,
  myRole:           null,
  myFaction:        null,
  players:          [],
  incidents:        [],
  workforceMeter:   0,
  oppositionMeter:  0,
  gameEnd:          null,
  activeEffects:    { ...DEFAULT_EFFECTS },
  stations:         [],
  completedTasks:   new Set(),
  holdingStationId: null,
  holdStartedAt:    0,
  toasts:           [],
  monitorSnapshot:  null,
  mapSeed:          '',
  mapSize:          'small' as const,

  setRoom:          (room) => set({ room }),
  setRole:          (myRole, myFaction) => set({ myRole, myFaction }),
  setPlayers:       (players) => set({ players }),
  addIncident:      (text, type = 'info', time) => set(s => ({
    incidents: [...s.incidents.slice(-49), {
      text, type,
      time: time ?? new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
    }],
  })),
  setMeters:        (workforceMeter, oppositionMeter) => set({ workforceMeter, oppositionMeter }),
  setGameEnd:       (winner, reason) => set({ gameEnd: { winner, reason } }),
  setActiveEffects: (activeEffects) => set({ activeEffects }),
  setStations:      (stations) => set({ stations }),
  completeTask:     (taskId) => set(s => ({ completedTasks: new Set([...s.completedTasks, taskId]) })),
  setHolding:       (holdingStationId) => set({ holdingStationId, holdStartedAt: holdingStationId ? Date.now() : 0 }),
  addToast:         (toast) => set(s => ({
    toasts: [...s.toasts, { ...toast, id: Math.random().toString(36).slice(2) }],
  })),
  clearExpiredToasts: () => set(s => ({ toasts: s.toasts.filter(t => t.expiresAt > Date.now()) })),
  setMonitorSnapshot: (monitorSnapshot) => set({ monitorSnapshot }),
  setMapConfig:       (mapSeed, mapSize) => set({ mapSeed, mapSize }),
  clearRoom:          () => set({
    room: null, myRole: null, myFaction: null, players: [], incidents: [],
    workforceMeter: 0, oppositionMeter: 0, gameEnd: null,
    activeEffects: { ...DEFAULT_EFFECTS }, stations: [], completedTasks: new Set(),
    holdingStationId: null, holdStartedAt: 0, toasts: [], monitorSnapshot: null,
  }),
}))
