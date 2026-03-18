# The Making of 3D Space Rocks: An Agent Team Story

3D Space Rocks did not emerge from one long coding sprint or a single all-knowing agent. It was assembled the way a good arcade ship is built: frame first, systems next, controls tightened, thrusters tested, shields reinforced, and only then launched into the void.

What makes this project interesting is not just the game itself, but the way a small team of specialized agents worked together under the Engineering Journey System (EJS) to make the work traceable, reversible, and surprisingly collaborative.

This is the story of how that happened.

---

## Act I: The Captain Draws the Flight Plan

Before the first asteroid existed, there was a process decision.

The very first major choice was not about rendering, physics, or waves. It was about **how the team would work**. The repository adopted the Engineering Journey System as a standing rule: initialize a session early, capture decisions as they happen, and only create ADRs when a choice has real architectural weight.

That choice became [ADR 0001](../ejs-docs/adr/0001-ejs-journey-recording-workflow.md).

It sounds administrative, but it changed everything. Instead of relying on memory after a long implementation sprint, the team recorded why things happened while the context was still fresh. That made the rest of the project less like archaeology and more like navigation.

The role split became clear early:
- **Copilot** acted as orchestrator, integrator, and final reviewer.
- **Specialist agents** handled deep implementation in their own domains.
- **The human** acted as product owner, playtester, and reality check.

That pattern stayed intact for the rest of the project.

---

## Act II: Building a Ship That Could Survive Space

The first engineering push established the fundamentals:
- Babylon.js scene bootstrapping
- camera setup
- player movement
- arena boundaries
- early combat systems
- asteroid entities
- projectile entities
- scoring
- physics integration

This was the "make it real" phase. The game stopped being a PRD and became a runnable system.

Several specialist agents helped shape that foundation:
- **project-architect** established the strict TypeScript + Vite baseline.
- **babylonjs-specialist** set up the scene and camera contracts.
- **gameplay-engineer** handled movement, containment, entities, and game loop integration.
- **vfx-artist** wired explosions and damage feedback once there was something worth reacting to.

What mattered here was not just that features were added, but that they were added with boundaries. Asteroids owned asteroid behaviour. Projectiles owned projectile lifetime. The score system became a passive service instead of a command center. Events, not direct coupling, carried most of the cross-system communication.

That decision paid off later, because once the systems were loosely connected, the team could improve one layer without destabilizing the others.

---

## Act III: From Systems to a Game

Phase 3 was where the project stopped being "a bunch of mechanics" and turned into a game with rhythm.

Waves, area transitions, HUD overlays, pause/game-over/victory states, barrier transitions, and exit mechanics all arrived here. This was also where one of the most important architectural choices was made:

**All state transitions would be centralized in `Game.ts`.**

That became [ADR 0002](../ejs-docs/adr/0002-game-state-machine-architecture.md).

The temptation was to let multiple systems own their own timing. WaveManager could control wave delays. Arena could signal completion. HUD could react however it wanted. But that would have created multiple authorities over time and sequencing.

Instead, the team chose a cleaner model:
- domain systems emit events
- `Game.ts` is the single transition authority
- UI, VFX, and audio subscribe passively

That one decision made the later work much easier. Once the game had one conductor, every other system could become a section in the orchestra instead of trying to lead the song itself.

This phase also showed the value of specialized agents working in sequence:
- **gameplay-engineer** defined wave logic and guarded transitions
- **babylonjs-specialist** made the arena barriers animate and open
- **ui-hud-developer** turned raw state into readable screens and overlays
- **vfx-artist** added celebration, beacon, and pulse feedback

The result was not just more code. It was clearer structure.

---

## Act IV: Giving the Machine a Pulse

A technically correct game is not automatically a satisfying one. Phase 4 addressed the feel.

Two important things happened:
- the ship got thruster feedback
- the world got sound

The audio work is especially telling. The repository had no packaged sound assets, but the PRD still called for offline-safe sound. Rather than forcing in missing files or weakening the requirement, the team used **procedural Web Audio synthesis**. That satisfied the feature while preserving the offline constraint.

This is a recurring theme in the journey: the strongest solutions usually came from respecting constraints instead of treating them as annoyances.

When the system said "no external runtime assets," the answer was not to bend the rule. The answer was to build a better fit.

---

## Act V: Making It Portable, Not Just Playable

By Phase 5, the game worked. But a working game in a browser is not the same thing as a resilient product.

The final major architecture decision focused on offline behaviour:

**How should the game cache build output that changes every time Vite emits new hashed filenames?**

That question became [ADR 0003](../ejs-docs/adr/0003-pwa-cache-strategy.md).

The chosen answer was elegant and pragmatic:
- inject the real build asset list into the service worker at build time
- use a versioned cache key
- keep caching same-origin only
- avoid a heavier PWA abstraction layer when a small custom Vite plugin was enough

This was a good example of the team avoiding both extremes:
- not a brittle manual cache list
- not an oversized dependency for a simple demo-scale PWA

The **pwa-specialist** handled the offline runtime. The **qa-tester** then stepped in with validation artifacts, bundle budgeting, and cross-browser checks. That handoff mattered. One agent built the system; another verified that the system deserved trust.

That is what a useful agent team looks like: not many voices talking at once, but the right voice at the right moment.

---

## Act VI: The Human Playtests, the Team Adapts

After the phase work, the human started doing what humans are best at: noticing what feels wrong.

Controls evolved. Mouse input behaviour changed. Asteroid pacing was revisited. Barrier opacity got tuned more than once. The ship design became more playful. The backdrop grew stars, planets, and nebula glow. Projectile direction was corrected. Asteroid arrival shifted from one-time bursts to a staggered queue.

This part of the story matters because it shows what the journals reveal so clearly: software is not a straight line.

The team did not simply "implement the spec." It repeatedly adjusted the game in response to actual experience.

One session in particular showed the difference between fixing symptoms and fixing causes:
- ship collision did not behave correctly on impact
- one barrier wall restored to the wrong transparency
- asteroid visuals were repetitive
- the PRD had drifted away from the implementation
- the README no longer matched the actual product

Each of those issues was resolved by going back to the exact source of truth:
- fix the `takeDamage` call site, not just the visible result
- restore wall alpha from config, not a hardcoded fallback
- vary asteroid shapes visually while preserving sphere physics for stability
- update the PRD so the specification matches reality
- rewrite the README so the repo tells the right story to the next person

That last point is easy to underestimate. A project is not done when the code works. It is done when the code, the docs, and the decisions all agree with each other.

---

## How the Team Actually Worked

Across the journey files, a consistent team pattern emerged.

### 1. The orchestrator did not try to do everything

Copilot delegated by domain when that improved clarity:
- gameplay problems to **gameplay-engineer**
- rendering and arena visuals to **babylonjs-specialist**
- HUD concerns to **ui-hud-developer**
- effect work to **vfx-artist**
- audio to **audio-engineer**
- offline/PWA work to **pwa-specialist**
- validation and release confidence to **qa-tester**

This kept prompts focused and outputs cleaner.

### 2. Contracts mattered more than cleverness

The best decisions were usually about boundaries:
- `Game.ts` owns transitions
- HUD subscribes, it does not control
- VFX returns handles when lifecycle matters
- physics uses stable impostors even if visuals become more expressive
- service worker logic respects build output instead of pretending filenames are static

### 3. The journals were not decoration

The EJS artifacts captured:
- why a decision was made
- what alternatives were rejected
- what evidence changed the team’s mind
- which sub-agent handed work to which next agent

That makes the project easier to continue without guessing.

### 4. The human stayed in the loop where it mattered most

The human did not micromanage file structure or internal abstractions. Instead, the human provided the highest-value input:
- this control scheme feels wrong
- that wall looks inconsistent
- the wave system seems suspicious
- the game needs more visual personality
- the docs need to match what actually shipped

That is exactly the right use of human attention in an agent-assisted build.

---

## Lessons for Someone Starting a Similar Journey

If you want to build with a team of agents instead of a single monolithic assistant, here is the practical guidance the project leaves behind.

### Start with process, not just code

If the work will span multiple sessions, phases, or agents, create a recording system early. The team here benefited enormously from having journeys, ADRs, and machine extracts. Without them, the story would have collapsed into vague memory.

### Give each agent a job boundary

Specialist agents work best when the prompt makes the contract obvious:
- what they own
- what they must not touch
- what output is expected
- what follow-on agent will consume their work

Broad prompts produce blurry results. Sharp boundaries produce reusable work.

### Centralize authority in one place

When multiple modules can advance time, state, or lifecycle, bugs become subtle and expensive. One module should own each coordination concern. In this project, `Game.ts` owning state transitions was the right call.

### Prefer event contracts over direct coupling

If systems can talk through typed events instead of direct calls, you can evolve them independently. That made HUD, VFX, scoring, audio, and progression easier to build in parallel.

### Respect constraints; don’t route around them carelessly

Some of the project’s best solutions came from this discipline:
- no audio assets → procedural audio
- hashed build outputs → build-injected service worker manifest
- visual variety needed → random shape selection with safe sphere physics

Constraints often improve architecture when taken seriously.

### Keep the docs honest

A stale PRD or README quietly degrades the whole project. Update the docs when the implementation meaningfully changes. The longer you wait, the more expensive that reconciliation becomes.

### Let humans judge feel, not only correctness

Agents are strong at structure, coverage, and implementation speed. Humans are still better at noticing when a game feels awkward, repetitive, or visually off. That loop is not optional in interactive software.

---

## Final Thought

The most useful thing these journeys and ADRs show is that successful agent collaboration is not about pretending the agents are magic. It is about giving them roles, boundaries, evidence, and a shared trail of decisions.

3D Space Rocks was built by a team that behaved less like a pile of disconnected tools and more like a small engineering crew:
- one agent kept the mission coherent
- several specialists solved focused problems well
- the human kept steering toward the right experience
- the documentation preserved why it all worked

If you are about to begin a similar project, that is the real takeaway:

Build the code, yes.

But also build the memory of how the code came to be.
