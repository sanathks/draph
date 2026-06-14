# Draph — notes for agents

**What this is:** a Mermaid + visual diagram editor. The entire app is one file:
`index.html` (HTML + CSS + one inline `<script>`). **No build step, no framework,
no runtime dependencies.** Keep it that way — prefer a small vanilla helper over a
new dependency, and keep it a single self-contained file (it must run by opening
the file or via `npm run dev`).

## Before you start
Read [`ARCHITECTURE.md`](./ARCHITECTURE.md). It has the section map, the core data
model (`node` / `connection` shapes), the render pipeline, the routing algorithm,
and extension recipes. Inside `index.html`, navigate by searching for
`=== SECTION:`; the top of the `<script>` has a header comment with the same map.

## Workflow (do this every time)
1. `npm install` (once) — installs jsdom, the only devDependency.
2. Make your change in `index.html`.
3. `npm test` — runs `test/regression.mjs` (49+ logic checks in jsdom). Must pass.
4. `npm run dev` and look at `http://localhost:3000` — **the tests cannot see
   pixels**, so verify any visual change with your eyes (or a screenshot).
5. Add a regression check for new behavior so the next agent can refactor safely.

## Conventions
- Tunables go in `CONFIG` / `COLORS` / `ROUTE_CFG` — don't sprinkle magic numbers.
- New palette color → one hex in `CONFIG.palette`. New shortcut → `KEY_BINDINGS`.
- State lives in module-scoped `let` bindings (not on `window`); tests read them
  with `win.eval(...)`.
- Match the surrounding Tokyo Night theme and the existing comment density.
