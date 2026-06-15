// =============================================================================
//  Draph regression suite — run with `npm test`.
//  Locks in logic-level behavior so agents can refactor with confidence.
//  See harness.mjs for what this can and cannot catch.
// =============================================================================
import { boot, mouse, key, check, group, report } from './harness.mjs';

const SIDE_OUT = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };

// ---------------------------------------------------------------------------
group('State & node/connection CRUD');
{
  const { win, doc, E, errors } = boot();
  const a = win.createNode('rect', 100, 100, 120, 60);
  const b = win.createNode('pill', 400, 300, 120, 60);
  win.render();
  check('createNode adds to state', E('nodes.length') === 2);
  check('nodes render as .node elements', doc.querySelectorAll('#nodes .node').length === 2);
  check('createNode returns a node with id', !!a.id && a.id !== b.id);
  E(`connections.push({id:'c1',from:'${a.id}',to:'${b.id}'})`);
  win.render();
  check('connection renders a connection-group', doc.querySelectorAll('.connection-group').length === 1);
  check('boot is error-free', errors.length === 0, errors[0]);
}

// ---------------------------------------------------------------------------
group('Routing geometry (perpendicular exit/entry, arrow direction)');
{
  const { win, E } = boot();
  const combos = [['right','top'],['right','left'],['bottom','top'],['bottom','right'],
                  ['top','bottom'],['left','right'],['left','top'],['top','right'],['bottom','left']];
  const place = (A, B) => { E('nodes.length=0'); win.createNode('rect', A[0], A[1], 120, 60); win.createNode('rect', B[0], B[1], 120, 60); };
  const perp = (A, B, f, t) => {
    place(A, B);
    const res = E(`routeConnection(nodes[0],nodes[1],'${f}','${t}')`);
    const p = res.points, n = p.length;
    const exit = [p[1].x - p[0].x, p[1].y - p[0].y], o1 = SIDE_OUT[f];
    const exitOk = Math.abs(exit[0]*o1[1] - exit[1]*o1[0]) < 0.5 && (exit[0]*o1[0] + exit[1]*o1[1]) > 0;
    const ent = [p[n-1].x - p[n-2].x, p[n-1].y - p[n-2].y], inw = [-SIDE_OUT[t][0], -SIDE_OUT[t][1]];
    const entOk = Math.abs(ent[0]*inw[1] - ent[1]*inw[0]) < 0.5 && (ent[0]*inw[0] + ent[1]*inw[1]) > 0;
    const dirOk = Math.abs(res.inDir.x - inw[0]) < 0.01 && Math.abs(res.inDir.y - inw[1]) < 0.01;
    return exitOk && entOk && dirOk;
  };
  for (const [f, t] of combos) check(`far ${f}->${t}: perpendicular + inDir`, perp([100,100],[500,400], f, t));
  check('close bottom->left: perpendicular', perp([100,100],[160,180],'bottom','left'));
  check('close right->top: perpendicular', perp([100,100],[150,170],'right','top'));
}

// ---------------------------------------------------------------------------
group('Arrow sits on the connector, line trimmed to its base');
{
  const { win, doc, E } = boot();
  const a = win.createNode('rect', 100, 100, 120, 60);
  const b = win.createNode('rect', 500, 400, 120, 60);
  E(`connections.push({id:'q',from:'${a.id}',to:'${b.id}',toSide:'top',toSideLocked:true,fromSide:'bottom',fromSideLocked:true,lineStyle:'straight'})`);
  win.render();
  const grp = [...doc.querySelectorAll('.connection-group')].find(g => g.getAttribute('data-conn') === 'q');
  const lineD = grp.querySelector('path.connection').getAttribute('d');
  const arrowD = [...grp.querySelectorAll('path')].find(p => !p.classList.contains('conn-hit') && !p.classList.contains('connection')).getAttribute('d');
  const tip = arrowD.match(/M([\-\d.]+),([\-\d.]+)/);
  check('arrow tip on the connector (560,400)', Math.abs(+tip[1]-560) < 0.5 && Math.abs(+tip[2]-400) < 0.5, `(${tip[1]},${tip[2]})`);
  const coords = [...lineD.matchAll(/([\-\d.]+),([\-\d.]+)/g)].map(m => [+m[1], +m[2]]);
  const end = coords[coords.length - 1];
  check('line ends at arrow base, not the node edge', Math.abs(end[1]-392) < 1 && Math.abs(end[0]-560) < 1, `(${end})`);
}

// ---------------------------------------------------------------------------
group('Selection, toolbars, endpoint handles');
{
  const { win, doc, E } = boot();
  const a = win.createNode('rect', 100, 100, 120, 60);
  const b = win.createNode('rect', 500, 100, 120, 60);
  win.render();
  win.selectNode(a.id);
  check('selectNode sets selectedId', E('selectedId') === `'${a.id}'`.slice(1, -1) || E(`selectedId==='${a.id}'`));
  win.deselectAll();
  check('deselectAll clears selection', E('selectedId') === null);
  E(`connections.push({id:'e',from:'${a.id}',to:'${b.id}'})`); win.render();
  E(`selectedConnId='e'`); win.render();
  check('selected connection shows 2 endpoint handles', doc.querySelectorAll('#connHandles .conn-endpoint[r="6"]').length === 2);
  E(`selectedConnId=null`); win.render();
  check('deselected connection hides handles', doc.querySelectorAll('#connHandles .conn-endpoint').length === 0);
}

// ---------------------------------------------------------------------------
group('Endpoint drag re-routes + snap highlight');
{
  const { win, doc, E } = boot();
  const a = win.createNode('rect', 100, 100, 120, 60);
  const b = win.createNode('rect', 500, 400, 120, 60);
  E(`connections.push({id:'e',from:'${a.id}',to:'${b.id}'})`);
  E(`selectedConnId='e'`); win.render();
  const c = win.createNode('rect', 800, 100, 120, 60); win.render();
  const ep = doc.querySelector('#connHandles .conn-endpoint[data-end="to"]');
  mouse(ep, 'mousedown', 0, 0);
  mouse(doc, 'mousemove', 805, 130); // over node C's left edge
  const snap = !!doc.querySelector('.connector.snap-target');
  mouse(doc, 'mouseup', 805, 130);
  check('snap-target highlighted while dragging', snap);
  check('endpoint drag retargets connection to C', E(`connections.find(c=>c.id==='e').to`) === c.id);
  check('dropped side is locked', E(`connections.find(c=>c.id==='e').toSideLocked`) === true);
}

// ---------------------------------------------------------------------------
group('History (undo/redo) and URL round-trip');
{
  const { win, E } = boot();
  win.createNode('rect', 100, 100, 120, 60);
  win.saveState();
  win.createNode('rect', 300, 100, 120, 60);
  win.saveState();
  check('two nodes before undo', E('nodes.length') === 2);
  win.undo();
  check('undo removes the second node', E('nodes.length') === 1);
  win.redo();
  check('redo restores it', E('nodes.length') === 2);
  // URL round-trip
  win.updateUrlHash();
  const hash = win.location.hash;
  check('updateUrlHash writes a hash', hash.length > 1);
}

// ---------------------------------------------------------------------------
group('Mermaid generate -> parse round-trip');
{
  const { win, doc, E } = boot();
  const editor = doc.getElementById('mermaidEditor');
  editor.value = `flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Do it]
    B -->|No| D[Stop]`;
  win.importMermaid(true);
  check('import builds nodes', E('nodes.length') >= 4, 'got ' + E('nodes.length'));
  check('import builds connections', E('connections.length') >= 3, 'got ' + E('connections.length'));
  const code = win.generateMermaid();
  check('generateMermaid returns flowchart code', /flowchart/.test(code), code.slice(0, 30));
}

// ---------------------------------------------------------------------------
group('Empty state, double-click create, in-place label edit');
{
  const { win, doc, E } = boot();
  const es = doc.getElementById('emptyState');
  check('empty state visible with no nodes', es.style.display === 'flex');
  win.createNode('rect', 100, 100, 120, 60); win.render();
  check('empty state hidden once a node exists', es.style.display === 'none');
  // double-click empty canvas creates a node
  const before = E('nodes.length');
  doc.getElementById('gridBg').dispatchEvent(new win.MouseEvent('dblclick', { bubbles: true, clientX: 600, clientY: 500 }));
  check('double-click canvas creates a node', E('nodes.length') === before + 1);
  // in-place label edit
  const n = win.createNode('rect', 200, 200, 120, 60); n.label = 'Old'; win.render();
  const el = doc.querySelector(`#nodes .node[data-id="${n.id}"]`);
  el.dispatchEvent(new win.MouseEvent('dblclick', { bubbles: true, clientX: 260, clientY: 230 }));
  const inp = doc.querySelector('.node-label-editor');
  check('double-click node opens label editor', !!inp && inp.value === 'Old');
  if (inp) { inp.value = 'New'; inp.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }
  check('Enter commits the new label', n.label === 'New');
}

// ---------------------------------------------------------------------------
group('Toasts and non-blocking confirm replace native dialogs');
{
  const { win, doc } = boot();
  win.toast('hi', 'success');
  check('toast renders', doc.querySelectorAll('#toastContainer .toast').length === 1);
  win.createNode('rect', 100, 100, 120, 60); win.render();
  win.clearCanvas(); // should open the confirm overlay, not clear immediately
  const overlay = doc.getElementById('confirmOverlay');
  check('clearCanvas opens confirm overlay', overlay.classList.contains('show'));
  check('clearCanvas does NOT clear before confirm', win.eval('nodes.length') === 1);
  doc.getElementById('confirmOk').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  check('confirming clears the canvas', win.eval('nodes.length') === 0);
}

// ---------------------------------------------------------------------------
group('Color palettes generated from CONFIG.palette');
{
  const { win, doc, E } = boot();
  const n = E('CONFIG.palette.length');
  for (const id of ['fillColorPalette', 'outlineColorPalette', 'connColorPalette']) {
    const btns = doc.querySelectorAll(`#${id} > div > button`);
    check(`${id} has palette+1 swatches`, btns.length === n + 1, `got ${btns.length}, expected ${n + 1}`);
  }
  // a fill swatch actually sets a node's color
  const node = win.createNode('rect', 100, 100, 120, 60); win.render(); win.selectNode(node.id);
  const swatch = doc.querySelectorAll('#fillColorPalette > div > button')[1]; // first real color
  swatch.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  check('clicking a swatch sets node.color', node.color === E('CONFIG.palette[0]'));
}

// ---------------------------------------------------------------------------
group('Route to a same-facing side goes around the node, not through it');
{
  const { win, E } = boot();
  // Start above-left, Node below-right; connect both BOTTOM sides (the reported case)
  const s = win.createNode('rect', 90, 15, 120, 50);
  const n = win.createNode('rect', 300, 233, 120, 50);
  const res = E(`routeConnection(nodes[0], nodes[1], 'bottom', 'bottom')`);
  // Does any axis-aligned segment pass through the node's interior (inset 2px)?
  const R = { left: n.x + 2, right: n.x + n.width - 2, top: n.y + 2, bottom: n.y + n.height - 2 };
  const through = (a, b) => {
    if (Math.abs(a.x - b.x) < 0.5) { // vertical segment at x=a.x
      const x = a.x, y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
      return x > R.left && x < R.right && y1 > R.top && y0 < R.bottom;
    } else { // horizontal segment at y=a.y
      const y = a.y, x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
      return y > R.top && y < R.bottom && x1 > R.left && x0 < R.right;
    }
  };
  let crosses = false;
  for (let i = 1; i < res.points.length; i++) if (through(res.points[i-1], res.points[i])) crosses = true;
  check('route does not pass through the target node', !crosses);
  check('route still ends on the bottom connector', Math.abs(res.endY - (n.y + n.height)) < 0.5 && res.inDir.y === -1);
}

// ---------------------------------------------------------------------------
group('Dropping a drawn connection on a node body sticks (no vanishing)');
{
  const { win, doc, E } = boot();
  const a = win.createNode('rect', 100, 100, 120, 60);
  const b = win.createNode('rect', 500, 400, 120, 60);
  win.render();
  // Simulate an in-progress draw from A's right connector, then drop on B's body.
  E(`connecting = { from: '${a.id}', fromSide: 'right', fromIdx: 1 }`);
  const before = E('connections.length');
  mouse(doc, 'mouseup', 560, 430); // inside node B, not on a connector dot
  check('drop on node body creates a connection', E('connections.length') === before + 1);
  const c = E('connections[connections.length-1]');
  check('connection goes from A to B', c.from === a.id && c.to === b.id);
  check('toSide snapped to a valid side', ['top','bottom','left','right'].includes(c.toSide), c.toSide);
  check('source side locked (user chose the start connector)', c.fromSideLocked === true);

  // Dropping on empty canvas must NOT create a stray connection (offers picker instead)
  E(`connecting = { from: '${a.id}', fromSide: 'right', fromIdx: 1 }`);
  const n2 = E('connections.length');
  mouse(doc, 'mouseup', 1000, 700); // empty canvas
  check('drop on empty canvas creates no connection', E('connections.length') === n2);
}

// ---------------------------------------------------------------------------
group('Draw preview matches the final routed shape');
{
  const { win, E } = boot();
  const a = win.createNode('rect', 100, 100, 120, 60);
  const b = win.createNode('rect', 500, 400, 120, 60);
  // Cursor over node B -> preview must equal the final routeConnection path.
  const bCx = 560, bCy = 430; // inside B
  const fromSide = E(`getOptimalSides(nodes[0], nodes[1]).fromSide`);
  const previewD = E(`pointsToPath(previewRoute(nodes[0], '${fromSide}', ${bCx}, ${bCy}).points, 'rounded')`);
  const toSide = E(`getBestConnectorSide(nodes[1], ${bCx}, ${bCy})`);
  const finalD = E(`pointsToPath(routeConnection(nodes[0], nodes[1], '${fromSide}', '${toSide}').points, 'rounded')`);
  check('preview over a node equals the final orthogonal path', previewD === finalD);
  // Over empty canvas the preview is orthogonal (contains only H/V segments).
  const emptyPts = E(`JSON.stringify(previewRoute(nodes[0], '${fromSide}', 900, 110).points)`);
  const pts = JSON.parse(emptyPts);
  let ortho = true;
  for (let i = 1; i < pts.length; i++) {
    const dx = Math.abs(pts[i].x - pts[i-1].x), dy = Math.abs(pts[i].y - pts[i-1].y);
    if (dx > 0.5 && dy > 0.5) ortho = false; // diagonal segment => not orthogonal
  }
  check('preview over empty canvas is orthogonal (no diagonal/bezier)', ortho);
}

// ---------------------------------------------------------------------------
group('Press-near-end grabs the endpoint in one gesture');
{
  const { win, doc, E } = boot();
  const a = win.createNode('rect', 300, 300, 120, 60);
  const b = win.createNode('rect', 700, 300, 120, 60);
  E(`connections.push({id:'e',from:'${a.id}',to:'${b.id}'})`); win.render();
  // start endpoint is A's right connector (420,330). Press there and DRAG to A's top.
  const hit = doc.querySelector('.conn-hit[data-conn="e"]');
  mouse(hit, 'mousedown', 420, 330);
  mouse(doc, 'mousemove', 360, 305);   // toward A's top edge
  mouse(doc, 'mouseup', 360, 305);
  const e1 = E(`connections.find(c=>c.id==='e')`);
  check('drag from near start re-routes the start side', e1.fromSide === 'top' && e1.fromSideLocked === true && e1.from === a.id, `fromSide=${e1.fromSide}`);

  // a plain click near an endpoint selects but must NOT lock/change the side
  const { win: w2, doc: d2, E: E2 } = boot();
  const a2 = w2.createNode('rect', 300, 300, 120, 60);
  const b2 = w2.createNode('rect', 700, 300, 120, 60);
  E2(`connections.push({id:'e',from:'${a2.id}',to:'${b2.id}'})`); w2.render();
  const hit2 = d2.querySelector('.conn-hit[data-conn="e"]');
  mouse(hit2, 'mousedown', 420, 330);
  mouse(d2, 'mouseup', 420, 330);      // no movement
  const e2 = E2(`connections.find(c=>c.id==='e')`);
  check('plain click selects without locking a side', E2(`selectedConnId`) === 'e' && !e2.fromSideLocked);
}

// ---------------------------------------------------------------------------
group('Keyboard shortcuts (KEY_BINDINGS map)');
{
  const { win, doc, E } = boot();
  key(doc, '2');
  check("'2' selects the pill tool", E('currentTool') === 'pill');
  key(doc, 'v');
  check("'v' selects the select tool", E('currentTool') === 'select');
  key(doc, 'T');
  check("'T' (uppercase) selects text tool", E('currentTool') === 'text');
  // Cmd/Ctrl + V must NOT be swallowed by the 'v' tool shortcut (paste path)
  E(`currentTool='select'`);
  const a = win.createNode('rect', 100, 100, 120, 60); a.label = 'X';
  E(`selectedId='${a.id}'`);
  key(doc, 'c', { metaKey: true });
  const before = E('nodes.length');
  key(doc, 'v', { metaKey: true });
  check('Cmd+V pastes instead of selecting move tool', E('nodes.length') === before + 1 && E('currentTool') === 'select');
}

// ---------------------------------------------------------------------------
group('Pencil tool — freehand drawing');
{
  const { win, doc, E } = boot();
  win.setTool('pencil');
  check("setTool('pencil') sets currentTool", E('currentTool') === 'pencil');
  check('pencil keybinding selects it', (() => { E(`currentTool='select'`); key(doc, 'p'); return E('currentTool') === 'pencil'; })());
  // Draw a stroke: mousedown on canvas, several moves, mouseup
  const canvas = doc.getElementById('canvas');
  mouse(canvas, 'mousedown', 100, 100);
  mouse(doc, 'mousemove', 130, 140);
  mouse(doc, 'mousemove', 170, 130);
  mouse(doc, 'mousemove', 210, 180);
  mouse(doc, 'mouseup', 210, 180);
  check('a pencil node was created', E(`nodes.some(n => n.type === 'pencil')`));
  const n = E(`JSON.parse(JSON.stringify(nodes.find(n => n.type === 'pencil')))`);
  check('pencil node stores points', Array.isArray(n.points) && n.points.length >= 2);
  check('points are relative to the bbox origin (start near 0,0)', Math.abs(n.points[0].x) < 1 && Math.abs(n.points[0].y) < 1);
  check('bbox matches the drawn extent', n.x === 100 && n.y === 100 && n.width === 110 && n.height === 80, JSON.stringify({x:n.x,y:n.y,w:n.width,h:n.height}));
  // The tool STAYS active so you can keep drawing (no auto-switch to select)
  check('pencil tool stays active after a stroke', E('currentTool') === 'pencil');
  check('no node is auto-selected after drawing', E('selectedId') === null);
  // A second stroke can be drawn without re-selecting the tool
  mouse(canvas, 'mousedown', 300, 300);
  mouse(doc, 'mousemove', 340, 320);
  mouse(doc, 'mouseup', 360, 360);
  check('a second stroke draws while the tool stays selected', E(`nodes.filter(n => n.type === 'pencil').length`) === 2);
  // It renders as a path and is selectable/movable like any node
  win.render();
  check('pencil renders inside #nodes as a .node', !!doc.querySelector(`#nodes .node[data-id="${n.id}"]`));
  check('pencil has no connectors or resize handle', doc.querySelectorAll(`#nodes .node[data-id="${n.id}"] .connector, #nodes .node[data-id="${n.id}"] .resize-handle`).length === 0);
  // It is excluded from Mermaid flowchart generation
  const code = win.generateMermaid();
  check('pencil is excluded from generated Mermaid', !/pencil/i.test(code));
}

// ---------------------------------------------------------------------------
group('Toolbar: creation tools visible with shortcut badges, rest in More menu');
{
  const { win, doc, E } = boot();
  // Creation tools stay visible, each with a shortcut badge
  for (const [id, badge] of [['tool-select','V'],['tool-rect','1'],['tool-pill','2'],['tool-diamond','3'],
                             ['tool-circle','4'],['tool-container','5'],['tool-text','T'],['tool-line','6'],['tool-pencil','P']]) {
    const btn = doc.getElementById(id);
    check(`${id} visible with badge ${badge}`, !!btn && btn.querySelector('.kbd-badge')?.textContent === badge);
  }
  // The More menu exists and holds the secondary actions
  const more = doc.getElementById('moreDropdown');
  check('More dropdown exists', !!more);
  const menuText = more.querySelector('.dropdown-menu').textContent;
  for (const label of ['Undo','Redo','Auto-arrange','Mermaid','Snap to grid','Animate flow','Export PNG','Export SVG','Export GIF','Copy share link','Clear canvas'])
    check(`More menu contains "${label}"`, menuText.includes(label));
  // Toggling the More dropdown open works
  win.toggleDropdown('moreDropdown');
  check('More dropdown opens', more.classList.contains('open'));
  win.closeDropdowns();
  // Grid/flow toggles (now menu items) still work without throwing
  const grid0 = E('snapToGrid');
  win.toggleGrid();
  check('grid toggle still flips state from the menu', E('snapToGrid') === !grid0);
  win.toggleFlow();
  check('flow toggle runs without error', E('typeof flowActive') === 'boolean');
  // Removed shortcuts (7/9 pointed at deleted dropdowns) no longer throw
  let threw = false;
  try { key(doc, '7'); key(doc, '9'); } catch { threw = true; }
  check('pressing old 7/9 shortcuts does not throw', !threw);
}

process.exit(report() ? 0 : 1);
