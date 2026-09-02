# Visual quality tests

These Playwright tests verify rendered Draph output in a real browser.

The fixtures lock these contracts:

- Fan-in and fan-out edges use separate attach points.
- Routes avoid unrelated nodes and mark unavoidable crossings.
- Parallel edges, cycles, containers, and labels remain readable.
- English, CJK, emoji, and technical labels remain legible.
- The 50-node and 100-edge fixture stays deterministic.
- Light and dark output match reviewed screenshots.

Run logic and visual checks:

```bash
npm run test:all
```

Update macOS screenshots after an intentional visual change:

```bash
npm run test:visual -- --update-snapshots
```

Update Linux screenshots with the pinned CI image:

```bash
docker run --rm --init --ipc=host \
  -v "$PWD:/work" -v /work/node_modules -w /work \
  mcr.microsoft.com/playwright:v1.62.1-noble \
  bash -lc "npm ci && npm run test:visual -- --update-snapshots"
```

Each JSON file in `fixtures/` has reviewed Darwin and Linux screenshots. Review every changed screenshot before commit.

Do not update screenshots to hide a failed geometry contract.
