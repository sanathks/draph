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
| Class | `classDiagram` | ✅ | classes with properties/methods, relations |
| State | `stateDiagram` / `-v2` | 🟡 | **NEW.** states→rounded rects, transitions+labels, `[*]`→small dot. TODO: composite (nested) states as containers, `note`, `<<fork>>/<<join>>/<<choice>>` shapes, `direction`, concurrency `--` |
| Entity-Relationship | `erDiagram` | ⬜ | entities w/ attributes (class-like), relationships w/ cardinality (`||--o{`) |
| Mindmap | `mindmap` | ⬜ | indentation-based tree; map to nodes + edges, radial/tree layout |
| Timeline | `timeline` | ⬜ | periods → grouped events |
| Gantt | `gantt` | ⬜ | sections/tasks with dates — needs a time axis (likely a custom render) |
| Pie | `pie` | ⬜ | needs a pie/chart render (not a node graph) |
| User Journey | `journey` | ⬜ | sections, tasks, actor scores |
| Git graph | `gitGraph` | ⬜ | commits/branches/merges → DAG |
| Quadrant | `quadrantChart` | ⬜ | 2×2 plot of points |
| Requirement | `requirementDiagram` | ⬜ | requirement boxes + relationships |
| C4 | `C4Context` etc. | ⬜ | persons/systems/boundaries → containers+nodes |
| Block | `block-beta` | ⬜ | grid of blocks |
| Architecture | `architecture-beta` | ⬜ | groups, services, edges |
| Sankey | `sankey-beta` | ⬜ | weighted flows (custom render) |
| XY chart | `xychart-beta` | ⬜ | bar/line chart (custom render) |

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
- **State diagrams (first cut):** `parseStateDiagram` added; `[*]` start/end
  rendered as a 24px solid dot; transition labels preserved; flattens composite
  states and ignores notes/fork shapes for now. Covered by regression tests.
