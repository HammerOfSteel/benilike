import { Client } from 'colyseus.js'

const SERVER_URL = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'ws://localhost:2567'

export const colyseusClient = new Client(SERVER_URL)
