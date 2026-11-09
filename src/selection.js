// selection.js
// "Always in select mode" for Gmail's message list.
//
// The cursor (blue bar) is the thread you're on. It moves with j/k, and also
// when you click a thread or open one.
//
// - Nothing picked with `s`: the cursor thread is selected, so `e` (and `h`,
//   Shift+S) act on it.
// - Threads picked with `s` (or ticked with the mouse): only those are
//   selected, and actions apply to all of them. `s` again unpicks one. Esc
//   unpicks all, and you're back to "cursor thread is selected".

(function () {
  const natemail = window.natemail;
  const dom = natemail.dom;

  let cursorRow = null; // the <tr> the cursor is on
  let cursorIndex = 0; // its position, used when Gmail removes the row (archive)
  const picked = new Set(); // row keys picked with `s` or the mouse
  const managed = new Set(); // row keys natemail ticked (so we only untick our own)
  let lastBase = null;
  let cursorUnticked = false; // you unticked the cursor row with the mouse
  let autoPick = null; // cursor thread picked for you when you ticked another by hand

  // Safety valve: if Gmail keeps refusing a tick, stop retrying instead of
  // clicking forever.
  const attempts = new Map();
  function tick(row, checked) {
    if (dom.isRowChecked(row) === checked) return;
    const key = dom.rowKey(row) + ":" + checked;
    const now = Date.now();
    const a = attempts.get(key) || { n: 0, since: now };
    if (now - a.since > 2000) Object.assign(a, { n: 0, since: now });
    if (++a.n > 4) return;
    attempts.set(key, a);
    dom.setRowChecked(row, checked);
  }

  function rows() {
    return dom.listRows();
  }

  function listActive() {
    return rows().length > 0;
  }

  function isPicked(row) {
    return picked.has(dom.rowKey(row));
  }

  function wanted(row) {
    if (picked.size > 0) return isPicked(row);
    return row === cursorRow && !cursorUnticked;
  }

  // Makes Gmail's checkboxes match what natemail wants, and draws the cursor.
  function apply() {
    for (const r of rows()) {
      const key = dom.rowKey(r);
      r.classList.toggle("natemail-cursor", r === cursorRow);
      r.classList.toggle("natemail-picked", isPicked(r));
      if (wanted(r)) {
        managed.add(key);
        tick(r, true);
      } else if (managed.has(key)) {
        managed.delete(key);
        tick(r, false);
      }
    }
  }

  function setCursor(row, index) {
    if (row !== cursorRow) cursorUnticked = false;
    cursorRow = row;
    cursorIndex = index;
    apply();
  }

  function moveTo(index) {
    resync();
    const all = rows();
    if (all.length === 0) return;
    index = Math.max(0, Math.min(all.length - 1, index));
    setCursor(all[index], index);
    cursorRow.scrollIntoView({ block: "nearest" });
  }

  // Keeps the cursor valid after Gmail changes the list or its checkboxes:
  // new mail arriving, a thread archived, selection cleared, a split opened.
  function resync() {
    const base = location.hash.replace(/\/[A-Za-z0-9_-]{12,}$/, "");
    if (base !== lastBase) {
      // A different list (another split, Inbox, a search): start at the top.
      lastBase = base;
      cursorRow = null;
      cursorIndex = 0;
      picked.clear();
      managed.clear();
    }
    const all = rows();
    if (all.length === 0) {
      cursorRow = null;
      return;
    }
    if (!cursorRow || !all.includes(cursorRow)) {
      // Row gone (archived, snoozed) or redrawn: take the one now in its place.
      cursorIndex = Math.min(cursorIndex, all.length - 1);
      cursorRow = all[cursorIndex];
      cursorUnticked = false;
    } else {
      cursorIndex = all.indexOf(cursorRow);
    }
    // Forget picks for threads that are gone.
    const present = new Set(all.map(dom.rowKey));
    for (const k of picked) if (!present.has(k)) picked.delete(k);
    apply();
  }

  let pending = null;
  function scheduleResync() {
    if (pending) return;
    pending = setTimeout(() => {
      pending = null;
      resync();
    }, 60);
  }

  function togglePick() {
    resync();
    if (!cursorRow) return;
    const key = dom.rowKey(cursorRow);
    autoPick = null; // any pick you make with s is your own
    if (picked.has(key)) picked.delete(key);
    else picked.add(key);
    apply();
  }

  function clearPicks() {
    picked.clear();
    autoPick = null;
    apply();
  }

  // Mouse: clicking a thread moves the cursor there; ticking a checkbox by
  // hand picks or unpicks that thread.
  function onMouseClick(e) {
    if (!e.isTrusted) return; // ignore natemail's own clicks
    const row = e.target.closest && e.target.closest("tr.zA");
    if (!row) return;
    const all = rows();
    const index = all.indexOf(row);
    if (index === -1) return;
    const onCheckbox = Boolean(e.target.closest('[role="checkbox"]'));

    // Let Gmail toggle the box first, then read what it did.
    setTimeout(() => {
      if (onCheckbox) {
        const key = dom.rowKey(row);
        const nowChecked = dom.isRowChecked(row);
        if (picked.size === 0 && row === cursorRow) {
          // Unticking the cursor row by hand: respect it until the cursor moves.
          cursorUnticked = !nowChecked;
          if (nowChecked) managed.add(key);
        } else if (nowChecked) {
          picked.add(key);
          managed.add(key);
          // Picking a first thread by hand keeps the cursor thread too, so
          // nothing you could see as selected silently drops out.
          if (picked.size === 1 && cursorRow && cursorRow !== row && !cursorUnticked) {
            autoPick = dom.rowKey(cursorRow);
            picked.add(autoPick);
          }
        } else {
          picked.delete(key);
          managed.delete(key);
          // Only the automatic pick left: go back to plain cursor mode.
          if (picked.size === 1 && picked.has(autoPick)) picked.clear();
        }
        apply();
      } else {
        setCursor(row, index);
      }
    }, 0);
  }

  natemail.selection = {
    // Threads the next action applies to.
    selectedRows() {
      resync();
      return rows().filter(wanted);
    },
    cursorRow() {
      return cursorRow && cursorRow.isConnected ? cursorRow : null;
    },
    // Re-checks everything right now. Call before an action reads selection.
    sync() {
      resync();
    },
    start() {
      new MutationObserver(scheduleResync).observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["aria-checked"],
      });
      window.addEventListener("hashchange", scheduleResync);
      document.addEventListener("click", onMouseClick, true);
      resync();
    },
  };

  const keys = natemail.keys;
  keys.register({ key: "j", help: "Next thread", when: listActive, run: () => moveTo(cursorIndex + 1) });
  keys.register({ key: "k", help: "Previous thread", when: listActive, run: () => moveTo(cursorIndex - 1) });
  keys.register({ key: "s", help: "Pick / unpick thread (act on several at once)", when: listActive, run: togglePick });
  keys.register({
    key: "Escape",
    label: "Esc",
    help: "Unpick all",
    when: () => listActive() && picked.size > 0,
    run: clearPicks,
  });
  const open = () => {
    resync();
    if (cursorRow) dom.openRow(cursorRow);
  };
  keys.register({ key: "Enter", label: "Enter / o", help: "Open thread", when: () => listActive(), run: open });
  keys.register({ key: "o", when: () => listActive(), run: open });
  // `e` is Gmail's own archive. Right before Gmail sees the key, make sure the
  // checkboxes are exactly what natemail shows.
  keys.register({
    key: "e",
    passThrough: true,
    when: listActive,
    run: () => {
      resync();
      for (const r of rows()) if (wanted(r)) dom.setRowChecked(r, true);
    },
  });
})();
