# Mermaid import support — coverage tracker

Goal: a user can paste/import **any** Mermaid diagram into draph and get a
faithful, editable result (aim: 1:1). This file tracks each Mermaid diagram type
and where draph stands. Driven by the `/loop` that adds one type at a time.

Parser entry point: `parseMermaid(code)` in `index.html` → dispatches by the
first line to a per-type parser, returns `{ nodes, connections, diagramType, … }`.
Layout: `layoutNodes(...)`. Render: `renderNodes()` / `renderConnections()`.

Legend: ✅ supported · 🟡 partial · ⬜ not yet · ➖ n/a for a node-graph tool

| Diagram | Keyword | Status | Notes |
|---|---|---|---|
| Flowchart | `flowchart` / `graph` | ✅ | nodes, shapes, edges, labels, subgraphs |
| Sequence | `sequenceDiagram` | ✅ | participants, lifelines, messages, frames |
| Class | `classDiagram` | ✅ | classes w/ properties/methods; **now**: `<<interface/abstract/enumeration>>` stereotypes, generics `~T~`→`<T>` (generic class ids unified), `direction`, multiplicities `"1" o-- "0..*"`, all relation operators (`<\|--`, `..\|>`, `*--`, `o--`, `-->`, `..>`), dotted relations dashed, auto-size, **UML end-markers** (hollow triangle = inheritance/realization, filled/hollow diamond = composition/aggregation, open arrow = association/dependency, at the correct end), connection-aware non-overlapping layout. TODO: namespaces |
| State | `stateDiagram` / `-v2` | 🟡 | **NEW.** states→rounded rects, transitions+labels, `[*]`→small dot. TODO: composite (nested) states as containers, `note`, `<<fork>>/<<join>>/<<choice>>` shapes, `direction`, concurrency `--` |
| Entity-Relationship | `erDiagram` | 🟡 | entities→class-style boxes w/ attribute rows (+PK/FK/UK tags), relationships→labeled edges, non-identifying `..`→dashed. **Now (#23):** crow's-foot **cardinality** on each end — `||`=one (double bar), `|o`/`o|`=zero-or-one (circle+bar), `}|`/`|{`=one-or-many (bar+foot), `}o`/`o{`=zero-or-many (circle+foot), via the inline `umlMarker()` end-markers. TODO: relationship-attribute editing UI |
| Mindmap | `mindmap` | 🟡 | **NEW.** indentation-based tree → nodes + parent/child edges; shapes `((circle))`/`(round)`/`[square]`/`{{hex→rect}}`. TODO: radial layout (currently top-down tree), `::icon()` rendering, class styling |
| Timeline | `timeline` | 🟡 | **NEW.** `period : event…` → period (pill) with event (rect) children; `: event` continues a period; `section` → grouping container. Laid out top-down (Mermaid is horizontal). TODO: title node, horizontal lane layout, section colors |
| Gantt | `gantt` | 🟡 | **NEW.** tasks→horizontal bars on a 20px/day axis (start date → x, duration → width); `after <id>` deps resolve start; sections→left labels; milestones→diamonds. TODO: date-axis ticks, today marker, dependency arrows, weekends/excludes |
| Pie | `pie` | 🟡 | **NEW.** one `pie` node renders an actual pie (slice `<path>` arcs) + legend with values & percentages; slice colors from the palette. TODO: donut variant, label leader lines |
| User Journey | `journey` | 🟡 | **NEW.** tasks→points placed left-to-right, vertical position = satisfaction score (1–5), chained into the journey line; actors shown in label; sections→labels. TODO: actor avatars/faces, section bands |
| Git graph | `gitGraph` | 🟡 | **NEW.** commits→dots on per-branch lanes (left→right), `branch` forks from current tip, `merge` joins a branch tip into a new 2-parent commit; dots colored per lane, labeled when an explicit id is set; lane labels. TODO: tags, commit types, cherry-pick source links, TB direction |
| Quadrant | `quadrantChart` | 🟡 | **NEW.** one `quadrant` node renders a 2×2 plot: tinted quadrants + labels, center cross, x/y axis labels, and plotted points (x,y 0..1, y up). TODO: per-point radius/color styling |
| Requirement | `requirementDiagram` | 🟡 | **NEW.** requirements & elements → class-style boxes (type as «stereotype», attrs as rows); typed links (satisfies/traces/contains/derives/refines/verifies/copies) → labeled edges (dashed except contains). Connection-aware layout. TODO: containment diamond glyph |
| C4 | `C4Context` etc. | 🟡 | **NEW.** Person/System/Container/Component/Node (incl. _Ext/Db/Queue) → class-style boxes (type as «stereotype», tech/descr wrapped rows); `Rel(...)`→labeled edges (BiRel→both ends, tech appended); `*_Boundary(){}`→grouping containers. TODO: directional Rel_U/D/L/R hints, person figure icon |
| Block | `block-beta` | 🟡 | **NEW.** `columns N` grid that wraps blocks left-to-right; column spans `id:N`, blank cells `space`/`space:N`; shapes `["sq"]`→rect, `("round")`→rect, `(("circ"))`→circle, `{"dia"}`→diamond, `>"flag"]`→rect; `x --> y` (optionally labelled) → arrows. Fixed grid geometry. TODO: nested `block:id … end` as containers (currently flattened), block arrows/edge routing between spans |
| Architecture | `architecture-beta` | 🟡 | **NEW.** `group id(icon)[Title]`→subgraph container; `service id(icon)[Title] in g`→node (in group g); `junction id`→small circle; edges `a:L -- R:b` (and `-->`, `<--`, `<-->`) → connections with arrowheads per direction. Reuses the flowchart Sugiyama layout + containers. TODO: icon rendering, explicit edge-side anchoring (L/R/T/B currently dropped — layout picks sides), group-in-group nesting (flattened) |
| Sankey | `sankey-beta` | 🟡 | **NEW.** CSV `source,target,value` rows → a weighted flow graph: one node per unique name (deduped), one labelled edge per row (value on the edge). Quoted fields / commas-in-quotes / `""` escapes handled. Reuses the flowchart Sugiyama layout. TODO: weighted ribbon widths (∝ value), column layout / native sankey figure |
| XY chart | `xychart-beta` | 🟡 | **NEW.** one `xychart` node renders a real chart: `bar [..]` series → bars (grouped when multiple), `line [..]` series → polylines, over a category x-axis + numeric y-axis with gridlines/ticks; parses `title`, axis labels, and `min --> max` ranges (auto-range from data otherwise). Synthesises x categories when none given. TODO: horizontal variant, multiple-axis, legend, point markers |

## Approach notes
- Graph-shaped diagrams (state, ER, mindmap, gitGraph, C4, requirement,
  architecture, block) map naturally to draph's node + connection model and the
  existing `layoutNodes` Sugiyama layout — these are the priority.
- Chart-shaped diagrams (pie, gantt, xychart, sankey, quadrant, timeline,
  journey) need bespoke rendering and are lower priority; some may render as a
  static figure rather than editable nodes.
- Each added type gets: a `parseXxx(lines)` parser, a `parseMermaid` dispatch
  line, any needed render tweaks, and regression tests in `test/regression.mjs`.

## Changelog
- **XY chart (first cut):** new `xychart` node type — `parseXyChart` reads title,
  x-axis (categories or `min --> max` + label), y-axis (label + range), and
  `bar`/`line` series; renderNodes draws a real chart figure (grouped bars,
  polylines, gridlines, ticks, axis labels). Auto-ranges from data and synthesises
  x categories when omitted. Covered by regression tests.
- **Sankey (first cut):** `parseSankey` — `sankey-beta` CSV `source,target,value`
  rows become a weighted flow graph (node per unique name, labelled edge per row,
  value on the edge). Handles quoted fields, commas-in-quotes, and `""` escapes.
  Reuses the flowchart layout (diagramType 'flowchart'). Ribbon widths / column
  layout deferred. Covered by regression tests.
- **Architecture (first cut):** `parseArchitecture` — `architecture-beta`
  `group`→subgraph container, `service … in g`→node in that group,
  `junction`→small circle, edges `a:L -- R:b` (`--`/`-->`/`<--`/`<-->`)→
  connections with direction-appropriate arrowheads. Reuses the flowchart layout
  + container creation (diagramType 'flowchart'). Icons, explicit edge sides, and
  group-in-group nesting are dropped/flattened for now. Covered by regression tests.
- **Block (first cut):** `parseBlock` — `block-beta` blocks flow into a grid that
  wraps at `columns N`; column spans (`id:N`) widen a block, `space`/`space:N`
  leave empty cells, shapes map to rect/circle/diamond, and `x --> y` arrows
  (plain or labelled) become edges. Fixed geometry (layout passes it through).
  Nested `block:id … end` groups are flattened for now. Covered by regression
  tests (357 total).
- **Requirement (first cut):** `parseRequirement` — requirements/elements reuse
  the class box (type as «stereotype», attributes as rows), typed relationships
  become labeled edges (dashed except `contains`), connection-aware layout.
- **Class diagram UML arrowheads:** relationships now render proper UML
  end-markers via a shared `umlMarker()` (hollow triangle for inheritance/
  realization, filled/hollow diamond for composition/aggregation, open arrow for
  association/dependency), placed at the correct end (markerStart/markerEnd) so
  the layout direction is preserved. Connection renderer generalized to draw a
  marker at either end; non-class edges keep the default arrow. Tested.
- **Class diagram layout fix:** replaced the fixed 220×180 grid (which let big
  boxes overlap and ignored edges) with the connection-aware Sugiyama layout.
  Class boxes are pre-sized in parseClassDiagram so the layout spaces them
  without overlap and stacks parents above subclasses. Tested (pairwise
  no-overlap + parent-above-child).
- **Quadrant (first cut):** new `quadrant` node type — `parseQuadrant` reads
  axes, the 4 quadrant labels, and points `[x,y]`; renderNodes draws the 2×2
  plot (tinted cells, cross, axis labels, point dots). Tested.
- **Class diagram — major upgrade (bugfix):** rewrote `parseClassDiagram` to
  handle real-world diagrams: `<<interface/abstract/enumeration>>` stereotypes
  (shown as «…» in the header), generics `~T~`→`<T>` with unified class ids
  (`Foo~T~` == `Foo~Order~`), `direction` directives, multiplicity strings, the
  full relation-operator set, dotted relations → dashed, enum values, and
  auto-sized boxes (width from longest member, sections hidden when empty).
  Verified against a 20-class e-commerce example. Tested.
- **Git graph (first cut):** `parseGitGraph` — commits as per-lane dots, branch
  forks from current tip, merge creates a 2-parent commit, lane labels, dots
  colored per branch. Fixed geometry. Tags/types/cherry-pick links TODO. Tested.
- **Journey (first cut):** `parseJourney` — tasks placed left-to-right with
  vertical position by satisfaction score (the journey line), chained
  sequentially, actors in the label, sections labeled. Fixed geometry. Tested.
- **Pie (first cut):** new `pie` node type — `parsePie` collapses slices into one
  node; renderNodes draws real slice arcs + a legend (label, value, percent).
  First chart rendered natively (not via the node graph). Tests cover it.
- **Gantt (first cut):** `parseGantt` lays tasks as horizontal bars on a fixed
  day scale (20px/day, grid-aligned so positions survive snap). Resolves start
  dates from explicit dates, `after <id>` deps, or sequential follow; durations
  d/w/h/y. Sections→left labels, milestones→diamonds. Nodes carry `fixed:true`
  so layout + fitNodeToLabel leave them alone (new import path). No axis/arrows
  yet. Covered by regression tests.
- **Timeline (first cut):** `parseTimeline` — periods→pills, events→rect
  children, `: event` continuation, `section`→subgraph containers. Title ignored;
  laid out top-down rather than horizontal. Covered by regression tests.
- **Mindmaps (first cut):** `parseMindmap` added — works on raw code since
  hierarchy is indentation-based; nearest-smaller-indent = parent. Node shapes
  parsed; rendered as a top-down tree (not radial yet); icons/class ignored.
- **ER diagrams (first cut):** `parseErDiagram` added. Entities render as
  class-style boxes (reusing `isClass`), attribute rows parsed as
  `name : type (tags)`, relationships become labeled edges with `..` → dashed.
  `strokeStyle` now flows through `importMermaid`. Crow's-foot cardinality not
  drawn yet. Covered by regression tests.
- **State diagrams (first cut):** `parseStateDiagram` added; `[*]` start/end
  rendered as a 24px solid dot; transition labels preserved; flattens composite
  states and ignores notes/fork shapes for now. Covered by regression tests.
