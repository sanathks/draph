import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixtures = [
  'fan-out',
  'fan-in',
  'obstacle',
  'crossing',
  'parallel',
  'labels',
  'cycle',
  'containers',
  'mixed-labels',
  'performance-50x100',
];

for (const name of fixtures) {
  test(`canonical ${name} fixture`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('draph.onboarding.v1', 'done'));
    await page.goto('/');
    const state = JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));

    const result = await page.evaluate(({ state, large }) => {
      window.draphHostAPI.loadState(state);
      applyTheme('light', false);
      setReadOnly(true);
      viewBox = large ? { x: 0, y: 0, w: 1650, h: 760 } : { x: 0, y: 0, w: 1150, h: 650 };
      updateViewBox();
      render();
      const boxes = [nodesGroup, connectionsGroup].map(group => group.getBBox());
      const left = Math.min(...boxes.map(box => box.x)), top = Math.min(...boxes.map(box => box.y));
      const right = Math.max(...boxes.map(box => box.x + box.width)), bottom = Math.max(...boxes.map(box => box.y + box.height));
      return { report: getDiagramQualityReport(), clipped: left < viewBox.x - 1 || top < viewBox.y - 1 || right > viewBox.x + viewBox.w + 1 || bottom > viewBox.y + viewBox.h + 1 };
    }, { state, large: name === 'performance-50x100' });

    await page.addStyleTag({ content: `
      *, *::before, *::after { animation: none !important; transition: none !important; }
      #gridBg, #viewEditLink, #emptyState, #minimap,
      #canvasContainer > .bottom-4 { display: none !important; }
    ` });

    expect(errors).toEqual([]);
    expect(result.clipped).toBe(false);
    expect(result.report.findings.every(finding => finding.type && (
      finding.connectionId || finding.connectionIds || finding.nodeId || finding.nodeIds ||
      ['node-density', 'edge-density'].includes(finding.type)
    ))).toBe(true);
    await expect(page.locator('#canvasContainer')).toHaveScreenshot(`canonical-${name}.png`);
  });
}
