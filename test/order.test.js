const test = require('node:test');
const assert = require('node:assert/strict');
const order = require('../order');

test('arrange: manual ids first, only those still there, then the rest in their own order', () => {
  assert.deepEqual(order.arrange(['c', 'gone', 'a'], ['a', 'b', 'c', 'd']), ['c', 'a', 'b', 'd']);
  assert.deepEqual(order.arrange([], ['a', 'b']), ['a', 'b']);
  assert.deepEqual(order.arrange(['b', 'b', 'a'], ['a', 'b']), ['b', 'a']);
  assert.deepEqual(order.arrange(['x'], []), []);
});

test('arrange: a new session goes to the end', () => {
  assert.deepEqual(order.arrange(['b', 'a'], ['new', 'a', 'b']), ['b', 'a', 'new']);
});

test('refill: reorders a filtered view and leaves the others in place', () => {
  // A section showing b, d (a filter hides a, c): drop d above b.
  assert.deepEqual(order.refill(['a', 'b', 'c', 'd'], ['d', 'b']), ['a', 'd', 'c', 'b']);
  // Ids the order doesn't have are ignored; duplicates count once.
  assert.deepEqual(order.refill(['a', 'b', 'c'], ['c', 'zz', 'a', 'c']), ['c', 'b', 'a']);
  assert.deepEqual(order.refill(['a', 'b'], []), ['a', 'b']);
});

test('move: by one place, stopping at the ends; unknown ids change nothing', () => {
  assert.deepEqual(order.move(['a', 'b', 'c'], 'b', -1), ['b', 'a', 'c']);
  assert.deepEqual(order.move(['a', 'b', 'c'], 'b', 1), ['a', 'c', 'b']);
  assert.deepEqual(order.move(['a', 'b', 'c'], 'a', -1), ['a', 'b', 'c']);
  assert.deepEqual(order.move(['a', 'b', 'c'], 'c', 1), ['a', 'b', 'c']);
  assert.deepEqual(order.move(['a', 'b'], 'x', 1), ['a', 'b']);
});

test('reordered: only a change in the order of ids both lists share counts', () => {
  assert.equal(order.reordered(['a', 'b', 'c'], ['a', 'c', 'b']), true);
  assert.equal(order.reordered(['a', 'b'], ['a', 'new', 'b']), false); // a tab opened between them
  assert.equal(order.reordered(['a', 'b', 'c'], ['a', 'c']), false); // one closed
  assert.equal(order.reordered([], ['a', 'b']), false);
  assert.equal(order.reordered(['a', 'b'], ['a', 'b']), false);
});

// Plays the moves the way VS Code's moveActiveEditor does: out of the group, back in at the index.
const play = (tabs, moves) => moves.reduce((t, [id, to]) => order.moveTo(t, id, to), tabs);

test('tabMoves: session tabs end up in the wanted order, other tabs stay put', () => {
  const cases = [
    [['a', 'b', 'c'], ['c', 'a', 'b']],
    [['a', null, 'b', null, 'c'], ['c', 'b', 'a']],
    [[null, 'a', 'b', null], ['b', 'a']],
    [['d', 'a', null, 'c', 'b'], ['a', 'b', 'c', 'd']],
    [['a', 'b', 'c', 'd', 'e'], ['e', 'd', 'c', 'b', 'a']],
  ];
  for (const [tabs, want] of cases) {
    const out = play(tabs, order.tabMoves(tabs, want));
    assert.deepEqual(out.filter(Boolean), want, `${tabs} → ${want}`);
    tabs.forEach((id, i) => id === null && assert.equal(out[i], null, `non-session tab ${i} moved`));
  }
});

test('tabMoves: nothing to do when already in order; ids not in this group are skipped', () => {
  assert.deepEqual(order.tabMoves(['a', null, 'b'], ['a', 'b']), []);
  assert.deepEqual(order.tabMoves(['a', 'b'], ['x', 'a', 'y', 'b']), []);
  assert.deepEqual(play(['b', 'a'], order.tabMoves(['b', 'a'], ['x', 'a', 'b'])), ['a', 'b']);
});

test('tabMoves: a neighbour swap is one move', () => {
  assert.deepEqual(order.tabMoves(['a', 'b'], ['b', 'a']), [['b', 0]]);
});
