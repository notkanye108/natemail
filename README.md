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
| 3 | Always-in-select cursor and core keys | next |
| 4 | Sort a sender into a split, new splits | |
| 5 | Remind me | |
| 6 | Reading pane toggle, Cmd+K palette | |
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
- Edit splits: right-click the natemail icon in Chrome's toolbar (or find it
  under the puzzle-piece icon), then **Options**.
- Each email lands in exactly one tab. When an email matches two splits, the
  one with the lower **Claim order** number gets it. **Other** catches the rest.
- A tab is just a Gmail search, so you'll see that search in Gmail's search bar.

## If something breaks

Gmail changes its page layout now and then. natemail shows a red message when
it can't find what it expects. All of the Gmail-specific code is in
`src/gmail-dom.js`, so that's usually the only file that needs a fix.

## Run the tests

Needs [Node.js](https://nodejs.org) 18 or newer. From the `natemail` folder:

```
node --test
```
