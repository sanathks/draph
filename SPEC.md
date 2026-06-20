# Draph — Improvement Spec (living document)

This document is built and maintained by a recurring **/loop**. Each iteration
analyzes the codebase (`index.html` + `test/`) for one concrete improvement and
appends a dated, numbered entry below. Over time this grows into a usable spec:
a prioritized, acceptance-criteria-backed backlog the team (or an agent) can pull
work from.

- **App:** single static file `index.html` (see [ARCHITECTURE.md](./ARCHITECTURE.md)).
- **Tests:** `npm test` → `test/regression.mjs` (jsdom, 137 checks as of 2026-06-18).
- **Convention:** entries are append-only; when an improvement ships, mark it
  `DONE` with the commit, don't delete it.

## How to read an entry
Each entry has: **Area**, **Problem** (what's wrong / the analysis), **Proposed
improvement**, **Acceptance criteria** (how we know it's done), and **Effort/Risk**.

---

## Improvement log

### #1 — Multi-line label editing · 2026-06-18 · status: DONE (commit e631246)
- **Area:** UX / editing
- **Problem:** The in-place label editor (`editNodeLabel`) creates a single-line
  `<input>`. Labels render wrapped (and sticky notes are multi-line by nature),
  but the user can never insert an intentional line break — Enter commits. So a
  note or a node whose text should break at a chosen point can't be authored;
  wrapping is only automatic by width.
- **Proposed improvement:** Use a `<textarea>` for the in-place editor on
  multi-line-capable types (`note`, `container`, and any node where the user
  wants explicit breaks). Enter inserts a newline; **Cmd/Ctrl+Enter** or blur
  commits; Escape cancels. Persist `\n` in `node.label`; the renderers already
  wrap, so they need to also honor explicit `\n` as a hard break.
- **Acceptance criteria:**
  - Double-clicking a note opens a multi-line editor; typing Enter adds a line.
  - Committed label round-trips `\n` through save/load (URL hash) and render.
  - `fitNodeToLabel` accounts for explicit line breaks when sizing height.
  - Single-line types (`text`) keep single-line editing; no regression in the
    134→ existing label tests.
- **Effort/Risk:** Medium / Low–Medium (touches editor + 4 renderers + sizing;
  guard with new regression checks for `\n` round-trip).

---

## Backlog (analyzed, not yet written up as full entries)
Future loop iterations should promote these into numbered entries (with criteria)
and, when ready, implement + verify with `npm test`:

- **Render-time side re-evaluation:** ✅ **DONE (#34)** — `computeConnectionGeometry`
  now recomputes auto (non-locked) sides every render and writes them back to the
  connection, so an edge re-seats to its optimal sides as nodes move (no manual
  Auto-Arrange). Locked sides (`fromSideLocked`/`toSideLocked`) are never touched.
- ~~**Subgraph layout parity:**~~ DONE (commit 57ac846) — the subgraph branch now
  shares the width-aware `estW/estH/HGAP/VGAP` sizing and preserves barycenter
  ordering inside each container; children no longer overlap on long labels.
- **`fitNodeToLabel` shrink-to-fit (opt-in):** currently grow-only, so deleting
  text leaves nodes oversized. Consider shrinking toward content unless the user
  manually resized (needs a `manuallyResized` flag).
- **Hard-break very long words:** a single unbreakable token still forces a very
  wide node; offer character-level wrapping past a width cap.
- **Export test coverage:** PNG/SVG/GIF export is untested (jsdom lacks canvas).
  Add SVG-string assertions (cropping, no UI chrome) which are testable.
- **Deploy source reconciliation (ops):** `draph.sanath.dev` auto-deploys from
  the `draph-core` repo, but development happens in `draph`. Align them so manual
  CLI deploys aren't required.
