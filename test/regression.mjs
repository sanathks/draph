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

process.exit(report() ? 0 : 1);
