# Benilike — Game Design Document

> Living document. Update as decisions are made.

---

## Lore

### The World

The year is ambiguous — it's the present, but slightly heightened. Corporate life has never been more competitive. Benisoft, a mid-sized HR and benefits tech company, operates out of a gleaming open-plan office complex. To the outside world it's just another software company. But inside, every department is a mini power structure of its own — and someone always wants what you've built.

Rival corporations, rogue hackers, and corporate spies make every day feel like a heist waiting to happen. The Workforce clocks in and tries to keep the company's metrics in the green. The Opposition slips in through the ventilation shaft (or just submits a fake contractor badge) and tries to make sure it doesn't.

### Tone
- **Absurdist corporate comedy** with real stakes
- Think: The Office meets Darkest Dungeon meets Among Us
- Dialogue and flavour text should be dry, bureaucratic, and occasionally horrifying ("Your performance review has been scheduled during an active security incident.")

---

## Factions

### The Workforce (Blue Team)

The employees of Benisoft. They win by maintaining **Company Reputation** above zero until all **Milestone Tasks** are completed.

**Win condition**: Complete all Milestone Tasks (e.g. finish the quarterly report, deploy the payroll update, present the all-hands) before Reputation hits zero.

**Lose condition**: Reputation reaches 0 OR Opposition completes their objective first.

**Reputation** drains slowly over time and faster when systems are hacked, equipment is broken, or tasks are failed.

---

### Workforce Roles

#### IT Technician
> "Have you tried turning it off and on again?"
- **Primary task**: Repair hacked/broken terminals and servers
- **Ability**: `Remote Patch` — can fix a system from one room away (cooldown: 30s)
- **Passive**: Moves 20% faster in the Server Room
- **Key dependency**: Other roles need IT to fix systems before they can use them

#### HR Manager
> "Per my last email..."
- **Primary task**: Resolve "employee incidents" (NPCs complaining, conflicts, absences)
- **Ability**: `Motivational Memo` — nearby players get a 15s speed + efficiency boost
- **Passive**: Can read Opposition player disguises more easily (slightly shorter recognition window)
- **Key dependency**: Management needs HR to process headcount before unlocking certain tasks

#### DevOps Engineer
> "It works on my machine."
- **Primary task**: Keep deployment pipelines running, restore crashed services
- **Ability**: `Rollback` — revert a sabotaged system to its last good state instantly (1 use/match)
- **Passive**: Can see system health indicators through walls (nearby rooms)
- **Key dependency**: Marketing's campaigns require DevOps to keep the website live

#### Finance Analyst
> "That's not in the budget."
- **Primary task**: Process expense reports, approve budget requests
- **Ability**: `Emergency Fund` — instantly grants one other player their resource cost action for free
- **Passive**: Can see a "cost meter" indicating how many resources the Opposition has spent
- **Key dependency**: Several milestone tasks require Finance approval to unlock

#### Marketing Manager
> "We need to shift the narrative."
- **Primary task**: Run campaigns, generate positive press (this is the main **Reputation** generator)
- **Ability**: `Viral Post` — generates a burst of Reputation (cooldown: 45s, interruptible by Hackers)
- **Passive**: Reputation decays 10% slower while Marketing is alive and active
- **Key dependency**: Needs DevOps infrastructure and Finance budget to run major campaigns

#### Admin / Office Manager
> "The key is in the drawer. I mean, was."
- **Primary task**: Manage access — unlock restricted areas, manage visitor badges
- **Ability**: `Lockdown` — seal one room for 20 seconds (no one enters/exits)
- **Passive**: Has access to all rooms without a keycard
- **Key dependency**: Opposition's Social Engineer relies on Admin access being unsecured

#### Management
> "I need this by EOD."
- **Primary task**: Coordinate team tasks, approve escalations, run the all-hands meeting (win task)
- **Ability**: `Debrief` — mark the location of one hidden Opposition player on the map for the whole team for 10 seconds (cooldown: 60s)
- **Passive**: Sees a mini-map with partial task completion indicators
- **Key dependency**: Several milestone tasks require Management sign-off; team struggles without coordination

---

### The Opposition (Red Team)

Corporate saboteurs, hackers, and infiltrators. They win by draining Reputation to zero OR by completing their own objective: the **Data Heist** (stealing three key data packages before the Workforce finishes the all-hands).

**Win condition A (Sabotage)**: Drain Workforce Reputation to 0.
**Win condition B (Heist)**: Steal 3 data packages from 3 different secure rooms.

**Lose condition**: Workforce completes all Milestone Tasks.

---

### Opposition Roles

#### Hacker
> "I'm in."
- **Primary task**: Compromise terminals, inject malware into systems
- **Ability**: `Zero-Day` — instantly compromise a terminal without the normal interaction animation (no tell)
- **Passive**: Can see which systems are currently in use by Workforce players
- **Counter**: IT can detect and remove malware; all effects are reversed on removal

#### Social Engineer
> "Hi, I'm from the third-party auditor."
- **Primary task**: Blend in as a Workforce NPC, access restricted areas
- **Ability**: `False Badge` — appears as a legitimate NPC worker for 30 seconds (can be broken by HR)
- **Passive**: Starts each match near the main entrance looking like a contractor
- **Counter**: HR has a shorter suspicion window; Admin can check badge validity at terminals

#### Corporate Spy
> "I just need five minutes alone in that office."
- **Primary task**: Reveal and photograph Workforce objective locations (marks them for Heist)
- **Ability**: `Surveillance` — place a hidden camera in a room; see everything that happens there in real time
- **Passive**: Workforce task timers are visible to the entire Opposition team
- **Counter**: Admin or Management can sweep for cameras (interactable action)

#### Saboteur
> "Oops."
- **Primary task**: Physically destroy equipment — longer and noisier to repair than hacking
- **Ability**: `Overload` — cause a system to explode, disabling an entire room's equipment for 40s
- **Passive**: Destruction actions are 30% faster
- **Counter**: IT can repair, but at 2x normal repair time for destroyed (vs hacked) equipment

#### Insider
> "Oh, I've worked here for years."
- **Primary task**: Starts disguised as a Workforce role (random) — can perform tasks but subtly drains Reputation while doing so
- **Ability**: `Deep Cover` — if challenged, can pass a fake HR check once per match
- **Passive**: Knows one of the three data package locations from match start
- **Counter**: HR's passive makes this harder; any Workforce player can call an impromptu "badge check" on a suspected Insider

---

## Game Mechanics

### Tasks
Tasks are contextual interactions tied to specific rooms and objects. They come in three types:

| Type | Description | Example |
|---|---|---|
| **Quick** | Short interaction (1–3s) | Send email, press button, scan badge |
| **Medium** | Requires standing at a terminal (5–15s) | Fix server, run report, approve request |
| **Collaborative** | Requires two specific roles simultaneously | Deploy payroll update (IT + DevOps), Present results (Management + Marketing) |

### Milestone Tasks (Workforce Win Path)
Each match generates 3–5 milestone tasks. All must be completed to win. Examples:
- `DEPLOY_PAYROLL_UPDATE` — requires IT + DevOps + Finance approval
- `SUBMIT_QUARTERLY_REPORT` — requires Finance + Management
- `RUN_MARKETING_CAMPAIGN` — requires Marketing + DevOps
- `HOST_ALL_HANDS_MEETING` — final milestone, requires Management + all departments checked in (at least 1 task per dept completed)

### Data Packages (Opposition Win Path B)
Three secure rooms each contain a data package. The Spy must photograph it, then the Hacker or Insider must physically retrieve (carry) it to an extraction point. Takes ~20 seconds to carry. Can be interrupted.

### Reputation
- Starts at 100
- Drains at a base rate of 1/minute
- Each hacked system: -5 on hack, -2/minute while compromised
- Each destroyed piece of equipment: -8
- Each failed task: -5
- Each Milestone Task completed: +10
- Marketing campaigns: +15 per run

---

## Level Design

### Office Layout Principles
- Procedurally generated via BSP (see research.md)
- **Zones** always present regardless of seed:
  - **Reception** (entry, both factions can access)
  - **Open Plan** (general desks, many quick tasks)
  - **Server Room** (IT stronghold, high-value hacking target)
  - **Meeting Rooms** (collaboration tasks)
  - **Executive Suite** (Management area, locked, data package location)
  - **Finance Floor** (locked, data package location)
  - **HR Corner** (morale tasks)
  - **Marketing Hub** (campaign terminals)
  - **DevOps Den** (pipeline dashboards)
- **Vents / service corridors** — secret paths the Opposition can exploit; Workforce can seal them

### Level Sizes
| Size | Rooms | Players | Match Length |
|---|---|---|---|
| Small | 8–10 | 4–6 | ~10 min |
| Medium | 12–16 | 6–8 | ~15 min |
| Large | 18–24 | 8–10 | ~20 min |

### Props and Interactables
- Desks (task terminals)
- Servers (hackable, repairable)
- Printers (jams = tasks), whiteboards (collaboration tasks), coffee machine (morale buff)
- CCTV cameras (surveillance by Spy, sweepable by Admin)
- Keycards (scattered, required for locked rooms)
- Ventilation shafts (hidden traversal)

---

## Visual Design

### Art Direction: "Corporate Brutalism Lite"
- Low-poly geometry, flat shading (`MeshToonMaterial`)
- Colour palette: cold greys and blues for Workforce, warm reds and oranges for Opposition
- Office environment: beige carpets, grey cubicle walls, green plants, bright fluorescent ceiling lights
- Players: blocky humanoid capsule figures (~Among Us silhouette) with role-specific accessories (IT: headset; Management: clipboard; Hacker: hoodie)

### Camera
- **Isometric / angled top-down** view, fixed angle, no free look (easier to read in multiplayer)
- Camera follows local player, soft pan at room edges
- Mini-map in corner for Management role; limited map for others

### UI / HUD
- Minimalist — task prompts appear only when in range of an interactable
- Reputation meter: top-center, visible to all
- Faction objectives: bottom-left (hidden from other faction)
- Player list: tab-held overlay (shows roles only to your own faction)
- Chat: text only, proximity-based (can't chat cross-faction)

---

## Progression & Session Structure

- No persistent progression in hackathon scope — every match starts fresh
- Post-match stats: tasks completed, systems hacked, distance walked, times caught
- "Company Newsletter" generated by AI after each match — headlines written in dry corporate voice recapping what happened

---

## Sound Design (placeholder ideas)

- Ambient: HVAC hum, keyboard clicks, distant phone rings
- Interactions: button beep, keycard swipe, terminal boot sound
- Alerts: alarm klaxon for detected intruder, phone ring for task call
- Music: lo-fi corporate jazz (Workforce areas), tense glitchy synth (Opposition perspective)
