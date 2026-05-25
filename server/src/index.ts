import 'reflect-metadata'
import { createServer } from 'http'
import express from 'express'
import cors from 'cors'
import { Server } from 'colyseus'
import { GameRoom } from './rooms/GameRoom'
import { SERVER_PORT } from '../../shared/src/types'

const port = Number(process.env.PORT) || SERVER_PORT
const app  = express()

app.use(cors({ origin: '*' }))
app.use(express.json())

// ── Health check (Vercel / Railway probe) ─────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── Colyseus ─────────────────────────────────────────────────────────────────
const httpServer  = createServer(app)
const gameServer  = new Server({ server: httpServer })

gameServer.define('game_room', GameRoom)

// Pretty-print registered rooms on startup
gameServer.onShutdown(() => {
  console.log('[BENILIKE] Server shutting down')
})

gameServer.listen(port).then(() => {
  console.log(`
╔══════════════════════════════════════╗
║  BENISOFT CORP — INCIDENT RESPONSE   ║
║  Server running on :${String(port).padEnd(17)}║
╚══════════════════════════════════════╝
  `)
})
