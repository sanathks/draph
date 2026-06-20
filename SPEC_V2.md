# Draph v2 — Product & Technical Specification

> Status: **DRAFT for review** · Authored 2026-06-18 · Supersedes the ad-hoc
> v1 behavior captured in [ARCHITECTURE.md](./ARCHITECTURE.md) and the
> improvement backlog in [SPEC.md](./SPEC.md).

This is the full specification for **Draph v2**. It defines the product vision,
the v2 feature set, the architecture evolution, the data model, non-functional
requirements, and a phased delivery plan. It is written so a single engineer (or
an agent) can pick up any milestone and build it against clear acceptance
criteria.

---

## 1. Context

### 1.1 What Draph is today (v1)
A **Mermaid + visual diagram editor** that runs as **one self-contained
`index.html`** (≈5.4k lines, **zero runtime dependencies**, no build step).
Deployed at `draph.sanath.dev`.

Capabilities shipped in v1:
- **Shapes/nodes:** rect, pill, diamond, circle, container, text, sticky **note**,
  freehand **pencil**, arrow/**line**; UML **class** and sequence **participant**
  nodes (via Mermaid import).
- **Connections:** orthogonal auto-router (perpendicular entry/exit, arrow on the
  connector, width-aware spacing), drag-to-create from connectors, drag endpoints
  to re-route, manual side locking, merged connectors, top-down side bias,
  close-node curve handling.
- **Editing:** select/multi-select, drag, resize, in-place label editing,
  color/fill/outline styling, label-aware node sizing with wrapping.
- **Layout:** width-aware Sugiyama-style auto-arrange with barycenter centering.
- **Mermaid:** import + export for flowchart, sequence, class diagrams; live
  syntax-highlighted code sidebar.
- **Export:** PNG, SVG, animated GIF.
- **Persistence/sharing:** diagram serialized into the **URL hash**; "copy share
  link"; undo/redo history; grid snap; pan/zoom.
- **Quality:** jsdom regression harness (`npm test`, 109+ checks); architecture +
  agent docs.

### 1.2 v1 limitations (the case for v2)
1. **Persistence is fragile** — the whole diagram lives in the URL hash. Large
   diagrams blow past URL length limits; there is no autosave, no file, no list
   of "my diagrams."
2. **No real collaboration** — sharing is a static snapshot link, not a live or
   even re-openable editable document.
3. **Single-file is hitting its ceiling** — at ~5.4k lines one file is hard to
   navigate and risky to change; new features compound this.
4. **Diagram-type coverage is partial** — only flowchart/sequence/class; no
   state, ER, mind-map, or swimlane diagrams; Mermaid round-trip is lossy for
   styling and freehand/notes.
5. **Routing is "two-endpoint aware," not obstacle-aware** — edges can still
   cross unrelated nodes; no waypoints or manual bends.
6. **No theming** beyond the single Tokyo Night palette.
7. **Weak on touch/mobile and accessibility** — ~~mouse-only~~ **touch/Apple-Pencil
   now supported** (#21: canvas runs on Pointer events, `touch-action:none`,
   two-finger pinch-zoom + pan, pen-pressure capture, palm rejection); still
   limited keyboard nav, no ARIA/screen-reader story.
8. **No AI authoring** despite being a natural fit (text → diagram, NL editing).

### 1.3 Target users & jobs-to-be-done
- **Engineers/PMs** sketching flows, architectures, sequence diagrams fast.
- **Mermaid users** who want a visual editor that round-trips their code.
- **Teams** that need to share an editable diagram and co-edit.
- **Note-takers/whiteboarders** who mix freehand, sticky notes, and structure.

Primary JTBD: *"Let me go from idea → clean shareable diagram in under a minute,
by typing, drawing, or describing it — and let me come back and edit it later."*

---

## 2. v2 principles (non-negotiables)
These constrain every design decision below.

1. **Stays lightweight & local-first.** The product still **opens and runs with
   zero network calls** for core editing; works offline; loads instantly. Any
   backend is **optional** and only powers collaboration/cloud, never core edit.
2. **Single-file deliverable preserved.** v2 may modularize the *source*, but the
   shipped artifact remains a self-contained `index.html` (produced by a small,
   optional bundler step). Opening the file still works.
3. **No heavyweight framework** for the canvas/editor core. Vanilla + small
   focused helpers. (A framework may be used only for non-core surfaces if it
   pays for itself — see §6.)
4. **Backward compatible.** Every v1 diagram (URL hash / exported JSON) loads in
   v2 unchanged, via a versioned, migrating data model (§7).
5. **Test-guarded.** No feature ships without regression coverage; `npm test`
   stays green. Visual changes get a human/screenshot pass.
6. **Theme-driven.** No hard-coded colors in logic; everything reads from a theme
   token set.

---

## 3. v2 feature areas

Each feature lists **Why**, **What**, and **Acceptance criteria (AC)**. Priority:
**P0** = v2 core (must ship), **P1** = strong, **P2** = opportunistic.

### 3.1 Persistence & documents — **P0**
- **Why:** URL-hash-only storage is the biggest blocker to real use.
- **What:**
  - **Local-first autosave** to IndexedDB; a "My diagrams" gallery (list,
    rename, duplicate, delete, thumbnail).
  - **File save/open** as `.draph` (JSON, versioned) via the File System Access
    API where available, with download/upload fallback.
  - **URL sharing keeps working** but switches to a short link backed by a
    stored doc (or compressed hash) so large diagrams share cleanly.
  - Explicit **document model**: id, title, created/updated, schema version.
- **AC:** create → reload browser → diagram restored from IndexedDB; export
  `.draph`, clear storage, re-open file → identical diagram; a 200-node diagram
  shares via a link that opens correctly; v1 hash links still open.

### 3.2 Collaboration & sharing — **P1**
- **Why:** teams want to co-edit, not just view a snapshot.
- **What:** real-time multiplayer via CRDT (e.g. Yjs) over a thin relay; presence
  cursors; shareable edit/view links; comments/annotations pinned to nodes.
  **Optional** — degrades to local-only when offline or backend absent.
- **AC:** two browsers editing the same doc converge without lost edits; offline
  edits merge on reconnect; a view-only link cannot mutate.

### 3.3 Diagram types & fidelity — **P1**
- **Why:** broaden beyond flowchart/sequence/class.
- **What:** add **state**, **ER**, **mind-map**, and **swimlane/pool** diagrams;
  make Mermaid round-trip **lossless for styling** where the syntax allows, and
  preserve Draph-only elements (notes, freehand) in `.draph` even if Mermaid
  can't express them.
- **AC:** each new type imports from Mermaid, renders, auto-arranges, and exports
  back; `.draph` round-trip is lossless for all elements.

### 3.4 Routing & layout v2 — **P1**
- **Why:** edges still cross unrelated nodes; layout is one fixed algorithm.
- **What:**
  - **Obstacle-aware orthogonal routing** (route around *all* nodes, not just the
    two endpoints) via a grid/visibility-graph pathfinder, with the current
    clean-stub behavior preserved as the fast path.
  - **Manual waypoints / bends** the user can add and drag; edges remember them.
  - **Edge label placement** that avoids overlapping the line and nodes.
  - **Layout options:** top-down / left-right / radial; per-subgraph layout
    (close the v1 gap where subgraph layout never got the width-aware upgrade).
- **AC:** an edge routed across a field of nodes touches none of their interiors;
  a dragged waypoint persists through save/load; switching to LR re-lays-out
  cleanly without overlaps.

### 3.5 Editing UX — **P0**
- **Why:** close the sharp edges found in v1 iteration.
- **What:** **multi-line label editing** (SPEC.md #1), **grouping** (group/ungroup,
  move/resize as one), **layers/z-order**, **alignment & distribution** guides
  and snapping, **copy/paste across diagrams**, robust **keyboard shortcuts** with
  a discoverable cheat-sheet, **context menu** on right-click.
- **AC:** group of nodes moves/resizes together and survives round-trip; smart
  guides snap edges/centers; paste from one diagram into another preserves
  styling; every toolbar action has a documented shortcut.

### 3.6 AI authoring — **P1**
- **Why:** natural fit; fastest "idea → diagram."
- **What:** **text → diagram** ("describe a login flow" → nodes+edges), **NL
  editing** ("make the decision node red", "add a retry loop"), and **layout/
  cleanup suggestions**. Built on the latest **Claude models** via the Anthropic
  API (see `/claude-api`); key handling is the user's (BYO key) or a thin proxy.
- **AC:** a one-sentence prompt produces a valid, auto-arranged diagram; an NL
  edit modifies the right elements and is undoable; AI is fully optional and
  absent-key degrades gracefully.

### 3.7 Theming & styling — **P1**
- **Why:** one palette only; logic has color literals.
- **What:** a **theme token system** (background, surface, text, accent, palette,
  grid); ship light + dark + Tokyo Night; user custom themes; per-diagram theme
  saved in the doc; richer node styles (shadows, corner radius, border styles,
  gradients) and connection styles.
- **AC:** switching theme recolors everything with no hard-coded colors left in
  logic; custom theme persists in the doc and export.

### 3.8 Export & embed — **P2**
- **What:** higher-fidelity PNG (scale factor), **PDF**, copy-to-clipboard image,
  **embeddable read-only viewer** (iframe/snippet), and Mermaid/`.draph` export.
- **AC:** PNG exports at 1×/2×/3×; embed renders read-only and is pan/zoomable.

### 3.9 Input, accessibility & mobile — **P1**
- **What:** **touch/pointer** support (draw, drag, pinch-zoom), full **keyboard
  navigation** (tab through nodes, arrow-move, enter-edit), **ARIA**
  roles/labels, focus management, reduced-motion support.
- **AC:** a diagram is fully creatable/editable on a touch device; a keyboard-only
  user can add, connect, label, and delete nodes; passes an automated a11y lint.

### 3.10 Performance & scale — **P2**
- **What:** keep editing smooth at **1,000+ nodes** — viewport culling
  (render only what's visible), incremental re-render, and routing work batched
  off the interaction thread where possible.
- **AC:** 1,000-node diagram pans/zooms at ~60fps; dragging a node re-renders only
  affected connections.

---

## 4. Non-functional requirements
- **Load:** interactive in < 1s on a cold load; works fully offline.
- **Footprint:** shipped artifact stays a single HTML (+ optional service worker
  for offline). No tracking; privacy-preserving by default.
- **Reliability:** autosave never loses > 5s of work; crash-safe restore.
- **Compatibility:** evergreen Chrome/Firefox/Safari; graceful degradation where
  File System Access / clipboard APIs are missing.
- **Quality bar:** `npm test` green; new logic covered; visual diffs reviewed.

---

## 5. Data model v2
- **Versioned document:** `{ schema: 2, id, title, theme, createdAt, updatedAt,
  nodes, connections, sequenceFrames, viewport }`.
- **Node** extends v1 with: `groupId?`, `z?` (layer order), `style?` (theme-aware
  overrides), and per-type extras (`points` for pencil, `waypoints` carried on
  connections).
- **Connection** extends v1 with: `waypoints?: {x,y}[]`, `labelPos?`, keeping
  `fromSide/toSide(+Locked)` semantics.
- **Migration:** a `migrate(doc)` step upgrades v1 (schema 1 / bare hash) → v2 on
  load; round-trips are lossless within v2. **AC:** any v1 URL hash opens and
  re-saves as schema 2 with no visual change.

---

## 6. Architecture evolution
The crux of v2: grow capability **without** breaking the lightweight ethos.

- **Source modularization, single-file output.** Split the inline script into ES
  modules by the existing section boundaries (`state`, `geometry/routing`,
  `render`, `interaction`, `mermaid`, `export`, `ui`). A tiny build (esbuild)
  **inlines everything back into one `index.html`** for shipping. Dev gets
  structure; the product stays a self-contained file that still opens locally.
  *(Decision to confirm: acceptable to introduce a build step? See §9.)*
- **Rendering:** keep SVG (DOM-diffed per layer) for ≤ a few hundred nodes; add an
  optional Canvas/WebGL fast path only if §3.10 needs it. Behind one render
  interface so the editor core doesn't care.
- **State:** a small central store with an explicit command/undo stack (replaces
  ad-hoc `saveState()` snapshots), enabling grouping, CRDT, and clean history.
- **Optional services (network):** a thin relay for collaboration (§3.2) and an
  optional AI proxy (§3.6). Both are feature-flagged; core editor never depends
  on them.
- **Plugin seam (P2):** a registry for node shapes, diagram types, exporters, and
  AI actions, so new types are additive (closes v1's "edit the giant render
  function" pain).

---

## 7. Delivery plan (phased)
Each milestone is independently shippable and test-guarded.

- **M0 — Foundation refactor (P0):** modularize source + bundler to single-file;
  central store + command/undo stack; theme token system; data model v2 +
  migration. *No user-visible change beyond theming hook.*
- **M1 — Persistence (P0):** IndexedDB autosave, "My diagrams" gallery,
  `.draph` file open/save, durable share links.
- **M2 — Editing UX (P0):** multi-line labels, grouping, layers, alignment guides,
  cross-diagram copy/paste, context menu, shortcut cheat-sheet.
- **M3 — Routing & layout v2 (P1):** obstacle-aware routing, waypoints, edge-label
  placement, layout direction options, subgraph layout parity.
- **M4 — Diagram types & fidelity (P1):** state/ER/mind-map/swimlane; lossless
  `.draph`; richer Mermaid round-trip.
- **M5 — AI authoring (P1):** text→diagram, NL editing, cleanup suggestions.
- **M6 — Collaboration (P1):** CRDT multiplayer, presence, comments.
- **M7 — Accessibility & touch (P1):** pointer/touch, keyboard nav, ARIA.
- **M8 — Export/embed & scale (P2):** PDF, scaled PNG, embed viewer, viewport
  culling for 1k+ nodes.

---

## 8. Out of scope for v2
- Native desktop/mobile apps (PWA install is enough).
- A full design tool (vector illustration); Draph stays diagram-focused.
- Server-rendered diagrams / heavy backend.
- Account system beyond what collaboration strictly needs.

---

## 9. Open questions / decisions to confirm
1. **Build step:** is introducing a small bundler (to keep a single-file output
   from modular source) acceptable, given the "no build" v1 ethos? *(Recommended:
   yes — it preserves the single-file product while making the source
   maintainable.)*
2. **Collaboration backend:** self-host a tiny relay, or use a managed CRDT
   service? Affects privacy posture and ops.
3. **AI key model:** BYO-key (user pastes their Anthropic key, stored locally) vs.
   a hosted proxy with limits? BYO is simplest/most private for v1 of the feature.
4. **Deploy source:** reconcile `draph` (dev) vs `draph-core` (the repo
   `draph.sanath.dev` auto-deploys from) before M0.
5. **Priority of collaboration (M6) vs AI (M5):** which lands first depends on
   audience — solo authors favor AI, teams favor collab.

---

## 10. Success metrics
- Time-to-first-diagram < 60s for a new user (incl. AI path).
- Diagrams reliably re-openable (0 lost docs); large diagrams shareable.
- `npm test` green every milestone; a11y lint passes by M7.
- Core editor still loads offline with zero network calls.
