// Subagents of a Claude Code session: what each one is, and whether it is still running.
//
// They live next to the session transcript, in <sessionId>/subagents/: agent-<id>.jsonl (transcript) and
// agent-<id>.meta.json ({ agentType, description, toolUseId, parentAgentId?, stoppedByUser?, ... }).
// Nothing in those files says "finished"; that is written to whoever spawned the agent (the session, or the
// parent agent for nested ones):
//   - background agents (all of them, in practice): a <task-notification> with <task-id>, <status>;
//   - foreground agents: the Agent tool_result for the meta's toolUseId (one that isn't "Async agent launched").
// So the session transcript is scanned for those in the same incremental pass that reads it (scanText), and
// parent agents' transcripts are scanned the same way, only when they have children.
const fs = require('fs');
const path = require('path');

const RECENT = 100; // agents per session sent to the panel, newest first
const RESUME_SLACK = 15000; // transcript written this long after its completion = the agent was resumed

const NOTE_RE = /<task-id>([\w-]+)<\/task-id>/g;
const STATUS_RE = /<status>(\w+)<\/status>/;
const TS_RE = /"timestamp":"([^"]+)"/;
const CALL_RE = /"id":"(toolu_\w+)","name":"(?:Agent|Task)"/g;
const RESULT_RE = /"tool_use_id":"(toolu_\w+)"/g;
const LAUNCHED_RE = /Async agent launched|Fork started/;

/** sessionId → { dir, key, agents: [...] } for sessions the panel asked about */
const bySession = new Map();
/** agent transcript → { offset, info } for parent agents scanned incrementally */
const agentScans = new Map();
/** meta file → { mtime, meta }; agent transcript → first timestamp */
const metaCache = new Map();
const startCache = new Map();
/** ids the panel listed since the last update(), and the ones that update() refreshed */
let requested = new Set();
let wanted = new Set();

function lineTime(text, i) {
  const start = text.lastIndexOf('\n', i) + 1;
  let end = text.indexOf('\n', i);
  if (end < 0) end = text.length;
  const m = TS_RE.exec(text.slice(start, end));
  return m ? Date.parse(m[1]) || 0 : 0;
}

/**
 * Collects completions from newly appended transcript text into `info`:
 * info.agentDone (agentId → { at, status }) and info.toolDone (toolUseId → at).
 */
function scanText(info, text) {
  if (text.includes('<task-id>')) {
    NOTE_RE.lastIndex = 0;
    let m;
    while ((m = NOTE_RE.exec(text))) {
      const status = (STATUS_RE.exec(text.slice(m.index, m.index + 1500)) || [])[1];
      if (!status || status === 'running') continue;
      const at = lineTime(text, m.index);
      const prev = (info.agentDone ||= new Map()).get(m[1]);
      if (!prev || at >= prev.at) info.agentDone.set(m[1], { at, status });
    }
  }
  if (text.includes('"name":"Agent"') || text.includes('"name":"Task"')) {
    CALL_RE.lastIndex = 0;
    let m;
    while ((m = CALL_RE.exec(text))) (info.agentCalls ||= new Set()).add(m[1]);
  }
  if (info.agentCalls?.size) {
    RESULT_RE.lastIndex = 0;
    let m;
    while ((m = RESULT_RE.exec(text))) {
      if (!info.agentCalls.has(m[1])) continue;
      if (LAUNCHED_RE.test(text.slice(m.index, m.index + 300))) continue;
      (info.toolDone ||= new Map()).set(m[1], lineTime(text, m.index));
      info.agentCalls.delete(m[1]);
    }
  }
}

async function scanAgentFile(file, size) {
  let c = agentScans.get(file);
  if (!c || size < c.offset) {
    c = { offset: 0, info: {} };
    agentScans.set(file, c);
  }
  if (size > c.offset) {
    const fh = await fs.promises.open(file, 'r');
    try {
      const buf = Buffer.alloc(size - c.offset);
      await fh.read(buf, 0, buf.length, c.offset);
      const end = buf.lastIndexOf(10) + 1;
      scanText(c.info, buf.toString('utf8', 0, end));
      c.offset += end;
    } finally {
      await fh.close();
    }
  }
  return c.info;
}

async function readMeta(file) {
  const st = await fs.promises.stat(file);
  const c = metaCache.get(file);
  if (c && c.mtime === st.mtimeMs) return c;
  const next = { mtime: st.mtimeMs, meta: JSON.parse(await fs.promises.readFile(file, 'utf8')) };
  metaCache.set(file, next);
  return next;
}

async function startOf(file, st) {
  if (startCache.has(file)) return startCache.get(file);
  let at = 0;
  const fh = await fs.promises.open(file, 'r');
  try {
    const buf = Buffer.alloc(Math.min(st.size, 8192));
    await fh.read(buf, 0, buf.length, 0);
    const m = TS_RE.exec(buf.toString('utf8'));
    at = m ? Date.parse(m[1]) || 0 : 0;
  } finally {
    await fh.close();
  }
  at = at || st.birthtimeMs || st.mtimeMs;
  if (st.size >= 8192 || at) startCache.set(file, at);
  return at;
}

/**
 * Re-reads the subagents of the sessions the panel shows. `sessions` and `live` are extension.js's maps;
 * an agent can only be running while its session's Claude process is (and was started by that process).
 */
async function update(sessions, live) {
  if (requested.size) wanted = requested;
  requested = new Set();
  await Promise.all(
    [...wanted].map(async (id) => {
      const s = sessions.get(id);
      if (!s?.file) return bySession.delete(id);
      const l = live.get(id);
      const key = `${l ? l.startedAt || 1 : 0}:${s.mtime}`;
      const prev = bySession.get(id);
      // A session that isn't running can't change its agents without touching its transcript.
      if (prev && !l && prev.key === key) return;
      const dir = path.join(path.dirname(s.file), id, 'subagents');
      const names = await fs.promises.readdir(dir).catch(() => []);
      const ids = names.filter((n) => n.startsWith('agent-') && n.endsWith('.meta.json')).map((n) => n.slice(6, -10));
      const raw = (
        await Promise.all(
          ids.map(async (aid) => {
            try {
              const { mtime: metaMtime, meta } = await readMeta(path.join(dir, `agent-${aid}.meta.json`));
              const file = path.join(dir, `agent-${aid}.jsonl`);
              const st = await fs.promises.stat(file);
              return { aid, meta, metaMtime, file, st, start: await startOf(file, st) };
            } catch {
              return undefined;
            }
          })
        )
      ).filter(Boolean);

      // Completions of nested agents are in their parent agent's transcript.
      const parents = new Map();
      for (const a of raw) {
        const pid = a.meta.parentAgentId;
        const p = pid && !parents.has(pid) && raw.find((x) => x.aid === pid);
        if (p) parents.set(pid, await scanAgentFile(p.file, p.st.size).catch(() => ({})));
      }

      const agents = raw.map((a) => {
        const { meta, st } = a;
        const src = meta.parentAgentId ? parents.get(meta.parentAgentId) || {} : s;
        const note = src.agentDone?.get(a.aid);
        let doneAt = Math.max(note?.at || 0, src.toolDone?.get(meta.toolUseId) || 0);
        let status = note && note.at >= doneAt ? note.status : doneAt ? 'completed' : '';
        if (meta.stoppedByUser && a.metaMtime > doneAt) {
          doneAt = a.metaMtime;
          status = 'stopped';
        }
        const resumed = doneAt && st.mtimeMs > doneAt + RESUME_SLACK;
        const alive = !!l && st.mtimeMs >= (l.startedAt || 0) - RESUME_SLACK;
        let state;
        if (alive && (!doneAt || resumed)) state = 'run';
        else if (doneAt) state = status === 'failed' ? 'failed' : status === 'completed' ? 'done' : 'stopped';
        else state = 'stopped'; // its Claude process is gone without telling anyone
        return {
          id: a.aid,
          desc: meta.description || meta.agentType || 'Agent',
          type: meta.agentType || '',
          depth: meta.spawnDepth || 1,
          state,
          start: Math.round(a.start),
          // When it stopped: the completion, or its last transcript write if nothing reported it.
          end: state === 'run' ? 0 : Math.round(resumed || !doneAt ? st.mtimeMs : doneAt),
        };
      });
      const latest = (a) => (a.state === 'run' ? Infinity : a.end);
      agents.sort((a, b) => latest(b) - latest(a) || b.start - a.start);
      bySession.set(id, { dir, key, agents: agents.slice(0, RECENT) });
    })
  );
  for (const id of bySession.keys()) if (!wanted.has(id)) bySession.delete(id);
}

/** Compact list for the panel payload; also marks the session as shown, for the next update(). */
function get(id) {
  requested.add(id);
  return bySession.get(id)?.agents || [];
}

function transcript(sessionId, agentId) {
  const s = bySession.get(sessionId);
  if (!s || !/^[\w-]+$/.test(agentId)) return undefined;
  return path.join(s.dir, `agent-${agentId}.jsonl`);
}

module.exports = { scanText, update, get, transcript };
