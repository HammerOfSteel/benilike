# Benilike — Research

> Notes on technology choices, references, and experiments. Add findings as you go.

---

## 3D Rendering + React

### React Three Fiber (R3F) ✅ Recommended
- **What it is**: A React renderer for Three.js. You write Three.js scenes as JSX.
- **Why it fits**: We're already React-first. R3F lets us keep the whole app in one mental model — UI and game world are both React trees.
- **Key packages**:
  - `@react-three/fiber` — core renderer
  - `@react-three/drei` — pre-built helpers (OrbitControls, Sky, Text, Html, etc.)
  - `@react-three/rapier` — Rapier physics engine bindings (WASM, fast)
  - `@react-three/postprocessing` — bloom, AO, vignette etc.
- **Docs**: https://docs.pmnd.rs/react-three-fiber
- **Examples**: https://codesandbox.io/examples/package/@react-three/fiber
- **Performance notes**: R3F re-renders only on explicit `invalidate()` calls or when using `frameloop="demand"` — important for a multiplayer game to avoid wasted renders.

### Alternatives considered
| Engine | Notes | Verdict |
|---|---|---|
| Babylon.js | Excellent 3D, has React wrapper (`react-babylonjs`) but it's less maintained | Skip |
| PlayCanvas | Great editor but harder to integrate with React | Skip |
| Phaser 3 | 2D-first, 3D is bolted on | Skip |
| A-Frame | VR-first, awkward without VR | Skip |

---

## Multiplayer

### Colyseus ✅ Recommended
- **What it is**: An authoritative multiplayer game server framework for Node.js.
- **Why it fits**: Room-based model fits our lobby/match structure. State sync via `@colyseus/schema` sends binary diffs — very bandwidth efficient. Has a React client SDK.
- **Key packages**:
  - `colyseus` — server
  - `colyseus.js` — client
  - `@colyseus/schema` — auto-synced state schemas
  - `@colyseus/monitor` — admin UI for inspecting rooms (dev only)
- **Docs**: https://docs.colyseus.io
- **Hosting**: runs on any Node.js host (Railway, Fly.io, Render). Needs sticky sessions or a Redis presence adapter for multi-node.
- **Tick rate**: default 20Hz, configurable.

### Alternatives considered
| Option | Notes | Verdict |
|---|---|---|
| Socket.io raw | Very flexible but no built-in game state sync | Could use as fallback |
| Partykit | Serverless, interesting but less game-specific | Interesting for future |
| Liveblocks | CRDT-based, more suited to docs collab than game | Skip |
| Nakama | Feature-rich but heavy, needs Docker | Overkill for hackathon |

---

## Procedural Level Generation

### Binary Space Partitioning (BSP) Trees
- Classic dungeon generation technique. Recursively splits a rectangle into rooms.
- **Pros**: Easy to implement, guarantees all rooms are connected, maps feel "architectural"
- **Cons**: Can feel boxy / grid-like (actually fine for an office!)
- **Reference**: https://www.roguebasin.com/index.php/Basic_BSP_Dungeon_generation
- **Good fit**: An office IS boxy — BSP will naturally produce corridor-connected rectangular rooms.

### Wave Function Collapse (WFC)
- Constraint-based tile placement. Generates organic-looking layouts.
- **Pros**: Very flexible, can produce surprisingly natural-feeling layouts
- **Cons**: More complex to implement, can be slow without optimization
- **Reference**: https://github.com/mxgmn/WaveFunctionCollapse
- **Good fit**: Could be used on top of BSP for furniture/prop placement rather than room generation.

### Recommended hybrid approach
1. **BSP** for room and corridor layout
2. **WFC or rule-based** for furniture and interactable prop placement within rooms
3. Department zones assigned after generation (e.g. cluster IT rooms near server room)

---

## AI Integration

### In-game AI (NPC behaviour)
- **Option A**: Simple finite state machines + A* pathfinding for NPC office workers (lightweight, fully custom)
- **Option B**: Behaviour trees via a library like `behaviortree.js`
- **Recommended**: FSM + A* for hackathon scope — simple, debuggable, enough personality

### AI-assisted content generation
- **Option A**: OpenAI API (GPT-4o / GPT-4o-mini) — call from server at match-start to generate room names, NPC names, flavour emails, post-match newsletter
- **Option B**: Local model via Ollama — no latency/cost concerns, but requires server with GPU
- **Option C**: Pre-generated content bank — faster, no API dependency
- **Recommended**: GPT-4o-mini for hackathon (cheap, fast, no infra needed). Add a static fallback if API is down.

### AI-assisted pathfinding
- A* on a navmesh. Three.js doesn't have built-in navmesh generation but `three-pathfinding` is a solid library.
- Reference: https://github.com/donmccurdy/three-pathfinding

---

## Visual Style Reference

### Target: Low-poly / "corporate minimalism"
- Think: flat-shaded geometry, limited colour palette, simple character silhouettes
- Reference games: **Mini Metro**, **Among Us** (for character simplicity), **Offworld Trading Company** (colour-coded factions)
- For 3D: `MeshToonMaterial` or `MeshLambertMaterial` in Three.js gives a flat/cartoon look without needing complex shaders
- Consider: `@react-three/drei`'s `<BakeShadows>` and ambient occlusion pass for depth without cost

### Asset Pipeline
- Start with primitive geometry (boxes, cylinders) as placeholders
- Upgrade to `.glb` models (Blender → glTF 2.0 export) as time allows
- For characters: simple capsule/block figures, colour-coded by role and faction

---

## References and Inspiration

### Games
- **Among Us** — social deduction, task mechanics, faction asymmetry
- **Unfortunate Spacemen** — asymmetric multiplayer with roles
- **Spy Party** — social reading, infiltrator vs observer
- **Keep Talking and Nobody Explodes** — role interdependency under pressure
- **Lethal Company** — co-op chaos in corporate horror setting

### Tech articles
- R3F performance best practices: https://docs.pmnd.rs/react-three-fiber/advanced/performance
- Colyseus schema serialization: https://docs.colyseus.io/state/schema
- Three.js journey (learning resource): https://threejs-journey.com

---

## Open Questions
- What's our deployment target? (see brainstorm.md)
- Do we need a database, or is everything session-based?
- How do we handle the game server during the hackathon — shared cloud instance or each dev runs locally?
