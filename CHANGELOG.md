# Changelog

## 0.7.0

Getting ready for the Marketplace and Open VSX.

- **Terminals open in the terminal panel by default** (`claudeSessions.terminalLocation: "panel"`). The split
  layout (session terminals as tabs in a right-hand editor group, files on the left) is one click away: the
  panel offers it once, or set `"split"`. If you relied on the old default, set it explicitly.
- **Cmd+1–9 no longer edits your settings silently.** To work while a terminal has focus they must be listed in
  `terminal.integrated.commandsToSkipShell`; the extension now asks once (*Allow* / *Not now*), and
  *Claude Sessions: Enable Cmd+1–9 in Terminals* does it later.
- New setting `claudeSessions.sessionShortcuts` turns Cmd+1–9 (and the ⌘N hints) off.
- Respects `CLAUDE_CONFIG_DIR` (falls back to `~/.claude`).
- If a Claude Code update changes its session files beyond recognition, the panel says so instead of
  quietly showing less.
- Restricted Mode: the workspace can't change the launch command, its arguments or skip-permissions.
- Runs where Claude Code runs (workspace extension), including Remote and WSL windows.
- Requires VS Code 1.106 or later (the first release with Secondary Side Bar view containers).
- MIT licence, icon, unit tests, CI.

## 0.6.0

- The session whose terminal is active is framed in its colour, with a ring round its dot (fainter when you've
  moved to a file).
- Yellow and orange are toned down in dark themes.
- Subagent dots: running green and pulsing, done grey, failed red, stopped hollow.

## 0.5.0

- **Cmd+1 … Cmd+9** switch to open session 1–9, in tab order, shown as ⌘N hints in the panel.

## 0.4.0

- **Split layout**: session terminals open as editor tabs in a right-hand editor group, files stay on the left.
  *Move Open Sessions to the Right Editor Group* tidies existing ones.

## 0.3.0

- **Subagents**: a session lists the agents it spawned, with running/done/failed/stopped state and elapsed time;
  click one to open its transcript.
- **Context usage** bar on each session (tokens in use / context window).

## 0.2.0

- **The panel**: a view listing this workspace's sessions, grouped into open, running elsewhere, pinned and by day,
  with live status (Working, Needs you, Done), notifications and a status bar item.
- Rename, colour, pin, hide, fork; reopen the sessions that were open after a restart.

## 0.1.0

- A quick picker to resume several Claude Code sessions at once, each in its own named, coloured terminal.
