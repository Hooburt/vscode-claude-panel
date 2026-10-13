# Claude Sessions

A VS Code panel for Claude Code sessions you run in the terminal.

- **See every session** for this workspace, grouped into *Open in this window*, *Running elsewhere*, *Pinned*,
  then *Today / Yesterday / This week / Older*. Each shows its name, colour, last prompt, folder and branch.
- **Live status**: *Working*, *Idle*, or *Done* (finished while you were looking at something else, which also
  gives a notification, a badge on the panel icon, and a bell in the status bar).
  Sessions you started by hand in a terminal are picked up too.
- **Current session**: the one whose terminal is active is framed, with a ring round its dot (fainter while
  you're in a file).
- **Open several at once**: tick them and press *Open N*. Each opens in its own terminal named and coloured
  like the session. Clicking an open session jumps to its terminal instead of opening it twice.
- **Remembers what was open**: after a restart it offers to reopen them (notification and a banner in the panel).
  A session is forgotten only when you close its terminal or exit Claude in it.
- **Skip permissions** switch in the panel adds `--dangerously-skip-permissions` to every launch.
  The `⋯` menu can resume one session the other way.
- `⋯` menu: rename, colour, pin, hide, fork, open the transcript, copy the id or resume command.
- **Subagents**: a session that spawned agents shows *› N agents · M running*; expand it to list them
  (running ones with elapsed time, finished ones from the last few hours, *Show older* for the rest).
  Green dots are running, grey done, red failed, hollow stopped. Click one to open its transcript. Running agents also show in the status pill (*Working · 2 agents*).

How it knows what's running: Claude Code writes `~/.claude/sessions/<pid>.json` for every live session
(id, name, busy/idle). The panel matches those processes to this window's terminals. Past sessions come from
`~/.claude/projects/<workspace path>*/`. Nothing leaves your machine.

## Keys

- **Cmd+1 … Cmd+9**: switch to open session 1–9 (left to right as the tabs sit; shown as ⌘N in the panel). Active while a terminal or the panel has focus, so Cmd+N still switches editor groups from files.
- **Cmd+Alt+C**: show the panel
- **Cmd+Alt+R**: quick multi-select picker (no panel)

## Settings

| Setting | Default | |
|---|---|---|
| `claudeSessions.skipPermissions` | `false` | also the switch in the panel |
| `claudeSessions.restoreOnStartup` | `ask` | `ask`, `always`, `never` |
| `claudeSessions.notifyWhenDone` | `true` | notification when a session finishes while you're elsewhere |
| `claudeSessions.terminalLocation` | `split` | `split` (terminals in the right editor group, files left), `editor` or `panel` |
| `claudeSessions.includeSubfolders` | `true` | include sessions started in subfolders |
| `claudeSessions.maxRecent` | `100` | how many past sessions to list |
| `claudeSessions.contextWindow` | `0` | context window size for the usage bar; `0` = auto (1M, or 200K for Claude 3/4 models) |
| `claudeSessions.command` | `claude` | CLI to run |
| `claudeSessions.extraArgs` | `[]` | extra arguments for every launch |

## Build / install

```bash
npx @vscode/vsce package
code --install-extension claude-sessions-0.6.0.vsix
```
