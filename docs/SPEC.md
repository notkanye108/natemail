# Spec: natemail, a lightweight Superhuman-style layer for Gmail

Status: draft v2 (your answers folded in). Nothing built yet.
Repo: `rsup2/natemail` (to be created).
Owner: Nate. Date: 2026-11-09.

## 1. Problem

The Superhuman desktop app is heavy, and the Superhuman web client is down about once a week. The goal is to keep the core Superhuman workflow inside regular Gmail in Chrome, so Gmail's uptime becomes our uptime.

## 2. Goals (v1)

1. **Split inbox**: a tab bar above the Gmail message list. Each tab is a saved Gmail search, for example "Team", "Customers", "Calendar", "Other".
2. **Keyboard-first triage**: archive, reply, reply all, forward, move between messages, and switch tabs without touching the mouse.
3. **Remind me**: one key opens a small picker. Type "tomorrow 9am", "mon", "3d", or "2h", press Enter, and the thread disappears until then.
4. **Command palette** (Cmd+K): type any action by name. This is also how you learn the shortcuts.
5. **Stretch: create calendar invite** from the open thread: title = subject, guests = everyone on the thread, opens Google Calendar prefilled.

## 3. Non-goals

- No AI replies, summaries, or any AI features.
- No separate server or database. Email content never leaves the browser.
- No read receipts, send-later, or snippets in v1 (could come later).
- No support for Outlook or browsers other than Chrome.
- No Chrome Web Store listing. Personal install ("load unpacked") only.

## 4. Key design decision: drive Gmail itself, no Gmail API in v1

There are two ways to build this.

| | A. Content script only (recommended) | B. Gmail API with OAuth sign-in |
|---|---|---|
| How it works | Code runs inside the Gmail tab and drives Gmail's own UI: URL changes, Gmail's built-in shortcuts, and button clicks | Extension signs in to Google and calls the Gmail and Calendar APIs |
| Setup | None | Google Cloud project, OAuth consent screen, Workspace admin approval for the Gmail scope |
| Snooze / remind | Uses **Gmail's native snooze**, so it syncs to your phone and fires with the laptop closed | **The Gmail API has no snooze**, so we'd have to fake it with labels and timers that only run while Chrome is open ([Mimestream docs](https://mimestream.com/help/user-guide/snoozing), [Google issue 109952618](https://issuetracker.google.com/issues/109952618)) |
| Weak point | Gmail changes its page structure without notice, so some selectors will break and need fixing | More moving parts, harder for a beginner |
| Unread counts per tab | Not in v1 | Easy |

**Decision: A.** It does everything on the v1 list with the least setup. Unread counts are the only thing it gives up, and those can be added later with option B.

To limit breakage, everything that depends on Gmail's page structure lives in **one file** (`gmail-dom.js`). When Gmail changes, that's the only file to fix.

## 5. Feature specs

### 5.1 Split inbox

- A tab bar is inserted above Gmail's message list, on inbox views only.
- Clicking a tab (or pressing `Tab` / `Shift+Tab`) changes the URL to a Gmail search: `https://mail.google.com/mail/u/0/#search/<encoded query>`. Gmail does the actual searching, which makes this the most reliable part of the build.
- Splits are saved with `chrome.storage.sync`, so they follow you to any Chrome where you're signed in.
- Not in v1: unread counts on tabs.

**How a split is stored.** Each split is a name plus a list of rules, and natemail turns the rules into a Gmail search:

```
{ name: "Datadog", rules: [ { type: "domain", value: "datadoghq.com" } ] }
   becomes  in:inbox from:(@datadoghq.com)
```

Rule types: `sender` (one exact address, `from:"a@b.com"`), `domain` (anyone at that domain, `from:(@b.com)`), `involves` (an address anywhere on the thread: `from:`, `to:`, or `cc:`), and `query` (raw Gmail search, for power use). Rules inside a split are joined with OR.

**Each email shows up in exactly one split.** Splits are checked in a priority order. An email that matches an earlier split is left out of later ones. "Other" is always last and catches everything left over, so nothing gets lost. Priority order is separate from the order the tabs are displayed in. This matters because Gmail's "Important" flag is broad: if Important went first, it would swallow most of your Datadog and Quo mail.

**Your splits** (tab display order as you listed them):

| Tab | Starting rule | Priority |
|---|---|---|
| Important | `is:important` | 6 (near last, so specific splits win) |
| Calendar | `filename:invite.ics OR from:calendar-notification@google.com` | 1 |
| Matt Levine | none yet: fill with `Shift+S` on one of his emails | 2 |
| Customer support | none yet: fill with `Shift+S`, option 3 (support address anywhere on the thread, so customer replies that cc it land here too) | 3 |
| Quo | none yet: fill with `Shift+S` | 4 |
| Datadog | none yet: fill with `Shift+S` | 5 |
| Other | everything left in the inbox | always last |

I left four splits empty on purpose. I don't know the exact sender addresses for Money Stuff, Quo, Datadog, or your support tool, and guessing wrong means mail silently lands in the wrong tab. Filling them takes one keypress each (section 5.7). The Calendar rule is my best guess and gets checked in Phase 2.

Note: Gmail has its own built-in "Multiple inboxes" setting ([Gmail Help](https://support.google.com/mail/answer/9694882?hl=en)). It stacks the sections vertically instead of showing tabs.

### 5.2 Keyboard shortcuts

Gmail's keyboard shortcuts must be turned on (Settings → General → Keyboard shortcuts on). For actions Gmail already has a key for, natemail passes the key straight through. When a natemail key is also a Gmail key (for example `s`, which stars in Gmail), natemail's version wins.

| Key | Action | How |
|---|---|---|
| `j` / `k` | Next / previous thread **(also selects it, see 5.6)** | natemail + Gmail |
| `s` | Add / remove the current thread from a multi-selection | natemail |
| `Esc` | Clear selection | natemail |
| `e` | Archive / mark done (everything selected) | Gmail native |
| `Enter` / `o` | Open thread | Gmail native |
| `Shift+P` | Toggle reading pane (thread beside the list) | natemail → Gmail reading pane |
| `r` | Reply | Gmail native |
| `a` | Reply all | Gmail native |
| `f` | Forward | Gmail native |
| `c` | Compose | Gmail native |
| `/` | Search | Gmail native |
| `h` | Remind me (opens picker) | natemail → Gmail snooze |
| `Shift+S` | Sort this sender into a split | natemail |
| `Shift+N` | Make a new split | natemail |
| `Tab` / `Shift+Tab` | Next / previous split tab | natemail |
| `Cmd+K` | Command palette | natemail |
| `Shift+B` | Create calendar invite (stretch) | natemail |
| `?` | Show natemail shortcut help | natemail |

Rules:
- Shortcuts never fire while you're typing in a text box, the compose window, or search.
- Gmail's native keys need to be checked against Gmail's official list in Phase 0. I couldn't open Google's help site from this session to confirm them.

### 5.3 Remind me

1. Press `h` on a selected or open thread.
2. A small box appears with preset buttons (Later today, Tomorrow 8am, This weekend, Next week) and a text field.
3. Text parsing handles: `2h`, `3d`, `tomorrow`, `tomorrow 9am`, `mon`, `mon 2pm`, `nov 20`, `nov 20 10am`. The parser is a small custom function with unit tests (no outside library).
4. On Enter, natemail opens Gmail's native snooze menu, picks "custom date & time", fills in the parsed date and time, and saves.
5. If something fails (for example, Gmail changed its menu), show a clear message: "Couldn't snooze. Gmail's layout may have changed." Never fail silently.

### 5.4 Command palette (Cmd+K)

- A centered search box listing every natemail action and its key.
- Type to filter, arrow keys to move, Enter to run.
- Also lists split tabs ("Go to Team").

### 5.5 Stretch: Create calendar invite

- On an open thread, `Shift+B` reads the subject and every address in From / To / Cc from the page, minus your own address.
- Opens a new tab with a prefilled Google Calendar event:
  `https://calendar.google.com/calendar/render?action=TEMPLATE&text=<subject>&dates=<next half hour, 30 min>&add=<emails>&details=<link back to thread>`
- You pick the time and click Save in Calendar. Calendar asks if you want to email the guests. That's the "send invite" step.
- No sign-in needed. Source for the URL parameters: a community reference that tested each one against the live Calendar editor, last checked 2026-08-19 ([add-event-to-calendar-docs](https://github.com/InteractionDesignFoundation/add-event-to-calendar-docs/blob/main/services/google.md)). Google doesn't officially document this URL, so it could change.
- Later (option B): create the event directly through the Calendar API, with a time picker inside Gmail.

### 5.6 Always-in-select mode

The problem: in Gmail, moving with `j`/`k` only moves a cursor. You have to press `x` to actually select a thread before `e` reliably acts on it, and the cursor itself is hard to see.

How natemail fixes it:
1. In the message list, the thread under the cursor is **always selected**. Moving with `j`/`k` selects the new thread and unselects the old one. The current row gets a clear highlight.
2. So `e`, `h`, and `Shift+S` always act on the thread you're looking at. No `x` needed.
3. To act on several threads at once, press `s` on each one. Threads marked with `s` stay selected while you keep moving. Then `e` archives all of them. `Esc` clears the selection.
4. After archiving, the cursor lands on the next thread, which is selected automatically, so you can keep pressing `e`.
5. Inside an open thread, every action applies to that thread.

How it works under the hood: natemail tracks which row the cursor is on and clicks that row's checkbox for you.

### 5.7 Sort a sender into a split, and make new splits

`Shift+S` on a selected or open thread:
1. A small box shows the sender, for example `alerts@datadoghq.com`.
2. Choose **who**: `1` = just this sender (`alerts@datadoghq.com`), `2` = anyone at this domain (`@datadoghq.com`), `3` = any thread this address is on, as sender or in To/Cc. Press `Tab` to pick a different address from the thread instead of the sender.
3. Choose **which split**: type to filter your splits, or type a new name and press Enter to create one.
4. natemail adds the rule and shows "Datadog now includes @datadoghq.com". Future and existing mail from them shows up in that tab right away, since tabs are just searches.
5. If the sender is already in another split, natemail asks whether to move them. A sender belongs to one split at a time.

`Shift+N` creates an empty split. You give it a name and optionally a raw Gmail search, then pick where it sits in the tab bar.

Splits can also be renamed, reordered, re-prioritized, and deleted, with their rules edited, on the options page (right-click the extension icon, then Options).

### 5.8 Reading pane toggle (`Shift+P`)

`Shift+P` switches between full-screen reading and a split view where the open thread sits beside the inbox list. It uses Gmail's own reading pane, so natemail only presses Gmail's toggle for you.

One-time setup: Gmail Settings → Inbox → Reading pane → turn on, "Right of inbox". Phase 1 confirms Gmail still shows a toggle control for this. If not, natemail switches the setting directly.

## 6. Technical design

- **Platform**: Chrome extension, Manifest V3 ([Chrome docs](https://developer.chrome.com/docs/extensions/develop)).
- **Language**: plain JavaScript, no build step. You edit a file and click reload. TypeScript can come later.
- **Permissions**: `storage` only, and host access to `https://mail.google.com/*`. No network calls to anything else.

File layout:

```
natemail/
  manifest.json        extension config: name, permissions, which scripts run on Gmail
  src/
    content.js         entry point: starts everything when Gmail loads
    gmail-dom.js       ALL Gmail page selectors and clicks live here (the only fragile file)
    keys.js            keyboard listener and keymap
    split-tabs.js      tab bar
    splits.js          split rules → Gmail search, priority, add-sender logic
    selection.js       always-in-select cursor (5.6)
    remind.js          remind picker plus snooze automation
    date-parse.js      "tomorrow 9am" → a date
    palette.js         Cmd+K palette
    calendar.js        stretch: calendar link builder
    styles.css         look of the tab bar, picker, palette
  options/
    options.html/js    edit splits: names, rules, display order, priority
  tests/
    date-parse.test.js runs with Node's built-in test runner, no installs
    splits.test.js     checks the generated searches, priority, and "Other"
  README.md            install steps for a beginner
```

Gmail is a single-page app (it loads once and swaps content in place), so `content.js` watches for page changes and redraws the tab bar when needed.

## 7. Security and compliance

- Email at Superscript may contain PHI (protected health information). This design keeps all data in the browser tab, makes no outside network calls, and stores only split settings (names and sender rules).
- IT/security approval for a custom extension on the work account: confirmed by Nate, 2026-11-09.

## 8. Plan

| Phase | What | You can test it by |
|---|---|---|
| 1 | Skeleton: manifest, content script, "natemail loaded" badge in Gmail | Loading unpacked in Chrome |
| 2 | Splits: tab bar, rules → search, priority, "Other", options page (+ tests) | Clicking tabs; checking no email shows in two tabs |
| 3 | Always-in-select cursor + core keys + `?` help | Triage a real inbox with only `j`/`k`/`e`/`s` |
| 4 | `Shift+S` sort sender into split, `Shift+N` new split | Fill the Matt Levine, Quo, Datadog, and support splits |
| 5 | Remind me (parser + tests, then snooze automation) | Snooze to 2 minutes from now, watch it come back |
| 6 | `Shift+P` reading pane toggle + Cmd+K palette | Toggle split view; run actions from Cmd+K |
| 7 | Stretch: calendar invite | `Shift+B` on a real thread |

Each phase is a separate commit, so you can stop at any point and still have a working tool.

## 9. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Gmail changes its page structure and a feature breaks | High, a few times a year | All selectors in one file, visible error messages, quick fix |
| Snooze automation is the most fragile piece | Medium | Clear failure message; fallback option: label-based reminders |
| Auto-select fights Gmail's own selection (for example, after a search or page change) | Medium | Re-sync cursor on every page change; `Esc` always resets |
| Long split searches (many senders in one split) hit Gmail's search length limit | Low | Warn in options page past ~50 rules; test in Phase 4 |
| Keys clash with Gmail or other extensions | Low | Rules in 5.2; keymap is editable |

## 10. Decisions log

- Repo: `rsup2/natemail` (new, separate from ops-command-center).
- Added keys: `Shift+P` reading pane toggle, `s` select, always-in-select mode, `Shift+S` sort sender into split (sender or whole domain), `Shift+N` new split.
- Splits: Important, Calendar, Matt Levine, Customer support, Quo, Datadog, Other.
- IT approval: yes.

- `Shift+P` toggles Gmail's reading pane (thread beside the list), not a separate window.
- Customer support: always involves one support address, alongside customer addresses. Handled by the `involves` rule.

## 11. Open questions

1. Repo owner: `rsup2` vs a personal GitHub account (see chat).
