# Benilike — Brainstorm

> This is a living conversation space. Questions are added here as they come up during design and development. For each question, 5 options are provided and one is recommended. Mark chosen answers with ✅.
>
> **Note:** Questions Q1–Q6 predate the 2026-05-25 redesign (Rogue AI model). Some options in those questions are now superseded — see Q7+ for current design decisions.

---

## How to use this file

- Questions are numbered sequentially.
- When you decide on an answer, mark it with ✅ and add a short note on why.
- New questions can be added at any time — just continue the numbering.

---

## Q1: What camera perspective should we use?

> This shapes the whole visual language of the game. Isometric is classic for roguelikes, but there are other compelling options for a 3D browser game.

| # | Option | Notes |
|---|---|---|
| A | **Isometric / fixed 45° top-down** | Classic roguelike feel, easy to read multiplayer chaos, easy to implement |
| B | **Third-person follow cam** | More immersive, feels more "game-y", but harder to see the whole room |
| C | **Top-down 2.5D (flat top-down, 3D assets)** | Good readability, among-us-ish, easiest to parse tasks |
| D | **First-person** | Most immersive, hardest to implement multiplayer well |
| E | **Dynamic camera (isometric in open areas, third-person in corridors)** | Interesting but complex to implement |

> 🏆 **Recommendation: A — Isometric fixed** — It respects the roguelike genre, makes it easy to see teammates and threats simultaneously, and is significantly simpler to implement with R3F. The fixed angle also means less work on occlusion and culling.

**Decision**: <!-- Mark here when chosen -->

---

## Q2: How should faction assignment work at match start?

> Players need to end up on two opposing teams. How does that happen?

| # | Option | Notes |
|---|---|---|
| A | **Host assigns factions before match** | Full control but host has all the power |
| B | **Players self-select faction in lobby** | Free choice, but may be unbalanced |
| C | **Random split, balanced by player count** | Fair, but no agency |
| D | **Draft pick — factions alternate picking players** | Fun meta-game but slow, especially with 4 players |
| E | **Random split but players can swap before countdown** | Best of both: default fair, allows coordination |

> 🏆 **Recommendation: E** — Random default is fair and fast. The swap window before countdown lets friend groups coordinate without it becoming a full draft ceremony.

**Decision**: <!-- Mark here when chosen -->

---

## Q3: How many Opposition players vs Workforce players?

> Asymmetric games live and die by balance. The ratio matters a lot.

| # | Option | Notes |
|---|---|---|
| A | **Always 50/50 split (e.g. 5v5)** | Simple, but Opposition roles are individually more powerful so may be unbalanced |
| B | **Workforce majority (e.g. 3 Opposition vs 5–7 Workforce)** | Classic among-us ratio, feels right thematically |
| C | **Flexible — host sets ratio** | Max flexibility but requires balance tuning per ratio |
| D | **Scaling ratio — automatically adjusts to player count** | Fair at all counts, but hard to communicate to players |
| E | **Role count caps (max 2 Hackers, max 1 Insider, etc.)** | Combines with any of the above, prevents stacking |

> 🏆 **Recommendation: B + E** — Workforce majority (roughly 2:1) makes Opposition feel elite and dangerous. Cap specific high-impact roles (max 1 Insider, max 2 Hackers) to prevent stacking the same broken combos.

**Decision**: <!-- Mark here when chosen -->

---

## Q4: How should the game handle an Opposition player being exposed/caught?

> "Catching" someone is the social deduction moment. What happens mechanically?

| # | Option | Notes |
|---|---|---|
| A | **Voting system (like Among Us) — call a meeting, majority vote ejects** | Familiar, but stops the action completely |
| B | **Workforce can "report" and physically escort to Security** | More active, requires HR or Admin to perform the escort |
| C | **No elimination — exposed player gets a penalty (speed debuff, can't use ability for 60s)** | Keeps all players in the game the whole time |
| D | **Eliminated players become "ghosts" who can still do ghost-tasks** | Among Us approach — stays involved |
| E | **Exposed player respawns after a cooldown (roguelike lives system)** | No one permanently removed, matches stay full |

> 🏆 **Recommendation: E** — A respawn cooldown (e.g. 45 seconds, reappear in lobby/reception) keeps all players in the match, prevents a runaway "the opposition is all gone" state, and means the game never has to stop for a vote. It also fits the roguelike feel of "death isn't the end, just a setback."

**Decision**: <!-- Mark here when chosen -->

---

## Q5: What's the primary AI integration that will be most impressive for the hackathon demo?

> We have limited time. Which AI feature gives the biggest wow-factor for judges/players?

| # | Option | Notes |
|---|---|---|
| A | **AI-generated post-match "company newsletter"** — LLM writes a corporate news summary of what happened | Easy to ship, very funny, always different, works with any AI provider |
| B | **AI procedural room naming + flavour text** — AI generates office room names, NPC names, task descriptions | Atmospheric, subtle, runs at generation time |
| C | **AI adaptive difficulty** — AI monitors faction performance and tweaks NPC patrol routes in real time | Technically impressive but invisible to players |
| D | **AI NPC coworkers with LLM-backed dialogue** — NPCs you can "talk to" who respond in character | Very impressive but high latency and cost |
| E | **AI opponent team** — fill missing player slots with AI-controlled Opposition roles | Hugely useful for testing and for smaller groups |

> 🏆 **Recommendation: A** — The newsletter is cheap to implement (one LLM call at match end), laugh-out-loud funny ("CEO cites 'unprecedented hacker productivity' as reason for quarterly losses"), and makes every match feel unique and shareable. It also clearly demonstrates AI integration to anyone watching. Ship this first, then consider E for solo testing.

**Decision**: <!-- Mark here when chosen -->

---

## Q6: What should the win/loss screen look like?

> The moment after a match ends. How do we make it memorable?

| # | Option | Notes |
|---|---|---|
| A | **Simple scoreboard — tasks completed, systems hacked, MVP per team** | Fast to implement, informative |
| B | **Animated "company report" slide deck** — slides flip through stats like a bad PowerPoint | Thematically perfect, a lot of fun |
| C | **Highlight reel** — replay key moments (first hack, final task, clutch catch) | Most impressive but hardest to implement (requires event recording) |
| D | **Faction dossier** — each player gets a "performance review" in HR style** | Very flavourful, easy to generate with AI |
| E | **AI newspaper front page** — full generated newspaper layout with headlines about the match | Combines A and the newsletter idea, very shareable |

> 🏆 **Recommendation: D + A** — "Your quarterly performance review" as the victory/defeat screen with individual stats is cheap, hilarious, and very on-brand. Add the newsletter (Q5-A) as a secondary panel. Save the highlight reel for a later phase.

**Decision**: <!-- Mark here when chosen -->

---

## Q7: How should players navigate the office?

> Core movement feel — this is what players spend 100% of the match doing.

| # | Option | Notes |
|---|---|---|
| A | **WASD + mouse look (standard 3D controls)** | Familiar for gamers, but conflicts with isometric cam |
| B | **WASD relative to isometric camera angle** | Classic isometric control, intuitive |
| C | **Click-to-move (point and click)** | Easy to implement, no input conflicts, works on mobile too |
| D | **Gamepad-style twin-stick (WASD move + arrow keys look)** | Good for keyboard players without mouse |
| E | **Hybrid: WASD to move + mouse to interact (no look, camera is fixed)** | Best of both — WASD feels snappy, mouse handles targeting |

> 🏆 **Recommendation: E** — Fixed camera + WASD movement (rotated to camera direction) + mouse hover/click for interactions is the sweet spot. No camera control means simpler code and no motion sickness. Mouse click to interact with objects in range feels natural.

**Decision**: <!-- Mark here when chosen -->

---

## Q8: Should the game have a fog of war / vision system?

> In roguelikes, you typically only see what's nearby. Does that apply here?

| # | Option | Notes |
|---|---|---|
| A | **Full vision — everyone sees the whole map** | Simplest, but removes a lot of tension |
| B | **Room-based vision — you can only see inside rooms you're currently in** | Classic roguelike, creates great tension |
| C | **Cone of vision — you see what's in front of you only** | Very tense, hard to implement fairly in multiplayer |
| D | **Soft fog — walls block vision but open corridors are visible** | Balanced, familiar from MOBAs |
| E | **Role-based — some roles see more (Management has mini-map, Spy has cameras)** | Creates meaningful role differentiation |

> 🏆 **Recommendation: B + E** — Room-based vision is easy to implement (just show/hide rooms the player isn't in) and creates real tension. Role differences on top of that (Management mini-map, Spy camera, Hacker terminal view) make the vision system a core part of role identity.

**Decision**: <!-- Mark here when chosen -->

---

## Open Questions (not yet framed as choices)

- Should there be an in-game voice chat, or text only? (Proximity chat like Among Us would be amazing.)
- What happens when a player disconnects mid-match?
- Should the Opposition know each other's identities from the start, or is there a "trust building" phase?

---

## 2026-05-25 Redesign — Rogue AI Model (Decisions Locked)

The following questions were resolved during the 2026-05-25 design session. Full spec: `docs/superpowers/specs/2026-05-25-rogue-ai-redesign.md`

---

## Q7: Who controls The AI role? ✅ B

> The faction model is being replaced with a 1-vs-all setup. One player is the hidden antagonist.

| # | Option | Notes |
|---|---|---|
| A | Server-controlled NPC (fully autonomous) | No human plays it |
| **B ✅** | **Hidden human player (or bot) assigned AI role** | **Classic Among Us social deduction** |
| C | Starts NPC, can be claimed by a late-joining player | Hybrid, hard to balance |

**Decision**: ✅ B — One player (human or bot) is secretly assigned The AI role at match start. Same identity format as workers. Bots can fill the role if player count is low.

---

## Q8: Win conditions? ✅ C — Dual condition

| # | Option | Notes |
|---|---|---|
| A | Pure elimination (AI kills until majority gone) | Binary, no task incentive |
| B | Objective race (complete phases vs complete tasks) | Parallel pressure but no emergency moments |
| **C ✅** | **Dual condition — both sides have two win paths** | **Workers: vote out AI OR hit all sprint quotas. AI: 3 phases + Takeover OR eliminate majority** |
| D | Survival race against clock | Less readable |

**Decision**: ✅ C — Dual win conditions. Workers are rewarded for productivity AND social deduction. AI has an escalation arc (3 phases) plus a kill path.

---

## Q9: Workforce roles — mechanical weight? ✅ C — Assigned task list

| # | Option | Notes |
|---|---|---|
| A | Pure flavour | No mechanical effect |
| B | Passive speed bonus at home zone | Small benefit |
| **C ✅** | **Assigned task list — role determines your 3 tasks** | **Personal to-do like Among Us, creates behavioural tells for deduction** |
| D | Assigned list + speed bonus | Most distinct identity |

**Decision**: ✅ C — Your job title assigns 3 tasks from the shared pool. You can do any task; only your assigned ones count for your personal sprint contribution. This creates deduction opportunities without locking access.

---

## Q10: AI elimination mechanic? ✅ A — Instant shutdown

| # | Option | Notes |
|---|---|---|
| **A ✅** | **Instant shutdown + ghost mode (spectate only)** | **Clean, readable, stakes are high** |
| B | Slow corruption (infect then kill) | Interesting but adds cure mechanic complexity |
| C | Sabotage + lockdown kill | No direct kill, less tension |
| D | Recruitment husk (player controls zombie) | Fun but complex |

**Decision**: ✅ A — Shutdown ability (30s cooldown, requires 1s alone with target). Eliminated players enter spectator-only mode: free-roam camera, no interaction, no voting, no chat with living. Ghosts can chat with other ghosts.

---

## Q11: Sprint structure? ✅ B — 2–3 sprints per match

| # | Option | Notes |
|---|---|---|
| A | One sprint per match | Simple but one retro moment |
| **B ✅** | **3 sprints per match** | **Escalating arc, stacking perks, AI grows more dangerous each sprint** |
| C | Continuous play, sprints are optional events | Freeform but unstructured |

**Decision**: ✅ B — 3 sprints, each ~3 minutes. Sprint size voted pre-game (Small/Medium/Large affects quota + perk tier). Retro meeting at end if quota met; morale penalty if missed. Match ends after Sprint 3 or earlier win condition.

- Do we want a spectator mode for people waiting to join the next match?
- Is there any kind of power-up or consumable item system?
- Should NPCs be killable / hackable by the Opposition?

---

*Add new questions below with the next sequential number.*
