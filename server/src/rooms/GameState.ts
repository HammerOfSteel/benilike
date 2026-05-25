import 'reflect-metadata'
import { Schema, type, MapSchema } from '@colyseus/schema'

export class Player extends Schema {
  @type('string')  sessionId: string  = ''
  @type('string')  name: string       = ''
  @type('string')  role: string       = ''
  @type('string')  faction: string    = ''
  @type('float32') x: number          = 0
  @type('float32') z: number          = 0
  @type('float32') facing: number     = 0
  @type('boolean') connected: boolean = true
  @type('boolean') isBot: boolean     = false
  @type('boolean') disguised: boolean = false  // Social Engineer / Insider passive
}

export class GameState extends Schema {
  @type({ map: Player }) players    = new MapSchema<Player>()
  @type('number')        reputation = 100
  @type('string')        phase      = 'waiting'  // waiting | playing | ended
  @type('string')        mapSeed    = ''
  @type('string')        mapSize    = 'medium'
  @type('string')        winner     = ''          // 'workforce' | 'opposition' | ''
  @type('float32')       terminalProgress = 50    // 0 = opp wins, 100 = workforce wins
  @type('boolean')       trapPlanted:    boolean = false
  @type('boolean')       lockdownActive: boolean = false
}
