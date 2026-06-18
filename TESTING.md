# Draph — Visual / User-Level Test Plan

`npm test` (jsdom) verifies *logic* but **cannot see pixels** — it can't tell if
an arrowhead sits on a connector, a label overflows, or the toolbar looks right.
This plan covers **user-level verification in a real browser**, driven by the
**Claude-in-Chrome MCP** (navigate, click, type, screenshot, read console).

Two layers, both required:
1. **`npm test`** — fast logic regression (run on every change).
2. **This plan** — visual/interactive smoke + acceptance, run before a release
   and whenever a visual change lands.

---

## How it runs (automation)
The agent drives a real Chrome tab via the MCP:
- `navigate` to the app URL, `computer` (click/drag/type/screenshot/zoom),
  `read_console_messages` (catch JS errors), `read_page`/`find` (locate elements).
- Each scenario: perform the user actions, then **screenshot** and verify the
  expected result by eye; assert **zero console errors**.
- Optional: `gif_creator` to record a flow for the PR.

### What the agent needs from you (setup)
1. **A running app URL** — either your dev server (`npm run dev`, e.g.
   `http://localhost:3000`) for local changes, or `https://draph.sanath.dev` for
   the live build. (Dev server for verifying un-deployed work.)
2. **Chrome with the Claude extension connected** (✔ confirmed working).
3. **Site permission granted** in the extension for that URL (localhost or
   draph.sanath.dev) — the extension needs per-site access before it can act.
4. Pick which connected browser to use when prompted.

---

## Conventions for each scenario
**Pre:** starting state · **Do:** user actions · **Expect:** what you should see
· **Fail signals:** what counts as broken · **Console:** must be error-free.

---

## A. Core canvas & tools (v1, testable now)

### A1 — Click-to-create at standard size
- **Do:** pick Rectangle (or press `1`), single-click empty canvas.
- **Expect:** a default-size rectangle appears centered on the click; the tool
  reverts to the arrow (select) and the new node is selected, ready to edit.
- **Fail:** nothing appears (needs drag); tool stays on Rectangle.

### A2 — Drag-to-create custom size
- **Do:** with a shape tool, click-drag a box.
- **Expect:** shape matches the dragged size; tool reverts to the arrow after.

### A3 — Tools revert to arrow after one shape (pencil is the exception)
- **Do:** draw a note (`N`); then draw a pencil stroke (`P`).
- **Expect:** after the note, the tool returns to the arrow (re-pick `N` for the
  next note); the **pencil stays active** so you can keep sketching until `V`/`Esc`.

### A4 — Pencil freehand
- **Do:** press `P`, draw a squiggle.
- **Expect:** a smoothed freehand stroke; selectable/movable; recolor via the
  outline-color swatch.

### A5 — Select, move, resize, delete
- **Do:** `V`, click a node, drag it, drag its resize handle, press Delete.
- **Expect:** moves/resizes smoothly (no lag/jank); deletes; undo (`⌘Z`) restores.

### A6 — Shortcut badges & More menu
- **Do:** inspect the toolbar.
- **Expect:** creation tools show shortcut badges (1–6, T, P, N, V); secondary
  actions (undo/redo, arrange, mermaid, grid, flow, line style, export, share,
  clear) live under the **⋯ More** menu and all work.

## B. Labels & sizing

### B1 — Label-aware sizing (no overflow)
- **Do:** double-click a diamond, type `Authenticated?`.
- **Expect:** the diamond **grows to contain** the text — no overflow past the edges.

### B2 — Multi-word wrap
- **Do:** label a rect `This is a fairly long multi word label`.
- **Expect:** text **wraps to multiple lines**; node grows taller, width stays
  moderate (not one very wide node).

### B3 — In-place edit commit/cancel
- **Do:** double-click a node, type, press Enter (commit) / Escape (cancel).
- **Expect:** Enter saves, Escape reverts; the active tool is unaffected.

## C. Connections & routing (the most visual-sensitive area)

### C1 — Draw a connection
- **Do:** hover a node, drag from a side connector to another node.
- **Expect:** the **blue preview matches the final orthogonal shape**; on drop it
  **sticks** (even dropping on the node body, not just the dot).

### C2 — Arrowhead sits on the connector
- **Do:** inspect any connection.
- **Expect:** arrow tip is **exactly on the node edge**; the line is trimmed to
  the arrow base — **no line poking past/behind the arrowhead**.

### C3 — Endpoint re-route
- **Do:** select a connection, drag an endpoint onto a different side/node.
- **Expect:** target connector **highlights** while dragging; endpoint moves and
  the side sticks. Pressing near an end grabs it in one motion.

### C4 — Close-node curve (no hook)
- **Do:** drag two connected nodes close together.
- **Expect:** the edge stays a **clean short/straight line** — no hook/loop.

### C5 — Side selection (no sideways "L")
- **Do:** place a node below-and-slightly-beside its parent.
- **Expect:** edge enters from the **top** (top-down), not wrapping into the side.

## D. Auto-arrange
- **Do:** build User→Authenticated→(Load dashboard | Show login)→(Done | Submit),
  then **Auto-Arrange** (`A`).
- **Expect:** clean top-down tree; **no overlapping nodes**; parents **centered
  over children**; branches fork from the diamond's **bottom into each child's
  top** (no tangles/curls).

## E. Mermaid
- **E1 Import:** open ⋯ → Mermaid, paste a flowchart, Import → matches the code.
- **E2 Export:** build a diagram, Export → valid Mermaid that re-imports the same.
- **E3 Highlight:** code sidebar shows syntax highlighting.

## F. Export & share
- **F1:** ⋯ → Export PNG / SVG / GIF → file downloads, content correct, no UI
  chrome (connectors/handles) in the output.
- **F2:** ⋯ → Copy share link → reopening the link restores the diagram.
- **F3 empty:** export with empty canvas → friendly toast, no crash.

## G. Persistence & misc
- **G1:** reload the page on a shared link → diagram restores.
- **G2:** Clear canvas → **in-app confirm dialog** (not native), confirm clears.
- **G3:** toasts (not native alerts) for share/export messages.
- **G4 empty state:** fresh canvas shows the onboarding empty state; it
  disappears once a node exists.

---

## H. v2 acceptance hooks (fill in as milestones land)
Each v2 feature in `SPEC_V2.md` gets a scenario here mirroring its **Acceptance
criteria**. Skeleton:
- **Persistence:** create → reload → restored from IndexedDB; `.draph` open/save
  round-trip; large-diagram share link opens.
- **Grouping/layers/align:** group moves as one; smart guides snap.
- **Obstacle routing:** edge across a node field touches no interiors; waypoint
  persists.
- **New diagram types:** state/ER/mind-map import→render→arrange→export.
- **AI authoring:** one-sentence prompt → valid arranged diagram; NL edit undoable.
- **Theming:** switch theme recolors everything; custom theme persists.
- **Collaboration:** two tabs converge; view-only can't mutate.
- **A11y/touch:** keyboard-only create/connect/label/delete; touch draw + pinch.

---

## Release checklist (quick gate)
- [ ] `npm test` green
- [ ] A (tools), B (labels), C (routing), D (arrange) screenshots reviewed, no
      console errors
- [ ] E/F/G spot-checked
- [ ] New/changed feature has a scenario above + a screenshot in the PR
