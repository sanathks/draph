# Draph — Architecture (for humans and agents)

Draph is a **Mermaid + visual diagram editor**: draw shapes and connections on a
canvas, or write Mermaid code and render it, and go back and forth between the two.

## TL;DR for agents

- **One file runs the app:** [`index.html`](./index.html). HTML + CSS + one inline
  `<script>`. **No build step, no framework, no runtime dependencies.** Keep it
  that way — prefer a small vanilla helper over a new dependency.
- **Find your way around:** the script is divided into labelled sections — search
  for `=== SECTION:`. There's also a big header comment at the top of the script
  with the data model and render pipeline.
- **Before and after any change** to state, routing, rendering, or Mermaid: run
  `npm test`. It will not catch *visual* regressions — for those, `npm run dev`
  and look at `http://localhost:3000`.

## Layout of the repo

| Path | What it is |
|------|------------|
| `index.html` | The entire application. |
| `test/harness.mjs` | Boots `index.html` in jsdom, stubs the browser APIs jsdom lacks, exposes helpers. |
| `test/regression.mjs` | The `npm test` suite — logic-level behavior checks. |
| `docs/` | Static documentation site (separate from the app). |
| `ARCHITECTURE.md` | This file. |

## The single-file script, section by section

Top to bottom inside the `<script>`:

1. **STATE & CONFIG** — the mutable app state (`nodes`, `connections`, selection,
   `viewBox`, …) and `CONFIG`/`COLORS`/`ROUTE_CFG` tunables.
2. **UI PRIMITIVES** — `toast()`, `confirmDialog()` (replace native
   `alert`/`confirm`), the empty state, and the temp drag line.
3. **TOOLS, PICKERS & LIFECYCLE** — current tool, dropdowns, node-type picker,
   `init()`, undo/redo history, and URL persistence (`updateUrlHash`/`loadFromUrl`).
4. **GEOMETRY & ROUTING** — `createNode()` and the orthogonal connection router
   (see below).
5. **RENDERING** — the `render()` pipeline.
6. **SELECTION & TOOLBARS** — selecting/editing nodes & connections, color/style
   controls, in-place label editing.
7. **LAYOUT** — auto-arrange algorithms (`arrangeFlowchart`, `arrangeSequence`, …).
8. **INTERACTION** — mouse/keyboard handlers, event-delegated.
9. **EXPORT** — SVG / PNG / GIF.
10. **MERMAID** — syntax highlight, generate (diagram→code), parse, layout, import.

## Core data model

```js
node = {
  id, type,                         // type: rect|pill|diamond|circle|container|text|line
  x, y, width, height,              // for 'line', width/height are dx/dy of the end point
  label, tag?, sublabel?, semanticRole?,
  color?, outlineColor?, fillStyle?,        // styling
  isParticipant?, hasLifeline?,             // sequence diagrams
  isClass?, properties?, methods?,          // UML class diagrams
}

connection = {
  id, from, to,                     // from/to are node ids
  fromSide, toSide,                 // 'top'|'bottom'|'left'|'right'
  fromSideLocked?, toSideLocked?,   // true = user chose it; the auto-router won't override
  fromFrac?, toFrac?, fromFracLocked?, toFracLocked?,
  waypoints?, label?, labelX?, labelY?, labelPositionLocked?,
  semanticRole?, color?, lineStyle?, strokeStyle?,
  isSequenceMessage?, messageY?, arrow?,    // sequence diagrams
}
```

State lives in module-scoped `let` bindings (not on `window`), so tests reach them
via `win.eval('connections')`. Top-level `function` declarations *are* global, so
the app's functions are callable directly (`win.createNode(...)`).

## Render pipeline

`render()` = `renderConnections()` + `renderNodes()` + `updateEmptyState()`. It
rebuilds the `innerHTML` of three persistent SVG layers, painted back-to-front:

```
#connections (lines)  →  #nodes (shapes)  →  #connHandles (endpoint drag dots)
```

- **`scheduleRender()`** — rAF-throttled full render; call it from hot paths.
- **`scheduleDragRender()`** — cheap path while dragging a node: it `transform`s the
  dragged node group and redraws only the connection layer, skipping the expensive
  node-markup rebuild. A full `render()` runs on mouse-up to bake the new position.
- **Events are delegated once** in `bindCanvasEvents()` onto the persistent layer
  groups, so rebuilding `innerHTML` never needs to re-bind listeners.

## Connection routing (orthogonal)

In the GEOMETRY & ROUTING section. Pure geometry, no side effects:

- `getOptimalSides(from, to)` — auto-pick which sides to attach to (unless locked).
- `routeConnection(from, to, fromSide, toSide)` — returns the preview polyline.
- `computeConnectionRoutes()` batch-routes final edges around expanded node and
  container-header obstacles, then reserves accepted channels.
  - It pushes a short **perpendicular stub** off each node so the line leaves the
    source and enters the target square-on (the arrowhead always sits perpendicular
    on the connector). The stub clearance is adaptive (`ROUTE_CFG`) so close nodes
    don't get a cramped back-jog.
  - `connectExits()` joins the two stub points, choosing the corner so the segment
    entering the target is perpendicular to its side (a clean 90°, never a spike).
- The renderer places the arrow tip exactly on the connector and trims the drawn
  line back to the arrow's base, so no line shows through the arrowhead.
- Automatic endpoint fractions and route lanes are computed, not persisted.
- Endpoint, waypoint, and label drags persist only explicit user intent.
- Crossing bridges and collision-aware labels derive from final routes.

## How to extend (common tasks)

| Goal | Where |
|------|-------|
| New tunable / magic number | Add to `CONFIG` (don't sprinkle literals). |
| New palette color | Add one hex to `CONFIG.palette` — all three pickers update. |
| New keyboard shortcut | Add an entry to `KEY_BINDINGS`; update the empty-state hint. |
| New node shape | Add a default size in `createNode()`, a branch in `renderNodes()`, and a toolbar button. For diagram-specific shapes (UML/sequence/state/ER), add a `placeShape(kind, x, y)` branch + a button in the **shape library panel** (`#shapePanel`, toggled via `toggleShapePanel()` / the `S` toolbar button) rather than a top-level tool. |
| Routing behavior | `ROUTE_CFG` + `routeConnection()` / `connectExits()`. |
| New Mermaid syntax | `parseMermaid()` (code→diagram) and `generateMermaid()` (diagram→code). |

## Testing

```bash
npm install   # once, to get jsdom (devDependency)
npm test        # runs test/regression.mjs
npm run test:visual
npm run test:all
npm run dev     # serve at http://localhost:3000 for a visual check
```

`npm test` boots the real `index.html` in jsdom for logic checks. Playwright checks
reviewed Darwin and Linux screenshots for every canonical geometry fixture.

When you change rendering, update and review both platform baseline sets.
