// =============================================================================
//  Test harness for Draph (diagram-studio)
//
//  Draph is a single static file (index.html) with all logic in one inline
//  <script>. There is no build step and no module system, so this harness loads
//  the page in jsdom, stubs the few browser APIs jsdom lacks (layout geometry,
//  requestAnimationFrame is provided by pretendToBeVisual), and exposes helpers
//  to drive the app and assert on its behavior.
//
//  WHY THIS EXISTS (for future agents):
//  The app can't be regression-tested visually in CI (no real browser / canvas),
//  so this harness locks in the *logic-level* behavior — state, node/connection
//  CRUD, routing geometry, render output structure, selection, history, and the
//  Mermaid parse/generate round-trip. Run `npm test` before and after any change
//  to routing, rendering, state, or Mermaid code. It will NOT catch pure visual
//  regressions (spacing, colors) — those still need a human eye on `npm run dev`.
//
//  Globals inside the app are `let`/`const` bindings in the script's top scope,
//  NOT properties of window. Reach them with `win.eval('connections')` etc.
//  Top-level `function` declarations DO become window properties, so the app's
//  functions are callable as `win.createNode(...)`.
// =============================================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';

const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX_HTML = join(HERE, '..', 'index.html');

// A fixed viewport so screen<->canvas coordinate math is deterministic.
const VIEW = { width: 1200, height: 800 };

/** Boot a fresh app instance in jsdom. Returns { win, doc, E } where E evals
 *  an expression in the app's global scope (to read `let`-scoped state). */
export function boot() {
  const html = readFileSync(INDEX_HTML, 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true, // provides requestAnimationFrame
    url: 'http://localhost/', // real URL so history.replaceState works
  });
  const { window: win } = dom;
  const { document: doc } = win;

  // jsdom doesn't lay out SVG/HTML, so getBoundingClientRect returns zeros.
  // Stub it to our fixed viewport so screenToCanvas() is meaningful.
  const rect = () => ({
    x: 0, y: 0, top: 0, left: 0,
    width: VIEW.width, height: VIEW.height, right: VIEW.width, bottom: VIEW.height,
  });
  win.SVGElement.prototype.getBoundingClientRect = rect;
  win.HTMLElement.prototype.getBoundingClientRect = rect;
  // jsdom has no hit-testing; return null so code that calls it (e.g. the
  // connection-drop handler) falls back to geometry (nodeAt) instead of throwing.
  if (typeof doc.elementFromPoint !== 'function') doc.elementFromPoint = () => null;

  const errors = [];
  win.addEventListener('error', (e) => errors.push(e.error?.stack || e.message));

  const E = (expr) => win.eval(expr);
  // init() ran during construction with a zero-size rect; reset the viewBox now
  // that geometry is stubbed so coordinate mapping is correct.
  E('viewBox.x=0;viewBox.y=0;viewBox.w=' + VIEW.width + ';viewBox.h=' + VIEW.height + ';zoom=1;');

  return { win, doc, E, errors, VIEW };
}

/** Dispatch a mouse event on a target (defaults to document). */
export function mouse(target, type, x, y, opts = {}) {
  const win = target.ownerDocument?.defaultView || target.defaultView || target;
  const Ctor = win.MouseEvent;
  target.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, ...opts }));
}

/** Dispatch a keydown on document. */
export function key(doc, k, opts = {}) {
  doc.dispatchEvent(new doc.defaultView.KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: k, ...opts }));
}

// ---- tiny test runner -------------------------------------------------------
let passed = 0, failed = 0;
const failures = [];

export function check(name, cond, detail = '') {
  if (cond) { passed++; }
  else { failed++; failures.push(name + (detail ? ' — ' + detail : '')); }
}

export function group(title) {
  process.stdout.write('\n  ' + title + '\n');
}

export function report() {
  process.stdout.write('\n');
  for (const f of failures) process.stdout.write('  ✗ ' + f + '\n');
  const total = passed + failed;
  process.stdout.write(`\n  ${passed}/${total} checks passed` + (failed ? `, ${failed} FAILED` : '') + '\n');
  return failed === 0;
}
