import { Schema, MapSchema, SetSchema, type, ArraySchema } from '@colyseus/schema'

export class Player extends Schema {
  @type('string')  sessionId  = ''
  @type('string')  name       = ''
  @type('string')  role       = ''
  @type('number')  x          = 0
  @type('number')  z          = 0
  @type('number')  floor      = 0
  @type('number')  facing     = 0
  @type('boolean') isBot      = false
  @type('boolean') isEliminated = false
  @type('boolean') isSpectator  = false
  @type('number')  allHandsLeft = 2
}

export class Body extends Schema {
  @type('string') bodyId = ''
  @type('string') name   = ''
  @type('number') x      = 0
  @type('number') z      = 0
  @type('number') floor  = 0
  @type('number') facing = 0
}

export class GameState extends Schema {
  @type({ map: Player }) players       = new MapSchema<Player>()
  @type({ map: Body })   bodies        = new MapSchema<Body>()
  @type({ set: 'string' }) completedTasks = new SetSchema<string>()
  @type('string')  phase               = 'lobby'  // lobby | briefing | game | meeting | retro | end
  @type('string')  winner              = ''
  @type('string')  winReason           = ''
  // ── Sprint fields ─────────────────────────────────────────────────────────
  @type('number')  sprintNumber        = 0
  @type('number')  sprintQuota         = 0
  @type('number')  sprintDone          = 0
  @type('number')  sprintTimeLeft      = 0
  @type('string')  sprintSize          = 'medium'
}
