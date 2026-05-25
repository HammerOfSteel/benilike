import { create } from 'zustand'
import type { Room } from 'colyseus.js'
import type { PlayerRole, Faction } from '@shared/types'

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
}

interface GameRoomStore {
  room:             Room | null
  myRole:           PlayerRole | null
  myFaction:        Faction | null
  players:          LobbyPlayer[]
  incidents:        { text: string; type: 'info' | 'warn' | 'danger' | 'success'; time: string }[]
  terminalProgress: number
  gameEnd:          { winner: string; reason: string } | null
  setRoom:      (room: Room) => void
  setRole:      (role: PlayerRole, faction: Faction) => void
  setPlayers:   (players: LobbyPlayer[]) => void
  addIncident:  (text: string, type?: GameRoomStore['incidents'][0]['type'], time?: string) => void
  setTerminalProgress: (v: number) => void
  setGameEnd:   (winner: string, reason: string) => void
  clearRoom:    () => void
}

export const useGameRoom = create<GameRoomStore>((set) => ({
  room:       null,
  myRole:     null,
  myFaction:  null,
  players:    [],
  incidents:  [],
  terminalProgress: 50,
  gameEnd:          null,

  setRoom:    (room) => set({ room }),
  setRole:    (role, faction) => set({ myRole: role, myFaction: faction }),
  setPlayers: (players) => set({ players }),
  setTerminalProgress: (terminalProgress) => set({ terminalProgress }),
  setGameEnd:   (winner, reason) => set({ gameEnd: { winner, reason } }),
  addIncident:(text, type = 'info', time) => set(s => ({
    incidents: [...s.incidents.slice(-40), {
      text,
      type,
      time: time ?? new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
    }],
  })),
  clearRoom:  () => set({ room: null, myRole: null, myFaction: null, players: [], incidents: [], gameEnd: null, terminalProgress: 50 }),
}))
