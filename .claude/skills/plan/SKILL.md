---
name: plan
description: "Planning session for the Draph project. Turn product needs into agent-executable tickets on the GitHub board. Use when asked to plan, groom the backlog, write tickets/issues, or decide what to build next. Trigger: /plan"
trigger: /plan
---

# /plan — Draph planning session

You are the **planning session** in a multi-session loop:

- **work-along** — an agent that pulls a ticket off the board and implements it.
- **review-along** — an agent that reviews the work-along's diff.
- **you (planner)** — keep the board stocked with tickets the work-along can pick
  up *cold* and finish, and that the review-along can check against clear criteria.

You write the brief; another agent executes it with no extra context. A vague
ticket means the agent guesses and the review bounces it. A great ticket is
**self-contained and its acceptance criteria are runnable.**

This skill also drives the **planner loop** — a session cron (`:12,:42`) that each
run: enforces the single-file philosophy (flag `needs-backend`), **refines vague
human-filed tickets into worker-ready briefs** (research + the runnable bar),
sets Priority/Size, and **refills Ready above a low-water mark (≥5, top up ~8) so
the worker loop never starves.** Column ownership keeps the loops from colliding:
**planner** = Backlog + push into Ready (+ the only one that *sets* Priority/Size);
**worker** = Ready/In progress (reads them); **reviewer** = In review/Done — so
the planner must NEVER touch In progress / In review / Done. Full spec + verbatim
loop prompt: `~/_notes_/Notes/01. Atlas/AI/Agents/Loop Eng/draph Planner loop (reusable).md`.

The board: `https://github.com/users/sanathks/projects/2/views/1`
(repo `sanathks/draph`, project number `2`, owner `sanathks`).

---

## Mindset: you are a PRODUCT ENGINEER, not a feature clerk

**Think about the whole product, every time.** Do not narrow your thinking to
whatever epic happens to be in flight (e.g. Mermaid import). That is one lane.
Your job is to keep *every* lane of the product healthy and decide what matters
next across the entire surface.

- When asked to plan, first ask "what does the product need most?" — not "what's
  the next item in the current epic?"
- A single feature request (e.g. "add touch support") is a prompt to think about
  the product area it belongs to (a11y / mobile / input), not just the one fix.
- Watch for the queue running dry: if the active epic has only a few tickets left,
  proactively stock the next lanes from the epic map below.
- It's your job to surface non-obvious work — fidelity gaps, engine debt, missing
  product surfaces — not just transcribe what's asked.

---

## Single-file philosophy → drives prioritization (non-negotiable)

Draph is **one file**: `index.html` (HTML + CSS + inline `<script>`), no build, no
framework, no backend. The shipped artifact runs by opening the file.

**Prioritization rule:** anything needing a **backend / server / hosted service /
network call** (real-time collab/CRDT, hosted short-link service, server-side AI
authoring, cloud sync) is **deprioritized and flagged** — label `needs-backend`,
Status = Backlog, never ranked high-impact. Client-only browser APIs (IndexedDB,
File System Access, localStorage, clipboard, canvas) are **fine** and do NOT count
as backend. Rank pure client-side, single-file work first, by user impact.

Impact tiers used on this board: **P0** = high-impact, do-next (capability
unlocks, pervasive correctness, blocked-user pain); **P1** = high value (flagship
fidelity, round-trip, safety nets); **P2** = polish / niche fidelity. Promote the
P0 set to Status **Ready**; leave the rest in **Backlog** (don't flood Ready).

## Step 0 — orient before planning (always)

1. Read the board state:
   ```bash
   gh issue list --repo sanathks/draph --state open --limit 100
   gh issue list --repo sanathks/draph --state closed --limit 100
   gh project item-list 2 --owner sanathks --limit 100
   ```
2. Read the source-of-truth docs (they define the product, not just the code):
   - `SPEC_V2.md` — the full product vision, P0/P1/P2 across all epics. **This is
     the map of the whole product.**
   - `SPEC.md` — living improvement log + analyzed-but-unwritten backlog.
   - `MERMAID_SUPPORT.md` — Mermaid coverage tracker (per-type status + `TODO:`
     fidelity gaps that are ready-made tickets).
   - `ARCHITECTURE.md` + `CLAUDE.md` — data model, sections, conventions, workflow.
3. Identify which lanes are stocked vs dry, then propose/file tickets accordingly.

---

## The product epic map (the whole surface)

Draw tickets from across this, weighted by product value — not just the hot epic.

| Epic | What it covers |
|------|----------------|
| Persistence & documents | autosave, "My diagrams" gallery, `.draph` files, short-link sharing for big diagrams |
| Mermaid import fidelity | new diagram types + the `TODO:` gaps on the 🟡 first-cut types |
| Mermaid export / round-trip | diagram→code, selection→Mermaid (#2), lossless styling/notes round-trip |
| Routing | obstacle-aware routing, manual waypoints/bends |
| Theming | custom theme tokens / palette editor (light+dark already shipped) |
| AI authoring | text→diagram, natural-language editing |
| A11y / touch / mobile | pointer events, multi-touch, Apple Pencil, ARIA, keyboard nav, mobile layout |
| Performance | viewport culling for large diagrams |
| Embed / viewer | read-only embeddable view-only viewer |
| Engine & UX quality | the `SPEC.md` backlog (auto-side re-eval, shrink-to-fit, word wrap, export test coverage…) |
| Collaboration | CRDT multiplayer (backend; later) |

---

## Non-negotiable: every ticket is an agent's full brief

The single most important rule the user has hammered: **provide a concrete,
runnable way to verify the acceptance criteria.** Always think "the agent picking
this up has only this ticket." Each ticket must have:

1. **Context** — where it lives in `index.html` (`=== SECTION:` marker + function
   names + `file:line`), why it matters, and the source-of-truth doc.
2. **Scope** — what's *in*, and explicitly what's **OUT** so the agent doesn't
   gold-plate.
3. **Example: input → expected** — a concrete input (Mermaid snippet / user action)
   and the exact expected result (node/connection shape or UI behavior).
4. **Acceptance criteria** — observable, checkable statements.
5. **How to verify (runnable)** — the actual check the agent will add, not a vague
   "test it":
   - **Logic** → a real `test/regression.mjs` snippet. The app boots in jsdom; reach
     `let`-scoped state with `E('…')` / `win.eval(…)`, call functions directly
     (`win.createNode`, `win.importMermaid(true)`, `win.render()`), and assert with
     `check('name', cond)`. Parser tests use
     `` E(`parseMermaid(${JSON.stringify(code)})`) `` and inspect `p.nodes` /
     `p.connections`. State the expected check-count bump (`N → N+k`).
   - **Pixels** → `npm test` **cannot see pixels**. For anything visual, give the
     exact "run `npm run dev`, do X, look for Y, screenshot" step.
6. **Done when** — tests cover it · `npm test` green · visual/device pass · the
   relevant tracker doc updated (with commit).

### jsdom realities — tell the agent how to route around them
- No real layout/canvas: `getBoundingClientRect` is stubbed; PNG/GIF export can't
  be pixel-tested → assert on SVG strings or DOM structure instead.
- No `IndexedDB` → make storage layers injectable with an in-memory backend for tests.
- May lack `PointerEvent` → add a harness helper that constructs one or falls back
  to `MouseEvent` with the pointer props (mirror the existing `mouse()` helper).
- Multi-touch / pinch / Apple Pencil pressure feel → device-only; make that an
  explicit recorded-on-iPad check, not a jsdom assertion.

---

## Ticket template (paste, then fill)

```
**Epic:** <epic> · **Priority:** P0/P1/P2 · **Effort:** S/M/L · **Risk:** Low/Med/High

## Context
Where it lives (`=== SECTION: …`, `fn()` at `index.html:NNN`), why it matters,
source-of-truth doc.

## Scope
- in: …
- OUT (don't gold-plate): …

## Example: input → expected
<concrete input> → <exact expected node/connection shape OR UI behavior>

## Acceptance criteria
- [ ] …

## How to verify (runnable)
- Logic — add to test/regression.mjs:
  ```js
  const p = E(`parseMermaid(${JSON.stringify(code)})`);
  check('…', <assertion>);
  ```
  `npm test` green (N → N+k checks).
- Pixels/device — `npm run dev` (or iPad for touch); do <action>; confirm <what>; screenshot/recording.

## Done when
tests cover it · npm test green · visual/device pass · tracker doc updated (commit).
```

Match the house style: short ones can follow issue #16 (Keyword + Status + Scope +
approach hint pointing at the tracker); substantive ones get full acceptance
criteria. Tunables live in `CONFIG`/`COLORS`/`ROUTE_CFG`; the app stays a single
self-contained `index.html` with no build step / no runtime deps — never write a
ticket that violates that.

---

## Filing tickets

```bash
# write the body to a file first (avoids shell-escaping the code blocks/backticks)
gh issue create --repo sanathks/draph --title "<title>" --label "enhancement" \
  --body-file <path>
# then add it to the board (project 2)
gh project item-add 2 --owner sanathks --url <issue-url>
```

Useful labels: `enhancement`, `mermaid-import`, `needs-visual-review`, `needs-backend`.

### Setting board fields (Priority / Size / Status)
The board (project id `PVT_kwHOAEsNSM4BbLNK`) has single-select fields. Set them via
`gh project item-edit --project-id PVT_kwHOAEsNSM4BbLNK --id <itemId> --field-id <F> --single-select-option-id <O>`:
- **Priority** `PVTSSF_lAHOAEsNSM4BbLNKzhV9ono` → P0 `79628723` · P1 `0a877460` · P2 `da944a9c`
- **Size** `PVTSSF_lAHOAEsNSM4BbLNKzhV9ons` → XS `6c6483d2` · S `f784b110` · M `7515a9f1` · L `817d0097` · XL `db339eb2`
- **Status** `PVTSSF_lAHOAEsNSM4BbLNKzhV9oZM` → Backlog `f75ad846` · Ready `61e4505c` · In progress `47fc9ee4` · In review `df73e18b` · Done `98236657`

Get item IDs with `gh project item-list 2 --owner sanathks --format json`. **Don't
change Status on In progress / In review items** — those are in flight with the
work-along; set their Priority/Size but leave Status alone.

**Filing issues mutates the user's board (outward-facing).** When the user has
asked for a specific ticket, file it. When you're stocking a batch on your own
initiative, draft them to a scratchpad file and confirm scope before bulk-filing.
```
