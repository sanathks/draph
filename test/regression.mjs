// =============================================================================
//  Draph regression runner — run with `npm test`.
//
//  Discovers every test/cases/*.mjs file, imports it (each file runs its own
//  group()/check() calls against the shared harness counters on import), then
//  reports once and sets the exit code.
//
//  WHY (for future agents): tests used to live in one giant file that every
//  ticket appended to at the same spot — so every parallel branch collided on a
//  merge conflict there. Now each ticket adds its OWN file under test/cases/
//  (e.g. `71-viewport-culling.mjs`). Two branches adding two different files
//  never conflict. Do NOT reintroduce a single shared append-point.
//
//  Convention: name files `<ticket-or-area>-<slug>.mjs`; they run in sorted
//  order (00-core.mjs is the legacy core set). A case file imports what it needs
//  from `../harness.mjs` and must NOT call report()/process.exit — the runner
//  owns those.
// =============================================================================
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { report } from './harness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CASES_DIR = join(HERE, 'cases');

const files = readdirSync(CASES_DIR).filter(f => f.endsWith('.mjs')).sort();
for (const f of files) {
  // file:// URL so dynamic import works regardless of platform path style.
  await import(pathToFileURL(join(CASES_DIR, f)).href);
}

process.exit(report() ? 0 : 1);
