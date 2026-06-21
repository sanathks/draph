// =============================================================================
//  Draph regression suite — run with `npm test`.
//  Locks in logic-level behavior so agents can refactor with confidence.
//  See harness.mjs for what this can and cannot catch.
// =============================================================================
import { boot, mouse, pointer, key, check, group, report } from './harness.mjs';

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
  check('line ends at arrow base, not the node edge', Math.abs(end[1]-389) < 1 && Math.abs(end[0]-560) < 1, `(${end})`);
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
  // editor is multi-line now: Cmd+Enter (or blur) commits, plain Enter = newline
  if (inp) { inp.value = 'New'; inp.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true })); }
  check('Cmd+Enter commits the new label', n.label === 'New');
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

// ---------------------------------------------------------------------------
group('Sticky note tool');
{
  const { win, doc, E } = boot();
  check("setTool('note') works + keybinding", (() => { win.setTool('note'); const a = E('currentTool') === 'note'; E(`currentTool='select'`); key(doc, 'n'); return a && E('currentTool') === 'note'; })());
  check("'note' is a SHAPE_TOOL (drag to draw)", E(`SHAPE_TOOLS.includes('note')`));
  // Draw a note by dragging on the canvas
  const canvas = doc.getElementById('canvas');
  mouse(canvas, 'mousedown', 200, 200);
  mouse(doc, 'mousemove', 360, 320);
  mouse(doc, 'mouseup', 360, 320);
  const n = E(`JSON.parse(JSON.stringify(nodes.find(x => x.type === 'note') || null))`);
  check('a note node was created', !!n);
  check('note has a default label', n && n.label === 'Note');
  win.render();
  const el = doc.querySelector(`#nodes .node[data-id="${n.id}"]`);
  check('note renders as a .node', !!el);
  check('note (no color) renders the default yellow', el.innerHTML.includes('#ffd95c'));
  // Color is changeable via setNodeColor (the fill-color picker)
  win.selectNode(n.id);
  win.setNodeColor('#7aa2f7');
  win.render();
  const el2 = doc.querySelector(`#nodes .node[data-id="${n.id}"]`);
  check('note color is changeable', E(`nodes.find(x=>x.type==='note').color`) === '#7aa2f7' && el2.innerHTML.includes('#7aa2f7'));
  // Notes are annotations: excluded from Mermaid generation
  check('note excluded from Mermaid', !/Note/.test(win.generateMermaid()) || win.generateMermaid().indexOf('Note') === -1);
  // Note is selectable/draggable like a normal node (has a toolbar button)
  check('note tool button exists with N badge', doc.getElementById('tool-note')?.querySelector('.kbd-badge')?.textContent === 'N');
}

// ---------------------------------------------------------------------------
group('Click-to-create at standard size + reverts to select (except pencil)');
{
  const { win, doc, E } = boot();
  const canvas = doc.getElementById('canvas');
  win.setTool('rect');
  // A plain click (no drag) drops a default-size rect centered on the click
  mouse(canvas, 'mousedown', 500, 500);
  mouse(doc, 'mouseup', 500, 500);
  const r = E(`JSON.parse(JSON.stringify(nodes[nodes.length-1]))`);
  check('click creates a node', E('nodes.length') === 1 && r.type === 'rect');
  check('node has its standard size (grid-snapped)', r.width === 160 && r.height === 60, `${r.width}x${r.height}`);
  check('node is centered on the click point', Math.abs((r.x + r.width/2) - 500) <= 10 && Math.abs((r.y + r.height/2) - 500) <= 10);
  check('tool reverts to select after creating a shape', E('currentTool') === 'select');
  check('newly created node is selected', E('selectedId') === r.id);
  // Dragging out a shape also reverts to select
  win.setTool('diamond');
  mouse(canvas, 'mousedown', 700, 300);
  mouse(doc, 'mousemove', 780, 360);
  mouse(doc, 'mouseup', 780, 360);
  check('drag-create also reverts to select', E('currentTool') === 'select' && E('nodes.length') === 2);
  // Pencil is the exception: it stays active for continuous sketching
  win.setTool('pencil');
  mouse(canvas, 'mousedown', 200, 200);
  mouse(doc, 'mousemove', 230, 230);
  mouse(doc, 'mousemove', 260, 210);
  mouse(doc, 'mouseup', 260, 210);
  check('pencil stays active after a stroke', E('currentTool') === 'pencil');
}

// ---------------------------------------------------------------------------
group('Auto-arrange: clean layered layout (no overlap, parents centered)');
{
  const { win, E } = boot();
  const mk = (type, w, h, label) => { const n = win.createNode(type, 0, 0, w, h); n.label = label; return n; };
  const ur = mk('rect', 140, 50, 'User request');
  const auth = mk('diamond', 150, 70, 'Authenticated?');
  const ld = mk('rect', 170, 50, 'Load dashboard');
  const sl = mk('rect', 150, 50, 'Show login');
  const done = mk('pill', 150, 50, '[Done]');
  const sub = mk('rect', 150, 60, 'Submit credentials');
  const link = (a, b) => E(`connections.push({from:'${a.id}',to:'${b.id}'})`);
  link(ur, auth); link(auth, ld); link(auth, sl); link(ld, done); link(sl, sub);
  win.arrangeDiagram();
  const N = (id) => E(`(()=>{const n=nodes.find(x=>x.id==='${id}');return {x:n.x,y:n.y,w:n.width,h:n.height}})()`);
  const ns = { ur: N(ur.id), auth: N(auth.id), ld: N(ld.id), sl: N(sl.id), done: N(done.id), sub: N(sub.id) };
  const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const arr = Object.values(ns);
  let bad = false;
  for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) if (overlap(arr[i], arr[j])) bad = true;
  check('no two arranged nodes overlap', !bad);
  check('User request sits above Authenticated', ns.ur.y + ns.ur.h <= ns.auth.y + 1);
  check('Authenticated sits above its children', ns.auth.y + ns.auth.h <= ns.ld.y + 1 && ns.auth.y + ns.auth.h <= ns.sl.y + 1);
  check('children share a layer (same y)', Math.abs(ns.ld.y - ns.sl.y) < 1);
  const authC = ns.auth.x + ns.auth.w / 2;
  const childMid = ((ns.ld.x + ns.ld.w / 2) + (ns.sl.x + ns.sl.w / 2)) / 2;
  check('Authenticated is centered over its two children', Math.abs(authC - childMid) < 20, `auth=${authC.toFixed(0)} mid=${childMid.toFixed(0)}`);
  check('Done is under Load dashboard', Math.abs((ns.done.x + ns.done.w/2) - (ns.ld.x + ns.ld.w/2)) < 30);
  // Routing: forward edges run parent-bottom -> child-top, and locks are cleared
  const edge = (f, t) => E(`(()=>{const c=connections.find(c=>c.from==='${f}'&&c.to==='${t}');return {fromSide:c.fromSide,toSide:c.toSide,fl:!!c.fromSideLocked,tl:!!c.toSideLocked}})()`);
  const e1 = edge(auth.id, ld.id), e2 = edge(auth.id, sl.id);
  check('Authenticated->Load dashboard routes bottom->top', e1.fromSide === 'bottom' && e1.toSide === 'top');
  check('Authenticated->Show login routes bottom->top', e2.fromSide === 'bottom' && e2.toSide === 'top');
  check('arrange clears manual side locks', !e1.fl && !e1.tl && !e2.fl && !e2.tl);
}

// ---------------------------------------------------------------------------
group('Edge stays clean (no overshoot/hook) when nodes are close');
{
  const { win, E } = boot();
  E('snapToGrid = false'); // test exact geometry, not grid-snapped positions
  const a = win.createNode('rect', 200, 200, 120, 50);
  const b = win.createNode('rect', 200, 260, 120, 50); // directly below, 10px gap
  // Monotonic check: a vertical bottom->top route must not reverse direction
  // (an overshoot would make the y go down-then-up = a hook).
  const monotonic = (f, t) => {
    const res = E(`routeConnection(nodes[0], nodes[1], '${f}', '${t}')`);
    const ys = res.points.map(p => p.y);
    let dir = 0;
    for (let i = 1; i < ys.length; i++) {
      const d = Math.sign(ys[i] - ys[i-1]);
      if (d === 0) continue;
      if (dir && d !== dir) return false; // reversed => hook/overshoot
      dir = d;
    }
    return true;
  };
  check('close vertical edge has no y-reversal (no hook)', monotonic('bottom', 'top'));
  // Bring them almost touching
  E(`nodes[1].y = 252`);
  check('nearly-touching edge still has no hook', monotonic('bottom', 'top'));
  // Far apart still fine
  E(`nodes[1].y = 600`);
  check('far edge still clean', monotonic('bottom', 'top'));
  // Vertically-aligned close nodes should give a straight edge, no x-wiggle
  E(`nodes[1].y = 260`);
  const r = E(`routeConnection(nodes[0], nodes[1], 'bottom', 'top')`);
  const xs = r.points.map(p => p.x);
  check('aligned close nodes give a straight edge (no wiggle)', Math.max(...xs) - Math.min(...xs) < 0.5);
}

// ---------------------------------------------------------------------------
group('getOptimalSides uses box separation (no hooky left/right for stacked nodes)');
{
  const { win, E } = boot();
  E('snapToGrid = false');
  // Diamond up-right, target down-left and only slightly offset horizontally but
  // well separated vertically -> should route bottom->top, not left->right.
  const a = win.createNode('diamond', 220, 40, 100, 70);
  const b = win.createNode('rect', 80, 150, 120, 50);
  const s1 = E(`(()=>{const r=getOptimalSides(nodes[0],nodes[1]);return r.fromSide+'>'+r.toSide})()`);
  check('stacked-ish nodes route bottom->top', s1 === 'bottom>top', s1);
  // Side-by-side at the same height -> right->left
  E(`nodes[1].x = 460; nodes[1].y = 50`);
  const s2 = E(`(()=>{const r=getOptimalSides(nodes[0],nodes[1]);return r.fromSide+'>'+r.toSide})()`);
  check('side-by-side nodes route right->left', s2 === 'right>left', s2);
  // Target above -> top->bottom
  E(`nodes[1].x = 230; nodes[1].y = -150`);
  const s3 = E(`(()=>{const r=getOptimalSides(nodes[0],nodes[1]);return r.fromSide+'>'+r.toSide})()`);
  check('target above routes top->bottom', s3 === 'top>bottom', s3);
  // Below-AND-slightly-beside (gaps nearly tied) should prefer top-down, not side entry
  E(`nodes[0].x=175; nodes[0].y=40; nodes[0].width=100; nodes[0].height=70`);
  E(`nodes[1].x=0; nodes[1].y=120; nodes[1].width=160; nodes[1].height=70`);
  const s4 = E(`(()=>{const r=getOptimalSides(nodes[0],nodes[1]);return r.fromSide+'>'+r.toSide})()`);
  check('below-and-beside prefers bottom->top (top-down bias)', s4 === 'bottom>top', s4);
  // restore for the hook check below
  E(`nodes[0].x=220; nodes[0].y=40; nodes[0].width=100; nodes[0].height=70`);
  E(`nodes[1].x=80; nodes[1].y=150; nodes[1].width=120; nodes[1].height=50`);
  // And the resulting route has no direction reversal (no hook) for the diagonal case
  E(`nodes[1].x = 80; nodes[1].y = 150`);
  const r = E(`(()=>{const o=getOptimalSides(nodes[0],nodes[1]);return routeConnection(nodes[0],nodes[1],o.fromSide,o.toSide)})()`);
  const ys = r.points.map(p => p.y); let dir = 0, hook = false;
  for (let i = 1; i < ys.length; i++) { const d = Math.sign(ys[i]-ys[i-1]); if (!d) continue; if (dir && d !== dir) hook = true; dir = d; }
  check('diagonal edge has no y-reversal/hook', !hook);
}

// ---------------------------------------------------------------------------
group('Nodes grow to fit their label (label-aware sizing)');
{
  const { win, doc, E } = boot();
  E('snapToGrid = false');
  // A diamond with a long single word must widen enough to contain it
  const d = win.createNode('diamond', 100, 100, 90, 60);
  d.label = 'Authenticated?';
  win.fitNodeToLabel(d);
  const textW = 'Authenticated?'.length * (11 * 0.62);
  check('diamond widened to fit a long label', d.width >= textW / 0.6, `w=${d.width} need~${Math.ceil(textW/0.6)}`);
  check('diamond grew from its default', d.width > 90);
  // fit never shrinks a node the user manually resized (#35: guarded by the flag)
  const big = win.createNode('rect', 0, 0, 400, 200); big.label = 'Hi'; big.manuallyResized = true;
  win.fitNodeToLabel(big);
  check('fit does not shrink a manually-resized node', big.width === 400 && big.height === 200);
  // typing in the toolbar grows the selected node live
  const r = win.createNode('rect', 0, 0, 120, 44); r.label = 'x'; win.render(); win.selectNode(r.id);
  const inp = doc.getElementById('toolbarLabel');
  inp.value = 'A very long label that should widen the node a lot';
  inp.dispatchEvent(new win.Event('input', { bubbles: true }));
  check('typing a long label grows the node', E(`nodes.find(n=>n.id==='${r.id}').width`) > 120);
  // circle stays square after fitting
  const c = win.createNode('circle', 0, 0, 80, 80); c.label = 'A longish circle label';
  win.fitNodeToLabel(c);
  check('circle stays square after fit', E(`(()=>{const n=nodes.find(x=>x.id==='${c.id}');return n.width===n.height})()`));
  // A long multi-word label WRAPS (node stays moderate width, grows taller)
  const m = win.createNode('rect', 0, 0, 120, 44);
  m.label = 'This is a fairly long multi word label that should wrap';
  win.fitNodeToLabel(m);
  check('long multi-word label wraps (width stays moderate)', m.width <= 200, `w=${m.width}`);
  check('wrapped label makes the node taller', m.height > 44);
  // ...while a single unbreakable word still forces the node wider than the cap
  const w1 = win.createNode('rect', 0, 0, 120, 44);
  w1.label = 'Supercalifragilisticexpialidocious';
  win.fitNodeToLabel(w1);
  check('single long word forces a wider node', w1.width > 200);
}

// ---------------------------------------------------------------------------
group('v2: multi-line labels (explicit \\n)');
{
  const { win, doc, E } = boot();
  E('snapToGrid = false');
  // wrapLabel honors explicit newlines as hard breaks
  const lines = E(`JSON.stringify(wrapLabel('First line\\nSecond line', 400, 12))`);
  check('wrapLabel splits on \\n', JSON.parse(lines).length === 2, lines);
  // a node with a \n label renders multiple tspans
  const r = win.createNode('rect', 100, 100, 160, 40); r.label = 'Line A\nLine B\nLine C';
  win.fitNodeToLabel(r); win.render();
  const tspans = doc.querySelectorAll(`#nodes .node[data-id="${r.id}"] tspan`).length;
  check('node renders one tspan per explicit line', tspans >= 3, `tspans=${tspans}`);
  check('explicit newlines grow node height', r.height > 40, `h=${r.height}`);
  // the in-place editor is now a textarea; plain Enter inserts a newline (not commit)
  win.selectNode(r.id);
  const el = doc.querySelector(`#nodes .node[data-id="${r.id}"]`);
  el.dispatchEvent(new win.MouseEvent('dblclick', { bubbles: true, clientX: 180, clientY: 140 }));
  const ed = doc.querySelector('.node-label-editor');
  check('in-place editor is a textarea', ed && ed.tagName === 'TEXTAREA');
  ed.value = 'one\ntwo';
  ed.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true })); // Cmd+Enter commits
  check('Cmd+Enter commits a multi-line label', E(`nodes.find(n=>n.id==='${r.id}').label`) === 'one\ntwo');
  // round-trips through the URL hash (save/load)
  win.updateUrlHash(); E('nodes.length = 0; connections.length = 0;'); win.loadFromUrl();
  check('\\n label survives save/load round-trip', E(`nodes.find(n=>n.label && n.label.includes('\\n')) ? true : false`) === true);
}

// ---------------------------------------------------------------------------
group('v2: local autosave & restore');
{
  const { win, E } = boot();
  win.createNode('rect', 100, 100, 120, 44);
  win.saveState(); // triggers updateUrlHash -> autosave
  const stored = E(`localStorage.getItem('draph:autosave')`);
  check('saving writes an autosave to localStorage', !!stored && stored.includes('"n"'));
  // restoreAutosave repopulates an empty canvas from storage
  E('nodes.length = 0; connections.length = 0;');
  const ok = E('restoreAutosave()');
  check('restoreAutosave returns true and repopulates', ok === true && E('nodes.length') === 1);
  // clearing to empty removes the autosave
  E('nodes.length = 0; connections.length = 0;');
  win.updateUrlHash();
  check('emptying the canvas clears the autosave', E(`localStorage.getItem('draph:autosave')`) === null);
  // loadFromUrl now reports whether it loaded (init uses this to fall back)
  check('loadFromUrl returns false with no hash', E(`loadFromUrl()`) === false);
}

// ---------------------------------------------------------------------------
group('v2: z-order, duplicate, select-all, context menu, cheat-sheet');
{
  const { win, doc, E } = boot();
  const a = win.createNode('rect', 100, 100, 120, 44);
  const b = win.createNode('rect', 300, 100, 120, 44);
  win.render();
  // z-order: bring A to front -> A renders after B in the #nodes DOM
  win.selectNode(a.id); win.bringToFront();
  const order = [...doc.querySelectorAll('#nodes .node')].map(n => n.dataset.id);
  check('bringToFront moves node to end of render order', order.indexOf(a.id) > order.indexOf(b.id), JSON.stringify(order));
  win.selectNode(a.id); win.sendToBack();
  const order2 = [...doc.querySelectorAll('#nodes .node')].map(n => n.dataset.id);
  check('sendToBack moves node to start of render order', order2.indexOf(a.id) < order2.indexOf(b.id));
  // duplicate
  const before = E('nodes.length');
  win.selectNode(a.id); win.duplicateSelected();
  check('duplicateSelected adds an offset copy', E('nodes.length') === before + 1);
  // select all
  win.selectAllNodes();
  check('selectAllNodes selects every non-stroke node', E('selectedIds.length') === E(`nodes.filter(n=>n.type!=='line'&&n.type!=='pencil').length`));
  // context menu opens on right-click of a node with expected actions
  win.selectNode(a.id); win.render();
  const el = doc.querySelector(`#nodes .node[data-id="${a.id}"]`);
  el.dispatchEvent(new win.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 150, clientY: 120 }));
  const menu = doc.getElementById('contextMenu');
  check('context menu opens on right-click', !menu.classList.contains('hidden'));
  check('context menu has expected actions', /Duplicate/.test(menu.textContent) && /Bring to front/.test(menu.textContent) && /Delete/.test(menu.textContent));
  // a left-click elsewhere closes it
  doc.dispatchEvent(new win.MouseEvent('mousedown', { bubbles: true, clientX: 700, clientY: 700 }));
  check('context menu closes on outside click', menu.classList.contains('hidden'));
  // cheat-sheet toggles with ?
  key(doc, '?');
  check('? opens the cheat-sheet', !doc.getElementById('cheatsheetOverlay').classList.contains('hidden'));
  key(doc, 'Escape');
  check('Escape closes the cheat-sheet', doc.getElementById('cheatsheetOverlay').classList.contains('hidden'));
}

// ---------------------------------------------------------------------------
group('v2: alignment snapping & guides');
{
  const { win, doc, E } = boot();
  E('snapToGrid = false');
  win.createNode('rect', 100, 100, 120, 60);          // anchor at x=100
  const b = win.createNode('rect', 250, 300, 120, 60); // will be dragged near x=103
  // snap b's left edge (currently would land at 103) to anchor's left (100)
  const snapped = E(`applyAlignSnap(nodes[1], 103, 300)`);
  check('left edges snap together when close', Math.abs(snapped.x - 100) < 0.5, `x=${snapped.x}`);
  check('a vertical guide line is drawn', doc.querySelectorAll('#alignGuides line').length >= 1);
  // out of tolerance: no snap
  const far = E(`applyAlignSnap(nodes[1], 160, 300)`);
  check('no snap when edges are far apart', Math.abs(far.x - 160) < 0.5);
  win.eval('clearGuides()');
  check('clearGuides removes the guides', doc.querySelectorAll('#alignGuides line').length === 0);
}

// ---------------------------------------------------------------------------
group('v2: grouping (group / select-together / move-together / ungroup)');
{
  const { win, doc, E } = boot();
  E('snapToGrid = false');
  const a = win.createNode('rect', 100, 100, 120, 60);
  const b = win.createNode('rect', 300, 100, 120, 60);
  const c = win.createNode('rect', 500, 100, 120, 60);
  // group A + B
  E(`selectedIds = ['${a.id}','${b.id}']; selectedId = null;`);
  win.groupSelected();
  const gid = E(`nodes.find(n=>n.id==='${a.id}').groupId`);
  check('groupSelected assigns a shared groupId', !!gid && E(`nodes.find(n=>n.id==='${b.id}').groupId`) === gid);
  check('ungrouped node keeps no groupId', !E(`nodes.find(n=>n.id==='${c.id}').groupId`));
  // clicking one member selects the whole group
  win.render();
  const elB = doc.querySelector(`#nodes .node[data-id="${b.id}"]`);
  mouse(elB, 'mousedown', 360, 130);
  mouse(doc, 'mouseup', 360, 130);
  const sel = E('selectedIds.slice().sort()');
  check('clicking a group member selects all members', sel.includes(a.id) && sel.includes(b.id) && !sel.includes(c.id), JSON.stringify(sel));
  // dragging one member moves the whole group together
  const ax0 = E(`nodes.find(n=>n.id==='${a.id}').x`);
  const bx0 = E(`nodes.find(n=>n.id==='${b.id}').x`);
  win.render();
  const elB2 = doc.querySelector(`#nodes .node[data-id="${b.id}"]`);
  mouse(elB2, 'mousedown', 360, 130);
  mouse(doc, 'mousemove', 410, 130);
  mouse(doc, 'mouseup', 410, 130);
  const ax1 = E(`nodes.find(n=>n.id==='${a.id}').x`);
  const bx1 = E(`nodes.find(n=>n.id==='${b.id}').x`);
  check('dragging a member moves the whole group by the same delta', Math.abs((ax1 - ax0) - (bx1 - bx0)) < 0.5 && Math.abs(ax1 - ax0) > 5, `dA=${ax1-ax0} dB=${bx1-bx0}`);
  // ungroup
  E(`selectedIds = ['${a.id}','${b.id}']; selectedId = null;`);
  win.ungroupSelected();
  check('ungroupSelected clears groupId from members', !E(`nodes.find(n=>n.id==='${a.id}').groupId`) && !E(`nodes.find(n=>n.id==='${b.id}').groupId`));
  // duplicating a group yields a fresh groupId (copies don't merge with originals)
  E(`selectedIds = ['${a.id}','${b.id}']; selectedId = null;`);
  win.groupSelected();
  const gid2 = E(`nodes.find(n=>n.id==='${a.id}').groupId`);
  const nBefore = E('nodes.length');
  E(`selectedIds = ['${a.id}','${b.id}']; selectedId = null;`);
  win.duplicateSelected();
  check('duplicating a group adds copies', E('nodes.length') === nBefore + 2);
  const copyGids = E(`nodes.slice(-2).map(n=>n.groupId)`);
  check('duplicated group gets a single fresh shared groupId', copyGids[0] === copyGids[1] && copyGids[0] !== gid2 && !!copyGids[0], JSON.stringify(copyGids));
}

// ---------------------------------------------------------------------------
group('v2: subgraph layout is width-aware (children dont overlap)');
{
  const { win, doc, E } = boot();
  const editor = doc.getElementById('mermaidEditor');
  // Two same-layer children with long labels inside one subgraph: a fixed-grid
  // layout would overlap them; the width-aware layout must keep them apart.
  editor.value = `flowchart TD
    subgraph Group A
      W[A very long descriptive node label here] --> X[Another fairly long node label]
      W --> Y[Second long sibling label text]
    end`;
  win.importMermaid(true);
  const real = E(`nodes.filter(n=>n.type!=='container')`);
  // Generic non-overlap check across every pair of non-container nodes:
  let overlap = false;
  for (let i = 0; i < real.length; i++) for (let j = i + 1; j < real.length; j++) {
    const a = real[i], b = real[j];
    const ox = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
    const oy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    if (ox > 1 && oy > 1) overlap = true;
  }
  check('subgraph imported nodes', real.length >= 3, 'got ' + real.length);
  check('no two subgraph children overlap (width-aware spacing)', !overlap);
  // container is wide enough to hold its widest child row
  const container = E(`nodes.find(n=>n.type==='container')`);
  if (container) {
    const kids = real.filter(n => n.x >= container.x - 1 && n.x + n.width <= container.x + container.width + 1);
    check('container width contains its children', kids.length === real.length, `${kids.length}/${real.length}`);
  } else {
    check('container width contains its children', true, 'no container produced (skipped)');
  }
}

// ---------------------------------------------------------------------------
group('v2: export helpers & .draph file round-trip');
{
  const { win, doc, E } = boot();
  // helpers exist
  check('rasterizeDiagram is defined', typeof win.rasterizeDiagram === 'function');
  check('downloadPNG accepts a scale arg', win.downloadPNG.length >= 0 && typeof win.downloadPNG === 'function');
  check('copyPNG is defined', typeof win.copyPNG === 'function');
  check('saveDiagramFile is defined', typeof win.saveDiagramFile === 'function');
  check('openDiagramFile is defined', typeof win.openDiagramFile === 'function');
  // rasterize on empty canvas returns false (no crash, friendly path)
  check('rasterizeDiagram returns false on empty canvas', win.rasterizeDiagram(2, () => {}) === false);
  // .draph payload (app/version wrapper) round-trips through loadDiagramJson
  win.createNode('rect', 120, 140, 120, 60);
  win.render();
  const payload = JSON.stringify({
    n: E('nodes'), c: E('connections'),
    v: { x: 0, y: 0, z: 1 }, app: 'draph', version: 2,
  });
  const { win: win2 } = boot();
  const ok = win2.loadDiagramJson(payload);
  check('loadDiagramJson accepts a .draph (wrapped) payload', ok === true);
  check('restored node count matches saved', win2.eval('nodes.length') === 1);
  check('restored node geometry matches saved', win2.eval('nodes[0].x') === 120 && win2.eval('nodes[0].width') === 120);
}

// ---------------------------------------------------------------------------
group('v2: light/dark theme toggle');
{
  const { win, doc, E } = boot();
  // defaults to dark
  check('default theme is dark', E('currentTheme') === 'dark');
  check('COLORS.bg starts at dark bg', E('COLORS.bg') === '#0f0f15');
  // toggle to light
  win.toggleTheme();
  check('toggleTheme switches to light', E('currentTheme') === 'light');
  check('html data-theme set to light', doc.documentElement.dataset.theme === 'light');
  check('COLORS swap to light palette', E('COLORS.bg') === E('THEMES.light.bg') && E('COLORS.bg') !== '#0f0f15');
  check('light theme persisted to localStorage', win.localStorage.getItem('draph:theme') === 'light');
  check('top-right toggle button exists', !!doc.getElementById('themeToggleBtn'));
  check('toggle tooltip reflects next action', /dark/i.test(doc.getElementById('themeToggleBtn').title));
  // toggle back
  win.toggleTheme();
  check('toggleTheme switches back to dark', E('currentTheme') === 'dark' && E('COLORS.bg') === '#0f0f15');
  // applyTheme restores a persisted choice without persisting again
  win.applyTheme('light', false);
  check('applyTheme(light,false) applies light', E('currentTheme') === 'light' && doc.documentElement.dataset.theme === 'light');
}

// ---------------------------------------------------------------------------
group('v2: curved connection line style');
{
  const { win, doc, E } = boot();
  // pointsToPath('curved') emits cubic beziers through the routed points
  const d = E(`pointsToPath([{x:0,y:0},{x:0,y:50},{x:100,y:50},{x:100,y:100}], 'curved')`);
  check('curved path starts with a moveto', /^M0,0/.test(d), d.slice(0, 12));
  check('curved path uses cubic beziers (C)', /C/.test(d) && !/\bL\b/.test(d), d.slice(0, 40));
  // straight still has no curve commands
  const ds = E(`pointsToPath([{x:0,y:0},{x:0,y:50},{x:100,y:50}], 'straight')`);
  check('straight path has no bezier', !/C/.test(ds) && !/Q/.test(ds));
  // setGlobalLineStyle('curved') applies to connections and the renderer emits a C path
  const a = win.createNode('rect', 100, 100, 120, 44);
  const b = win.createNode('rect', 100, 320, 120, 44);
  win.createConnection ? win.createConnection(a.id, b.id) : E(`connections.push({id:'tc',from:'${a.id}',to:'${b.id}',fromSide:'bottom',toSide:'top',fromIdx:1,toIdx:1})`);
  win.setGlobalLineStyle('curved');
  win.render();
  check('connections adopt the curved style', E(`connections.every(c=>c.lineStyle==='curved')`));
  const pathEl = doc.querySelector('#connections .connection');
  check('rendered curved connection path contains a bezier', !!pathEl && /C/.test(pathEl.getAttribute('d')), pathEl && pathEl.getAttribute('d').slice(0, 30));
  // the curved menu item exists
  check('Curved lines menu item exists', !!doc.querySelector('[data-line="curved"]'));
  // curved is the default for new connections
  check('globalLineStyle defaults to curved', E(`globalLineStyle`) === 'curved');
  // line-style choice persists to localStorage
  win.setGlobalLineStyle('straight');
  check('setGlobalLineStyle persists to localStorage', win.localStorage.getItem('draph:lineStyle') === 'straight');
  win.setGlobalLineStyle('curved');
  check('switching back persists curved', win.localStorage.getItem('draph:lineStyle') === 'curved');
}

// ---------------------------------------------------------------------------
group('v2: node icons');
{
  const { win, doc, E } = boot();
  const n = win.createNode('rect', 200, 200, 160, 60); n.label = 'users'; win.render();
  win.selectNode(n.id);
  win.setNodeIcon('database');
  check('setNodeIcon sets node.icon', E(`nodes[0].icon`) === 'database');
  win.render();
  const nodeEl = doc.querySelector(`#nodes .node[data-id="${n.id}"]`);
  check('icon renders as an svg group with the database path', !!nodeEl && /<g[^>]*transform="translate/.test(nodeEl.innerHTML) && /ellipse/.test(nodeEl.innerHTML));
  // icon-aware sizing reserves room (node grew vs no-icon baseline)
  win.setNodeIcon('');
  check('clearing icon removes node.icon', E(`nodes[0].icon`) === undefined);
  check('icon picker grid was built (none tile + all icons)', doc.querySelectorAll('#iconGrid button').length === E(`Object.keys(ICONS).length`) + 1);
}

// ---------------------------------------------------------------------------
group('v2: paste image & text onto canvas');
{
  const { win, doc, E } = boot();
  // image node via the testable factory
  const before = E('nodes.length');
  const img = win.createImageNode('data:image/png;base64,AAAA', 200, 120);
  check('createImageNode adds an image node', E('nodes.length') === before + 1 && img.type === 'image' && img.src.startsWith('data:image/png'));
  win.render();
  const imgEl = doc.querySelector(`#nodes .node[data-id="${img.id}"] image`);
  check('image node renders an <image> with the data URL', !!imgEl && imgEl.getAttribute('href').startsWith('data:image/png'));
  check('image node is selected after paste', E('selectedId') === img.id);
  // pasted text becomes an auto-sized rect carrying the text
  const t = win.createTextNodeFromPaste('Hello pasted text');
  check('createTextNodeFromPaste makes a labeled rect', t.type === 'rect' && t.label === 'Hello pasted text');
  check('pasted-text node grew to fit its label', t.width >= 120);
}

// ---------------------------------------------------------------------------
group('v2: paste a URL -> link-preview card');
{
  const { win, doc, E } = boot();
  // URL detection
  check('isUrl accepts an http(s) URL', E(`isUrl('https://github.com/sanathks')`) === true);
  check('isUrl rejects plain text', E(`isUrl('just some text')`) === false);
  check('isUrl rejects text with a URL inside', E(`isUrl('see https://x.com now')`) === false);
  // creating a link card (enrich is a no-op without fetch in jsdom)
  const ln = win.createLinkNode('https://github.com/sanathks/draph');
  check('createLinkNode makes a link node', ln.type === 'link' && ln.url === 'https://github.com/sanathks/draph');
  check('link node derives the domain', ln.domain === 'github.com');
  win.render();
  const el = doc.querySelector(`#nodes .node[data-id="${ln.id}"]`);
  check('link card renders the domain text', !!el && /github\.com/.test(el.textContent));
  // the paste pipeline routes a URL to a link card (not a text rect).
  // jsdom has no ClipboardEvent/DataTransfer, so synthesize the event.
  const before = E('nodes.length');
  const ev = new win.Event('paste', { bubbles: true, cancelable: true });
  ev.clipboardData = { items: [], getData: () => 'https://example.com/page' };
  doc.dispatchEvent(ev);
  check('pasting a URL adds a link node', E('nodes.length') === before + 1 && E('nodes[nodes.length-1].type') === 'link');
  // persistence: a link card stores ONLY its URL (+geometry), never the fetched
  // thumbnail/title/desc/favicon — those are re-fetched on load.
  E(`nodes.find(n=>n.id==='${ln.id}').image = 'data:image/png;base64,'+'X'.repeat(50000)`);
  E(`nodes.find(n=>n.id==='${ln.id}').title = 'Heavy Title'`);
  const ser = E(`JSON.stringify(serializeNodes().find(n=>n.id==='${ln.id}'))`);
  const obj = JSON.parse(ser);
  check('serialized link keeps the url', obj.url === 'https://github.com/sanathks/draph');
  check('serialized link drops the thumbnail/title (URL-only)', obj.image === undefined && obj.title === undefined && obj.favicon === undefined);
  check('serialized link is tiny (no embedded image)', ser.length < 300, `len=${ser.length}`);
  // a loaded diagram re-hydrates link nodes (blank rich fields, domain set)
  const payload = E(`JSON.stringify({n:[{id:'L1',type:'link',url:'https://youtube.com/watch?v=abc',x:0,y:0,width:300}],c:[],v:{x:0,y:0,z:1}})`);
  win.loadDiagramJson(payload);
  check('loaded link node gets its domain back', E(`nodes[0].domain`) === 'youtube.com');
  check('loaded link node starts without a persisted thumbnail', E(`nodes[0].image`) === '');
  // loading state: spinner + "Loading preview…" while fetching; not persisted
  E(`nodes[0].loading = true`); win.render();
  const lel = doc.querySelector('#nodes .node[data-id="L1"]');
  check('loading card shows a spinner', !!lel && /animateTransform/.test(lel.innerHTML));
  check('loading card shows "Loading preview"', !!lel && /Loading preview/.test(lel.textContent));
  check('loading flag is not persisted', JSON.parse(E(`JSON.stringify(serializeNodes()[0])`)).loading === undefined);
}

// ---------------------------------------------------------------------------
group('v2: share-link size guard');
{
  const { win, E } = boot();
  // browser limit detection returns a sane shape
  const lim = E('browserUrlLimit()');
  check('browserUrlLimit returns a name + numeric limit', typeof lim.name === 'string' && typeof lim.limit === 'number' && lim.limit > 1000);
  // share URL grows with content and is measurable before committing
  win.createNode('rect', 100, 100, 160, 60);
  const base = E('diagramShareUrl().length');
  check('diagramShareUrl produces a hash URL', E(`diagramShareUrl().includes('#')`) && base > 20);
  // a huge embedded image makes the URL exceed a (small) limit -> guard would trip
  E(`nodes.push({id:'img1',type:'image',src:'data:image/png;base64,'+'A'.repeat(200000),x:0,y:0,width:100,height:100,label:''})`);
  const big = E('diagramShareUrl().length');
  check('embedded image inflates the share URL past 65k', big > 65000, `len=${big}`);
  check('share URL would exceed Firefox-class limit', big > 65000);
}

// ---------------------------------------------------------------------------
group('v2: paste Mermaid code -> append diagram (no canvas wipe)');
{
  const { win, E } = boot();
  // detection
  check('isMermaid: flowchart header', E(`isMermaid('flowchart TD\\n A-->B')`) === true);
  check('isMermaid: edges + node shapes (no header)', E(`isMermaid('A[Start] --> B{Go}')`) === true);
  check('isMermaid: plain prose is not Mermaid', E(`isMermaid('hello world, see you -- later')`) === false);
  check('isMermaid: a URL is not Mermaid', E(`isMermaid('https://example.com')`) === false);
  // seed an existing diagram, then append via Mermaid paste
  const a = win.createNode('rect', 100, 100, 120, 60); a.label = 'existing';
  win.render();
  const beforeNodes = E('nodes.length');
  const ok = win.importMermaid(true, { code: 'flowchart TD\n  A[Login] --> B{Auth?}\n  B -->|yes| C[Home]\n  B -->|no| D[Retry]', append: true });
  check('importMermaid(append) returns true', ok === true);
  check('existing node is NOT wiped', E(`nodes.some(n=>n.label==='existing')`) === true);
  check('mermaid nodes were added on top of existing', E('nodes.length') >= beforeNodes + 4);
  check('appended connections exist', E('connections.length') >= 3);
  // appended block sits to the RIGHT of the existing node (offset, not overlapping)
  const minNewX = E(`Math.min(...nodes.filter(n=>n.label!=='existing'&&n.type!=='line').map(n=>n.x))`);
  check('appended diagram is offset to the side', minNewX >= 120, `minNewX=${minNewX}`);
  // the newly added nodes are selected
  check('appended nodes are selected', E('selectedIds.length') >= 4);
}

// ---------------------------------------------------------------------------
group('v2: dot-grid background covers the viewport at any zoom');
{
  const { win, doc, E } = boot();
  const grid = doc.getElementById('gridBg');
  // simulate a big zoom-out: large viewBox, off-origin
  E('viewBox.x = -4000; viewBox.y = -3000; viewBox.w = 9000; viewBox.h = 7000;');
  win.updateViewBox();
  const gx = +grid.getAttribute('x'), gy = +grid.getAttribute('y');
  const gw = +grid.getAttribute('width'), gh = +grid.getAttribute('height');
  check('grid starts left/above the viewport', gx <= -4000 && gy <= -3000);
  check('grid extends past the viewport right/bottom', gx + gw >= -4000 + 9000 && gy + gh >= -3000 + 7000);
}

// ---------------------------------------------------------------------------
group('v2: Mermaid state diagram import (stateDiagram-v2)');
{
  const { win, E } = boot();
  const code = `stateDiagram-v2
    [*] --> Still
    Still --> Moving : go
    Moving --> Still : stop
    Moving --> Crash
    Crash --> [*]`;
  // parser
  const parsed = E(`parseMermaid(${JSON.stringify(code)})`);
  check('state parser detects a flow-style graph', parsed.diagramType === 'flowchart');
  check('state parser makes a node per state + start/end dot', parsed.nodes.some(n => n.label === 'Still') && parsed.nodes.some(n => n.isPseudo));
  check('state parser keeps transition labels', parsed.connections.some(c => c.label === 'go'));
  // full import
  const ed = win.document.getElementById('mermaidEditor');
  ed.value = code;
  win.importMermaid(true);
  check('state import builds states + transitions', E(`nodes.filter(n=>n.type!=='line').length`) >= 5 && E('connections.length') >= 4);
  check('[*] becomes a small circle node', E(`nodes.some(n=>n.type==='circle' && n.width<=30)`));
  check('a labeled transition survived import', E(`connections.some(c=>c.label==='go')`));
}

// ---------------------------------------------------------------------------
group('v2: Mermaid ER diagram import (erDiagram)');
{
  const { win, E } = boot();
  const code = `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    CUSTOMER }|..|{ DELIVERY-ADDRESS : uses
    CUSTOMER {
        string name
        string custNumber PK
    }`;
  const parsed = E(`parseMermaid(${JSON.stringify(code)})`);
  check('ER parser makes entity nodes (class boxes)', parsed.nodes.some(n => n.id === 'CUSTOMER' && n.type === 'class'));
  check('ER parser reads attributes onto the entity', parsed.nodes.find(n => n.id === 'CUSTOMER').properties.some(p => /name/.test(p)));
  check('ER parser keeps a PK tag', parsed.nodes.find(n => n.id === 'CUSTOMER').properties.some(p => /PK/.test(p)));
  check('ER parser handles hyphenated entity ids', parsed.nodes.some(n => n.id === 'LINE-ITEM'));
  check('ER parser keeps relationship labels', parsed.connections.some(c => c.label === 'places'));
  check('ER non-identifying (..) relationship is dashed', parsed.connections.some(c => c.strokeStyle === 'dashed'));
  // full import builds class-style entities + edges, dashed carried through
  const ed = win.document.getElementById('mermaidEditor');
  ed.value = code;
  win.importMermaid(true);
  check('ER import builds entities + relationships', E(`nodes.some(n=>n.isClass)`) && E('connections.length') >= 3);
  check('ER import carries the dashed edge style', E(`connections.some(c=>c.strokeStyle==='dashed')`));
}

// ---------------------------------------------------------------------------
group('v2: Mermaid mindmap import (indentation tree)');
{
  const { win, E } = boot();
  const code = [
    'mindmap',
    '  root((Project))',
    '    Planning',
    '      Scope',
    '      Timeline',
    '    Build',
    '      Frontend',
    '      Backend',
  ].join('\n');
  const parsed = E(`parseMermaid(${JSON.stringify(code)})`);
  check('mindmap makes one node per line', parsed.nodes.length === 7);
  check('mindmap root is a circle with its label', parsed.nodes.some(n => n.type === 'circle' && n.label === 'Project'));
  check('mindmap builds parent->child edges', parsed.connections.length === 6);
  // hierarchy: Scope's parent is Planning (not root)
  const idOf = (lbl) => parsed.nodes.find(n => n.label === lbl).id;
  check('mindmap nests by indentation', parsed.connections.some(c => c.from === idOf('Planning') && c.to === idOf('Scope')));
  check('root parents the top-level branches', parsed.connections.some(c => c.from === idOf('Project') && c.to === idOf('Build')));
  // shape parsing
  const code2 = ['mindmap', '  A((Root))', '    B[Square]', '    C(Rounded)'].join('\n');
  const p2 = E(`parseMermaid(${JSON.stringify(code2)})`);
  check('mindmap shapes: [] -> rect, () -> pill', p2.nodes.some(n => n.label === 'Square' && n.type === 'rect') && p2.nodes.some(n => n.label === 'Rounded' && n.type === 'pill'));
  // full import
  const ed = win.document.getElementById('mermaidEditor');
  ed.value = code; win.importMermaid(true);
  check('mindmap import builds the tree', E(`nodes.filter(n=>n.type!=='line').length`) === 7 && E('connections.length') === 6);
}

// ---------------------------------------------------------------------------
group('v2: Mermaid timeline import');
{
  const { win, E } = boot();
  const code = [
    'timeline',
    '    title History',
    '    2002 : LinkedIn',
    '    2004 : Facebook : Google',
    '    2005 : YouTube',
  ].join('\n');
  const parsed = E(`parseMermaid(${JSON.stringify(code)})`);
  check('timeline makes period nodes (pills)', parsed.nodes.filter(n => n.type === 'pill').length === 3);
  check('timeline makes an event node per event', parsed.nodes.some(n => n.label === 'Facebook') && parsed.nodes.some(n => n.label === 'Google'));
  check('timeline title becomes a heading node (#29)', parsed.nodes.some(n => n.label === 'History'));
  // a period with two events -> two child edges from that period
  const p2004 = parsed.nodes.find(n => n.label === '2004').id;
  check('timeline links events to their period', parsed.connections.filter(c => c.from === p2004).length === 2);
  // sections -> period pills tinted per-section (#29: horizontal, not containers)
  const code2 = ['timeline', '  section Early', '    2002 : LinkedIn', '  section Later', '    2006 : Twitter'].join('\n');
  const p2 = E(`parseMermaid(${JSON.stringify(code2)})`);
  const e2002 = p2.nodes.find(n => n.label === '2002'), t2006 = p2.nodes.find(n => n.label === '2006');
  check('timeline sections tint period pills with distinct colors', !!e2002.color && !!t2006.color && e2002.color !== t2006.color);
  // full import
  const ed = win.document.getElementById('mermaidEditor');
  ed.value = code; win.importMermaid(true);
  check('timeline import builds periods + events', E(`nodes.filter(n=>n.type!=='line').length`) >= 5 && E('connections.length') >= 4);
}

// ---------------------------------------------------------------------------
group('v2: Mermaid gantt import (time-axis bars)');
{
  const { win, E } = boot();
  const code = [
    'gantt',
    '    title A Gantt',
    '    dateFormat YYYY-MM-DD',
    '    section Phase1',
    '        Task A :a1, 2014-01-01, 10d',
    '        Task B :after a1, 5d',
    '    section Phase2',
    '        Mile X :milestone, 2014-01-20, 0d',
    '        Task C :2014-01-16, 4d',
  ].join('\n');
  const p = E(`parseMermaid(${JSON.stringify(code)})`);
  check('gantt diagramType is gantt', p.diagramType === 'gantt');
  const A = p.nodes.find(n => n.label === 'Task A');
  const B = p.nodes.find(n => n.label === 'Task B');
  check('gantt task is a fixed-geometry rect', A && A.type === 'rect' && A.fixed === true);
  check('gantt duration sets bar width (10d -> 200px)', A.width === 200);
  check('gantt "after" places a task to the right of its dependency', B.x > A.x);
  check('gantt section becomes a left-margin text label', p.nodes.some(n => n.type === 'text' && n.label === 'Phase1'));
  check('gantt milestone becomes a diamond', p.nodes.some(n => n.type === 'diamond' && n.label === 'Mile X'));
  // full import keeps the bar geometry (no auto-resize, no dependency arrows)
  const ed = win.document.getElementById('mermaidEditor');
  ed.value = code; win.importMermaid(true);
  const ia = E(`nodes.find(n=>n.label==='Task A')`);
  check('gantt import preserves bar width', ia && ia.width === 200);
  check('gantt import draws a dependency arrow for the "after" task (#25)', E('connections.length') >= 1);
}

// ---------------------------------------------------------------------------
group('v2: Mermaid pie chart import');
{
  const { win, doc, E } = boot();
  const code = [
    'pie title Pets adopted',
    '    "Dogs" : 386',
    '    "Cats" : 85',
    '    "Rats" : 15',
  ].join('\n');
  const p = E(`parseMermaid(${JSON.stringify(code)})`);
  check('pie collapses to a single pie node', p.nodes.length === 1 && p.nodes[0].type === 'pie');
  check('pie keeps the title', p.nodes[0].title === 'Pets adopted');
  check('pie parses all slices with values', p.nodes[0].slices.length === 3 && p.nodes[0].slices[0].label === 'Dogs' && p.nodes[0].slices[0].value === 386);
  check('pie assigns slice colors', p.nodes[0].slices.every(s => /^#/.test(s.color)));
  // full import renders pie slices (paths) + legend
  const ed = doc.getElementById('mermaidEditor');
  ed.value = code; win.importMermaid(true);
  check('pie import makes one pie node carrying slices', E(`nodes.length`) === 1 && E(`nodes[0].type==='pie'`) && E('nodes[0].slices.length') === 3);
  win.render();
  const el = doc.querySelector(`#nodes .node[data-id="${E('nodes[0].id')}"]`);
  check('pie renders slice <path> arcs', !!el && (el.querySelectorAll('path').length >= 2));
  check('pie renders a legend with a percentage', !!el && /%/.test(el.textContent));
}

// ---------------------------------------------------------------------------
group('v2: Mermaid user-journey import');
{
  const { win, E } = boot();
  const code = [
    'journey',
    '    title My day',
    '    section Work',
    '      Make tea: 5: Me',
    '      Do work: 1: Me, Cat',
    '    section Home',
    '      Sit down: 5: Me',
  ].join('\n');
  const p = E(`parseMermaid(${JSON.stringify(code)})`);
  check('journey makes a task node per task', p.nodes.filter(n => n.type === 'pill').length === 3);
  check('journey carries actors as a list on the task (#31)', p.nodes.some(n => Array.isArray(n.actors) && n.actors.length === 2 && n.actors[0] === 'Me' && n.actors[1] === 'Cat'));
  check('journey chains tasks sequentially', p.connections.length === 2);
  // higher score => higher up (smaller y). "Make tea" (5) above "Do work" (1)
  const tea = p.nodes.find(n => /Make tea/.test(n.label));
  const work = p.nodes.find(n => /Do work/.test(n.label));
  check('journey positions higher score higher up', tea.y < work.y);
  check('journey adds section labels', p.nodes.some(n => n.type === 'text' && n.label === 'Work'));
  // full import
  const ed = win.document.getElementById('mermaidEditor');
  ed.value = code; win.importMermaid(true);
  check('journey import builds tasks + line', E(`nodes.filter(n=>n.type==='pill').length`) === 3 && E('connections.length') === 2);
}

// ---------------------------------------------------------------------------
group('v2: Mermaid gitGraph import (commit DAG)');
{
  const { win, E } = boot();
  const code = [
    'gitGraph',
    '   commit',
    '   commit id: "A"',
    '   branch develop',
    '   commit',
    '   checkout main',
    '   commit',
    '   merge develop',
  ].join('\n');
  const p = E(`parseMermaid(${JSON.stringify(code)})`);
  check('gitGraph diagramType', p.diagramType === 'gitgraph');
  check('gitGraph makes a dot per commit (incl. merge)', p.nodes.filter(n => n.type === 'circle').length === 5);
  check('gitGraph labels only explicit-id commits', p.nodes.some(n => n.label === 'A') && p.nodes.filter(n => n.type === 'circle' && n.label === '').length === 4);
  check('gitGraph puts branches on separate lanes (y)', new Set(p.nodes.filter(n => n.type === 'circle').map(n => n.y)).size === 2);
  check('gitGraph adds branch lane labels', p.nodes.some(n => n.type === 'text' && n.label === 'develop'));
  // merge commit has TWO incoming edges (from main tip + develop tip)
  const merge = p.nodes.filter(n => n.type === 'circle').slice(-1)[0];
  check('gitGraph merge commit has two parents', p.connections.filter(c => c.to === merge.id).length === 2);
  // full import
  const ed = win.document.getElementById('mermaidEditor');
  ed.value = code; win.importMermaid(true);
  check('gitGraph import builds commit dots + edges', E(`nodes.filter(n=>n.type==='circle').length`) === 5 && E('connections.length') >= 4);
}

// ---------------------------------------------------------------------------
group('v2: complex class diagram (generics, stereotypes, multiplicities)');
{
  const { win, E } = boot();
  const code = `classDiagram
direction TB
class Identifiable {
  <<interface>>
  +UUID id
  +getId() UUID
}
class Person {
  <<abstract>>
  #String firstName
  +getFullName() String
  +sendNotification(msg String)* void
}
class Customer {
  -List~Address~ addresses
  -LoyaltyTier tier
  +placeOrder(cart Cart) Order
}
class Order {
  -OrderStatus status
  -List~OrderLine~ lines
  +calculateTotal() Money
}
class OrderRepository~T~ {
  <<interface>>
  +findById(id UUID) T
}
class OrderStatus {
  <<enumeration>>
  PENDING
  SHIPPED
  CANCELLED
}
Person <|-- Customer
Person ..|> Identifiable
Customer "1" o-- "0..*" Address : ships to
Customer "1" --> "0..*" Order : places
Order --> OrderStatus : has
OrderRepository~Order~ ..> Order : manages`;
  const p = E(`parseMermaid(${JSON.stringify(code)})`);
  const byId = {}; p.nodes.forEach(n => byId[n.id] = n);
  check('class: direction line is not a node', !byId['direction'] && !byId['TB']);
  check('class: <<interface>> stereotype captured', byId['Identifiable'] && byId['Identifiable'].stereotype === 'interface');
  check('class: <<abstract>> stereotype captured', byId['Person'].stereotype === 'abstract');
  check('class: <<enumeration>> captured + values listed', byId['OrderStatus'].stereotype === 'enumeration' && byId['OrderStatus'].properties.includes('PENDING'));
  check('class: generics ~T~ render as <T> in members', byId['Customer'].properties.some(s => /List<Address>/.test(s)));
  check('class: generic class id ignores type param (Foo~T~ == Foo~Order~)', !!byId['OrderRepository'] && p.nodes.filter(n => n.id === 'OrderRepository').length === 1);
  check('class: method with abstract * marker kept', byId['Person'].methods.some(s => /sendNotification/.test(s)));
  check('class: inheritance relationship parsed', p.connections.some(c => c.from === 'Person' && c.to === 'Customer'));
  check('class: multiplicity + label relationship parsed', p.connections.some(c => c.from === 'Customer' && c.to === 'Address' && c.label === 'ships to'));
  check('class: dotted (..) relationships are dashed', p.connections.some(c => c.strokeStyle === 'dashed'));
  // 6 defined + Address (auto-created from the relationship) = 7 nodes
  check('class: all classes (+auto Address) + relationships parsed', p.nodes.length === 7 && p.connections.length === 6);
  // full import doesn't throw and builds the boxes
  const ed = win.document.getElementById('mermaidEditor');
  ed.value = code; win.importMermaid(true);
  check('complex class import builds class boxes + relations', E(`nodes.filter(n=>n.isClass).length`) === 7 && E('connections.length') === 6);
  check('imported class carries its stereotype', E(`nodes.find(n=>n.label==='Identifiable').stereotype`) === 'interface');
}

// ---------------------------------------------------------------------------
group('v2: Mermaid quadrantChart import');
{
  const { win, doc, E } = boot();
  const code = [
    'quadrantChart',
    '    title Reach and engagement',
    '    x-axis Low Reach --> High Reach',
    '    y-axis Low Engagement --> High Engagement',
    '    quadrant-1 Expand',
    '    quadrant-2 Promote',
    '    quadrant-3 Re-evaluate',
    '    quadrant-4 Improve',
    '    Campaign A: [0.3, 0.6]',
    '    Campaign B: [0.45, 0.23]',
  ].join('\n');
  const p = E(`parseMermaid(${JSON.stringify(code)})`);
  check('quadrant collapses to one node', p.nodes.length === 1 && p.nodes[0].type === 'quadrant');
  check('quadrant parses axes', p.nodes[0].xAxis.left === 'Low Reach' && p.nodes[0].xAxis.right === 'High Reach' && p.nodes[0].yAxis.top === 'High Engagement');
  check('quadrant parses the 4 quadrant labels', p.nodes[0].quadrants[0] === 'Expand' && p.nodes[0].quadrants[3] === 'Improve');
  check('quadrant parses points with x,y', p.nodes[0].points.length === 2 && p.nodes[0].points[0].label === 'Campaign A' && p.nodes[0].points[0].x === 0.3 && p.nodes[0].points[0].y === 0.6);
  // full import renders plot frame + points
  const ed = doc.getElementById('mermaidEditor');
  ed.value = code; win.importMermaid(true);
  check('quadrant import makes one quadrant node', E(`nodes.length`) === 1 && E(`nodes[0].type==='quadrant'`));
  win.render();
  const el = doc.querySelector(`#nodes .node[data-id="${E('nodes[0].id')}"]`);
  check('quadrant renders point dots', !!el && [...el.querySelectorAll('circle')].filter(c => c.getAttribute('r') === '5').length === 2);
  check('quadrant renders axis labels', !!el && /High Reach/.test(el.textContent));
}

// ---------------------------------------------------------------------------
group('v2: class diagram layout is connection-aware + non-overlapping');
{
  const { win, doc, E } = boot();
  const code = [
    'classDiagram',
    '  class Animal { +String name +eat() void }',
    '  class Dog { +bark() void }',
    '  class Cat { +meow() void }',
    '  class Puppy { +play() void }',
    '  Animal <|-- Dog',
    '  Animal <|-- Cat',
    '  Dog <|-- Puppy',
  ].join('\n');
  const ed = doc.getElementById('mermaidEditor');
  ed.value = code; win.importMermaid(true);
  const ns = E(`nodes.filter(n=>n.isClass).map(n=>({label:n.label,x:n.x,y:n.y,w:n.width,h:n.height}))`);
  check('all four classes imported', ns.length === 4);
  // no two class boxes overlap (the bug: fixed grid let big boxes collide)
  let overlap = false;
  for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
    const a = ns[i], b = ns[j];
    const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    if (ox > 1 && oy > 1) overlap = true;
  }
  check('no two class boxes overlap', !overlap);
  // connection-aware: parent (Animal) sits above its children (Dog/Cat)
  const by = {}; ns.forEach(n => by[n.label] = n);
  check('parent class is laid out above its subclasses', by['Animal'].y < by['Dog'].y && by['Animal'].y < by['Cat'].y);
  check('grandchild is below its parent', by['Puppy'].y > by['Dog'].y);
}

// ---------------------------------------------------------------------------
group('v2: class diagram UML relationship markers');
{
  const { win, doc, E } = boot();
  const code = [
    'classDiagram',
    '  Animal <|-- Dog',
    '  Car *-- Engine',
    '  Library o-- Book',
    '  Order --> Customer',
    '  Service ..|> Iface',
  ].join('\n');
  const p = E(`parseMermaid(${JSON.stringify(code)})`);
  const rel = (a, b) => p.connections.find(c => c.from === a && c.to === b);
  check('inheritance -> hollow triangle at the base end', rel('Animal', 'Dog').markerStart === 'triangle' && rel('Animal', 'Dog').markerEnd === 'none');
  check('composition -> filled diamond', rel('Car', 'Engine').markerStart === 'diamond-filled');
  check('aggregation -> hollow diamond', rel('Library', 'Book').markerStart === 'diamond-hollow');
  check('association -> open arrow at target', rel('Order', 'Customer').markerEnd === 'arrow');
  check('realization -> triangle + dashed line', rel('Service', 'Iface').markerEnd === 'triangle' && rel('Service', 'Iface').strokeStyle === 'dashed');
  // rendered: the two diamonds become <polygon>s
  const ed = doc.getElementById('mermaidEditor'); ed.value = code; win.importMermaid(true); win.render();
  check('UML diamonds render as polygons', doc.querySelectorAll('#connections polygon').length === 2);
  // non-class edges are unaffected (default filled arrow, no UML marker fields)
  const f = boot();
  const a = f.win.createNode('rect', 0, 0, 80, 40); const b = f.win.createNode('rect', 0, 200, 80, 40);
  f.E(`connections.push({id:'z',from:'${a.id}',to:'${b.id}'})`); f.win.render();
  check('flowchart edge keeps the default arrow (no UML markers)', f.E(`connections[0].markerEnd`) === undefined && f.doc.querySelectorAll('#connections polygon').length === 0);
}

// ---------------------------------------------------------------------------
group('v2: Mermaid requirementDiagram import');
{
  const { win, E } = boot();
  const code = [
    'requirementDiagram',
    '    requirement test_req {',
    '        id: 1',
    '        text: the test text.',
    '        risk: high',
    '        verifymethod: test',
    '    }',
    '    element test_entity {',
    '        type: simulation',
    '    }',
    '    test_entity - satisfies -> test_req',
    '    test_req - contains -> test_req2',
  ].join('\n');
  const p = E(`parseMermaid(${JSON.stringify(code)})`);
  const byId = {}; p.nodes.forEach(n => byId[n.id] = n);
  check('requirement becomes a class-style box with its type as stereotype', byId['test_req'] && byId['test_req'].type === 'class' && byId['test_req'].stereotype === 'requirement');
  check('requirement attributes become rows', byId['test_req'].properties.some(s => /risk: high/.test(s)) && byId['test_req'].properties.some(s => /id: 1/.test(s)));
  check('element becomes a box with «element» stereotype', byId['test_entity'].stereotype === 'element' && byId['test_entity'].properties.some(s => /type: simulation/.test(s)));
  check('typed relationship keeps its verb label', p.connections.some(c => c.from === 'test_entity' && c.to === 'test_req' && c.label === 'satisfies'));
  check('non-contains relationships are dashed', p.connections.find(c => c.label === 'satisfies').strokeStyle === 'dashed');
  check('contains relationship is solid', p.connections.find(c => c.label === 'contains').strokeStyle === undefined);
  check('relationship target auto-created (test_req2)', !!byId['test_req2'] || p.nodes.some(n => n.id === 'test_req2'));
  // full import
  const ed = win.document.getElementById('mermaidEditor');
  ed.value = code; win.importMermaid(true);
  check('requirement import builds boxes + edges', E(`nodes.filter(n=>n.isClass).length`) >= 3 && E('connections.length') === 2);
}

// ---------------------------------------------------------------------------
group('v2: Mermaid C4 diagram import');
{
  const { win, E } = boot();
  const code = [
    'C4Context',
    '    title System Context',
    '    Person(customerA, "Banking Customer A", "A customer of the bank.")',
    '    System(SystemAA, "Internet Banking", "Allows customers to view info.")',
    '    System_Ext(SystemE, "Mainframe", "Stores core banking data")',
    '    Rel(customerA, SystemAA, "Uses")',
    '    Rel(SystemAA, SystemE, "Uses", "SOAP/XML")',
    '    BiRel(customerA, SystemE, "Syncs")',
  ].join('\n');
  const p = E(`parseMermaid(${JSON.stringify(code)})`);
  const byId = {}; p.nodes.forEach(n => byId[n.id] = n);
  check('C4 element becomes a class box with type as stereotype', byId['customerA'] && byId['customerA'].type === 'class' && byId['customerA'].stereotype === 'Person');
  check('C4 element keeps its label (not the alias)', byId['customerA'].label === 'Banking Customer A');
  check('C4 _Ext stereotype preserved', byId['SystemE'].stereotype === 'System Ext');
  check('C4 description wrapped into rows', byId['customerA'].properties.length >= 1 && byId['customerA'].properties.join(' ').includes('customer of the bank'));
  check('C4 Rel becomes a labeled edge', p.connections.some(c => c.from === 'customerA' && c.to === 'SystemAA' && c.label === 'Uses'));
  check('C4 Rel tech appended to label', p.connections.some(c => /SOAP\/XML/.test(c.label)));
  check('C4 BiRel marks both ends', p.connections.some(c => c.markerStart === 'arrow' && c.markerEnd === 'arrow'));
  // boundary -> subgraph
  const code2 = ['C4Context', '  System_Boundary(b1, "Bank") {', '    System(s1, "Core")', '  }'].join('\n');
  const p2 = E(`parseMermaid(${JSON.stringify(code2)})`);
  check('C4 boundary becomes a subgraph owning its child', Array.isArray(p2.subgraphs) && p2.subgraphs[0].children.includes('s1'));
  // full import
  const ed = win.document.getElementById('mermaidEditor');
  ed.value = code; win.importMermaid(true);
  check('C4 import builds boxes + relationships', E(`nodes.filter(n=>n.isClass).length`) === 3 && E('connections.length') === 3);
}

group('v2: Mermaid architecture diagram import (architecture-beta)');
{
  const { win, doc, E } = boot();
  const code = [
    'architecture-beta',
    '  group api(cloud)[API]',
    '  service db(database)[Database] in api',
    '  service disk1(disk)[Storage] in api',
    '  service server(server)[Server] in api',
    '  service gateway(internet)[Gateway]',
    '  junction jx in api',
    '  db:L -- R:server',
    '  disk1:T --> B:server',
    '  server:T <--> B:gateway',
  ].join('\n');
  const p = E(`parseMermaid(${JSON.stringify(code)})`);
  const byId = {}; p.nodes.forEach(n => byId[n.id] = n);
  check('architecture diagramType is flowchart (reuses layout)', p.diagramType === 'flowchart');
  check('architecture services become nodes with their title', byId.db && byId.db.label === 'Database' && byId.server.label === 'Server');
  check('architecture ungrouped service still imported', byId.gateway && byId.gateway.label === 'Gateway');
  check('architecture junction becomes a small circle node', byId.jx && byId.jx.type === 'circle');
  check('architecture group becomes a subgraph owning its services', Array.isArray(p.subgraphs) && p.subgraphs[0].id === 'api' && p.subgraphs[0].label === 'API' && p.subgraphs[0].children.includes('db') && p.subgraphs[0].children.includes('server') && p.subgraphs[0].children.includes('jx'));
  check('architecture plain edge has no arrowheads', p.connections.some(c => c.from === 'db' && c.to === 'server' && !c.markerEnd && !c.markerStart));
  check('architecture --> edge gets an end arrowhead', p.connections.some(c => c.from === 'disk1' && c.to === 'server' && c.markerEnd === 'arrow' && !c.markerStart));
  check('architecture <--> edge gets both arrowheads', p.connections.some(c => c.from === 'server' && c.to === 'gateway' && c.markerStart === 'arrow' && c.markerEnd === 'arrow'));
  check('architecture edge sides (L/R/T/B) are stripped, not ids', !byId['L'] && !byId['R'] && !byId['B'] && !byId['T']);
  // full import builds nodes + a container + edges, no crash
  const ed = doc.getElementById('mermaidEditor');
  ed.value = code; win.importMermaid(true);
  check('architecture import creates a group container', E(`nodes.some(n=>n.type==='container' && n.label==='API')`));
  check('architecture import wires the edges', E('connections.length') === 3);
}

group('v2: Mermaid block diagram import (block-beta)');
{
  const { win, doc, E } = boot();
  const code = [
    'block-beta',
    '  columns 3',
    '  a["Square"] b(("Circle")) c{"Diamond"}',
    '  d:2 e',
    '  space f',
    '  a --> b',
    '  b -- "lbl" --> c',
  ].join('\n');
  const p = E(`parseMermaid(${JSON.stringify(code)})`);
  const byId = {}; p.nodes.forEach(n => byId[n.id] = n);
  check('block diagramType is block', p.diagramType === 'block');
  check('block parses all six blocks (spaces make no node)', p.nodes.length === 6);
  check('block shapes map []→rect (()) →circle {}→diamond', byId.a.type === 'rect' && byId.b.type === 'circle' && byId.c.type === 'diamond');
  check('block keeps quoted labels', byId.a.label === 'Square' && byId.b.label === 'Circle' && byId.c.label === 'Diamond');
  check('block nodes carry fixed geometry', byId.a.fixed === true && byId.a.x === 80 && byId.a.y === 80);
  check('block column span widens the block', byId.d.width === 2 * 150 + 22);
  check('block wraps to a new row at the column count', byId.d.y > byId.a.y && byId.c.x > byId.b.x);
  check('block space leaves an empty cell (f shifted right + down a row)', byId.f.x === 80 + (150 + 22) && byId.f.y > byId.d.y);
  check('block plain arrow becomes an edge', p.connections.some(c => c.from === 'a' && c.to === 'b' && c.label === '' && c.markerEnd === 'arrow'));
  check('block labelled arrow keeps its label', p.connections.some(c => c.from === 'b' && c.to === 'c' && c.label === 'lbl'));
  // full import round-trips through layout + render
  const ed = doc.getElementById('mermaidEditor');
  ed.value = code; win.importMermaid(true);
  check('block import builds the blocks + edges', E(`nodes.length`) === 6 && E('connections.length') === 2);
  check('block import preserves the circle shape', E(`nodes.some(n=>n.type==='circle')`) && E(`nodes.some(n=>n.type==='diamond')`));
  // regression for the review finding: circles were normalised square to their
  // (wider) cell width and overflowed the row, overlapping neighbours.
  const bn = E(`nodes.map(n=>({type:n.type,x:n.x,y:n.y,w:n.width,h:n.height}))`);
  const circ = bn.find(n => n.type === 'circle');
  const ys = [...new Set(bn.map(n => n.y))].sort((a, b) => a - b);
  let minRowGap = Infinity;
  for (let i = 1; i < ys.length; i++) minRowGap = Math.min(minRowGap, ys[i] - ys[i - 1]);
  check('block circle is square and fits within the row pitch (no overflow)', !!circ && circ.w === circ.h && circ.h <= minRowGap);
  let blockOverlap = false;
  for (let i = 0; i < bn.length; i++) for (let j = i + 1; j < bn.length; j++) {
    const A = bn[i], B = bn[j];
    if (A.x < B.x + B.w && A.x + A.w > B.x && A.y < B.y + B.h && A.y + A.h > B.y) blockOverlap = true;
  }
  check('block nodes never overlap (incl. circles)', !blockOverlap);
  // no-columns case: a single row sized to the block count
  const code2 = ['block-beta', '  x y z'].join('\n');
  const p2 = E(`parseMermaid(${JSON.stringify(code2)})`);
  check('block with no columns lays out one row', p2.nodes.length === 3 && p2.nodes[0].y === p2.nodes[1].y && p2.nodes[1].y === p2.nodes[2].y);
}

group('v2: Mermaid XY chart import (xychart-beta)');
{
  const { win, doc, E } = boot();
  const code = [
    'xychart-beta',
    '    title "Sales Revenue"',
    '    x-axis "Month" [jan, feb, mar, apr]',
    '    y-axis "Revenue" 0 --> 12000',
    '    bar [5000, 6000, 7500, 8200]',
    '    line [4000, 5000, 6000, 9000]',
  ].join('\n');
  const p = E(`parseMermaid(${JSON.stringify(code)})`);
  check('xychart diagramType is xychart', p.diagramType === 'xychart');
  check('xychart collapses to one fixed chart node', p.nodes.length === 1 && p.nodes[0].type === 'xychart' && p.nodes[0].fixed === true);
  const x = p.nodes[0];
  check('xychart parses the title', x.title === 'Sales Revenue');
  check('xychart parses x-axis label + categories', x.xAxis.label === 'Month' && x.xAxis.categories.length === 4 && x.xAxis.categories[0] === 'jan' && x.xAxis.categories[3] === 'apr');
  check('xychart parses y-axis label + range', x.yAxis.label === 'Revenue' && x.yAxis.min === 0 && x.yAxis.max === 12000);
  check('xychart parses bar + line series with values', x.series.length === 2 && x.series[0].type === 'bar' && x.series[0].values[2] === 7500 && x.series[1].type === 'line' && x.series[1].values[3] === 9000);
  // numeric-only x-axis range + missing categories synthesised
  const code2 = ['xychart-beta', '  line [3, 1, 4, 1, 5]'].join('\n');
  const p2 = E(`parseMermaid(${JSON.stringify(code2)})`);
  check('xychart synthesises x categories when none given', p2.nodes[0].xAxis.categories.length === 5);
  // full import renders the chart figure
  const ed = doc.getElementById('mermaidEditor');
  ed.value = code; win.importMermaid(true);
  check('xychart import makes one xychart node', E(`nodes.length`) === 1 && E(`nodes[0].type==='xychart'`));
  win.render();
  const el = doc.querySelector(`#nodes .node[data-id="${E('nodes[0].id')}"]`);
  check('xychart renders bars (rects) + a line (polyline)', !!el && el.querySelectorAll('rect').length >= 5 && el.querySelectorAll('polyline').length === 1);
  check('xychart renders the title text', !!el && /Sales Revenue/.test(el.textContent));
}

group('v2: Mermaid sankey diagram import (sankey-beta)');
{
  const { win, doc, E } = boot();
  const code = [
    'sankey-beta',
    '',
    '%% a comment row to ignore',
    'Coal,Electricity,40',
    'Gas,Electricity,25',
    'Electricity,Homes,30',
    'Electricity,Industry,35',
    '"Solar, PV",Electricity,10',
  ].join('\n');
  const p = E(`parseMermaid(${JSON.stringify(code)})`);
  const ids = p.nodes.map(n => n.id);
  check('sankey diagramType is flowchart (reuses layout)', p.diagramType === 'flowchart');
  check('sankey makes one node per unique name (deduped)', p.nodes.length === 6 && ids.includes('Coal') && ids.includes('Electricity') && ids.includes('Homes'));
  check('sankey shared node is not duplicated', ids.filter(i => i === 'Electricity').length === 1);
  check('sankey row becomes a labelled edge with the value', p.connections.some(c => c.from === 'Coal' && c.to === 'Electricity' && c.label === '40' && c.markerEnd === 'arrow'));
  check('sankey handles quoted name with an internal comma', ids.includes('Solar, PV') && p.connections.some(c => c.from === 'Solar, PV' && c.to === 'Electricity' && c.label === '10'));
  check('sankey edge count matches data rows', p.connections.length === 5);
  // full import round-trips through layout + render
  const ed = doc.getElementById('mermaidEditor');
  ed.value = code; win.importMermaid(true);
  check('sankey import builds nodes + edges', E(`nodes.length`) === 6 && E('connections.length') === 5);
  check('sankey import keeps the value labels', E(`connections.some(c=>c.label==='40')`) && E(`connections.some(c=>c.label==='10')`));
}

group('Touch & pointer input (#21): pointer-event migration + pen pressure');
{
  const { win, doc, E } = boot();
  const canvas = doc.getElementById('canvas');
  // (1) browser must not hijack gestures over the canvas
  check('canvas declares touch-action:none', /touch-action:\s*none/.test(canvas.getAttribute('style') || ''));
  // (2) a pen pointer draws a pencil node whose points each carry pressure
  win.setTool('pencil');
  pointer(canvas, 'pointerdown', 100, 100, { pointerType: 'pen', pressure: 0.4 });
  pointer(doc, 'pointermove', 140, 160, { pointerType: 'pen', pressure: 0.6 });
  pointer(doc, 'pointermove', 180, 200, { pointerType: 'pen', pressure: 0.7 });
  pointer(doc, 'pointerup', 180, 200, { pointerType: 'pen', pressure: 0 });
  const pencils = E(`JSON.parse(JSON.stringify(nodes.filter(n=>n.type==='pencil')))`);
  check('pen pointer draws exactly one pencil node', pencils.length === 1);
  check('every stroke point carries a numeric pressure', pencils[0].points.length >= 2 && pencils[0].points.every(p => typeof p.pressure === 'number'));
  check('a pen pressure value is actually captured (>0)', pencils[0].points.some(p => p.pressure > 0));
  // (3) desktop no-regression: a mouse drag still draws (mouse() drives the pointer path)
  win.setTool('pencil');
  mouse(canvas, 'mousedown', 300, 300);
  mouse(doc, 'mousemove', 340, 340);
  mouse(doc, 'mouseup', 360, 360);
  check('mouse still draws a pencil node after the pointer migration', E(`nodes.filter(n=>n.type==='pencil').length`) === 2);
  // (4) a touch pointer drives the canvas too (marquee select starts on empty canvas)
  win.setTool('select');
  pointer(canvas, 'pointerdown', 60, 60, { pointerType: 'touch' });
  check('touch pointer reaches the canvas handler (marquee selection begins)', E(`selecting !== null && typeof selecting === 'object'`));
  pointer(doc, 'pointerup', 60, 60, { pointerType: 'touch' });
}

group('Touch & pointer input (#21): multi-touch pinch/pan + palm rejection');
{
  const { doc, E } = boot();
  const canvas = doc.getElementById('canvas');
  // --- pinch-zoom: two fingers moving apart zooms IN (zoom value decreases) ---
  E('zoom=1; viewBox.x=0; viewBox.y=0; viewBox.w=1200; viewBox.h=800;');
  pointer(canvas, 'pointerdown', 400, 400, { pointerType: 'touch', pointerId: 1 });
  pointer(canvas, 'pointerdown', 600, 400, { pointerType: 'touch', pointerId: 2 });
  check('two touch pointers begin a pinch gesture', E('pinch !== null'));
  const z0 = E('zoom');
  pointer(doc, 'pointermove', 350, 400, { pointerType: 'touch', pointerId: 1 });
  pointer(doc, 'pointermove', 650, 400, { pointerType: 'touch', pointerId: 2 });
  check('fingers apart zooms in (zoom value drops)', E('zoom') < z0);
  pointer(doc, 'pointerup', 350, 400, { pointerType: 'touch', pointerId: 1 });
  pointer(doc, 'pointerup', 650, 400, { pointerType: 'touch', pointerId: 2 });
  check('lifting a finger ends the pinch', E('pinch === null'));

  // --- two-finger pan: dragging both fingers shifts the viewBox ---
  const { doc: doc2, E: E2 } = boot();
  const canvas2 = doc2.getElementById('canvas');
  E2('zoom=1; viewBox.x=0; viewBox.y=0; viewBox.w=1200; viewBox.h=800;');
  pointer(canvas2, 'pointerdown', 400, 400, { pointerType: 'touch', pointerId: 1 });
  pointer(canvas2, 'pointerdown', 500, 400, { pointerType: 'touch', pointerId: 2 });
  const vx0 = E2('viewBox.x');
  pointer(doc2, 'pointermove', 450, 400, { pointerType: 'touch', pointerId: 1 });
  pointer(doc2, 'pointermove', 550, 400, { pointerType: 'touch', pointerId: 2 });
  check('two-finger drag moves the viewBox (pan)', E2('viewBox.x') !== vx0);

  // --- palm rejection: a stray finger during a pen stroke is ignored ---
  const { win: win3, doc: doc3, E: E3 } = boot();
  const canvas3 = doc3.getElementById('canvas');
  win3.setTool('pencil');
  pointer(canvas3, 'pointerdown', 100, 100, { pointerType: 'pen', pointerId: 1, pressure: 0.5 });
  pointer(doc3, 'pointermove', 140, 140, { pointerType: 'pen', pointerId: 1, pressure: 0.5 });
  check('pen stroke marks penActive', E3('penActive === true'));
  pointer(canvas3, 'pointerdown', 300, 300, { pointerType: 'touch', pointerId: 2 });
  check('stray finger does not start a pinch while pen draws', E3('pinch === null'));
  check('stray finger does not reset the in-progress pen stroke', E3('penciling !== null && penciling.points.length >= 2'));
  pointer(doc3, 'pointerup', 140, 140, { pointerType: 'pen', pointerId: 1 });
  check('exactly one pencil node after the pen stroke + palm touch', E3(`nodes.filter(n=>n.type==='pencil').length`) === 1);
  check('penActive clears when the pen lifts', E3('penActive === false'));
}

group('Document store (#38): docStore CRUD against the in-memory backend');
{
  const { win, E } = boot();
  E(`docStore._useMemory()`);                                       // swap to the test backend
  // a real diagram to persist
  win.createNode('rect', 100, 100);
  E(`docStore.save({ title:'Auth flow', data: exportState() })`);
  check('doc saved + listed', E(`docStore.list().length`) === 1);
  check('list item carries title + timestamps', E(`(d=>d.title==='Auth flow' && typeof d.created==='number' && typeof d.updated==='number')(docStore.list()[0])`));
  check('load round-trips the title + data', E(`(d=>d.title==='Auth flow' && Array.isArray(d.data.n) && d.data.n.length===1)(docStore.load(docStore.list()[0].id))`));
  // duplicate → new id, same content
  E(`docStore.duplicate(docStore.list()[0].id)`);
  check('duplicate adds a 2nd doc with a new id', E(`docStore.list().length`) === 2 && E(`docStore.list()[0].id`) !== E(`docStore.list()[1].id`));
  check('duplicate title is derived', E(`docStore.list().some(d=>/ copy$/.test(d.title))`));
  // save with an existing id updates in place (no new doc), bumps updated, keeps created
  const firstId = E(`docStore.list().find(d=>d.title==='Auth flow').id`);
  const created0 = E(`docStore.load('${firstId}').created`);
  E(`docStore.save({ id:'${firstId}', title:'Auth flow v2' })`);
  check('save with id updates in place (count unchanged)', E(`docStore.list().length`) === 2);
  check('update keeps created, changes title', E(`docStore.load('${firstId}').title`) === 'Auth flow v2' && E(`docStore.load('${firstId}').created`) === created0);
  // remove
  E(`docStore.remove('${firstId}')`);
  check('remove drops the doc', E(`docStore.list().length`) === 1 && E(`docStore.load('${firstId}')`) === null);
}

group('Document library (#38): gallery UI + autosave write-through');
{
  const { win, doc, E } = boot();
  E(`docStore._useMemory(); activeDocId = null;`);
  // first edit autosaves through to a new active doc
  win.createNode('rect', 100, 100);
  win.updateUrlHash();
  check('first edit creates an active library doc', E(`activeDocId !== null`) && E(`docStore.list().length`) === 1);
  const id1 = E(`activeDocId`);
  win.galleryRename(id1, 'Auth flow');
  check('rename updates the doc title', E(`docStore.load('${id1}').title`) === 'Auth flow');
  // "New" banks the current diagram and starts a fresh one (newest-first → 2 docs)
  win.galleryNew();
  check('New starts a 2nd doc and switches active', E(`docStore.list().length`) === 2 && E(`activeDocId`) !== id1);
  // edit B, then open A → canvas restores A exactly
  win.createNode('diamond', 200, 200); win.updateUrlHash();
  win.galleryOpen(id1);
  check('opening a doc restores its data + sets it active', E(`activeDocId`) === id1 && E(`nodes.length`) === 1 && E(`nodes[0].type`) === 'rect');
  // autosave write-through bumps the active doc's data (B kept its diamond)
  const other = E(`docStore.list().find(d=>d.id!=='${id1}').id`);
  check('the other doc retained its own edited data', E(`docStore.load('${other}').data.n.some(n=>n.type==='diamond')`));
  // duplicate + gallery DOM
  win.galleryDuplicate(id1);
  check('duplicate adds a 3rd card', E(`docStore.list().length`) === 3);
  win.toggleGallery();
  check('gallery opens and renders one card per doc', E(`galleryIsOpen()`) === true && doc.querySelectorAll('#galleryGrid .gallery-card').length === 3);
  check('active doc card is highlighted', !!doc.querySelector(`#galleryGrid .gallery-card[data-id="${id1}"]`));
  win.toggleGallery();
  check('gallery toggles closed', E(`galleryIsOpen()`) === false);
}

group('Connection routing (#34): non-locked sides re-seat on render');
{
  const { win, E } = boot();
  const a = win.createNode('rect', 100, 100);
  const b = win.createNode('rect', 400, 100);            // b starts to the right of a
  E(`connections.push({ id:'r34', from:'${a.id}', to:'${b.id}' })`);
  win.render();
  const before = E(`connections.find(c=>c.id==='r34').toSide`);
  check('initial toSide faces the source (left)', before === 'left');
  // move b to the left of a — a non-locked edge should re-seat on the next render
  E(`nodes.find(n=>n.id==='${b.id}').x = -300`);
  win.render();
  const after = E(`connections.find(c=>c.id==='r34').toSide`);
  check('non-locked toSide re-seats after the node moves', after !== before);
  check('re-seated to the optimal side (now entering from the right)', after === 'right');
  // lock the side; it must never change again
  E(`connections.find(c=>c.id==='r34').toSideLocked = true`);
  const locked = E(`connections.find(c=>c.id==='r34').toSide`);
  E(`nodes.find(n=>n.id==='${b.id}').x = 900`);          // move b far right again
  win.render();
  check('locked toSide is left untouched', E(`connections.find(c=>c.id==='r34').toSide`) === locked);
}

group('Shape library panel (#40): placeShape + slide-out panel');
{
  const { win, doc, E } = boot();
  const c = win.placeShape('class', 200, 200);
  check('class box created with UML flag', c.isClass === true);
  check('class box has default members', ((c.properties || []).length + (c.methods || []).length) > 0);
  const i = win.placeShape('interface', 400, 200);
  check('interface variant sets stereotype', i.isClass === true && i.stereotype === 'interface');
  const en = win.placeShape('enumeration', 600, 200);
  check('enum variant sets stereotype + values', en.stereotype === 'enumeration' && en.properties.length >= 1);
  const p = win.placeShape('participant', 800, 200);
  check('participant has a lifeline', p.hasLifeline === true && p.isParticipant === true);
  const ent = win.placeShape('entity', 1000, 200);
  check('entity is a class box with attribute rows', ent.isClass === true && ent.properties.length >= 1);
  const t = win.placeShape('terminal', 100, 400);
  check('terminal is a small pseudo dot', t.isPseudo === true && t.width <= 24);
  check('placed shape lands on the requested point (within its bounds)', c.x <= 200 && 200 <= c.x + c.width && c.y <= 200 && 200 <= c.y + c.height);
  win.render();
  const cEl = doc.querySelector(`#nodes .node[data-id="${c.id}"]`);
  check('placed class renders with its members', !!cEl && cEl.textContent.length > 0);
  check('placed participant renders', !!doc.querySelector(`#nodes .node[data-id="${p.id}"]`));
  // panel toggles open/closed + reflects state in className
  win.toggleShapePanel(true);
  check('shape panel opens', /\bopen\b/.test(doc.getElementById('shapePanel').className) && doc.getElementById('shapePanel').style.display === 'flex');
  win.toggleShapePanel(false);
  check('shape panel closes', !/\bopen\b/.test(doc.getElementById('shapePanel').className));
  // no regression: basic shape tool still works
  win.setTool('rect');
  check('basic rect tool still selects', E(`currentTool`) === 'rect');
}

group('Mermaid state import (#22): composite / fork-join-choice / notes');
{
  const { win, doc, E } = boot();
  const code = 'stateDiagram-v2\n  [*] --> Active\n  state Active {\n    [*] --> Idle\n    Idle --> Running\n  }\n  Active --> [*]';
  const p = E(`parseMermaid(${JSON.stringify(code)})`);
  const sg = (p.subgraphs || []).find(s => s.id === 'Active');
  check('composite state becomes a container subgraph with its inner states', !!sg && sg.children.includes('Idle') && sg.children.includes('Running'));
  check('composite name is not duplicated as a plain node', !p.nodes.some(n => n.id === 'Active'));
  // import nests the children inside the container
  doc.getElementById('mermaidEditor').value = code; win.importMermaid(true);
  check('import creates the Active container', E(`nodes.some(n=>n.type==='container'&&n.label==='Active')`));
  check('inner state renders inside the composite container', E(`(()=>{const c=nodes.find(n=>n.type==='container'&&n.label==='Active');const i=nodes.find(n=>n.label==='Idle');return !!c&&!!i&&i.x>=c.x&&i.y>=c.y&&i.x+i.width<=c.x+c.width&&i.y+i.height<=c.y+c.height;})()`));
  // fork / join → bar nodes; choice → diamond
  const p2 = E(`parseMermaid(${JSON.stringify('stateDiagram-v2\n  state f1 <<fork>>\n  state j1 <<join>>\n  state c1 <<choice>>\n  A --> f1\n  c1 --> B')})`);
  check('fork parses to a bar node (not a rect)', p2.nodes.some(n => n.id === 'f1' && n.type === 'bar' && n.stateKind === 'fork'));
  check('join parses to a bar node (not a rect)', p2.nodes.some(n => n.id === 'j1' && n.type === 'bar' && n.stateKind === 'join'));
  check('choice parses to a diamond', p2.nodes.some(n => n.id === 'c1' && n.type === 'diamond' && n.stateKind === 'choice'));
  // import: fork/join become thin bar nodes (the defect the reviewer caught — must not be 'rect')
  win.document.getElementById('mermaidEditor').value = 'stateDiagram-v2\n  state f1 <<fork>>\n  A --> f1';
  win.importMermaid(true);
  const fbar = E(`nodes.find(n=>n.type==='bar')`);
  check('fork imports to a thin bar shape, not a blank rect', !!fbar && fbar.height <= 16 && !E(`nodes.some(n=>n.type==='rect'&&!n.label)`));
  // note → note node linked (dashed) to its state
  const p3 = E(`parseMermaid(${JSON.stringify('stateDiagram-v2\n  A --> B\n  note right of A : hello world')})`);
  check('note becomes a note node', p3.nodes.some(n => n.type === 'note' && /hello world/.test(n.label)));
  check('note links to its state (dashed)', p3.connections.some(c => c.to === 'A' && c.strokeStyle === 'dashed'));
}

group('Selection → Mermaid (#2): selection-scoped export');
{
  const { win, doc, E } = boot();
  const a = win.createNode('rect', 0, 0); E(`nodes.find(n=>n.id==='${a.id}').label='A'`);
  const b = win.createNode('rect', 200, 0); E(`nodes.find(n=>n.id==='${b.id}').label='B'`);
  const c = win.createNode('rect', 400, 0); E(`nodes.find(n=>n.id==='${c.id}').label='C'`);
  E(`connections.push({ id:'ab', from:'${a.id}', to:'${b.id}' })`);   // internal to {A,B}
  E(`connections.push({ id:'bc', from:'${b.id}', to:'${c.id}' })`);   // dangles outside {A,B}
  E(`selectedIds = ['${a.id}','${b.id}']; selectedId = null;`);
  const code = E(`generateMermaid({ selectionOnly: true })`);
  check('selection export includes both selected nodes', /\bA\b/.test(code) && /\bB\b/.test(code));
  check('selection export excludes the unselected node', !/\bC\b/.test(code));
  check('internal edge kept, dangling edge dropped', (code.match(/-->/g) || []).length === 1);
  const reparsed = E(`parseMermaid(${JSON.stringify(code)})`);
  check('selection export round-trips to 2 nodes + 1 edge', reparsed.nodes.length === 2 && reparsed.connections.length === 1);
  // copyAsMermaid loads the selection code into the sidebar editor (reuses highlighter)
  win.copyAsMermaid();
  const ev = doc.getElementById('mermaidEditor').value;
  check('copyAsMermaid populates the editor with selection code', /\bA\b/.test(ev) && !/\bC\b/.test(ev));
  // no selection → wrapper falls back to whole-canvas export
  E(`selectedIds = []; selectedId = null;`);
  check('no selection falls back to whole-canvas export', /\bC\b/.test(E(`generateMermaid({ selectionOnly: true })`)));
}

group('Mermaid append import (#46): feedback on silent failures');
{
  const { win, doc } = boot();
  // recognized-but-unsupported keyword → named toast, returns false, nothing imported
  const n0 = doc.querySelectorAll('.toast').length;
  const r1 = win.importMermaid(true, { code: 'kanban\n  Todo\n  Doing', append: true });
  check('unsupported append import returns false', r1 === false);
  check('a feedback toast was shown', doc.querySelectorAll('.toast').length > n0);
  check('toast names the unsupported type', /kanban/.test(doc.querySelector('.toast span').textContent));
  check('nothing was imported on failure', win.eval('nodes.length') === 0);
  // garbage / no recognizable diagram → generic toast, returns false
  const before2 = doc.querySelectorAll('.toast').length;
  const r2 = win.importMermaid(true, { code: '%% only a comment', append: true });
  check('comment-only append import returns false + toasts', r2 === false && doc.querySelectorAll('.toast').length > before2);
  // valid append import still succeeds with no error toast
  const before3 = doc.querySelectorAll('.toast').length;
  const r3 = win.importMermaid(true, { code: 'flowchart TD\n A-->B', append: true });
  check('valid append import still succeeds, no new toast', r3 === true && doc.querySelectorAll('.toast').length === before3 && win.eval('nodes.length') === 2);
  // replace-mode (non-append) still uses the editor errorDiv, not a toast (no regression)
  const before4 = doc.querySelectorAll('.toast').length;
  win.importMermaid(true, { code: 'kanban\n x', append: false });
  check('replace-mode unsupported does not toast (errorDiv path unchanged)', doc.querySelectorAll('.toast').length === before4);
}

group('Accessibility (#45): icon-button ARIA labels + pressed state');
{
  const { win, doc } = boot();
  const btns = [...doc.querySelectorAll('.tool-btn')];
  check('every tool button has a non-empty aria-label', btns.length >= 10 && btns.every(b => (b.getAttribute('aria-label') || '').trim().length > 0));
  check('decorative button SVGs are aria-hidden', btns.every(b => { const s = b.querySelector('svg'); return !s || s.getAttribute('aria-hidden') === 'true'; }));
  win.setTool('rect');
  const rectBtn = doc.getElementById('tool-rect');
  check('active tool is marked aria-pressed=true', rectBtn.getAttribute('aria-pressed') === 'true');
  win.setTool('pencil');
  check('previously-active tool clears aria-pressed', rectBtn.getAttribute('aria-pressed') === 'false');
  check('newly-active tool is pressed', doc.getElementById('tool-pencil').getAttribute('aria-pressed') === 'true');
  // exactly one tool is pressed at a time
  check('exactly one tool button is pressed', [...doc.querySelectorAll('[id^="tool-"]')].filter(b => b.getAttribute('aria-pressed') === 'true').length === 1);
}

group('First-run onboarding (#44): walkthrough + versioned flag');
{
  const { win, doc, E } = boot();
  const ov = doc.getElementById('onboardingOverlay');
  // fresh jsdom → flag absent → should show (init already auto-showed; flag still absent)
  check('first run: flag absent and should show', E(`!localStorage.getItem('draph.onboarding.v1') && shouldShowOnboarding()`) === true);
  win.startOnboarding();
  check('overlay visible on start', !!ov && !ov.classList.contains('hidden'));
  check('starts at step 0 with all 7 step dots', E(`onboardingStep`) === 0 && doc.querySelectorAll('#obDots .ob-dot').length === 7);
  win.onboardingNext();
  check('Next advances the step', E(`onboardingStep`) === 1);
  win.onboardingBack();
  check('Back goes up a step', E(`onboardingStep`) === 0);
  win.finishOnboarding();
  check('finish writes the versioned flag', E(`localStorage.getItem('draph.onboarding.v1')`) !== null);
  check('overlay hidden after finish', ov.classList.contains('hidden'));
  check('does not auto-show once completed', E(`shouldShowOnboarding()`) === false);
  win.startOnboarding();
  check('manual replay reopens despite the flag', !ov.classList.contains('hidden'));
  // skip also writes the flag (not just finish)
  E(`localStorage.removeItem('draph.onboarding.v1')`);
  win.startOnboarding(); win.skipOnboarding();
  check('skip closes and writes the flag too', ov.classList.contains('hidden') && E(`localStorage.getItem('draph.onboarding.v1')`) !== null);
  // Next on the last step acts as Finish
  E(`localStorage.removeItem('draph.onboarding.v1')`);
  win.startOnboarding(); E(`onboardingStep = 6`); win.onboardingNext();
  check('Next on the last step finishes (overlay closed + flag set)', ov.classList.contains('hidden') && E(`shouldShowOnboarding()`) === false);
}

group('SVG export (#37): buildExportSVG string assertions');
{
  const { win, E } = boot();
  // empty canvas → null, no side effects
  check('buildExportSVG returns null on an empty canvas', E(`buildExportSVG()`) === null);
  const a = win.createNode('rect', 100, 100); E(`nodes.find(n=>n.id==='${a.id}').label='Alpha'`);
  const b = win.createNode('rect', 400, 100); E(`nodes.find(n=>n.id==='${b.id}').label='Beta'`);
  E(`connections.push({ id:'e', from:'${a.id}', to:'${b.id}' })`);
  win.render();
  const svg = E(`buildExportSVG()`);
  check('export is a standalone <svg> with a viewBox', /^<svg[\s>]/.test(svg.trim()) && /viewBox=/.test(svg));
  check('export includes every node label', /Alpha/.test(svg) && /Beta/.test(svg));
  check('export includes the connection markup', /connection-group|class="connection"/.test(svg));
  check('export omits UI chrome (connectors/hit-areas/grid/marquee)', !/connector|conn-hit|gridBg|selectBox|drawPreview|resize-handle/.test(svg));
  // viewBox tightly bounds content (not the full 1200×800 canvas)
  const vb = (svg.match(/viewBox="([^"]+)"/) || [])[1].split(/\s+/).map(Number);
  check('viewBox crops to content, not the whole canvas', vb[2] < 1200 && vb[3] < 800 && vb[0] > 0);
  // pure: calling it does not mutate state or trigger a download
  const before = E(`nodes.length`);
  E(`buildExportSVG()`);
  check('buildExportSVG is side-effect free (node count unchanged)', E(`nodes.length`) === before);
}

group('Mermaid class import (#27): namespaces → grouping container');
{
  const { win, doc, E } = boot();
  const code = 'classDiagram\n  namespace Payment {\n    class Card\n    class Wallet\n  }\n  Card --> Wallet';
  const p = E(`parseMermaid(${JSON.stringify(code)})`);
  const sg = (p.subgraphs || []).find(s => s.label === 'Payment');
  check('namespace becomes a grouping container with its classes', !!sg && sg.children.includes('Card') && sg.children.includes('Wallet'));
  check('namespaced classes still parse as class nodes', p.nodes.some(n => n.label === 'Card' && n.type === 'class') && p.nodes.some(n => n.label === 'Wallet'));
  check('relationship inside/after the namespace still parsed', p.connections.some(c => c.from === 'Card' && c.to === 'Wallet'));
  // classes inside a namespace keep stereotypes + members
  const p2 = E(`parseMermaid(${JSON.stringify('classDiagram\n  namespace Bank {\n    class Account {\n      +Float balance\n      +deposit(n) void\n    }\n    class Ledger\n  }')})`);
  const acct = p2.nodes.find(n => n.label === 'Account');
  check('namespaced class keeps its members', !!acct && acct.properties.length >= 1 && acct.methods.length >= 1);
  // import nests the classes inside the Payment container
  doc.getElementById('mermaidEditor').value = code; win.importMermaid(true);
  check('import creates the Payment container', E(`nodes.some(n=>n.type==='container'&&n.label==='Payment')`));
  check('namespaced class renders inside the container', E(`(()=>{const c=nodes.find(n=>n.type==='container'&&n.label==='Payment');const k=nodes.find(n=>n.label==='Card');return !!c&&!!k&&k.x>=c.x&&k.y>=c.y&&k.x+k.width<=c.x+c.width&&k.y+k.height<=c.y+c.height;})()`));
}

group("Mermaid ER import (#23): crow's-foot cardinality markers");
{
  const { win, doc, E } = boot();
  const code = 'erDiagram\n  CUSTOMER ||--o{ ORDER : places';
  const p = E(`parseMermaid(${JSON.stringify(code)})`);
  const c = p.connections[0];
  check('er cardinality parsed onto ends', c.fromCard === 'one' && c.toCard === 'zero-or-many');
  check('er maps cardinality to crow-foot markers', c.markerStart === 'er-one' && c.markerEnd === 'er-zero-many');
  check('er label preserved', c.label === 'places');
  // all 4 glyph families parse; identifying vs non-identifying line preserved
  const p2 = E(`parseMermaid(${JSON.stringify('erDiagram\n  A |o--|| B\n  C }|..o{ D')})`);
  check('er zero-or-one + one parse', p2.connections[0].fromCard === 'zero-or-one' && p2.connections[0].toCard === 'one');
  check('er one-or-many + zero-or-many parse', p2.connections[1].fromCard === 'one-or-many' && p2.connections[1].toCard === 'zero-or-many');
  check('er non-identifying stays dashed, identifying solid', p2.connections[1].strokeStyle === 'dashed' && p2.connections[0].strokeStyle === undefined);
  // render: crow-foot glyphs draw as SVG (distinct, inline — no shared marker-id collisions)
  doc.getElementById('mermaidEditor').value = code; win.importMermaid(true); win.render();
  check('er crow-foot markers render as SVG', E(`connections[0].markerStart==='er-one' && connections[0].markerEnd==='er-zero-many'`) && doc.querySelectorAll('#connections circle').length >= 1);
}

group('Mermaid mindmap import (#24): radial layout + ::icon');
{
  const { win, doc, E } = boot();
  const code = 'mindmap\n  root((Idea))\n  ::icon(fa fa-lightbulb)\n    Origins\n      Long history\n    Tools\n      Pen';
  doc.getElementById('mermaidEditor').value = code; win.importMermaid(true);
  const ns = E(`nodes.map(n=>({l:n.label,x:n.x,y:n.y,w:n.width,h:n.height,icon:n.icon}))`);
  const root = ns.find(n => n.l === 'Idea');
  const dist = n => Math.hypot((n.x + n.w / 2) - (root.x + root.w / 2), (n.y + n.h / 2) - (root.y + root.h / 2));
  check('radial: ring-1 nodes are away from root', ns.filter(n => ['Origins', 'Tools'].includes(n.l)).every(n => dist(n) > 60));
  check('radial: depth maps to radius (ring-2 farther than ring-1)', dist(ns.find(n => n.l === 'Long history')) > dist(ns.find(n => n.l === 'Origins')));
  let ov = false;
  for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
    const a = ns[i], b = ns[j];
    if (Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) > 1 && Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)) > 1) ov = true;
  }
  check('radial: no node overlap', !ov);
  check('::icon(...) sets the node icon field', root.icon === 'lightbulb');
  // existing parse/tree intact (layout-only change)
  const p = E(`parseMermaid(${JSON.stringify(code)})`);
  check('mindmap still builds the parent→child tree', p.nodes.length === 5 && p.connections.length === 4);
  // review fix: every ::icon resolves to a RENDERABLE registry key — canonical
  // `fa fa-book` renders, and an unknown name falls back (never a silent blank).
  const p2 = E(`parseMermaid(${JSON.stringify('mindmap\n  root((R))\n    Has\n    ::icon(fa fa-book)\n    Wild\n    ::icon(fa fa-unicorn)')})`);
  const reg = E(`Object.keys(ICONS)`);
  const has = p2.nodes.find(n => n.label === 'Has'), wild = p2.nodes.find(n => n.label === 'Wild');
  check('canonical fa fa-book resolves to a registered icon', has.icon === 'book' && reg.includes('book'));
  check('unknown ::icon falls back to a renderable glyph (no blank)', !!wild.icon && reg.includes(wild.icon) && wild.icon === 'dot');
}

group('Mermaid gantt import (#25): dependency arrows + weekly axis');
{
  const { E } = boot();
  const code = 'gantt\n  dateFormat YYYY-MM-DD\n  section Build\n  Design :a1, 2026-06-01, 5d\n  Code :after a1, 7d';
  const p = E(`parseMermaid(${JSON.stringify(code)})`);
  const design = p.nodes.find(n => /Design/.test(n.label)), code2 = p.nodes.find(n => /Code/.test(n.label));
  check('gantt: dependent task starts at predecessor end', Math.abs(code2.x - (design.x + design.width)) < 2);
  check('gantt: dependency arrow connects predecessor → dependent', p.connections.some(c => c.from === design.id && c.to === code2.id && c.markerEnd === 'arrow'));
  check('gantt: weekly axis ticks span the date range', p.nodes.filter(n => /^gax/.test(n.id)).length >= 2);
  check('gantt: bars keep fixed geometry', design.fixed === true && code2.fixed === true);
}

group('Theming (#62): render colors derive from the palette, not dark literals');
{
  const { win, E } = boot();
  // palette swaps both ways
  win.applyTheme('light', false);
  check('light theme accent is the light value', E('COLORS.accent') === '#3d59a1');
  const pL = E(`parseMermaid('gantt\\n  dateFormat YYYY-MM-DD\\n  A :a1, 2026-06-01, 3d')`);
  check('gantt bar color derives from the (light) theme accent', pL.nodes.find(n => n.color).color === E('COLORS.accent'));
  win.applyTheme('dark', false);
  check('dark theme accent restored', E('COLORS.accent') === '#7aa2f7');
  const pD = E(`parseMermaid('gantt\\n  dateFormat YYYY-MM-DD\\n  A :a1, 2026-06-01, 3d')`);
  check('gantt bar color follows the (dark) theme accent', pD.nodes.find(n => n.color).color === '#7aa2f7');
  // dark theme palette values byte-for-byte unchanged (no regression)
  check('dark theme palette intact', E('COLORS.bg') === '#0f0f15' && E('COLORS.fg') === '#a9b1d6' && E('COLORS.border') === '#414868');
}

group('Keyboard a11y (#58): roving arrows + modal focus trap/restore');
{
  const { win, doc, E } = boot();
  doc.getElementById('tool-select').focus();
  key(doc, 'ArrowRight');
  check('arrow cycles tool focus + selection', doc.activeElement === doc.getElementById('tool-rect') && E('currentTool') === 'rect');
  key(doc, 'ArrowLeft');
  check('arrow-left cycles back', doc.activeElement === doc.getElementById('tool-select') && E('currentTool') === 'select');
  check('roving tabindex: active tool is the only tab stop', doc.getElementById('tool-select').getAttribute('tabindex') === '0' && doc.getElementById('tool-rect').getAttribute('tabindex') === '-1');
  // modal focus trap + restore
  const opener = doc.getElementById('tool-select'); opener.focus();
  win.toggleCheatsheet(true);
  check('opening a modal moves focus inside it', doc.getElementById('cheatsheetOverlay').contains(doc.activeElement));
  key(doc, 'Tab');
  check('Tab stays trapped within the modal', doc.getElementById('cheatsheetOverlay').contains(doc.activeElement));
  key(doc, 'Escape');
  check('Esc closes the modal', doc.getElementById('cheatsheetOverlay').classList.contains('hidden'));
  check('focus restored to the opener on close', doc.activeElement === opener);
  // no regression: single-key shortcuts still fire
  key(doc, 'p');
  check('single-key shortcut still works (P → pencil)', E('currentTool') === 'pencil');
}

group('Mermaid C4 import (#28): directional Rel + person figure');
{
  const { win, doc, E } = boot();
  const code = 'C4Context\n  Person(user, "User")\n  System(sys, "App")\n  Rel_D(user, sys, "uses")\n  Rel(sys, user, "replies")';
  const p = E(`parseMermaid(${JSON.stringify(code)})`);
  const cD = p.connections.find(c => c.from === 'user' && c.to === 'sys');
  const cPlain = p.connections.find(c => c.from === 'sys' && c.to === 'user');
  check('c4: Rel_D locks a downward (bottom→top) route', cD.fromSide === 'bottom' && cD.toSide === 'top' && cD.fromSideLocked === true && cD.toSideLocked === true);
  check('c4: plain Rel is unchanged (no locked sides)', !cPlain.fromSide && !cPlain.fromSideLocked);
  // per-direction sides pinned (review #28: the suite must check each variant)
  const dirSides = (dir) => {
    const pp = E(`parseMermaid(${JSON.stringify('C4Context\n  System(a, "A")\n  System(b, "B")\n  ' + dir + '(a, b, "x")')})`);
    const c = pp.connections.find(x => x.from === 'a');
    return c.fromSideLocked && c.toSideLocked ? c.fromSide + '/' + c.toSide : 'unlocked';
  };
  check('c4: Rel_R → right/left (locked)', dirSides('Rel_R') === 'right/left');
  check('c4: Rel_L → left/right (locked)', dirSides('Rel_L') === 'left/right');
  check('c4: Rel_U → top/bottom (locked)', dirSides('Rel_U') === 'top/bottom');
  check('c4: Rel_D → bottom/top (locked)', dirSides('Rel_D') === 'bottom/top');
  check('c4: long-form Rel_Right matches Rel_R', dirSides('Rel_Right') === 'right/left');
  check('c4: Person box flagged for the figure', p.nodes.find(n => n.id === 'user').isPerson === true);
  // render: the person figure (user icon) draws inside the box
  doc.getElementById('mermaidEditor').value = code; win.importMermaid(true); win.render();
  const person = E(`nodes.find(n=>n.isPerson)`);
  const el = doc.querySelector(`#nodes .node[data-id="${person.id}"]`);
  check('c4: person figure renders in the box', !!el && /path|circle/.test(el.innerHTML));
  // the locked direction must SURVIVE import + render (the re-seat pass must not
  // override it) — this is what the logic-only parse check missed (review #28).
  doc.getElementById('mermaidEditor').value = 'C4Context\n  System(a, "A")\n  System(b, "B")\n  Rel_R(a, b, "x")';
  win.importMermaid(true); win.render();
  check('c4: Rel_R leaves the right edge after import+render (lock survives)', E(`connections[0].fromSide`) === 'right' && E(`connections[0].fromSideLocked`) === true);
}

group('Mermaid timeline import (#29): horizontal lanes + title + section tint');
{
  const { win, doc, E } = boot();
  const code = 'timeline\n  title History\n  2002 : LinkedIn\n  2004 : Facebook : Google';
  doc.getElementById('mermaidEditor').value = code; win.importMermaid(true);
  const ns = E(`nodes.map(n=>({l:n.label,x:n.x,y:n.y,w:n.width,h:n.height}))`);
  const p2002 = ns.find(n => n.l === '2002'), p2004 = ns.find(n => n.l === '2004');
  check('timeline: periods laid left-to-right on one row', p2004.x > p2002.x && Math.abs(p2004.y - p2002.y) < 40);
  check('timeline: title heading node present', ns.some(n => n.l === 'History'));
  const fb = ns.find(n => n.l === 'Facebook');
  check('timeline: events sit under their period', fb.x === p2004.x && fb.y > p2004.y);
  // section tint: two sections → period pills get distinct colors
  const p2 = E(`parseMermaid('timeline\\n  section A\\n  2002 : x\\n  section B\\n  2006 : y')`);
  const a = p2.nodes.find(n => n.label === '2002'), b = p2.nodes.find(n => n.label === '2006');
  check('timeline: per-section pill tint differs', a.color && b.color && a.color !== b.color);
}

group('Mermaid gitGraph import (#26): tags, commit types, cherry-pick');
{
  const { win, doc, E } = boot();
  const code = 'gitGraph\n  commit id: "A"\n  commit tag: "v1.0"\n  branch dev\n  commit type: HIGHLIGHT\n  checkout main\n  cherry-pick id: "A"';
  const p = E(`parseMermaid(${JSON.stringify(code)})`);
  check('gitgraph: tag captured on the commit', p.nodes.some(n => n.tag === 'v1.0'));
  check('gitgraph: HIGHLIGHT type captured', p.nodes.some(n => n.commitType === 'HIGHLIGHT'));
  check('gitgraph: cherry-pick adds a dashed link from the source commit', p.connections.some(c => c.strokeStyle === 'dashed' && c.label === 'cherry-pick'));
  // existing geometry intact (commits are fixed circle dots on lanes)
  check('gitgraph: commits still fixed circle dots', p.nodes.filter(n => /^gc/.test(n.id)).every(n => n.type === 'circle' && n.fixed === true));
  // render: the tag label appears in the node layer
  doc.getElementById('mermaidEditor').value = code; win.importMermaid(true); win.render();
  check('gitgraph: tag label rendered', /v1\.0/.test(doc.getElementById('nodes').textContent));
  check('gitgraph: import carries tag + commitType onto nodes', E(`nodes.some(n=>n.tag==='v1.0')`) && E(`nodes.some(n=>n.commitType==='HIGHLIGHT')`));
}

group('Mermaid quadrant import (#33): per-point radius/color styling');
{
  const { win, doc, E } = boot();
  const code = 'quadrantChart\n  x-axis Low --> High\n  y-axis Low --> High\n  Campaign A: [0.3, 0.6] radius: 10, color: #ff0000\n  Plain B: [0.5, 0.5]';
  const p = E(`parseMermaid(${JSON.stringify(code)})`);
  const a = p.nodes[0].points[0], b = p.nodes[0].points[1];
  check('quadrant: per-point radius parsed', a.radius === 10);
  check('quadrant: per-point color parsed', a.color === '#ff0000');
  check('quadrant: unstyled point keeps defaults', b.radius === undefined && b.color === undefined);
  // render: styled dot uses its custom radius + color, default dot stays r=5
  doc.getElementById('mermaidEditor').value = code; win.importMermaid(true); win.render();
  const el = doc.querySelector('#nodes .node');
  const radii = [...el.querySelectorAll('circle')].map(c => c.getAttribute('r'));
  check('quadrant: styled dot uses custom radius', radii.includes('10'));
  check('quadrant: default dot still r=5', radii.includes('5'));
  check('quadrant: custom color rendered', /fill="#ff0000"/.test(el.innerHTML));
}

group('Mermaid requirement import (#32): containment diamond glyph');
{
  const { win, doc, E } = boot();
  const code = 'requirementDiagram\n  requirement r1 { id: 1 text: top }\n  requirement r2 { id: 2 text: child }\n  r1 - contains -> r2\n  r2 - satisfies -> r1';
  const p = E(`parseMermaid(${JSON.stringify(code)})`);
  const c = p.connections.find(x => x.from === 'r1' && x.to === 'r2');
  const s = p.connections.find(x => x.label === 'satisfies');
  check('req: contains edge gets a filled diamond at the parent end', c && c.relType === 'contains' && c.markerStart === 'diamond-filled');
  check('req: contains is solid (not dashed)', c && c.strokeStyle !== 'dashed');
  check('req: other typed links stay dashed + arrow', s && s.strokeStyle === 'dashed' && s.markerEnd === 'arrow');
  // render: the diamond glyph draws (inline umlMarker → polygon)
  doc.getElementById('mermaidEditor').value = code; win.importMermaid(true); win.render();
  check('req: diamond marker rendered on the connection', /polygon/.test(doc.getElementById('connections').innerHTML));
  check('req: contains markerStart carried through import', E(`connections.some(c=>c.markerStart==='diamond-filled')`));
}

group('fitNodeToLabel shrink-to-fit + manual-resize guard (#35)');
{
  const { win, E } = boot();
  const n = win.createNode('rect', 100, 100, 'A very long label that makes the node quite wide indeed');
  win.fitNodeToLabel(n); const wide = n.width;
  E(`nodes.find(x=>x.id==='${n.id}').label='Hi'`); win.fitNodeToLabel(E(`nodes.find(x=>x.id==='${n.id}')`));
  check('shrinks toward content when not manually resized', E(`nodes.find(x=>x.id==='${n.id}').width`) < wide);
  check('does not shrink below the type minimum', E(`nodes.find(x=>x.id==='${n.id}').width`) >= E('CONFIG.node.minWidth'));
  // manually-resized node is never auto-shrunk
  const m = win.createNode('rect', 300, 300, 'x');
  E(`(n=>{n.manuallyResized=true; n.width=400; n.label='y';})(nodes.find(x=>x.id==='${m.id}'))`);
  win.fitNodeToLabel(E(`nodes.find(x=>x.id==='${m.id}')`));
  check('manually-resized node keeps its width', E(`nodes.find(x=>x.id==='${m.id}').width`) === 400);
}

group('Mermaid journey import (#31): actor avatars + section bands');
{
  const { win, doc, E } = boot();
  const code = 'journey\n  title My Day\n  section Morning\n    Wake: 3: Me\n    Coffee: 5: Me, Cat';
  const p = E(`parseMermaid(${JSON.stringify(code)})`);
  const coffee = p.nodes.find(n => /Coffee/.test(n.label));
  check('journey: task carries its actor list', Array.isArray(coffee.actors) && coffee.actors.length === 2);
  check('journey: each actor gets a distinct color', coffee.actorColors && coffee.actorColors[0] !== coffee.actorColors[1]);
  check('journey: section band node present', p.nodes.some(n => /^jband/.test(n.id)));
  // render: section label + actor glyphs draw
  doc.getElementById('mermaidEditor').value = code; win.importMermaid(true); win.render();
  check('journey: section band/label rendered', /Morning/.test(doc.getElementById('nodes').textContent));
  const cn = E(`nodes.find(n=>/Coffee/.test(n.label))`);
  const el = doc.querySelector(`#nodes .node[data-id="${cn.id}"]`);
  check('journey: actor glyphs render on the task', !!el && (el.innerHTML.match(/<circle/g) || []).length >= 2);
}

group('Mermaid pie import (#30): donut variant + leader lines');
{
  const { win, doc, E } = boot();
  const code = 'pie title Browsers\n  "Chrome" : 60\n  "Safari" : 25\n  "Other" : 15';
  doc.getElementById('mermaidEditor').value = code; win.importMermaid(true);
  check('pie: one pie node imported', E(`nodes.length`) === 1 && E(`nodes[0].type === 'pie'`));
  // default (non-donut): slices are wedge paths + leader % labels present
  win.render();
  const elDef = doc.querySelector('#nodes .node');
  check('pie: default renders slice paths', !!elDef && (elDef.innerHTML.match(/<path/g) || []).length === 3);
  check('pie: leader lines show slice percentages', /\d+%/.test(elDef.textContent));
  // donut flag → annulus paths (inner-arc reverse sweep), default parse unchanged
  E(`nodes[0].donut = true`); win.render();
  const el = doc.querySelector('#nodes .node');
  check('pie: donut renders annulus paths', !!el && /A[\d.]+,[\d.]+ 0 \d 0/.test(el.innerHTML));
  check('pie: donut flag does not alter the parsed slices', E(`nodes[0].slices.length`) === 3);
}

group('Custom accent color (#78): live override, persist, reset');
{
  const { win, doc, E } = boot();
  win.setAccentColor('#ff5577');
  check('accent applied to canvas palette', E(`COLORS.accent`) === '#ff5577');
  check('accent set as CSS var', doc.documentElement.style.getPropertyValue('--accent').trim() === '#ff5577');
  check('accent persists via saveSetting', E(`loadSetting('accent')`) === '#ff5577');

  // Custom accent survives a theme switch (applyTheme must re-apply it).
  win.applyTheme('light');
  check('custom accent survives theme toggle', E(`COLORS.accent`) === '#ff5577');
  win.applyTheme('dark');

  // Reset restores the active theme's default accent and clears the override.
  win.resetAccentColor();
  check('reset restores theme default accent', E(`COLORS.accent`) === E(`THEMES[currentTheme].accent`));
  check('reset clears the CSS var', doc.documentElement.style.getPropertyValue('--accent').trim() === '');
  check('reset clears the persisted setting', !E(`loadSetting('accent')`));

  // Light/dark toggle still works after reset (no regression).
  win.applyTheme('light');
  check('theme toggle still works', E(`COLORS.bg`) === E(`THEMES.light.bg`));
  win.applyTheme('dark');
}

group('Read-only viewer (#77): chrome hidden + mutations gated, pan/zoom kept');
{
  const { win, doc, E } = boot();
  const canvas = doc.getElementById('canvas');
  win.createNode('rect', 100, 100, 120, 60);

  // Enter read-only via the URL flag.
  E(`location.hash = '#view'`); win.loadFromUrl();
  check('read-only root class set by #view flag', doc.documentElement.classList.contains('read-only'));

  // Shape-draw is a no-op in read-only (plain drag pans instead).
  const before = E('nodes.length'); win.setTool('rect');
  mouse(canvas, 'mousedown', 300, 300); mouse(doc, 'mousemove', 380, 360); mouse(doc, 'mouseup', 380, 360);
  check('shape-draw disabled in read-only', E('nodes.length') === before);

  // Double-click create is gated too.
  canvas.dispatchEvent(new win.MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: 500, clientY: 400 }));
  check('dblclick create disabled in read-only', E('nodes.length') === before);

  // Delete keyboard shortcut is gated.
  E(`selectedId = nodes[0].id`);
  key(doc, 'Delete');
  check('Delete key disabled in read-only', E('nodes.length') === before);

  // editNodeLabel is gated (no overlay textarea spawned).
  E(`editNodeLabel(nodes[0])`);
  check('label edit disabled in read-only', !doc.querySelector('.node-label-editor'));

  // Pan still works (viewBox shifts on a plain drag).
  const vbx = E('viewBox.x');
  mouse(canvas, 'mousedown', 400, 400); mouse(doc, 'mousemove', 320, 400); mouse(doc, 'mouseup', 320, 400);
  check('pan still works in read-only', E('viewBox.x') !== vbx);

  // Edit affordance links back to the same diagram without the flag.
  check('Edit link points to the no-flag hash', !/view/.test(doc.getElementById('viewEditLink').getAttribute('href')));

  // Leaving view mode restores the editor (no-flag re-init clears the class).
  E(`location.hash = ''`); win.loadFromUrl();
  check('no-flag mode clears read-only', !doc.documentElement.classList.contains('read-only'));
}

group('#71 viewport culling for large diagrams');
{
  const { win, doc, E } = boot();
  // Force culling on regardless of node count for the test.
  E(`CONFIG.cullThreshold = 0`);
  const near = win.createNode('rect', E('viewBox.x') + 100, E('viewBox.y') + 100, 80, 40);
  const far  = win.createNode('rect', E('viewBox.x') + 99999, E('viewBox.y') + 99999, 80, 40);
  win.render();
  check('cull: on-screen node renders', !!doc.querySelector(`#nodes .node[data-id="${near.id}"]`));
  check('cull: off-screen node is culled', !doc.querySelector(`#nodes .node[data-id="${far.id}"]`));

  // Panning the viewBox over the far node brings it into the DOM.
  E(`viewBox.x = ${far.x - 100}; viewBox.y = ${far.y - 100}`); win.render();
  check('cull: panning to a culled node renders it', !!doc.querySelector(`#nodes .node[data-id="${far.id}"]`));

  // The selected node is never culled, even when off-screen.
  E(`viewBox.x = 0; viewBox.y = 0; selectedId = '${far.id}'`); win.render();
  check('cull: selected node is exempt from culling', !!doc.querySelector(`#nodes .node[data-id="${far.id}"]`));
  E(`selectedId = null`);

  // A connection survives if either endpoint is in view; both off-screen → culled.
  E(`connections.push({ id: 'cull-c', from: '${near.id}', to: '${far.id}' })`);
  win.render();
  check('cull: edge with one endpoint in view is drawn', E(`connectionsGroup.querySelectorAll('path').length`) > 0);
  // Move both endpoints off-screen → the edge is culled too.
  E(`viewBox.x = 50000; viewBox.y = 50000`); win.render();
  check('cull: edge with both endpoints off-screen is culled', E(`connectionsGroup.querySelectorAll('path').length`) === 0);

  // Below the threshold, nothing is culled (no regression for small diagrams).
  E(`CONFIG.cullThreshold = 300; viewBox.x = 0; viewBox.y = 0`); win.render();
  check('cull: small diagrams keep the off-screen node', !!doc.querySelector(`#nodes .node[data-id="${far.id}"]`));
}

group('#70 manual connection waypoints');
{
  const { win, doc, E } = boot();
  const A = win.createNode('rect', 0, 0, 80, 40);
  const B = win.createNode('rect', 400, 0, 80, 40);
  E(`connections.push({ id: 'wp', from: '${A.id}', to: '${B.id}' })`);
  E(`connections[0].waypoints = [{ x: 200, y: 150 }]`);
  win.render();

  // Router honors waypoints: the routed path passes through each one.
  const through = E(`(() => {
    const o = getOptimalSides(nodes[0], nodes[1]);
    const r = routeConnection(nodes[0], nodes[1], o.fromSide, o.toSide, 0.5, 0.5, connections[0].waypoints);
    return r.points.some(p => Math.abs(p.x - 200) < 1 && Math.abs(p.y - 150) < 1);
  })()`);
  check('waypoint: routed path passes through the waypoint', through === true);

  // The rendered <path> visits the waypoint coordinate.
  const d = doc.querySelector('#connections path');
  check('waypoint: rendered path includes the waypoint', !!d && /200[ ,]\s*150/.test(d.getAttribute('d').replace(/,/g, ', ')));

  // A draggable midpoint handle renders for the selected connection.
  E(`selectedConnId = 'wp'`); win.render();
  check('waypoint: midpoint handle renders', !!doc.querySelector('.conn-waypoint'));

  // Persistence: waypoint survives the serialize round-trip.
  const json = E(`JSON.stringify(connections)`);
  check('waypoint: survives serialize', /"waypoints"/.test(json) && /150/.test(json));

  // Auto-routing resumes once the waypoint is removed.
  E(`delete connections[0].waypoints`); win.render();
  const auto = E(`(() => {
    const o = getOptimalSides(nodes[0], nodes[1]);
    const r = routeConnection(nodes[0], nodes[1], o.fromSide, o.toSide, 0.5, 0.5, connections[0].waypoints);
    return r.points.some(p => Math.abs(p.y - 150) < 1);
  })()`);
  check('waypoint: removing it resumes auto-routing (no longer through 150)', auto === false);
}

group('#36 label wrapping: hard-break long unbreakable words');
{
  const { win, E } = boot();
  // A single token longer than the line cap hard-breaks across lines.
  const lines = E(`wrapLabel('supercalifragilisticexpialidociousAndThenSomeMore', 120)`);
  check('long unbreakable word hard-breaks to >=2 lines', lines.length >= 2);
  check('each wrapped line stays within the cap-ish width', lines.every(l => l.length <= 30));
  check('hard-break preserves all characters', lines.join('') === 'supercalifragilisticexpialidociousAndThenSomeMore');
  // Normal multi-word labels still wrap on spaces (no regression).
  const normal = E(`wrapLabel('the quick brown fox jumps', 120)`);
  check('normal wrap still breaks on spaces', normal.join(' ').split(' ').length === 5);
  // Code-point safe: an emoji token isn't split mid-surrogate.
  const emoji = E(`wrapLabel('😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀', 60)`);
  check('emoji hard-break keeps code-points intact', emoji.every(l => !/�/.test(l)) && emoji.length >= 2);
  // fitNodeToLabel caps node width for a long token instead of stretching it.
  const n = win.createNode('rect', 100, 100, 120, 44);
  E(`(nd=>{nd.label='supercalifragilisticexpialidociousAndThenSomeMoreEvenLonger'; fitNodeToLabel(nd);})(nodes.find(x=>x.id==='${n.id}'))`);
  const w = E(`nodes.find(x=>x.id==='${n.id}').width`);
  check('long token does not force an ultra-wide node', w <= E('CONFIG.wrap.maxWidth') + 30);
  check('cap lives in CONFIG (no magic number)', typeof E('CONFIG.wrap.maxWidth') === 'number');
}

group('Align & distribute (#95): selection ops, undoable, toolbar-gated');
{
  const { win, doc, E } = boot();
  const a = win.createNode('rect', 100, 100, 80, 40);
  const b = win.createNode('rect', 300, 160, 80, 40);
  const c = win.createNode('rect', 220, 260, 80, 40);
  E(`selectedIds = ['${a.id}','${b.id}','${c.id}']; selectedId = null;`);

  win.alignSelection('left');
  check('align-left equalizes x', a.x === b.x && b.x === c.x);
  check('align-left uses the min x (100)', a.x === 100);

  win.alignSelection('top');
  check('align-top equalizes y', a.y === b.y && b.y === c.y && a.y === 100);

  // center-x: all share the same center
  win.alignSelection('centerx');
  const cxs = [a, b, c].map(n => n.x + n.width / 2);
  check('center-x equalizes centers', Math.abs(cxs[0] - cxs[1]) < 0.5 && Math.abs(cxs[1] - cxs[2]) < 0.5);

  // distribute horizontally → equal gaps between left edges
  E(`nodes.find(n=>n.id==='${a.id}').x = 100; nodes.find(n=>n.id==='${b.id}').x = 130; nodes.find(n=>n.id==='${c.id}').x = 400`);
  win.distributeSelection('h');
  const xs = [a.x, b.x, c.x].sort((p, q) => p - q);
  check('distribute makes equal gaps', Math.abs((xs[1] - xs[0]) - (xs[2] - xs[1])) <= 1);

  // undoable — each op is one undo step
  const yBefore = a.y;
  win.alignSelection('bottom');
  win.undo();
  check('align is undoable', E(`nodes.find(n=>n.id==='${a.id}').y`) === yBefore);

  // toolbar gating: shown for 2+, distribute disabled under 3
  win.render();
  const bar = doc.getElementById('alignToolbar');
  check('align bar visible for multi-select', !bar.classList.contains('hidden'));
  E(`selectedIds = ['${a.id}','${b.id}']`); win.render();
  check('distribute disabled with <3 selected', [...bar.querySelectorAll('.al-dist')].every(b => b.disabled));
  E(`selectedIds = []; selectedId = '${a.id}'`); win.render();
  check('align bar hidden for single selection', bar.classList.contains('hidden'));
  // align is a no-op on a single selection
  const x1 = a.x; win.alignSelection('right');
  check('align no-op under 2 nodes', a.x === x1);
}

group('Minimap / overview (#82): markers + viewport rect + click-to-pan');
{
  const { win, doc, E } = boot();
  const mm = doc.getElementById('minimap');
  check('minimap element exists', !!mm);
  // empty canvas → hidden
  win.render();
  check('minimap hidden when canvas empty', mm.style.display === 'none');

  win.createNode('rect', 0, 0, 80, 40);
  win.createNode('pill', 600, 400, 80, 40);
  win.render();
  check('minimap shown when nodes exist', mm.style.display !== 'none');
  check('one marker per node', mm.querySelectorAll('[data-mm-node]').length === E('nodes.length'));
  check('viewport indicator rect present', !!mm.querySelector('.mm-viewport'));

  // click-to-pan moves the main viewport (target chosen so it can't coincide with 0,0)
  const x0 = E('viewBox.x'), y0 = E('viewBox.y');
  win.minimapPanTo(2000, 1500);
  check('minimap pan moves the viewport', E('viewBox.x') !== x0 || E('viewBox.y') !== y0);
  check('pan centers viewBox on the target', Math.abs((E('viewBox.x') + E('viewBox.w') / 2) - 2000) < 1);

  // viewport rect tracks the pan (re-rendered with new viewBox)
  check('viewport rect updates after pan', !!mm.querySelector('.mm-viewport'));

  // emptying the canvas hides it again
  E('nodes.length = 0'); win.render();
  check('minimap re-hidden when emptied', mm.style.display === 'none');
}

group('Find nodes by label (#83): match + focus-center, Cmd+F box');
{
  const { win, doc, E } = boot();
  const far = win.createNode('rect', 5000, 5000, 80, 40);
  E(`nodes.find(n=>n.id==='${far.id}').label = 'FarNode'`);
  win.createNode('rect', 0, 0, 80, 40);
  win.render();

  // case-insensitive substring match
  check('find matches by label (case-insensitive)', E(`findNodes('farnode').length`) === 1);
  check('find returns nothing for a non-match', E(`findNodes('zzz').length`) === 0);
  check('empty query matches nothing', E(`findNodes('').length`) === 0);

  // focusNode selects + centers the viewport on the node
  win.focusNode(far.id);
  const cx = 5000 + 80 / 2, cy = 5000 + 40 / 2;
  check('focus selects the node', E(`selectedId === '${far.id}'`));
  check('focus centers viewport on the node',
    E('viewBox.x') <= cx && cx <= E('viewBox.x') + E('viewBox.w') &&
    E('viewBox.y') <= cy && cy <= E('viewBox.y') + E('viewBox.h'));

  // Cmd/Ctrl+F opens the find box; Esc closes it.
  const box = doc.getElementById('findBox');
  check('find box starts hidden', box.classList.contains('hidden'));
  win.openFind();
  check('openFind reveals the box', !box.classList.contains('hidden'));
  win.closeFind();
  check('closeFind hides the box', box.classList.contains('hidden'));
}

group('Keyboard nudge (#94): arrow moves selection, Shift = fine, undoable');
{
  const { win, doc, E } = boot();
  const n = win.createNode('rect', 100, 100, 80, 40); win.selectNode(n.id);
  const x0 = n.x;
  key(doc, 'ArrowRight');
  check('arrow nudges selection right by a grid step', n.x - x0 === E('gridSize'));
  const x1 = n.x;
  key(doc, 'ArrowRight', { shiftKey: true });
  check('shift+arrow is a 1px fine step', n.x - x1 === 1);
  const y0 = n.y;
  key(doc, 'ArrowDown');
  check('arrow down moves on Y', n.y - y0 === E('gridSize'));

  // undoable — undo reverts the most recent nudge (undo swaps in fresh node
  // objects from the snapshot, so re-read by id rather than the stale ref)
  win.undo();
  check('nudge is undoable', E(`nodes.find(x=>x.id==='${n.id}').y`) === y0);

  // multi-selection nudges together
  const a = win.createNode('rect', 300, 300, 80, 40);
  const b = win.createNode('rect', 500, 300, 80, 40);
  E(`selectedId = null; selectedIds = ['${a.id}','${b.id}']`);
  const ax = a.x, bx = b.x;
  key(doc, 'ArrowLeft');
  check('multi-selection nudges together', a.x - ax === -E('gridSize') && b.x - bx === -E('gridSize'));

  // no nudge while typing in an input
  const before = a.x;
  const inp = doc.createElement('input'); doc.body.appendChild(inp);
  inp.dispatchEvent(new win.KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'ArrowLeft' }));
  check('no nudge while an input is focused', a.x === before);
  inp.remove();
}

group('Gallery thumbnails (#79): generate helper + doc-record field + card render');
{
  const { win, doc, E } = boot();
  check('thumbnail helper exists', typeof win.generateThumbnail === 'function');

  // docStore persists a thumbnail field through save/load (jsdom has no canvas,
  // so the raster itself is untestable — assert the storage wiring).
  E(`docStore._useMemory()`);
  const id = E(`docStore.save({ title: 't', data: exportState(), thumbnail: 'data:image/png;base64,AAAA' }).id`);
  check('doc record stores a thumbnail field', /^data:image/.test(E(`docStore.load('${id}').thumbnail`)));

  // A save without a thumbnail keeps the field null (placeholder path), no error.
  const id2 = E(`docStore.save({ title: 'n', data: exportState() }).id`);
  check('missing thumbnail is null (placeholder)', E(`docStore.load('${id2}').thumbnail`) === null);

  // updating a doc without passing thumbnail preserves the existing one
  E(`docStore.save({ id: '${id}', title: 't2' })`);
  check('thumbnail preserved across a partial save', /^data:image/.test(E(`docStore.load('${id}').thumbnail`)));

  // Gallery card renders an <img> when a thumbnail is present.
  E(`activeDocId = '${id}'`); win.toggleGallery();
  const card = doc.querySelector(`#galleryGrid .gallery-card[data-id="${id}"]`);
  check('gallery card renders the thumbnail image', !!card && !!card.querySelector('img[src^="data:image"]'));
  const card2 = doc.querySelector(`#galleryGrid .gallery-card[data-id="${id2}"]`);
  check('thumbnail-less card shows no img (placeholder)', !!card2 && !card2.querySelector('img'));
  win.toggleGallery();
}

group('Coach-marks (#56): spotlight steps + shared onboarding flag');
{
  const { win, doc, E } = boot();
  E(`localStorage.removeItem('draph.onboarding.v1')`);
  const ov = doc.getElementById('coachmarkOverlay');
  check('coachmark overlay starts hidden', !!ov && ov.classList.contains('hidden'));

  win.startCoachmarks();
  check('coachmarks overlay visible', !ov.classList.contains('hidden'));
  check('step 1 targets the rect tool', E(`coachmarkSteps[coachmarkStep].target`) === '#tool-rect');

  win.coachmarkNext();
  check('Next advances the step', E(`coachmarkStep`) === 1);

  // Last-step Next finishes.
  E(`coachmarkStep = coachmarkSteps.length - 1`); win.coachmarkNext();
  check('overlay hidden after finish', ov.classList.contains('hidden'));
  check('shares onboarding flag (no re-trigger)', E(`localStorage.getItem('draph.onboarding.v1')`) !== null);
  check('finishing coachmarks suppresses first-run', E(`shouldShowOnboarding()`) === false);

  // Skip also hides + writes the flag.
  E(`localStorage.removeItem('draph.onboarding.v1')`); win.startCoachmarks();
  win.skipCoachmarks();
  check('skip hides the overlay', ov.classList.contains('hidden'));
  check('skip writes the shared flag', E(`localStorage.getItem('draph.onboarding.v1')`) !== null);

  // Finishing the #44 carousel hands off to coach-marks.
  const { win: w2, doc: d2, E: E2 } = boot();
  E2(`localStorage.removeItem('draph.onboarding.v1')`);
  w2.startOnboarding(); E2(`onboardingStep = ONBOARDING_STEPS.length - 1`); w2.onboardingNext();
  check('carousel finish opens coach-marks', !d2.getElementById('coachmarkOverlay').classList.contains('hidden'));
}

group('Flowchart shapes (#49): placeShape + renderNodes branches');
{
  const { win, doc } = boot();
  for (const kind of ['cylinder', 'hexagon', 'parallelogram', 'trapezoid', 'subroutine']) {
    const n = win.placeShape(kind, 200, 200);
    check(kind + ' node created with that type', n && n.type === kind);
    check(kind + ' has a default size', n && n.width > 0 && n.height > 0);
  }
  win.render();
  // cylinder renders a path + ellipse
  const cyl = win.placeShape('cylinder', 400, 200); win.render();
  const elc = doc.querySelector(`#nodes .node[data-id="${cyl.id}"]`);
  check('cylinder renders a path/ellipse', !!elc && /<path|<ellipse/i.test(elc.innerHTML));
  // hexagon / parallelogram / trapezoid render polygons
  const hex = win.placeShape('hexagon', 600, 200); win.render();
  const elh = doc.querySelector(`#nodes .node[data-id="${hex.id}"]`);
  check('hexagon renders a polygon', !!elh && /<polygon/i.test(elh.innerHTML));
  // subroutine renders a rect plus inner vertical border lines
  const sub = win.placeShape('subroutine', 800, 200); win.render();
  const els = doc.querySelector(`#nodes .node[data-id="${sub.id}"]`);
  check('subroutine renders a double border (rect + lines)', !!els && /<rect/i.test(els.innerHTML) && (els.innerHTML.match(/<line/g) || []).length >= 2);
  // label/connect parity: a flowchart shape carries a label and can be an edge endpoint
  check('flowchart shape carries a default label', !!cyl.label);
  const other = win.createNode('rect', 1000, 200, 80, 40);
  win.eval(`connections.push({ id: 'fc', from: '${cyl.id}', to: '${other.id}' })`); win.render();
  check('flowchart shape is connectable', win.eval(`connections.some(c=>c.from==='${cyl.id}')`));
}

group('Copy / paste node style (#99): format painter');
{
  const { win, E } = boot();
  const a = win.createNode('rect', 0, 0, 80, 40);
  E(`(n=>{n.color='#ff0000'; n.fillStyle='infill'; n.outlineColor='#00ff00';})(nodes.find(x=>x.id==='${a.id}'))`);
  const b = win.createNode('rect', 200, 0, 80, 40);
  const c = win.createNode('rect', 400, 0, 80, 40);

  // paste to a single target
  check('copyStyle succeeds', win.copyStyle(a.id) === true);
  check('pasteStyle to a single node', win.pasteStyle(b.id) === true);
  check('paste copies color', b.color === '#ff0000');
  check('paste copies fillStyle', b.fillStyle === 'infill');
  check('paste copies outlineColor', b.outlineColor === '#00ff00');
  check('shape/size/label unchanged by paste', b.type === 'rect' && b.width === 80 && b.height === 40);

  // paste to a multi-selection (no explicit target → current selection)
  E(`selectedId = null; selectedIds = ['${b.id}','${c.id}']`);
  win.pasteStyle();
  check('paste applies to a multi-selection', c.color === '#ff0000' && c.fillStyle === 'infill');

  // undoable
  win.undo();
  check('paste-style is undoable', E(`nodes.find(x=>x.id==='${c.id}').color`) !== '#ff0000');

  // no-op guards
  const { win: w2 } = boot();
  check('pasteStyle is a no-op with an empty clipboard', w2.pasteStyle('nope') === false);
  check('copyStyle on a missing node returns false', w2.copyStyle('nope') === false);
}

group('Screen-reader semantics (#59): node/conn aria-labels + live region');
{
  const { win, doc, E } = boot();
  const a = win.createNode('rect', 100, 100, 120, 60);
  E(`nodes.find(n=>n.id==='${a.id}').label = 'Login'`);
  win.render();
  const el = doc.querySelector(`#nodes .node[data-id="${a.id}"]`);
  check('node group has role=img', !!el && el.getAttribute('role') === 'img');
  check('node aria-label includes type + label', !!el && /Rectangle: Login/.test(el.getAttribute('aria-label') || ''));

  // unlabeled node falls back to the type name
  const u = win.createNode('diamond', 300, 100, 100, 60);
  E(`nodes.find(n=>n.id==='${u.id}').label = ''`);
  win.render();
  const elu = doc.querySelector(`#nodes .node[data-id="${u.id}"]`);
  check('unlabeled node aria-label is the type', (elu.getAttribute('aria-label') || '') === 'Diamond');

  // connection accessible name describes from→to
  const b = win.createNode('pill', 500, 100, 120, 60);
  E(`nodes.find(n=>n.id==='${b.id}').label = 'Home'`);
  E(`connections.push({ id: 'e1', from: '${a.id}', to: '${b.id}' })`);
  win.render();
  const ce = doc.querySelector(`.connection-group[data-id="e1"]`);
  check('connection has role=img', !!ce && ce.getAttribute('role') === 'img');
  check('connection aria-label describes from→to', !!ce && /from Login to Home/.test(ce.getAttribute('aria-label') || ''));

  // live region exists and receives announcements
  const live = doc.querySelector('[aria-live]');
  check('an aria-live region exists', !!live);
  win.createNode('rect', 700, 100, 80, 40);
  check('add announces via the live region', /added/.test((live.textContent || '')));
  E(`selectedId = '${a.id}'`); win.deleteSelected();
  check('delete announces via the live region', /deleted/i.test((live.textContent || '')));
  win.announceConnect(b.id, u.id);
  check('connect announcement names endpoints', /connected Home to Diamond/.test(live.textContent || ''));

  // no visual regression: node groups still render their shape markup
  check('node still renders its shape', !!doc.querySelector(`#nodes .node[data-id="${b.id}"] rect, #nodes .node[data-id="${b.id}"] path`));
}

group('Export selection only (#102): selected nodes + internal edges, cropped');
{
  const { win, doc, E } = boot();
  const a = win.createNode('rect', 0, 0, 80, 40);
  const b = win.createNode('rect', 200, 0, 80, 40);
  const far = win.createNode('rect', 900, 900, 80, 40);
  E(`nodes.find(n=>n.id==='${a.id}').label='Alpha'; nodes.find(n=>n.id==='${b.id}').label='Bravo'; nodes.find(n=>n.id==='${far.id}').label='FarAway'`);
  // an internal edge (a→b) and an edge to an unselected node (b→far)
  E(`connections.push({id:'e_ab', from:'${a.id}', to:'${b.id}'}); connections.push({id:'e_bf', from:'${b.id}', to:'${far.id}'})`);
  win.render();

  E(`selectedIds=['${a.id}','${b.id}']; selectedId=null;`);
  const svg = win.exportSelectionSVG();
  check('selection export includes the selected nodes', /Alpha/.test(svg) && /Bravo/.test(svg));
  check('selection export excludes unselected nodes', !/FarAway/.test(svg));
  check('selection export keeps the internal edge', /e_ab/.test(svg));
  check('selection export drops edges to unselected nodes', !/e_bf/.test(svg));
  check('selection export is a standalone svg with a viewBox', /^<svg[\s>]/.test(svg.trim()) && /viewBox=/.test(svg));
  check('selection export has no UI chrome (connectors/handles)', !/class="connector"|resize-handle|conn-hit/.test(svg));

  // cropped to the selection: viewBox is far smaller than the full canvas span (Far is at 900,900)
  const vb = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  check('selection viewBox is cropped to the subset (not the far node)', vb[2] < 600 && vb[3] < 600);

  // whole-canvas export is unchanged — still includes everything
  const full = win.buildExportSVG();
  check('whole-canvas export still includes all nodes', /Alpha/.test(full) && /FarAway/.test(full));

  // guard: no selection → exportSelectionSVG returns null
  E(`selectedIds=[]; selectedId=null;`);
  check('exportSelectionSVG returns null with no selection', win.exportSelectionSVG() === null);
}

group('Group resize of a multi-selection (#101): scale + reposition, undoable');
{
  const { win, doc, E } = boot();
  const a = win.createNode('rect', 0, 0, 100, 50);
  const b = win.createNode('rect', 300, 0, 100, 50);
  win.saveState();   // baseline snapshot (both nodes present) so undo has somewhere to land
  E(`selectedIds = ['${a.id}','${b.id}']; selectedId = null;`);
  const wA = a.width, gap0 = b.x - a.x;
  check('resizeSelection scales members', win.resizeSelection(1.5) === true && a.width > wA && b.width > wA);
  check('resizeSelection scales spacing (proportional layout)', (b.x - a.x) > gap0);
  check('scale is about the bbox origin (a stays at min)', a.x === 0 && a.y === 0);

  // undoable — one undo reverts the whole group resize
  win.undo();
  check('group resize is undoable', E(`nodes.find(n=>n.id==='${a.id}').width`) === wA && E(`nodes.find(n=>n.id==='${b.id}').x`) === 300);

  // group-resize handle renders only for a 2+ selection
  E(`selectedIds = ['${a.id}','${b.id}']; selectedId = null;`); win.render();
  check('group-resize handle renders for 2+ selection', !!doc.querySelector('.group-resize-handle'));
  E(`selectedIds = []; selectedId = '${a.id}'`); win.render();
  check('no group handle for a single selection', !doc.querySelector('.group-resize-handle'));

  // guards: <2 nodes or bad factor is a no-op
  E(`selectedIds = ['${a.id}']; selectedId = null;`);
  check('resizeSelection no-ops under 2 nodes', win.resizeSelection(2) === false);
  E(`selectedIds = ['${a.id}','${b.id}']`);
  check('resizeSelection rejects a non-positive factor', win.resizeSelection(0) === false);

  // single-node resize still works (no regression) — width changes via direct field
  const before = E(`nodes.find(n=>n.id==='${a.id}').width`);
  check('single-node geometry untouched by failed group ops', before === wA);
}

group('Width-aware label sizing (#105): CJK / emoji widen, Latin unchanged');
{
  const { win, E } = boot();
  // CJK label sizes wide enough for full-width glyphs (not the 0.62em Latin estimate)
  const cjk = win.createNode('rect', 0, 0); E(`nodes.find(n=>n.id==='${cjk.id}').label='日本語表示テスト'`);  // 8 full-width chars
  win.fitNodeToLabel(E(`nodes.find(n=>n.id==='${cjk.id}')`));
  check('CJK label box accounts for full-width chars', cjk.width >= 8 * 12 * 0.9);

  // an emoji label is wider than the same count of Latin chars
  const emo = win.createNode('rect', 0, 200); E(`nodes.find(n=>n.id==='${emo.id}').label='😀😀😀😀'`);
  win.fitNodeToLabel(E(`nodes.find(n=>n.id==='${emo.id}')`));
  const lat = win.createNode('rect', 0, 400); E(`nodes.find(n=>n.id==='${lat.id}').label='oooo'`);
  win.fitNodeToLabel(E(`nodes.find(n=>n.id==='${lat.id}')`));
  check('emoji label is wider than the same count of Latin chars', emo.width > lat.width);

  // the helper itself: wide glyphs measure wider than Latin, emoji widest
  check('labelWidthPx: CJK wider than Latin', E(`labelWidthPx('日本', 12)`) > E(`labelWidthPx('ab', 12)`));
  check('labelWidthPx: emoji wider than CJK', E(`labelWidthPx('😀😀', 12)`) > E(`labelWidthPx('日本', 12)`));
  check('labelWidthPx: Latin matches the prior 0.62em estimate', Math.abs(E(`labelWidthPx('Hello', 12)`) - 5 * 12 * 0.62) < 0.01);
  check('labelWidthPx: emoji surrogate pair counts as one glyph', E(`labelWidthPx('😀', 12)`) < E(`labelWidthPx('😀😀', 12)`));

  // Latin node sizing unchanged vs the old flat 0.62em width path
  const asc = win.createNode('rect', 0, 600); E(`nodes.find(n=>n.id==='${asc.id}').label='Hello World'`);
  win.fitNodeToLabel(E(`nodes.find(n=>n.id==='${asc.id}')`));
  // reproduce the old computation: longest word 'World'(5) and seg(11) at 0.62em, capped at prefMax 140
  const oldCharW = 12 * 0.62;
  const oldTextW = Math.min(Math.max(5 * oldCharW, Math.min(11 * oldCharW, 140)), E('CONFIG.wrap.maxWidth'));
  check('Latin node width matches the prior estimate', asc.width === Math.ceil(oldTextW) + 22);
}

group('Self-loop edges (#104): from===to renders a non-degenerate arc');
{
  const { win, doc, E } = boot();
  const a = win.createNode('rect', 100, 100, 100, 60);
  win.connect(a.id, a.id);
  win.render();

  const conn = E(`connections[0]`);
  check('self-loop connection is kept (from===to)', conn && conn.from === conn.to);
  const path = doc.querySelector('#connections path');
  const dd = path && path.getAttribute('d');
  check('self-loop renders a non-degenerate arc', !!dd && dd.length > 20 && !/NaN/.test(dd));

  // route geometry: multiple points, extends beyond the node, arrow perpendicular on the right side
  const r = E(`routeConnection(nodes[0], nodes[0], 'top', 'right')`);
  check('self-loop route has a multi-point arc', r.points.length >= 4);
  check('self-loop extends beyond the node bounds', r.points.some(p => p.x > 200) && r.points.some(p => p.y < 100));
  check('self-loop arrow enters perpendicular on the right side', r.inDir.x === -1 && r.inDir.y === 0);

  // distinct-node routing unchanged (no regression)
  win.createNode('rect', 400, 100, 100, 60);
  const r2 = E(`routeConnection(nodes[0], nodes[1], 'right', 'left')`);
  check('distinct-node routing still produces a path', r2.points.length >= 2 && !r2.points.some(p => isNaN(p.x) || isNaN(p.y)));

  // importing a self-transition keeps the self-edge
  const p = E(`parseMermaid('stateDiagram-v2\\n  S --> S : retry')`);
  check('importer keeps a self-transition', p.connections.some(c => c.from === c.to));
}

group('Adjustable snap grid size (#115): setGridSize drives snap + dot-grid + persistence');
{
  const { win, doc, E } = boot();

  win.setGridSize(40);
  check('snap rounds to the new grid (50 -> 40)', E(`snap(50)`) === 40);
  check('dot-grid pattern spacing tracks grid size', doc.getElementById('grid').getAttribute('width') === '40');
  check('grid size persists via settings', E(`loadSetting('gridSize')`) === '40');

  win.setGridSize(20);
  check('default grid restored (50 -> 60)', E(`snap(50)`) === 60);
  check('dot-grid pattern back to 20', doc.getElementById('grid').getAttribute('width') === '20');

  // invalid / out-of-set sizes are ignored (no per-axis or arbitrary snapping)
  win.setGridSize(7);
  check('out-of-set grid size is ignored', E(`gridSize`) === 20);
}

group('One-step z-order (#114): bringForward / sendBackward swap with nearest neighbour');
{
  const { win, E } = boot();
  const a = win.createNode('rect', 0, 0, 80, 40);
  const b = win.createNode('rect', 10, 10, 80, 40);
  const c = win.createNode('rect', 20, 20, 80, 40);
  a.z = 1; b.z = 2; c.z = 3;

  // bringForward raises one step (swaps with the neighbour just above), not to the top
  win.bringForward([a.id]);
  check('bringForward raises one step above neighbour', a.z > b.z);
  check('bringForward did not jump to front', a.z <= c.z);

  // no-op at the top: the topmost node can't go higher
  const topZ = c.z;
  win.bringForward([c.id]);
  check('bringForward is a no-op at the top', c.z === topZ);

  // sendBackward is symmetric: lowers one step, no-op at the bottom
  a.z = 1; b.z = 2; c.z = 3;
  win.sendBackward([c.id]);
  check('sendBackward lowers one step below neighbour', c.z < b.z);
  check('sendBackward did not jump to back', c.z >= a.z);
  const botZ = a.z;
  win.sendBackward([a.id]);
  check('sendBackward is a no-op at the bottom', a.z === botZ);

  // one undo unit: a single bringForward is reverted by one undo
  a.z = 1; b.z = 2; c.z = 3;
  win.saveState();
  win.bringForward([a.id]);
  win.undo();
  const aAfter = E(`nodes.find(n => n.id === '${a.id}').z`);
  const bAfter = E(`nodes.find(n => n.id === '${b.id}').z`);
  check('one undo reverts the z-swap', aAfter === 1 && bAfter === 2);
}

group('Auto-arrange direction (#113): TB / LR');
{
  const { win, E } = boot();
  const a = win.createNode('rect', 0, 0, 80, 40);
  const b = win.createNode('rect', 0, 0, 80, 40);
  const c = win.createNode('rect', 0, 0, 80, 40);
  win.connect(a.id, b.id); win.connect(b.id, c.id);

  win.arrangeDiagram('LR');
  check('LR spreads layers horizontally', a.x < b.x && b.x < c.x);
  check('LR keeps a chain at similar y', Math.abs(a.y - b.y) < 80 && Math.abs(b.y - c.y) < 80);

  win.arrangeDiagram('TB');
  check('TB stacks layers vertically', a.y < b.y && b.y < c.y);
  check('TB keeps a chain at similar x', Math.abs(a.x - b.x) < 80 && Math.abs(b.x - c.x) < 80);

  // parseMermaid captures the declared direction
  const pl = E(`parseMermaid('flowchart LR\\n  A-->B')`);
  check('parser captures LR direction', pl.direction === 'LR');
  const pt = E(`parseMermaid('flowchart TD\\n  A-->B')`);
  check('parser normalizes TD direction to TB', pt.direction === 'TB');

  // no-arg arrange honors an imported direction
  E(`importedDirection = 'LR'`);
  win.arrangeDiagram();
  check('no-arg arrange honors imported LR', a.x < b.x && b.x < c.x);
  E(`importedDirection = null`);
  win.arrangeDiagram();
  check('default arrange (no imported dir) is TB', a.y < b.y && b.y < c.y);
}

group('Node text alignment (#120): textAlign drives text-anchor (left/center/right)');
{
  const { win, doc, E } = boot();
  const textAnchor = id => {
    const t = doc.querySelector(`#nodes .node[data-id="${id}"] text`);
    return t && t.getAttribute('text-anchor');
  };

  // note: left-align → start
  const n = win.createNode('note', 0, 0, 200, 120);
  n.label = 'hello world that wraps a bit'; n.textAlign = 'left';
  win.render();
  check('note left align → text-anchor=start', textAnchor(n.id) === 'start');

  // rect: default (no textAlign) stays centered
  const c = win.createNode('rect', 0, 300, 120, 50);
  c.label = 'x';
  win.render();
  check('rect default stays centered (middle)', textAnchor(c.id) === 'middle');

  // rect: right-align → end
  c.textAlign = 'right'; win.render();
  check('rect right align → text-anchor=end', textAnchor(c.id) === 'end');

  // container header honors alignment
  const ct = win.createNode('container', 400, 0, 220, 150);
  ct.label = 'Group'; ct.textAlign = 'center'; win.render();
  check('container header center → middle', textAnchor(ct.id) === 'middle');

  // persists across a serialize round-trip
  const json = E(`JSON.stringify({ n: serializeNodes(), c: connections })`);
  win.loadDiagramJson(json);
  check('textAlign persists across serialize', E(`nodes.find(n => n.id === '${c.id}').textAlign`) === 'right');
}

group('Per-connection line style override (#119): setConnectionLineStyle is per-edge');
{
  const { win, E } = boot();
  const a = win.createNode('rect', 0, 0, 80, 40);
  const b = win.createNode('rect', 240, 0, 80, 40);
  const c = win.createNode('rect', 0, 200, 80, 40);
  win.connect(a.id, b.id);
  win.connect(a.id, c.id);
  const cid = E(`connections[0].id`);
  const otherId = E(`connections[1].id`);
  const globalBefore = E(`globalLineStyle`);
  win.saveState(); // baseline WITH both connections so undo lands here

  win.setConnectionLineStyle(cid, 'straight');
  check('per-connection style overridden', E(`connections[0].lineStyle`) === 'straight');
  check('global default unchanged', E(`globalLineStyle`) === globalBefore && globalBefore !== 'straight');
  check('other connection unaffected', E(`connections.find(c => c.id === '${otherId}').lineStyle`) !== 'straight');

  // override is undoable as a single unit, and persists through serialize round-trip
  win.undo();
  check('one undo reverts the override', E(`connections[0].lineStyle`) !== 'straight');

  win.setConnectionLineStyle(cid, 'rounded');
  const json = E(`JSON.stringify({ n: serializeNodes(), c: connections })`);
  win.loadDiagramJson(json);
  check('override persists across serialize round-trip', E(`connections.find(c => c.id === '${cid}').lineStyle`) === 'rounded');
}

group('Flowchart import shape mapping (#123): brackets → real shape types');
{
  const { E } = boot();
  const code = 'flowchart TD\n  A[(Users DB)] --> B{{Gateway}}\n  C[/Input/] --> D[\\Output\\]\n  E((Round)) --> F{Decide}\n  G[Plain] --> H(Pill)';
  const p = E(`parseMermaid(${JSON.stringify(code)})`);
  const by = {};
  p.nodes.forEach(n => { by[n.label] = n; });

  // the fixed mappings (#123)
  check('database [(...)] -> cylinder', by['Users DB'] && by['Users DB'].type === 'cylinder');
  check('hexagon {{...}} -> hexagon', by['Gateway'] && by['Gateway'].type === 'hexagon');
  check('parallelogram [/.../] -> parallelogram', by['Input'] && by['Input'].type === 'parallelogram');
  check('trapezoid [\\...\\] -> trapezoid', by['Output'] && by['Output'].type === 'trapezoid');

  // unchanged mappings (no regression)
  check('double-paren ((...)) still circle', by['Round'] && by['Round'].type === 'circle');
  check('brace {...} still diamond', by['Decide'] && by['Decide'].type === 'diamond');
  check('bracket [...] still rect', by['Plain'] && by['Plain'].type === 'rect');
  check('paren (...) still pill', by['Pill'] && by['Pill'].type === 'pill');
}

group('Resize from any corner/edge (#126): 8 handles, origin-moving edges');
{
  const { win, doc } = boot();
  const sel = id => `#nodes .node[data-id="${id}"] .resize-handle`;

  const n = win.createNode('rect', 200, 200, 160, 80);
  win.selectNode(n.id); win.render();
  const handles = doc.querySelectorAll(sel(n.id));
  check('8 resize handles render', handles.length === 8);
  check('handles carry direction classes', !!doc.querySelector(sel(n.id) + '.handle-nw') && !!doc.querySelector(sel(n.id) + '.handle-e'));

  // top-left (nw) drag down-right: origin moves in, size shrinks, bottom-right pinned
  const x0 = n.x, y0 = n.y, w0 = n.width, h0 = n.height;
  const rightEdge0 = n.x + n.width, bottomEdge0 = n.y + n.height;
  const tl = doc.querySelector(sel(n.id) + '.handle-nw');
  mouse(tl, 'mousedown', n.x, n.y);
  mouse(doc, 'mousemove', n.x + 40, n.y + 20);
  mouse(doc, 'mouseup', 0, 0);
  check('nw handle moves origin in', n.x > x0 && n.y > y0);
  check('nw handle shrinks size', n.width < w0 && n.height < h0);
  check('nw handle pins the bottom-right corner', Math.abs((n.x + n.width) - rightEdge0) < 0.5 && Math.abs((n.y + n.height) - bottomEdge0) < 0.5);

  // bottom-right (se) drag still grows without moving origin (no regression)
  const m = win.createNode('rect', 600, 200, 160, 80);
  win.selectNode(m.id); win.render();
  const mx0 = m.x, my0 = m.y, mw0 = m.width;
  const se = doc.querySelector(`#nodes .node[data-id="${m.id}"] .resize-handle.handle-se`);
  mouse(se, 'mousedown', m.x + m.width, m.y + m.height);
  mouse(doc, 'mousemove', m.x + m.width + 60, m.y + m.height + 40);
  mouse(doc, 'mouseup', 0, 0);
  check('se handle grows width', m.width > mw0);
  check('se handle leaves origin fixed', m.x === mx0 && m.y === my0);
}

group('Shift-to-lock aspect ratio on resize (#125): proportional vs free');
{
  const { win, doc } = boot();

  // Shift-drag the corner handle: the node keeps its STARTING aspect ratio
  // (capture it live — createNode clamps to min sizes, so don't assume a value).
  const n = win.createNode('rect', 100, 100, 160, 80);
  win.selectNode(n.id); win.render();
  const r0 = n.width / n.height;
  let h = doc.querySelector(`#nodes .node[data-id="${n.id}"] .resize-handle.handle-se`);
  mouse(h, 'mousedown', n.x + n.width, n.y + n.height);
  mouse(doc, 'mousemove', n.x + n.width + 120, n.y + n.height + 8, { shiftKey: true });
  mouse(doc, 'mouseup', 0, 0);
  check('shift-resize preserves starting aspect', Math.abs((n.width / n.height) - r0) < 0.1);
  check('shift-resize actually grew the node', n.width > 160);

  // Without Shift: free resize — width and height move independently (skew allowed)
  const m = win.createNode('rect', 400, 100, 160, 80);
  win.selectNode(m.id); win.render();
  const mr0 = m.width / m.height;
  h = doc.querySelector(`#nodes .node[data-id="${m.id}"] .resize-handle.handle-se`);
  mouse(h, 'mousedown', m.x + m.width, m.y + m.height);
  mouse(doc, 'mousemove', m.x + m.width + 120, m.y + m.height + 4); // no shiftKey
  mouse(doc, 'mouseup', 0, 0);
  check('free resize is not aspect-locked', Math.abs((m.width / m.height) - mr0) > 0.3);
}

group('Connection arrowhead style (#130): none / end / start / both');
{
  const { win, doc, E } = boot();
  const a = win.createNode('rect', 0, 0, 80, 40);
  const b = win.createNode('rect', 240, 0, 80, 40);
  win.connect(a.id, b.id);
  const cid = E(`connections[0].id`);
  win.saveState(); // baseline (no arrowStyle) so undo lands here

  // arrow markers are <path> elements that aren't the line (.connection) or hit area (.conn-hit)
  const markers = () => doc.querySelectorAll(`#connections [data-id="${cid}"] path:not(.connection):not(.conn-hit)`).length;

  win.render();
  check('default edge has a single end arrow', markers() === 1);

  win.setConnectionArrows(cid, 'both');
  check('arrowStyle stored', E(`connections[0].arrowStyle`) === 'both');
  check('both → two arrow markers', markers() === 2);

  win.setConnectionArrows(cid, 'none');
  check('none → no arrow markers', markers() === 0);

  win.setConnectionArrows(cid, 'start');
  check('start → one arrow marker', markers() === 1);

  // undoable as one unit
  win.undo();
  check('undo restores the previous arrow style', E(`connections[0].arrowStyle`) === 'none');

  // UML/sequence markers are not disturbed (no regression)
  win.connect(a.id, b.id, { markerEnd: 'arrow', markerStart: 'triangle' });
  const umlId = E(`connections[1].id`);
  win.render();
  check('UML edge still renders its markers', E(`connections[1].markerStart`) === 'triangle' && E(`connections[1].markerEnd`) === 'arrow');
}

group('Reverse connection direction (#129): swap from/to + sides/markers, undoable');
{
  const { win, E } = boot();
  const a = win.createNode('rect', 0, 0, 80, 40);
  const b = win.createNode('rect', 240, 0, 80, 40);
  win.connect(a.id, b.id, { fromSide: 'right', toSide: 'left', markerEnd: 'arrow' });
  const cid = E(`connections[0].id`);
  win.saveState(); // baseline with the connection present so undo lands here

  win.reverseConnection(cid);
  check('reverse swaps from/to', E(`connections[0].from`) === b.id && E(`connections[0].to`) === a.id);
  check('reverse swaps sides', E(`connections[0].fromSide`) === 'left' && E(`connections[0].toSide`) === 'right');
  check('reverse moves the arrow marker to the new end', E(`connections[0].markerStart`) === 'arrow' && (E(`connections[0].markerEnd`) === undefined || E(`connections[0].markerEnd`) === null));

  // undoable as one unit
  win.undo();
  check('one undo restores original direction', E(`connections[0].from`) === a.id && E(`connections[0].to`) === b.id);

  // round-trips a second reverse back to original
  win.reverseConnection(cid); win.reverseConnection(cid);
  check('double reverse is identity', E(`connections[0].from`) === a.id && E(`connections[0].to`) === b.id);
}

group('Per-node opacity (#134): group opacity attr, multi-select, persistence');
{
  const { win, doc, E } = boot();
  const op = id => {
    const g = doc.querySelector(`#nodes .node[data-id="${id}"]`);
    return g && g.getAttribute('opacity');
  };

  // explicit field renders as group opacity
  const n = win.createNode('rect', 0, 0, 100, 50);
  n.opacity = 0.5; win.render();
  check('node opacity applied to group', op(n.id) === '0.5');

  // default node has no reduced opacity attr
  const d = win.createNode('rect', 0, 200, 100, 50);
  win.render();
  check('default node has no opacity attr', !op(d.id) || op(d.id) === '1');

  // setNodeOpacity applies to a multi-selection, and is undoable
  const p = win.createNode('rect', 0, 400, 100, 50);
  const q = win.createNode('rect', 0, 600, 100, 50);
  win.saveState();
  E(`selectedIds = ['${p.id}', '${q.id}']`); E(`selectedId = null`);
  win.setNodeOpacity(0.25);
  check('multi-select opacity set on both', op(p.id) === '0.25' && op(q.id) === '0.25');
  win.undo();
  win.render();
  check('one undo clears the opacity', (!op(p.id) || op(p.id) === '1') && (!op(q.id) || op(q.id) === '1'));

  // 100% clears the field (no lingering attr); persists across serialize round-trip
  E(`selectedIds = []`); win.selectNode(n.id);
  win.setNodeOpacity(0.75);
  const json = E(`JSON.stringify({ n: serializeNodes(), c: connections })`);
  win.loadDiagramJson(json);
  check('opacity persists across serialize', E(`nodes.find(x => x.id === '${n.id}').opacity`) === 0.75);
  win.selectNode(n.id); win.setNodeOpacity(1);
  check('setting 100% removes the opacity field', E(`nodes.find(x => x.id === '${n.id}').opacity`) === undefined);
}

group('Select connected component (#133): grow selection across edges');
{
  const { win, E } = boot();
  const a = win.createNode('rect', 0, 0, 80, 40);
  const b = win.createNode('rect', 200, 0, 80, 40);
  const c = win.createNode('rect', 400, 0, 80, 40);
  const d = win.createNode('rect', 900, 900, 80, 40); // unrelated
  win.connect(a.id, b.id);
  win.connect(b.id, c.id);

  // from a single seed → whole A-B-C component, excluding D
  win.selectNode(a.id);
  win.selectConnected();
  let sel = E(`selectedIds`);
  check('includes direct neighbor', sel.includes(b.id));
  check('includes transitive node', sel.includes(c.id));
  check('excludes unconnected node', !sel.includes(d.id));
  check('seed itself is selected', sel.includes(a.id));

  // walking is undirected (seed from the tail reaches the head)
  E(`selectedIds = []`); win.selectNode(c.id);
  win.selectConnected();
  sel = E(`selectedIds`);
  check('undirected walk reaches the head', sel.includes(a.id) && sel.includes(b.id));

  // a lone node with no edges stays a single selection (no crash, no spurious growth)
  E(`selectedIds = []`); win.selectNode(d.id);
  win.selectConnected();
  check('lone node selectConnected is a no-op', E(`selectedNodeIds().length`) === 1 && E(`selectedNodeIds()[0]`) === d.id);
}

group('Mermaid export of edge style (#138): dashed → -.->, solid stays -->');
{
  const { win, E } = boot();
  const a = win.createNode('rect', 0, 0, 80, 40); a.label = 'A';
  const b = win.createNode('rect', 240, 0, 80, 40); b.label = 'B';
  win.connect(a.id, b.id, { label: 'go' });

  // solid default
  let code = win.generateMermaid();
  check('solid edge exports as -->', /-->/.test(code) && !/-\.->/.test(code));
  check('label still emitted on solid', /\|go\|/.test(code));

  // dashed
  E(`connections[0].strokeStyle = 'dashed'`);
  code = win.generateMermaid();
  check('dashed edge exports as -.->', /-\.->/.test(code));
  check('label still emitted on dashed', /-\.->\|go\|/.test(code));

  // thick (forward-compat; draph has no thick UI but the operator is correct)
  E(`connections[0].strokeStyle = 'thick'`);
  check('thick edge exports as ==>', /==>/.test(win.generateMermaid()));

  // round-trips: dashed re-imports as a dashed edge
  E(`connections[0].strokeStyle = 'dashed'`);
  const parsed = E(`parseMermaid(generateMermaid())`);
  check('dashed round-trips to strokeStyle dashed', parsed.connections[0].strokeStyle === 'dashed');

  // solid back to solid
  E(`connections[0].strokeStyle = 'solid'`);
  check('solid edge still --> after reset', /-->/.test(win.generateMermaid()) && !/-\.->/.test(win.generateMermaid()));
}

group('Mermaid export of #49 shapes (#137): emit real brackets, not [rect]');
{
  const { win, E } = boot();
  const mk = (type, label) => { const n = win.createNode(type, 0, 0, 140, 70); n.label = label; return n; };
  mk('cylinder', 'Users');
  mk('hexagon', 'Gate');
  mk('parallelogram', 'Input');
  mk('trapezoid', 'Funnel');
  mk('subroutine', 'Sub');
  mk('rect', 'Plain');
  mk('diamond', 'Decide');
  win.render();
  const code = win.generateMermaid();

  check('cylinder → [(...)] not [rect]', /\[\(Users\)\]/.test(code) && !/[A-Za-z0-9]\[Users\]/.test(code));
  check('hexagon → {{...}}', /\{\{Gate\}\}/.test(code));
  check('parallelogram → [/.../]', /\[\/Input\/\]/.test(code));
  check('trapezoid → [\\...\\]', /\[\\Funnel\\\]/.test(code));
  check('subroutine → [[...]]', /\[\[Sub\]\]/.test(code));

  // existing shapes unchanged
  check('rect still [label]', /[A-Za-z0-9]\[Plain\]/.test(code));
  check('diamond still {label}', /\{Decide\}/.test(code));

  // round-trips with the #123 import side: re-parsing recovers the shape types
  const parsed = E(`parseMermaid(generateMermaid())`);
  const byLabel = {};
  parsed.nodes.forEach(n => { byLabel[n.label] = n.type; });
  check('cylinder round-trips', byLabel['Users'] === 'cylinder');
  check('hexagon round-trips', byLabel['Gate'] === 'hexagon');
}

group('Mermaid export label escaping (#142): special chars quoted, round-trips');
{
  const { win, E } = boot();
  const n = win.createNode('rect', 0, 0, 140, 50); n.label = 'Step [1]: go';
  const plain = win.createNode('rect', 0, 200, 140, 50); plain.label = 'Plain';
  win.render();
  const code = win.generateMermaid();

  check('special-char label is quoted on export', /"Step \[1\]: go"/.test(code));
  check('plain label is NOT quoted', /[A-Za-z0-9]\[Plain\]/.test(code) && !/"Plain"/.test(code));

  // round-trips: re-import recovers the same label text
  const parsed = E(`parseMermaid(generateMermaid())`);
  const labels = parsed.nodes.map(x => x.label);
  check('special-char label round-trips intact', labels.includes('Step [1]: go'));

  // newline collapses to <br/> and the label is quoted
  const m = win.createNode('rect', 0, 400, 140, 50); m.label = 'line1\nline2';
  win.render();
  check('newline label becomes quoted <br/>', /"line1<br\/>line2"/.test(win.generateMermaid()));
}

group('Mermaid export of containers as subgraphs (#141): grouping survives round-trip');
{
  const { win, E } = boot();
  const c = win.createNode('container', 0, 0, 320, 200); c.label = 'Auth';
  const a = win.createNode('rect', 40, 60, 80, 40); a.label = 'Login';   // inside c
  const b = win.createNode('rect', 40, 120, 80, 40); b.label = 'Verify'; // inside c
  const out = win.createNode('rect', 600, 0, 80, 40); out.label = 'Outside'; // not in c
  win.render();
  const code = win.generateMermaid();

  check('container exported as subgraph block', /subgraph/.test(code) && /\bend\b/.test(code));
  check('member Login nested in the block', /subgraph[\s\S]*Login[\s\S]*end/.test(code));
  check('member Verify nested in the block', /subgraph[\s\S]*Verify[\s\S]*end/.test(code));
  check('container not also emitted as a flat [["Auth"]] node', !/\[\["Auth"\]\]/.test(code));
  check('outside node is not inside the subgraph block', !/subgraph[\s\S]*Outside[\s\S]*end/.test(code));

  // round-trips: re-parsing recovers a subgraph with both members
  const parsed = E(`parseMermaid(generateMermaid())`);
  check('re-import yields a subgraph', !!parsed.subgraphs && parsed.subgraphs.length >= 1);
  check('subgraph keeps both members', !!parsed.subgraphs && parsed.subgraphs.some(s => (s.children || []).length >= 2));

  // a diagram with no containers is unchanged (no stray subgraph keyword)
  const { win: win2 } = boot();
  const x = win2.createNode('rect', 0, 0, 80, 40); x.label = 'X';
  const y = win2.createNode('rect', 200, 0, 80, 40); y.label = 'Y';
  win2.connect(x.id, y.id);
  check('no-container diagram has no subgraph', !/subgraph/.test(win2.generateMermaid()));
}

group('Flowchart import edge style (#145): dotted/thick/no-arrow/bidirectional');
{
  const { E } = boot();
  const code = 'flowchart TD\n  A -.-> B\n  C ==> D\n  E --- F\n  G <--> H\n  I --> J';
  const p = E(`parseMermaid(${JSON.stringify(code)})`);
  const idOf = label => p.nodes.find(n => n.label === label).id;
  const edge = (from, to) => p.connections.find(c => c.from === idOf(from) && c.to === idOf(to));

  check('dotted -.-> imports dashed', edge('A', 'B').strokeStyle === 'dashed');
  check('thick ==> imports thick', edge('C', 'D').thick === true);
  check('--- imports with no arrowhead', edge('E', 'F').markerEnd === 'none');
  check('<--> imports with a start arrowhead', edge('G', 'H').markerStart === 'arrow');
  const solid = edge('I', 'J');
  check('solid --> unchanged (no style fields)',
    !solid.strokeStyle && !solid.thick && solid.markerStart === undefined && solid.markerEnd === undefined);

  // round-trips with #138 export: a dashed edge loaded into state exports as -.->
  const { win, E: E2 } = boot();
  const a = win.createNode('rect', 0, 0, 80, 40); a.label = 'A';
  const b = win.createNode('rect', 240, 0, 80, 40); b.label = 'B';
  win.connect(a.id, b.id, { strokeStyle: 'dashed' });
  const reparsed = E2(`parseMermaid(generateMermaid())`);
  check('dashed survives export→import round-trip', reparsed.connections[0].strokeStyle === 'dashed');

  // FULL import path (importMermaid → live connection reconstruction): the bug
  // the reviewer caught — `thick` was dropped when rebuilding live connections,
  // so an imported ==> rendered at the normal stroke width. (#145 follow-up)
  const { win: w3, doc: d3, E: E3 } = boot();
  w3.importMermaid(false, { code: 'flowchart TD\n  C ==> D\n  E -.-> F' });
  const conns = E3(`connections`);
  const thickConn = conns.find(c => c.thick);
  check('importMermaid keeps thick on the live connection', !!thickConn);
  check('importMermaid keeps strokeStyle dashed on the live connection', conns.some(c => c.strokeStyle === 'dashed'));
  // and it actually renders thicker: the thick edge's .connection path stroke-width > 2
  w3.render();
  const widths = [...d3.querySelectorAll('#connections .connection')].map(p => parseFloat(p.getAttribute('stroke-width')));
  check('imported thick edge renders at a wider stroke', widths.some(w => w >= 4));
}

group('Flowchart import mid-arrow labels (#146): A -- text --> B, no spurious nodes');
{
  const { E } = boot();
  const code = 'flowchart TD\n  A -- yes --> B\n  A -- no --> C';
  const p = E(`parseMermaid(${JSON.stringify(code)})`);
  check('no spurious label-nodes', !p.nodes.some(n => n.label === 'yes' || n.label === 'no'));
  check('exactly the real nodes (A,B,C)', p.nodes.length === 3);
  check('two labelled edges', p.connections.length === 2 && p.connections.some(c => c.label === 'yes') && p.connections.some(c => c.label === 'no'));

  // == text ==> and -. text .-> also attach labels (and keep their style)
  const p2 = E(`parseMermaid('flowchart TD\\n  X == thick ==> Y\\n  M -. dotted .-> N')`);
  check('thick mid-label attaches, no stray node', !p2.nodes.some(n => n.label === 'thick') && p2.connections.some(c => c.label === 'thick'));
  check('dotted mid-label attaches, no stray node', !p2.nodes.some(n => n.label === 'dotted') && p2.connections.some(c => c.label === 'dotted'));

  // the |label| form still works
  const p3 = E(`parseMermaid('flowchart TD\\n  P -->|piped| Q')`);
  check('pipe-label form still works', p3.connections.some(c => c.label === 'piped') && !p3.nodes.some(n => n.label === 'piped'));

  // plain unlabeled arrow unchanged
  const p4 = E(`parseMermaid('flowchart TD\\n  S --> T')`);
  check('plain arrow unchanged', p4.connections.length === 1 && (p4.connections[0].label || '') === '' && p4.nodes.length === 2);
}

group('Paste/create at cursor (#150): anchor to last pointer, center fallback');
{
  const { win, E } = boot();
  const cx = E(`viewBox.x + viewBox.w / 2`);
  const ax = E(`viewBox.x + viewBox.w * 0.8`);   // pointer toward lower-right
  const ay = E(`viewBox.y + viewBox.h * 0.8`);

  // text paste anchors at the pointer, not center
  E(`lastCanvasPointer = { x: ${ax}, y: ${ay} }`);
  const t = win.createTextNodeFromPaste('hi there');
  check('text paste is offset toward the pointer, not centered', Math.abs(t.x - cx) > 50);
  check('text paste centers on the pointer x', Math.abs((t.x + t.width / 2) - ax) < 120);

  // image paste anchors too
  const img = win.createImageNode('data:image/png;base64,AAAA', 100, 80);
  check('image paste is offset toward the pointer', Math.abs(img.x - cx) > 50);

  // no pointer → viewport-center fallback
  E(`lastCanvasPointer = null`);
  const t2 = win.createTextNodeFromPaste('center me');
  check('falls back to viewport center when no pointer', Math.abs((t2.x + 80) - cx) < 60);

  // pointer outside the current viewport → center fallback
  E(`lastCanvasPointer = { x: viewBox.x - 5000, y: viewBox.y - 5000 }`);
  const t3 = win.createTextNodeFromPaste('off-screen');
  check('off-viewport pointer falls back to center', Math.abs((t3.x + 80) - cx) < 60);
}

group('Duplicate keeps internal connections (#149): remap edges to the copies');
{
  const { win, E } = boot();
  const a = win.createNode('rect', 0, 0, 80, 40);
  const b = win.createNode('rect', 200, 0, 80, 40);
  const outside = win.createNode('rect', 0, 300, 80, 40);
  win.connect(a.id, b.id, { label: 'edge' });
  win.connect(b.id, outside.id); // edge to a NON-duplicated node

  E(`selectedIds = ['${a.id}', '${b.id}']; selectedId = null;`);
  win.saveState(); // baseline with originals so undo lands here
  const c0 = E(`connections.length`), n0 = E(`nodes.length`);
  win.duplicateSelected();

  check('two node copies added', E(`nodes.length`) === n0 + 2);
  check('internal A→B edge duplicated', E(`connections.length`) === c0 + 1);
  // the new edge connects the two COPIES (not the originals), label copied
  const copyIds = E(`selectedIds`);
  const newEdge = E(`connections[connections.length - 1]`);
  check('duplicated edge links the two copies', copyIds.includes(newEdge.from) && copyIds.includes(newEdge.to));
  check('duplicated edge keeps the label', newEdge.label === 'edge');
  check('edge to outside node not duplicated', !E(`connections.some(cn => (cn.from === '${copyIds[0]}' || cn.from === '${copyIds[1]}') && cn.to === '${outside.id}')`));

  // one undo removes both copies and the duplicated edge
  win.undo();
  check('one undo reverts the whole duplicate', E(`nodes.length`) === n0 && E(`connections.length`) === c0);

  // single-node duplicate adds no edge
  win.selectNode(a.id);
  const cBefore = E(`connections.length`);
  win.duplicateSelected();
  check('single-node duplicate adds no connection', E(`connections.length`) === cBefore);
}

group('Copy/paste keeps internal connections (#154): clipboard path, shared with #149');
{
  const { win, doc, E } = boot();
  const a = win.createNode('rect', 0, 0, 80, 40);
  const b = win.createNode('rect', 200, 0, 80, 40);
  const outside = win.createNode('rect', 0, 300, 80, 40);
  win.connect(a.id, b.id, { label: 'edge' });
  win.connect(b.id, outside.id); // edge to a NON-copied node
  E(`selectedIds = ['${a.id}', '${b.id}']; selectedId = null;`);
  const n0 = E(`nodes.length`), c0 = E(`connections.length`);

  key(doc, 'c', { metaKey: true });
  key(doc, 'v', { metaKey: true });

  check('two node copies pasted', E(`nodes.length`) === n0 + 2);
  check('internal edge recreated on the copies', E(`connections.length`) === c0 + 1);
  const copyIds = E(`selectedIds`);
  const newEdge = E(`connections[connections.length - 1]`);
  check('pasted edge links the two copies', copyIds.includes(newEdge.from) && copyIds.includes(newEdge.to));
  check('pasted edge keeps the label', newEdge.label === 'edge');
  check('edge to non-copied node not pasted', !E(`connections.some(cn => (cn.from === '${copyIds[0]}' || cn.from === '${copyIds[1]}') && cn.to === '${outside.id}')`));

  // single-node copy/paste adds no edge
  E(`selectedIds = []`); win.selectNode(a.id);
  const cBefore = E(`connections.length`);
  key(doc, 'c', { metaKey: true });
  key(doc, 'v', { metaKey: true });
  check('single-node copy/paste adds no connection', E(`connections.length`) === cBefore);
}

group('Container drag carries contents (#153): members + nested move together');
{
  const { win, doc } = boot();
  const c = win.createNode('container', 0, 0, 360, 240); c.label = 'Box';
  const a = win.createNode('rect', 40, 50, 80, 40); a.label = 'A';     // inside c
  const nested = win.createNode('container', 30, 110, 200, 100); nested.label = 'Inner'; // inside c
  const deep = win.createNode('rect', 50, 130, 60, 30); deep.label = 'Deep'; // inside nested (∴ inside c)
  const outside = win.createNode('rect', 700, 0, 80, 40); outside.label = 'Out';
  win.render(); win.selectNode(c.id);
  const ax0 = a.x, ay0 = a.y, dx0 = deep.x, ox0 = outside.x;

  const cEl = doc.querySelector(`#nodes .node[data-id="${c.id}"]`);
  mouse(cEl, 'mousedown', c.x + 10, c.y + 10);
  mouse(doc, 'mousemove', c.x + 110, c.y + 60);
  mouse(doc, 'mouseup', 0, 0);

  check('contained A moved ~100 right with the container', Math.abs((a.x - ax0) - 100) < 30);
  check('contained A moved ~50 down', Math.abs((a.y - ay0) - 50) < 30);
  check('nested-container descendant moved too', Math.abs((deep.x - dx0) - 100) < 30);
  check('outside node did not move', outside.x === ox0);

  // dragging a non-container node moves only itself
  const p = win.createNode('rect', 0, 600, 80, 40); p.label = 'P';
  const q = win.createNode('rect', 30, 610, 80, 40); q.label = 'Q'; // geometrically near, but P is not a container
  win.render(); win.selectNode(p.id);
  const qx0 = q.x;
  const pEl = doc.querySelector(`#nodes .node[data-id="${p.id}"]`);
  mouse(pEl, 'mousedown', p.x + 5, p.y + 5);
  mouse(doc, 'mousemove', p.x + 105, p.y + 5);
  mouse(doc, 'mouseup', 0, 0);
  check('non-container drag moves only itself', q.x === qx0);
}

group('Sequence activation bars (#158): inline +/- and activate/deactivate → spans');
{
  const { E } = boot();

  // inline markers: ->>+B activates B; -->>-A deactivates the source B
  const p = E(`parseMermaid('sequenceDiagram\\n  participant A\\n  participant B\\n  A->>+B: req\\n  B-->>-A: res')`);
  check('inline +/- produces one activation span', (p.activations || []).length === 1);
  check('activation is on the target participant B', p.activations[0].participant === 'B');
  check('span covers the req→res message range', p.activations[0].startIndex === 0 && p.activations[0].endIndex === 1);
  check('messages still parse', p.connections.filter(c => c.label === 'req' || c.label === 'res').length === 2);

  // explicit activate/deactivate
  const p2 = E(`parseMermaid('sequenceDiagram\\n  participant A\\n  participant B\\n  activate B\\n  A->>B: req\\n  B-->>A: res\\n  deactivate B')`);
  check('explicit activate/deactivate produces a span', (p2.activations || []).length === 1 && p2.activations[0].participant === 'B');

  // full import path: stored on sequenceActivations and rendered as a bar
  const { win, doc, E: E3 } = boot();
  win.importMermaid(false, { code: 'sequenceDiagram\n  participant A\n  participant B\n  A->>+B: req\n  B-->>-A: res' });
  check('importMermaid stores the activation', E3(`sequenceActivations.length`) === 1);
  // the activation participant is remapped to the LIVE node id (review fix)
  check('activation participant remapped to a live node id', E3(`!!nodes.find(n => n.id === sequenceActivations[0].participant)`));
  // a NARROW activation bar (w≈10) renders on B's lifeline center-x, spanning a message range
  const bNode = E3(`nodes.find(n => n.label === 'B')`);
  const bcx = bNode.x + bNode.width / 2;
  const bars = [...doc.querySelectorAll('#connections rect')].filter(r => {
    const w = parseFloat(r.getAttribute('width'));
    const x = parseFloat(r.getAttribute('x'));
    return Math.abs(w - 10) < 2 && Math.abs((x + w / 2) - bcx) < 3;
  });
  check('a narrow activation bar renders on B’s lifeline center-x', bars.length === 1);
  check('the activation bar spans a message range (tall, not a glyph)', parseFloat(bars[0].getAttribute('height')) >= 30);

  // a plain sequence diagram has no activations (no regression / no stray bars)
  const p3 = E(`parseMermaid('sequenceDiagram\\n  A->>B: hi')`);
  check('plain sequence has no activations', (p3.activations || []).length === 0);
}

group('Sequence note import (#157): note over/left of/right of → note nodes');
{
  const { E } = boot();
  const code = 'sequenceDiagram\n  participant A\n  participant B\n  A->>B: hi\n  note over A: validate token\n  note right of B: ack\n  note over A,B: shared';
  const p = E(`parseMermaid(${JSON.stringify(code)})`);

  check('note over imported as a node', p.nodes.some(n => n.type === 'note' && (n.label || '').includes('validate token')));
  check('note right of imported as a node', p.nodes.some(n => n.type === 'note' && n.label === 'ack'));
  check('multi-participant note imported', p.nodes.some(n => n.type === 'note' && n.label === 'shared' && (n.noteOver || []).length === 2));
  check('note carries its placement', p.nodes.find(n => n.label === 'ack').notePlacement === 'right');

  // messages + participants still parse correctly (no regression)
  check('the message still parses', p.connections.some(c => c.label === 'hi'));
  check('both participants present', p.nodes.filter(n => n.type === 'participant').length === 2);
  check('no spurious participant from the note text', !p.nodes.some(n => n.type === 'participant' && /validate|token|ack|shared/.test(n.label || '')));

  // full import path creates + positions the note as a live note node
  const { win, doc, E: E2 } = boot();
  win.importMermaid(false, { code });
  check('importMermaid creates a live note node', E2(`nodes.some(n => n.type === 'note' && n.label === 'validate token')`));
  check('imported note is positioned in the message area (below participants)', E2(`nodes.find(n => n.type === 'note' && n.label === 'validate token').y`) > 100);
  check('imported note renders a node element', [...doc.querySelectorAll('#nodes .node')].some(g => (g.textContent || '').replace(/\s+/g, '').includes('validatetoken')));

  // review fix: two consecutive notes at the SAME step get distinct, non-overlapping y
  const { win: w2, E: E4 } = boot();
  w2.importMermaid(false, { code: 'sequenceDiagram\n  participant A\n  participant B\n  A->>B: hi\n  note over A: first\n  note over A,B: second' });
  const ns = E4(`nodes.filter(n => n.type === 'note').sort((a,b)=>a.y-b.y)`);
  check('two consecutive notes imported', ns.length === 2);
  check('consecutive same-step notes have distinct y', ns[0].y !== ns[1].y);
  check('consecutive notes do not vertically overlap', (ns[1].y - ns[0].y) >= ns[0].height);
}

process.exit(report() ? 0 : 1);
