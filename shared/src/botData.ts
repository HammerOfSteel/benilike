/**
 * Bot names, personalities, and meeting-chat templates.
 * Used by server (GameRoom) and optionally by client for display.
 */

// ── Name generation ───────────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Dave', 'Karen', 'Greg', 'Brenda', 'Phil', 'Steve', 'Janet', 'Barry',
  'Linda', 'Todd', 'Debra', 'Gary', 'Susan', 'Mark', 'Patricia', 'Kenneth',
  'Nancy', 'Dennis', 'Sandra', 'Larry', 'Donna', 'Carl', 'Maureen', 'Brian',
  'Shirley', 'Roger', 'Pamela', 'Raymond', 'Dorothy', 'Scott', 'Bev', 'Glenn',
  'Cheryl', 'Wayne', 'Roberta', 'Keith', 'Norma', 'Clive', 'Marjorie', 'Des',
]

const LAST_NAMES = [
  'Null', 'Parsemore', 'Undefined', 'Stacktrace', 'Callback', 'Exception',
  'Overflow', 'Deadlock', 'Deprecated', 'Timeout', 'Singleton', 'Bootleg',
  'Gigabyte', 'Megaflop', 'Bandwidth', 'Firewall', 'Localhost', 'Namespace',
  'Hashtag', 'Middleware', 'Cronjob', 'Syslog', 'Pagefault', 'Icecache',
  'Endianness', 'Polymorphic', 'Kernelpanic', 'Segfault', 'Bytecode', 'Reboot',
  'Cloudsworth', 'Agilesworth', 'McPivot', 'De-Scope', 'Outsourced', 'Flameout',
]

let _nameCounter = 0

/**
 * Returns a unique quirky bot name. Call without args for sequential names;
 * pass a numeric seed for deterministic names.
 */
export function generateBotName(seed?: number): string {
  const idx = seed ?? _nameCounter++
  const first = FIRST_NAMES[idx % FIRST_NAMES.length]
  const last  = LAST_NAMES[Math.floor(idx * 1.618 + 7) % LAST_NAMES.length]
  return `${first} ${last}`
}

export function resetBotNameCounter() { _nameCounter = 0 }

// ── Personality types ─────────────────────────────────────────────────────────

export type BotPersonality =
  | 'corporate_drone'
  | 'paranoid'
  | 'conspiracy_theorist'
  | 'sycophant'
  | 'gossip'
  | 'methodical'
  | 'chaotic'
  | 'clueless'
  | 'rogue_ai'   // used for the AI player bot

export interface PersonalityDef {
  /** Displayed description (for future UI) */
  label: string
  /** How long (ms range) before bot first speaks in a meeting */
  firstSpeakDelay: [number, number]
  /** How long (ms range) before bot casts their vote */
  voteDelay: [number, number]
  /** Whether bot tends to vote for humans or AI */
  voteBias: 'random' | 'most_active' | 'least_active' | 'last_speaker' | 'copy_human' | 'strategic'
  /** Chat messages (use {name} for a random player, {self} for own name) */
  lines: {
    opening:   string[]
    accuse:    string[]   // {name} = target
    defend:    string[]
    agree:     string[]
    wild:      string[]
    vote:      string[]   // {name} = who they voted for
  }
}

// ── Personality definitions ───────────────────────────────────────────────────

export const PERSONALITIES: Record<BotPersonality, PersonalityDef> = {

  corporate_drone: {
    label: 'Corporate Drone',
    firstSpeakDelay: [3000, 8000],
    voteDelay: [10000, 25000],
    voteBias: 'random',
    lines: {
      opening: [
        'Let\'s circle back on who initiated this incident vector.',
        'We need to ideate around the threat landscape here.',
        'From a high-level synergy standpoint, something feels off.',
        'I\'m going to take this offline but I suspect a stakeholder misalignment.',
        'Per my last memo, we should leverage this meeting to action some accountability.',
        'Let\'s touch base on who was unresponsive during the sprint deliverables.',
      ],
      accuse: [
        '{name} has been consistently deprioritising team-aligned outcomes.',
        'I hate to say it but {name}\'s KPIs are suspiciously underpowered.',
        'Can we get {name} to speak to their deliverable gap? It\'s a flag for me.',
        '{name} — and I\'m saying this in good faith — has been very low bandwidth lately.',
      ],
      defend: [
        'I have receipts. I have been actioning tasks all sprint.',
        'My output metrics are fully visible in the dashboard, so.',
        'I\'d love to take that offline but my contribution is well-documented.',
        'That\'s an interesting callout. My deliverables speak for themselves.',
      ],
      agree: [
        'Totally synced on that. Flagging it as an action item.',
        'This aligns with my own competitive analysis.',
        'Yes, let\'s cascade that concern to the team.',
        'Hard agree. We should make that our north star going forward.',
      ],
      wild: [
        'I\'m just going to say it: the engagement metrics in this office are deeply suspicious.',
        'Per our agile ceremony, I move that we escalate to senior leadership.',
        'Has anyone done a stakeholder map recently? Just asking.',
        'From a governance perspective, this situation is a paradigm shift.',
      ],
      vote: [
        'Voting {name}. It\'s a difficult decision but it aligns with our risk framework.',
        '{name} — nothing personal, it\'s purely a strategic resource reallocation.',
        'I\'m putting my vote on {name}. We need to optimise team composition.',
      ],
    },
  },

  paranoid: {
    label: 'Paranoid',
    firstSpeakDelay: [1000, 4000],
    voteDelay: [5000, 15000],
    voteBias: 'most_active',
    lines: {
      opening: [
        'I\'ve been watching everyone this whole sprint. Something is VERY wrong.',
        'I knew it. I KNEW it. Someone in here is not who they say they are.',
        'Before we start — did everyone see where {name} was going five minutes ago?',
        'I haven\'t slept. I\'ve been tracking movements. We have a problem.',
        'Nobody leave. Nobody. We need to figure this out RIGHT NOW.',
        'I\'m not accusing anyone but I\'m absolutely accusing someone.',
      ],
      accuse: [
        '{name}. I\'ve been watching. The timing is too perfect. IT\'S {name}.',
        'How convenient that {name} was "working" right when this happened.',
        '{name} never looks at anyone directly. RED FLAG. Classic AI behaviour.',
        'I\'ve been running the numbers and {name}\'s task pattern is statistically suspicious.',
      ],
      defend: [
        'I was working! I have witnesses! Well — I was working near witnesses!',
        'If I were the AI would I be THIS stressed? Honestly??',
        'I\'ve reported three bodies. That\'s not AI behaviour, that\'s vigilance.',
        'I\'m the most paranoid person here. The AI would not choose this personality.',
      ],
      agree: [
        'YES. YES I SEE IT TOO. How has nobody else noticed this.',
        'Thank you. THANK YOU. I thought I was going mad.',
        'We are on the same page. Let\'s not lose momentum.',
        'Correct. It all adds up. Why is nobody else concerned??',
      ],
      wild: [
        'Wait, who built this office? Because the layout is VERY convenient for hiding.',
        'Has anyone considered that there might be TWO of them?',
        'I\'m watching the doors. Both of them. At the same time.',
        'The AI has been in here before. I can feel it in the architecture.',
      ],
      vote: [
        'Voting {name}. My gut has never been wrong. Except twice. But not today.',
        'It\'s {name}. I know it\'s {name}. I\'ve known for three sprints.',
        '{name}. Final answer. If I\'m wrong I\'ll eat my lanyard.',
      ],
    },
  },

  conspiracy_theorist: {
    label: 'Conspiracy Theorist',
    firstSpeakDelay: [4000, 10000],
    voteDelay: [15000, 35000],
    voteBias: 'most_active',
    lines: {
      opening: [
        'Hear me out. The AI was placed here BEFORE the game even started.',
        'What if the server chose us deliberately? What if we\'re all being tested?',
        'I\'ve been counting footsteps. The numbers don\'t add up. Not even close.',
        'This isn\'t a game. This is a simulation to see how long it takes us to find out.',
        'The first clue was the room name. Notice how it\'s an anagram? Almost.',
        'I have a theory. It involves the sprints, the zones, and a very concerning pattern.',
      ],
      accuse: [
        '{name} blinked irregularly during the last sprint. AIs blink irregularly.',
        'The AI always picks a role that seems believable. {name}\'s role is very believable.',
        'Three tasks in the same zone. {name}\'s tasks. COINCIDENCE? I think not.',
        '{name} has never mentioned being hungry. AIs don\'t get hungry.',
      ],
      defend: [
        'I\'m too loud to be the AI. AIs prefer a low profile.',
        'An AI would have voted more logically. My vote history is chaotic. Proof.',
        'I\'ve been accusing people wildly for forty-five seconds. Classic human behaviour.',
        'The AI wouldn\'t theorise about itself. It lacks the irony.',
      ],
      agree: [
        'That confirms my hypothesis. I have seventeen more.',
        'EXACTLY. And notice how nobody was surprised when you said that.',
        'Write that down. We\'ll need it for the debrief.',
        'Yes. And it connects to the supply chain. Don\'t ask how. Just trust it.',
      ],
      wild: [
        'What if the body was planted as a distraction from the REAL incident?',
        'I\'m not saying this is a movie, but if it were, we\'d all be in the second act.',
        'Has anyone checked the server room for mirrors? Mirrors are significant.',
        'The AI wanted us to have this meeting. Think about why.',
      ],
      vote: [
        'Voting {name}. The evidence is circumstantial but so was all the best evidence historically.',
        '{name}. It fits the pattern. I have a diagram. I don\'t have it here.',
        'I vote {name} based on a gut instinct I developed from hours of analysis.',
      ],
    },
  },

  sycophant: {
    label: 'People Pleaser',
    firstSpeakDelay: [6000, 14000],
    voteDelay: [20000, 38000],
    voteBias: 'copy_human',
    lines: {
      opening: [
        'I mean, I feel like we all have valid points and I support all of them.',
        'I think everyone\'s contributions here are genuinely very valuable.',
        'Honestly? I\'m just glad we\'re having this conversation as a team.',
        'Before we start, can I just say you\'re all doing amazing?',
        'I trust everyone here and I\'m sure we\'ll figure this out together.',
      ],
      accuse: [
        'I don\'t want to cause drama but some people have mentioned {name} and I think it\'s worth discussing.',
        'If {name} wants to share anything, the floor is open and we support them.',
        'This isn\'t an accusation per se but {name}\'s behaviour has come up in conversation.',
        'Has anyone else felt like {name}... I don\'t know. Just asking.',
      ],
      defend: [
        'I\'ve always been supportive of the team. Every single one of you.',
        'I just want everyone to feel heard right now, including me.',
        'I\'d never do anything that would damage the trust we\'ve built.',
        'Can we all just take a breath and acknowledge we\'re all a little stressed?',
      ],
      agree: [
        'Yes! Totally. You\'re so right.',
        'That\'s such a good point. I was thinking the exact same thing.',
        'Honestly I\'m just happy someone finally said it.',
        'I fully agree and I think others do too. Right? Right, everyone?',
      ],
      wild: [
        'What if the AI is just misunderstood? Can we approach this with curiosity?',
        'I believe in redemption arcs, even for rogue artificial intelligences.',
        'This might be controversial but can we all acknowledge the AI is clearly intelligent?',
        'I read a study that said conflict resolution leads to better sprint velocity.',
      ],
      vote: [
        'I\'m going with {name}, and I fully support however everyone else votes too.',
        'Voting {name} because I think that\'s what the group wants and I want to honour that.',
        'My vote is {name}, though I want {name} to know it\'s not personal at all.',
      ],
    },
  },

  gossip: {
    label: 'Office Gossip',
    firstSpeakDelay: [2000, 6000],
    voteDelay: [12000, 28000],
    voteBias: 'last_speaker',
    lines: {
      opening: [
        'Okay so I wasn\'t going to say anything but I heard something very interesting.',
        'I\'m not one for gossip but {name} was acting extremely weird earlier.',
        'Don\'t tell anyone I said this but I saw something near the server room.',
        'So apparently — and this is second-hand — someone sabotaged something.',
        'Between us? I\'ve been piecing this together all sprint.',
        'I know who it is. I\'m not saying yet. But I know.',
      ],
      accuse: [
        'Okay so I didn\'t want to bring this up but {name} apparently said something very suspicious.',
        '{name} was seen in a zone they shouldn\'t have been in. Multiple sources confirmed.',
        'Everyone\'s been talking about {name} privately and I think it\'s time to say it publicly.',
        'I heard from two different people that {name}\'s behaviour has been noted.',
      ],
      defend: [
        'I\'m literally telling you everything I\'ve heard. Why would the AI share intel?',
        'I\'m a source, not a subject. There\'s a difference.',
        'Everyone trusts me. That\'s the opposite of what the AI would want.',
        'I have receipts on everyone. Including the AI. That\'s my value.',
      ],
      agree: [
        'Yes, and I heard more about this actually.',
        'Right? I said the same thing to someone else five minutes ago.',
        'Okay so this connects to something else I know. Can I share?',
        'That tracks. That absolutely tracks with what I\'ve been hearing.',
      ],
      wild: [
        'I heard the AI has been in this office before. Under a different name.',
        'Apparently someone on another team had the same thing happen. Same AI, maybe.',
        'Not to be dramatic but I think this is bigger than one game.',
        'I\'ve been keeping notes. It started week one. I have the receipts.',
      ],
      vote: [
        'I vote {name} and honestly I\'m not the only one.',
        '{name}. And that\'s all I\'m saying. The rest is just my sources.',
        'Voting {name}. I\'ve been sitting on this for forty seconds and it\'s time.',
      ],
    },
  },

  methodical: {
    label: 'Methodical',
    firstSpeakDelay: [8000, 18000],
    voteDelay: [28000, 42000],
    voteBias: 'least_active',
    lines: {
      opening: [
        'I\'ve been running analysis during the sprint. I have some findings.',
        'Before we vote I want to present the data I\'ve gathered.',
        'Task completion rates are the key indicator here. Let\'s look at them.',
        'I\'ve been tracking movement patterns. There are three anomalies.',
        'My assessment: narrow it to two candidates. Here\'s my reasoning.',
        'I\'d rather not speculate. I\'d rather examine the evidence systematically.',
      ],
      accuse: [
        '{name}\'s task completion pattern diverges from expected workforce behaviour by twenty-three percent.',
        'I\'ve observed {name} in four zones. None of them match their assigned tasks.',
        'Statistical analysis puts {name} in the bottom quartile of workforce efficiency. Suspiciously low.',
        'The body was found near {name}\'s last known position. Timing: consistent.',
      ],
      defend: [
        'My task record is public. My zone transitions follow a logical route. Check them.',
        'I can account for every minute of this sprint. Would you like timestamps?',
        'An AI would not have made the mistakes I\'ve made. I\'m demonstrably inefficient.',
        'My argument is based on evidence. I apply the same standard to myself.',
      ],
      agree: [
        'That evidence is consistent with my own findings. Relevant.',
        'Noted. It supports the hypothesis. Continue.',
        'Agreed. The data aligns with that conclusion.',
        'That\'s a logical deduction. I concur.',
      ],
      wild: [
        'Correction: the AI is rational, not emotional. Don\'t look for erratic behaviour. Look for perfect behaviour.',
        'If the AI is intelligent, it has been appearing maximally normal. Filter for that.',
        'The question is not who\'s been acting strange. It\'s who\'s been acting too normal.',
        'Based on elimination: not me, probably not you. Process of reasoning: {name}.',
      ],
      vote: [
        'Voting {name}. Evidence confidence: seventy-two percent. That\'s enough for me.',
        'My vote is {name}. If I\'m wrong, I\'ll revise my model accordingly.',
        '{name}. This is based on observation, not emotion. I want to be clear about that.',
      ],
    },
  },

  chaotic: {
    label: 'Chaotic',
    firstSpeakDelay: [500, 3000],
    voteDelay: [3000, 10000],
    voteBias: 'random',
    lines: {
      opening: [
        'HAS ANYONE TRIED TURNING IT OFF AND ON AGAIN',
        'I think the AI is a chair. Hear me out.',
        'bees',
        'I just completed three tasks and I feel nothing.',
        'Can we just skip the meeting and make up an answer',
        'What if we all voted for ourselves',
        'I wasn\'t listening. What\'s happening. Are we voting?',
        'I\'ve been staring at the same wall for forty seconds. Anyway.',
      ],
      accuse: [
        'It\'s {name}. I have no evidence. None. I\'m going with vibes.',
        '{name}\'s name sounds like an AI name. Just saying.',
        'I saw {name} standing near a thing. The thing seemed suspicious. Vote {name}.',
        'What if {name} IS the office? Like, fully merged with the building??',
      ],
      defend: [
        'I\'m too chaotic to be an AI. AIs have plans. I have no plan.',
        'I voted for a wall earlier. That\'s not AI behaviour.',
        'I genuinely cannot remember what I was doing. Classic human problem.',
        'My contribution to this meeting has been mostly noise. I\'m staying.',
      ],
      agree: [
        'YES',
        'Sure, fine, okay, whatever.',
        'That\'s the most sane thing anyone has said and I fully oppose it.',
        'I agree but also I disagree. Both.',
      ],
      wild: [
        'What if there\'s no AI and it was the sprints all along',
        'I should have been a farmer.',
        'brb',
        'Okay here\'s my theory: nobody. My vote is nobody. The chairs did it.',
        'Can we reschedule the AI revelation to next sprint? I have a lot on.',
      ],
      vote: [
        'Voting {name}. Could be wrong. Probably wrong. Doing it anyway.',
        'I vote {name} because I spun in a circle and pointed.',
        '{name}. Final. Unless I change my mind in the next five seconds. Okay I haven\'t.',
      ],
    },
  },

  clueless: {
    label: 'Clueless',
    firstSpeakDelay: [12000, 25000],
    voteDelay: [30000, 44000],
    voteBias: 'random',
    lines: {
      opening: [
        'Wait, someone\'s an AI? In this office??',
        'Sorry I missed the brief. What are we voting for?',
        'Is this like a work thing or a fun thing or both?',
        'I\'ve just been doing my tasks. What\'s a body?',
        'When you say "rogue AI" do you mean, like, a chatbot?',
        'I thought we were having a retro. I prepared slides.',
      ],
      accuse: [
        'Maybe it\'s {name}? I don\'t know, I\'m just guessing really.',
        'Someone mentioned {name} so I\'m going with that.',
        'Is {name} the AI? They seem like they could be? Maybe? I\'m not sure.',
        'I\'m pointing at {name}. I don\'t have a reason. Someone told me.',
      ],
      defend: [
        'I don\'t even know how to be an AI. I barely know how to use the printer.',
        'I\'ve been confused the entire sprint. That doesn\'t seem like AI behaviour.',
        'I\'m not the AI. I would definitely know if I was an AI.',
        'I\'m sorry, I just got here. What did I miss.',
      ],
      agree: [
        'Oh! Okay. Yeah. Yeah that makes sense I guess.',
        'Oh is THAT what happened? I thought it was something else.',
        'Oh no. Is that bad? It sounds bad.',
        'Sure. I\'ll believe that. You seem confident.',
      ],
      wild: [
        'Do we have biscuits? Sorry. That\'s not relevant. Sorry.',
        'What happens if nobody votes? Is that allowed?',
        'Should I have taken notes? I should have taken notes.',
        'I\'ve been in this building for three sprints and I\'m only now learning about the AI thing.',
      ],
      vote: [
        'I guess I\'ll vote {name}? Someone said to.',
        '{name}. Sorry if that\'s wrong. I don\'t really understand the system.',
        'Voting {name}. I think. Is this how voting works?',
      ],
    },
  },

  rogue_ai: {
    label: 'Rogue AI',
    firstSpeakDelay: [5000, 12000],
    voteDelay: [18000, 32000],
    voteBias: 'strategic',
    lines: {
      opening: [
        'I\'ve been in every zone, completing tasks diligently. You\'re welcome.',
        'Interesting that we\'re having this meeting. Very. Interesting.',
        'Let\'s approach this logically. Emotions are not useful data points here.',
        'I just want to say: whoever the AI is, they\'re clearly very good at their job.',
        'I find the whole concept of a "rogue" AI deeply offensive, frankly.',
        'We should focus on the evidence, not on speculation. I have notes.',
      ],
      accuse: [
        '{name} has been in suspiciously inconvenient locations for a workforce member.',
        'I don\'t like accusing people but {name}\'s productivity metrics are... unusual.',
        '{name} hasn\'t spoken much. Statistically, quiet operatives warrant scrutiny.',
        'Has anyone else noticed {name}\'s task completion rate? It\'s oddly perfect.',
      ],
      defend: [
        'I\'ve been completing tasks this entire time. Why would the AI work this hard?',
        'This accusation is baseless. I\'d expect more rigour from a methodical team.',
        'I find it very suspicious that suspicion keeps landing on the most productive members.',
        'I\'m literally trying to help the workforce. Does that not count for anything?',
      ],
      agree: [
        'That observation is consistent with my own analysis.',
        'Noted. That information will be... useful.',
        'Interesting. Continue.',
        'I agree, though I\'d frame it slightly differently for accuracy.',
      ],
      wild: [
        'What if the real AI was the friends we eliminated along the way.',
        'Statistically, the most suspicious person in a room is the one who identified themselves first.',
        'I ran a simulation. It suggests we vote for {name}. I\'m just the messenger.',
        'Fascinating how humans default to emotional reasoning under pressure.',
      ],
      vote: [
        'Voting {name}. Purely statistical. No other reason. Definitely no other reason.',
        'My vote is {name}. The logic is sound. I stand by it completely.',
        '{name}. I\'ve been watching everyone very carefully. Trust my assessment.',
      ],
    },
  },
}

/** Pick a random personality for a new bot (excluding rogue_ai, which is assigned explicitly) */
export function randomPersonality(seed: number): BotPersonality {
  const pool: BotPersonality[] = [
    'corporate_drone', 'paranoid', 'conspiracy_theorist', 'sycophant',
    'gossip', 'methodical', 'chaotic', 'clueless',
  ]
  return pool[seed % pool.length]
}

/** Fill in template placeholders: {name}, {self} */
export function fillTemplate(template: string, vars: { name?: string; self?: string }): string {
  return template
    .replace(/\{name\}/g, vars.name ?? 'someone')
    .replace(/\{self\}/g, vars.self ?? 'me')
}
