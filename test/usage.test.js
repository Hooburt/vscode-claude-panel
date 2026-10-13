const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const usage = require('../usage');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
const assistant = (u, extra = {}) =>
  JSON.stringify({ type: 'assistant', isSidechain: false, message: { model: 'claude-opus-5-5', usage: u }, ...extra });

test('used tokens = input + cache read + cache creation of the last main-chain request', () => {
  const r = usage.scan(fixture('session-part1.jsonl'));
  assert.deepEqual(r, { ctx: 3 + 20000 + 1200, ctxModel: 'claude-opus-5-5' });
});

test('sidechain messages are skipped; requestedModel wins over message.model', () => {
  const r = usage.scan(fixture('session-part2.jsonl'));
  assert.deepEqual(r, { ctx: 5 + 40000 + 3000, ctxModel: 'claude-opus-5-5[1m]' });
});

test('a compact boundary gives the post-compaction size until the next real assistant message', () => {
  const text = fixture('session-compacted.jsonl');
  // The <synthetic> message after the boundary doesn't count.
  assert.deepEqual(usage.scan(text), { ctx: 12500 });
  const after = text + assistant({ input_tokens: 4, cache_read_input_tokens: 13000, cache_creation_input_tokens: 600 }) + '\n';
  assert.deepEqual(usage.scan(after), { ctx: 13604, ctxModel: 'claude-opus-5-5' });
});

test('nothing to say: no usage, zero usage, or broken lines', () => {
  assert.equal(usage.scan(''), undefined);
  assert.equal(usage.scan('{"type":"user","message":{"role":"user","content":"hi"}}\n'), undefined);
  assert.equal(usage.scan(assistant({ input_tokens: 0 }) + '\n'), undefined);
  assert.equal(usage.scan('{"type":"assistant","usage" broken\n'), undefined);
});

test('window rule: [1m] → 1M, Claude 3/4 → 200K, newer → 1M, never less than in use', () => {
  assert.equal(usage.contextWindow('claude-sonnet-4-5[1m]'), 1e6);
  assert.equal(usage.contextWindow('claude-opus-4-1'), 200000);
  assert.equal(usage.contextWindow('claude-sonnet-4-5'), 200000);
  assert.equal(usage.contextWindow('claude-3-5-haiku'), 200000);
  assert.equal(usage.contextWindow('claude-opus-5-5'), 1e6);
  assert.equal(usage.contextWindow(''), 1e6);
  assert.equal(usage.contextWindow('claude-sonnet-4-5', 250000), 1e6);
});

test('forPayload: [used, window], with an explicit override', () => {
  assert.equal(usage.forPayload({}), undefined);
  assert.equal(usage.forPayload(undefined), undefined);
  assert.deepEqual(usage.forPayload({ ctx: 50000, ctxModel: 'claude-sonnet-4-5' }, 0), [50000, 200000]);
  assert.deepEqual(usage.forPayload({ ctx: 50000, ctxModel: 'claude-sonnet-4-5' }, 400000), [50000, 400000]);
});
