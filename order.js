// Manual session order: plain list functions, no VS Code, so the tests can run them.

/** `ids`, with those in `manual` first in manual's order, then the rest in the order they came. */
function arrange(manual, ids) {
  const have = new Set(ids);
  const first = [...new Set(manual)].filter((id) => have.has(id));
  const placed = new Set(first);
  return [...first, ...ids.filter((id) => !placed.has(id))];
}

/** `order` with the places its `subset` ids hold refilled in subset's order: reorders one filtered view (a panel
 *  section, the session tabs of an editor group) and leaves everything else where it was. */
function refill(order, subset) {
  const inOrder = new Set(order);
  const want = [...new Set(subset)].filter((id) => inOrder.has(id));
  const moving = new Set(want);
  let i = 0;
  return order.map((id) => (moving.has(id) ? want[i++] : id));
}

/** `list` with `id` moved `by` places, stopping at either end. */
function move(list, id, by) {
  const from = list.indexOf(id);
  if (from < 0) return [...list];
  return moveTo(list, id, Math.max(0, Math.min(list.length - 1, from + by)));
}

/** `list` with `id` taken out and put back at `index`: VS Code's moveEditor semantics. */
function moveTo(list, id, index) {
  const out = list.filter((x) => x !== id);
  out.splice(index, 0, id);
  return out;
}

/** Did the ids in both lists change their order? Ids that appeared or went away don't count. */
function reordered(before, after) {
  const a = new Set(after);
  const b = new Set(before);
  const was = before.filter((id) => a.has(id));
  const now = after.filter((id) => b.has(id));
  return was.some((id, i) => id !== now[i]);
}

/** The moves (id → final index) that put an editor group's session tabs in `want` order without moving any other
 *  tab: `tabs` holds a session id per tab, or null for a file or other tab. Each step swaps two session tabs, so
 *  the slots they occupy, and every tab between them, stay where they were. */
function tabMoves(tabs, want) {
  let cur = [...tabs];
  const slots = cur.map((id, i) => (id && want.includes(id) ? i : -1)).filter((i) => i >= 0);
  const target = refill(slots.map((i) => cur[i]), want);
  const moves = [];
  const put = (id, to) => {
    if (cur.indexOf(id) === to) return;
    cur = moveTo(cur, id, to);
    moves.push([id, to]);
  };
  slots.forEach((s, k) => {
    const x = cur[s];
    if (x === target[k]) return;
    const p = cur.indexOf(target[k]);
    put(target[k], s); // x and everything up to p shift right by one…
    put(x, p); // …and back, with x where target[k] was
  });
  return moves;
}

module.exports = { arrange, refill, move, moveTo, reordered, tabMoves };
