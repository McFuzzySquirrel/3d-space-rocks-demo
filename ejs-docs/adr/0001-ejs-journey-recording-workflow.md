---
ejs:
  type: journey-adr
  version: 1.1
  adr_id: 0001
  title: Adopt EJS Session Recording Workflow
  date: 2026-03-18
  status: accepted
  session_id: ejs-session-2026-03-18-01
  session_journey: ejs-docs/journey/2026/ejs-session-2026-03-18-01.md

actors:
  humans:
    - id: human
      role: requester
  agents:
    - id: copilot
      role: project-orchestrator

context:
  repo: 3d-space-rocks-demo
  branch: demos/prep
---

> ADRs are optional. Create one only when a significant architecture/design decision occurred. Otherwise, capture decisions and rationale in the Session Journey.

# Session Journey

Link to the originating session artifact:
- Session Journey: `ejs-docs/journey/2026/ejs-session-2026-03-18-01.md`

# Context

The repository introduced an Engineering Journey System (EJS) with hooks, session journey files, and ADR tooling. During this session, work moved from ad hoc notes to structured, mandatory session capture while implementing PRD Phase 1. This changed how engineering work is recorded, reviewed, and finalized.

---

# Session Intent

Start project implementation and ensure work is captured in EJS from the beginning of execution.



# Collaboration Summary

Human prompted kickoff and commit checkpoints. Copilot initialized EJS tracking, orchestrated specialist sub-agents for Phase 1 implementation, and captured decisions/evidence in the journey file. Wrap-up request triggered explicit ADR evaluation and finalization.

---

# Decision Trigger / Significance

This decision changes engineering workflow for all future sessions (recording lifecycle, checkpoint/finalization behavior, and hook-enforced reminders). It has long-lived consequences and is not trivial to reverse without process disruption.

# Considered Options

## Option A
Adopt EJS workflow as the default process: initialize session early, continuously update journey, evaluate ADR rubric at wrap-up.

## Option B
Keep EJS optional and document only at the end of major changes.

---

# Decision

Adopt Option A: use EJS session recording as standard workflow for this repository.

---

# Rationale

Continuous capture reduces context loss, improves traceability of human-agent collaboration, and produces reusable decision records. Optional, end-only documentation was rejected because it is error-prone and frequently incomplete, especially in long, multi-agent sessions.

---

# Consequences

### Positive
- Better audit trail for changes, experiments, and decisions.
- Faster onboarding via session and ADR artifacts.
- Improved consistency between implementation and documented rationale.

### Negative / Trade-offs
- Added documentation overhead each session.
- Requires discipline to keep journey updates current.
- Hook reminders may add friction when rushing commits.

---

# Key Learnings

- Session initialization and periodic checkpoints prevent expensive reconstruction at wrap-up.
- ADR creation is most useful when workflow boundaries change, not for every technical tweak.

---

# Agent Guidance

Instructions and signals for future agents:
- Initialize EJS at session start using the session-init skill.
- Update journey incrementally after major interactions and delegated work.
- Evaluate ADR rubric during wrap-up and create ADR when process/system boundaries change.
- Keep machine extracts concise and structured for automation.

---

# Reuse Signals (Optional)

```yaml
reuse:
  patterns:
    - initialize-ejs-before-implementation
    - per-phase-checkpoint-updates
    - wrapup-with-adr-rubric
  prompts:
    - "lets start"
    - "/ejs-session-wrapup"
  anti_patterns:
    - delayed-journey-capture
    - skip-adr-rubric-on-workflow-change
  future_considerations:
    - automate periodic checkpoint prompts
```
