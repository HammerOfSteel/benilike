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
  @type('boolean') disguised: boolean = false
  @type('boolean') slowed: boolean    = false
  @type('int8')    floor: number      = 0
}

export class GameState extends Schema {
  @type({ map: Player }) players         = new MapSchema<Player>()
  @type('string')        phase           = 'waiting'   // waiting | playing | ended
  @type('string')        mapSeed         = ''
  @type('string')        mapSize         = 'medium'
  @type('string')        winner          = ''
  @type('float32')       workforceMeter:  number = 0
  @type('float32')       oppositionMeter: number = 0
  @type('float32')       rackHealthA:     number = 100
  @type('float32')       rackHealthB:     number = 100
  @type('float32')       rackHealthC:     number = 100
  @type('boolean')       lockdownActive:  boolean = false
}
