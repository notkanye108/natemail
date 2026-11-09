# natemail

A small Chrome extension that adds Superhuman-style split inbox and keyboard
shortcuts to regular Gmail. Everything runs inside your browser. No server, no
sign-in, and no email leaves the page.

Full plan: [docs/SPEC.md](docs/SPEC.md)

## Status

| Phase | What | State |
|---|---|---|
| 1 | Skeleton: loads in Gmail and shows "natemail loaded" | done |
| 2 | Split inbox tabs, options page | done |
| 3 | Always-in-select cursor and core keys | done |
| 4 | Sort a sender into a split, new splits | done |
| 5 | Remind me | done |
| 6 | Reading pane toggle, Cmd+K palette | next |
| 7 | Calendar invite (stretch) | |

## Install (first time)

1. Download the code. Either:
   - **Easiest:** on the GitHub page for this repo, click the green **Code**
     button, then **Download ZIP**. Unzip it somewhere you'll keep it, for
     example `Documents/natemail`.
   - **With git:** `git clone https://github.com/notkanye108/natemail`
2. In Chrome, go to `chrome://extensions`.
3. Turn on **Developer mode** (switch in the top-right corner).
4. Click **Load unpacked** and choose the `natemail` folder (the one that
   contains `manifest.json`).
5. Open or refresh Gmail. A "natemail loaded" message appears in the
   bottom-left corner for 3 seconds.

Don't delete or move the folder afterward. Chrome runs the extension from it.

## Update to a new version

1. Replace the folder's contents with the new download (or run `git pull`
   inside it).
2. Go to `chrome://extensions` and click the circular reload arrow on the
   natemail card.
3. Refresh Gmail.

## Splits

- Tabs sit above the Gmail message list. Click one, or press `Tab` /
  `Shift+Tab` to move between them. Grey tabs have no rules yet.
- **Sort a sender:** on any thread, press `Shift+S`. Pick who
  (`1` just this address, `2` anyone at their domain, `3` any thread this
  address is on; `Tab` switches to another person on the thread), type a split
  name, and press `Enter`. Type a new name to create a split on the spot. A
  sender lives in one split at a time, so this moves them if needed.
- **New split:** press `Shift+N`.
- Edit splits in detail: right-click the natemail icon in Chrome's toolbar (or find it
  under the puzzle-piece icon), then **Options**.
- Each email lands in exactly one tab. When an email matches two splits, the
  one with the lower **Claim order** number gets it. **Other** catches the rest.
- A tab is just a Gmail search, so you'll see that search in Gmail's search bar.

## Keyboard

Press `?` in Gmail for the full list. The main idea: in the message list, the
thread under the blue cursor is always selected.

| Key | Does |
|---|---|
| `j` / `k` | Next / previous thread (clicking a thread also moves the cursor) |
| `e` | Archive: the cursor thread, or every picked thread if you picked some |
| `s` | Pick / unpick the cursor thread, to act on several at once |
| `Esc` | Unpick all |
| `Enter` / `o` | Open the thread (beside the list, with the reading pane on) |
| `h` | Remind me: snooze until a time (`tomorrow 9am`, `fri`, `3d`, `nov 20`) |
| `Shift+S` | Sort this sender into a split |
| `Shift+N` | Make a new split |
| `r` / `a` / `f` | Reply / reply all / forward, in an open thread (Gmail's own keys) |

Gmail's keyboard shortcuts must be on: Settings → See all settings → General →
Keyboard shortcuts on.

## Remind me

Press `h`, then pick a preset with the arrow keys or type a time and press
`Enter`. natemail uses Gmail's own Snooze, so the thread comes back at that time
on every device, even with your laptop closed.

Typing works for: `2h`, `30m`, `3d`, `1w`, `5pm`, `tonight`, `tomorrow`,
`tmrw 9am`, `mon`, `friday 2pm`, `this weekend`, `next week`, `nov 20`,
`nov 20 10am`, `11/20`. With no time given, it's 8:00 AM. A plain `3` means
3 PM.

## If something breaks

Gmail changes its page layout now and then. natemail shows a red message when
it can't find what it expects. All of the Gmail-specific code is in
`src/gmail-dom.js`, so that's usually the only file that needs a fix.

## Run the tests

Needs [Node.js](https://nodejs.org) 18 or newer. From the `natemail` folder:

```
node --test
```

Optional browser checks against a fake Gmail page (needs Playwright):
`tests/e2e/run.sh`
