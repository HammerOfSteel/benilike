import { create } from 'zustand'
import type { Room } from 'colyseus.js'
import type { PlayerRole, Faction, EffectUpdate } from '@shared/types'

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
}

export interface PingMarker {
  id:        string
  x:         number
  z:         number
  expiresAt: number
  pingType:  'hr' | 'spy'
}

export type ActiveEffects = EffectUpdate

const DEFAULT_EFFECTS: ActiveEffects = {
  hotfixActive:    false,
  speedBoostActive: false,
  frozenActive:    false,
  marketingActive: false,
  lockdownActive:  false,
  trapPlanted:     false,
}

interface GameRoomStore {
  room:             Room | null
  myRole:           PlayerRole | null
  myFaction:        Faction | null
  players:          LobbyPlayer[]
  incidents:        { text: string; type: 'info' | 'warn' | 'danger' | 'success'; time: string }[]
  terminalProgress: number
  gameEnd:          { winner: string; reason: string } | null
  activeEffects:    ActiveEffects
  pingMarkers:      PingMarker[]
  myLastAbilityTime: number
  setRoom:      (room: Room) => void
  setRole:      (role: PlayerRole, faction: Faction) => void
  setPlayers:   (players: LobbyPlayer[]) => void
  addIncident:  (text: string, type?: GameRoomStore['incidents'][0]['type'], time?: string) => void
  setTerminalProgress: (v: number) => void
  setGameEnd:   (winner: string, reason: string) => void
  setActiveEffects: (e: ActiveEffects) => void
  addPings:     (pings: Omit<PingMarker, 'id'>[]) => void
  clearExpiredPings: () => void
  setMyLastAbilityTime: (t: number) => void
  clearRoom:    () => void
}

export const useGameRoom = create<GameRoomStore>((set) => ({
  room:             null,
  myRole:           null,
  myFaction:        null,
  players:          [],
  incidents:        [],
  terminalProgress: 50,
  gameEnd:          null,
  activeEffects:    { ...DEFAULT_EFFECTS },
  pingMarkers:      [],
  myLastAbilityTime: 0,

  setRoom:    (room) => set({ room }),
  setRole:    (role, faction) => set({ myRole: role, myFaction: faction }),
  setPlayers: (players) => set({ players }),
  setTerminalProgress: (terminalProgress) => set({ terminalProgress }),
  setGameEnd:   (winner, reason) => set({ gameEnd: { winner, reason } }),
  setActiveEffects: (activeEffects) => set({ activeEffects }),
  addPings: (pings) => set(s => ({
    pingMarkers: [
      ...s.pingMarkers,
      ...pings.map((p, i) => ({ ...p, id: `${Date.now()}-${i}` })),
    ],
  })),
  clearExpiredPings: () => set(s => ({
    pingMarkers: s.pingMarkers.filter(p => p.expiresAt > Date.now()),
  })),
  setMyLastAbilityTime: (myLastAbilityTime) => set({ myLastAbilityTime }),
  addIncident: (text, type = 'info', time) => set(s => ({
    incidents: [...s.incidents.slice(-40), {
      text,
      type,
      time: time ?? new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
    }],
  })),
  clearRoom: () => set({
    room: null, myRole: null, myFaction: null, players: [], incidents: [],
    gameEnd: null, terminalProgress: 50,
    activeEffects: { ...DEFAULT_EFFECTS }, pingMarkers: [], myLastAbilityTime: 0,
  }),
}))
