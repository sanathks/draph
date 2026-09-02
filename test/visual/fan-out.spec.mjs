import { expect, test } from '@playwright/test';

const themes = ['light', 'dark'];

for (const theme of themes) {
  test(`fan-out ports stay separate in ${theme} mode`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('draph.onboarding.v1', 'done'));
    await page.goto('/');

    const quality = await page.evaluate(selectedTheme => {
      nodes = [];
      connections = [];
      selectedId = null;
      selectedIds = [];
      selectedConnId = null;
      idCounter = 0;
      applyTheme(selectedTheme, false);

      const source = createNode('rect', 440, 80, 160, 64);
      source.label = 'API Gateway';
      source.icon = 'link';
      const targets = [
        { x: 100, label: 'Identity', icon: 'user' },
        { x: 280, label: 'Orders', icon: 'table' },
        { x: 460, label: 'Inventory', icon: 'database' },
        { x: 640, label: 'Billing', icon: 'credit-card' },
        { x: 820, label: 'Notifications', icon: 'message' },
      ].map(item => {
        const node = createNode('rect', item.x, 390, 140, 56);
        node.label = item.label;
        node.icon = item.icon;
        return node;
      });

      targets.forEach((target, index) => connections.push({
        id: `fan${index}`,
        from: source.id,
        to: target.id,
        label: ['OIDC', 'HTTP', 'events', 'gRPC', 'queue'][index],
        lineStyle: 'rounded',
      }));

      setReadOnly(true);
      viewBox = { x: 0, y: 0, w: 1060, h: 620 };
      updateViewBox();
      render();

      const nodeById = new Map(nodes.map(node => [node.id, node]));
      const geometry = computeConnectionGeometry(nodeById);
      const starts = connections.map(connection => geometry.sideOf.get(connection.id).fromFrac);
      return {
        starts,
        findings: analyzePortGeometry(nodeById, geometry.sideOf),
        lineStyles: connections.map(connection => connection.lineStyle),
      };
    }, theme);

    await page.addStyleTag({ content: `
      *, *::before, *::after { animation: none !important; transition: none !important; }
      #gridBg, #viewEditLink, #emptyState, #minimap,
      #canvasContainer > .bottom-4 { display: none !important; }
    ` });

    expect(errors).toEqual([]);
    expect(quality.findings).toEqual([]);
    expect(new Set(quality.starts.map(value => value.toFixed(4))).size).toBe(5);
    expect(quality.lineStyles).toEqual(Array(5).fill('rounded'));
    await expect(page.locator('#canvasContainer')).toHaveScreenshot(`fan-out-${theme}.png`);
  });
}
