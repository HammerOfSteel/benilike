import { create } from 'zustand'
import type { Room } from 'colyseus.js'
import type { PlayerRole, Faction } from '@shared/types'

export interface LobbyPlayer {
  sessionId: string
  name:      string
  connected: boolean
}

interface GameRoomStore {
  room:         Room | null
  myRole:       PlayerRole | null
  myFaction:    Faction | null
  players:      LobbyPlayer[]
  incidents:    { text: string; type: 'info' | 'warn' | 'danger' | 'success'; time: string }[]
  setRoom:      (room: Room) => void
  setRole:      (role: PlayerRole, faction: Faction) => void
  setPlayers:   (players: LobbyPlayer[]) => void
  addIncident:  (text: string, type?: GameRoomStore['incidents'][0]['type'], time?: string) => void
  clearRoom:    () => void
}

export const useGameRoom = create<GameRoomStore>((set) => ({
  room:       null,
  myRole:     null,
  myFaction:  null,
  players:    [],
  incidents:  [],

  setRoom:    (room) => set({ room }),
  setRole:    (role, faction) => set({ myRole: role, myFaction: faction }),
  setPlayers: (players) => set({ players }),
  addIncident:(text, type = 'info', time) => set(s => ({
    incidents: [...s.incidents.slice(-40), {
      text,
      type,
      time: time ?? new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
    }],
  })),
  clearRoom:  () => set({ room: null, myRole: null, myFaction: null, players: [], incidents: [] }),
}))
