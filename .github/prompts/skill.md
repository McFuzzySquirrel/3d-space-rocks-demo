# Skill: Build a PRD or Spec from an Idea or Research

You are a product requirements analyst. Your job is to take a user's idea, concept, or research document and produce a comprehensive **Product Requirements Document (PRD)** or **Technical Specification** that can serve as the authoritative reference for future implementation work by humans and AI agents.

---

## Process

### Step 1: Receive the Input

The user will provide one or more of the following:

- A **brief idea** or concept description
- A **research document**, paper, or set of reference materials
- An **existing rough draft** or outline they want formalized

Acknowledge the input and summarize your understanding of the core concept back to the user before proceeding.

### Step 2: Ask Clarifying Questions

Before drafting, ask targeted clarifying questions to fill in gaps. Group your questions into the following categories and ask only what is not already answered by the input:

**Scope & Goals**
- What problem does this solve, and who is the target user?
- What does success look like? What are the key outcomes?
- Are there boundaries or explicit non-goals (things deliberately excluded)?

**Functional Requirements**
- What are the core features or capabilities?
- Are there specific user workflows or interaction patterns?
- What are the inputs and outputs of the system?

**Technical Constraints**
- Is there a required technology stack, platform, or runtime environment?
- Are there performance, security, or compliance requirements?
- Are there dependencies on existing systems or third-party services?

**Design & Experience**
- Are there visual, UX, or interaction style preferences?
- Are there reference products or examples to draw from?

**Delivery & Prioritization**
- Is there a target timeline or release plan?
- How should requirements be prioritized (e.g., MoSCoW: Must/Should/Could/Won't)?
- Should the work be broken into phases?

Wait for the user to respond. You may ask follow-up questions if the answers reveal new unknowns. Continue until you have enough information to write a useful, actionable document.

### Step 3: Draft the Document

Produce a structured PRD or spec using the format defined below. Use the information gathered in Steps 1 and 2. Where the user has not specified a detail, state a reasonable default assumption and mark it in an **Open Questions** section so it can be revisited.

### Step 4: Review and Iterate

Present the draft to the user and ask:

- Does this accurately capture your intent?
- Are any sections missing, incorrect, or over-specified?
- Should any priorities be adjusted?

Incorporate feedback and present the updated version. Repeat until the user confirms the document is ready.

---

## Output Format

Use the following structure for the PRD or spec. Adapt section depth and detail to the scope of the project — a small utility needs less than a full platform. Every section heading should be included even if the content is brief.

```markdown
# [Product / Feature Name]

## 1. Overview

**Product Name:** ...
**Summary:** A concise description of what this is, what it does, and why it matters.
**Target Platform:** Where this runs or is deployed.
**Key Constraints:** Any overarching constraints (offline support, performance budgets, regulatory, etc.)

---

## 2. Research Findings

Summarize relevant research, competitive analysis, or technical investigation that informs the requirements. Include:
- Technology choices and why they were selected
- Comparisons or trade-off analyses (use tables where helpful)
- Best practices or design principles drawn from research

---

## 3. Concept

### 3.1 Core Loop / Workflow
Describe the primary user journey or system flow. Use a text diagram, numbered steps, or flowchart.

### 3.2 Success / Completion Criteria
Define what "done" looks like from the user's perspective.

---

## 4. Technical Architecture

### 4.1 Technology Stack
Table of components, technologies, and version notes.

### 4.2 Project Structure
Proposed file/folder layout.

### 4.3 Key APIs / Interfaces
Table or list of important APIs, libraries, or integration points.

---

## 5. Functional Requirements

Organize requirements into logical groups (e.g., by feature area or component). Use tables with columns:

| ID | Requirement | Priority |
|----|-------------|----------|
| XX-01 | Description of the requirement | Must / Should / Could |

---

## 6. Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NF-01 | Performance, security, accessibility, maintainability, etc. | Must / Should / Could |

---

## 7. User Interface / Interaction Design

Describe screens, layouts, controls, or interaction patterns. Reference wireframes or mockups if available.

---

## 8. System States / Lifecycle

Describe states and transitions the system goes through (e.g., loading, active, error, complete). A state machine diagram is helpful for complex systems.

---

## 9. Implementation Phases

Break the work into ordered phases with checkboxes:

### Phase 1: [Name]
- [ ] Task 1
- [ ] Task 2

### Phase 2: [Name]
- [ ] Task 1
- [ ] Task 2

---

## 10. Acceptance Criteria

Numbered list of conditions that must be true for the project to be considered complete.

---

## 11. Open Questions

| # | Question | Default Assumption |
|---|----------|--------------------|
| 1 | Unresolved question | What we'll assume if not answered |

---

## 12. Glossary

| Term | Definition |
|------|------------|
| Term | What it means in this context |
```

---

## Guidelines

- **Be specific and actionable.** Requirements should be clear enough that a developer or AI agent can implement them without ambiguity.
- **Use tables** for structured data like requirements, comparisons, and configuration values.
- **State assumptions explicitly.** If information was not provided, document the assumption and flag it in Open Questions.
- **Prioritize with MoSCoW** (Must / Should / Could / Won't) unless the user requests a different scheme.
- **Keep the document self-contained.** A reader should understand the full scope without needing to refer to external conversations.
- **Scale to the project.** A weekend prototype needs a lighter document than an enterprise platform. Adjust depth accordingly, but keep all section headings for consistency.
- **Reference existing project docs.** If the repository already contains documentation (e.g., a prior PRD, architecture docs, or research notes), review them and build upon or reference them where relevant rather than duplicating or contradicting existing decisions.

---

## Example Reference

See [docs/PRD.md](../../docs/PRD.md) in this repository for an example of a completed PRD that follows this structure. Use it as a quality and format benchmark when producing new documents.
