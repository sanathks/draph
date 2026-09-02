import { expect, test } from '@playwright/test';

test('routes avoid nodes and labels stay clear', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('draph.onboarding.v1', 'done'));
  await page.goto('/');

  const quality = await page.evaluate(() => {
    nodes = [];
    connections = [];
    selectedId = null;
    selectedIds = [];
    selectedConnId = null;
    idCounter = 0;
    applyVisualPreset('editorial', false);
    applyTheme('light', false);

    const source = createNode('rect', 100, 250, 150, 60);
    source.label = 'Public API';
    source.icon = 'link';
    const blocker = createNode('rect', 430, 180, 180, 200);
    blocker.label = 'Policy Engine';
    blocker.icon = 'filter';
    blocker.semanticRole = 'focal';
    const target = createNode('cylinder', 800, 250, 150, 70);
    target.label = 'Audit Store';
    target.icon = 'database';
    target.semanticRole = 'store';
    connections.push({
      id: 'route',
      from: source.id,
      to: target.id,
      fromSide: 'right',
      toSide: 'left',
      fromSideLocked: true,
      toSideLocked: true,
      label: 'verified events',
      lineStyle: 'rounded',
    });

    setReadOnly(true);
    viewBox = { x: 0, y: 0, w: 1060, h: 620 };
    updateViewBox();
    render();
    return getDiagramQualityReport();
  });

  await page.addStyleTag({ content: `
    *, *::before, *::after { animation: none !important; transition: none !important; }
    #gridBg, #viewEditLink, #emptyState, #minimap,
    #canvasContainer > .bottom-4 { display: none !important; }
  ` });

  expect(errors).toEqual([]);
  expect(quality.findings.filter(finding => ['edge-node', 'shared-segment', 'label-node'].includes(finding.type))).toEqual([]);
  await expect(page.locator('#canvasContainer')).toHaveScreenshot('obstacle-light.png');
});
