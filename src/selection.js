// selection.js
// "Always in select mode": in the message list, the thread under the cursor
// is always selected, so `e` (and later `h`, Shift+S) acts on it right away.
// `s` keeps extra threads selected while you move; Esc clears them.

(function () {
  const natemail = window.natemail;
  const dom = natemail.dom;

  let cursorRow = null; // the <tr> the cursor is on
  let cursorIndex = 0; // its position, used when Gmail removes the row (archive)
  const kept = new Set(); // row keys selected with `s`
  let lastBase = null;

  function rows() {
    return dom.listRows();
  }

  function listActive() {
    return rows().length > 0;
  }

  function isKept(row) {
    return kept.has(dom.rowKey(row));
  }

  // Draws the cursor and makes sure the cursor row is checked in Gmail.
  function apply() {
    const all = rows();
    for (const r of all) {
      r.classList.toggle("natemail-cursor", r === cursorRow);
      r.classList.toggle("natemail-kept", isKept(r));
    }
    if (cursorRow) dom.setRowChecked(cursorRow, true);
  }

  function moveTo(index) {
    const all = rows();
    if (all.length === 0) return;
    index = Math.max(0, Math.min(all.length - 1, index));
    const next = all[index];
    if (cursorRow && cursorRow !== next && cursorRow.isConnected && !isKept(cursorRow)) {
      dom.setRowChecked(cursorRow, false);
    }
    cursorRow = next;
    cursorIndex = index;
    apply();
    cursorRow.scrollIntoView({ block: "nearest" });
  }

  // Keeps the cursor valid after Gmail changes the list: new mail arriving,
  // a thread archived, a different split opened.
  function resync() {
    const base = location.hash.replace(/\/[A-Za-z0-9_-]{12,}$/, "");
    if (base !== lastBase) {
      // A different list (another split, Inbox, a search): start at the top.
      lastBase = base;
      cursorRow = null;
      cursorIndex = 0;
      kept.clear();
    }
    const all = rows();
    if (all.length === 0) {
      cursorRow = null;
      return;
    }
    if (!cursorRow || !all.includes(cursorRow)) {
      // Row gone (archived, snoozed): the next one slides into its place.
      cursorIndex = Math.min(cursorIndex, all.length - 1);
      cursorRow = all[cursorIndex];
    } else {
      cursorIndex = all.indexOf(cursorRow);
    }
    apply();
  }

  let pending = null;
  function scheduleResync() {
    if (pending) return;
    pending = setTimeout(() => {
      pending = null;
      resync();
    }, 80);
  }

  function toggleKept() {
    if (!cursorRow) return;
    const key = dom.rowKey(cursorRow);
    if (kept.has(key)) kept.delete(key);
    else kept.add(key);
    apply();
  }

  function clearKept() {
    for (const r of rows()) {
      if (isKept(r) && r !== cursorRow) dom.setRowChecked(r, false);
    }
    kept.clear();
    apply();
  }

  natemail.selection = {
    // Threads the next action should apply to: the cursor row plus any kept rows.
    selectedRows() {
      return rows().filter((r) => r === cursorRow || isKept(r));
    },
    cursorRow() {
      return cursorRow && cursorRow.isConnected ? cursorRow : null;
    },
    // Called after an action removes the selected threads (archive, snooze).
    afterRemove() {
      kept.clear();
    },
    start() {
      new MutationObserver(scheduleResync).observe(document.body, { childList: true, subtree: true });
      window.addEventListener("hashchange", scheduleResync);
      resync();
    },
  };

  const keys = natemail.keys;
  keys.register({ key: "j", help: "Next thread (and select it)", when: listActive, run: () => moveTo(cursorIndex + 1) });
  keys.register({ key: "k", help: "Previous thread (and select it)", when: listActive, run: () => moveTo(cursorIndex - 1) });
  keys.register({ key: "s", help: "Add / remove thread from a multi-selection", when: listActive, run: toggleKept });
  keys.register({
    key: "Escape",
    label: "Esc",
    help: "Clear multi-selection",
    when: () => listActive() && kept.size > 0,
    run: clearKept,
  });
  const open = () => cursorRow && dom.openRow(cursorRow);
  keys.register({ key: "Enter", label: "Enter / o", help: "Open thread", when: () => listActive() && Boolean(cursorRow), run: open });
  keys.register({ key: "o", when: () => listActive() && Boolean(cursorRow), run: open });
  // `e` is Gmail's own archive. We make sure the cursor row is checked first,
  // then let Gmail do the archiving.
  keys.register({
    key: "e",
    passThrough: true,
    when: listActive,
    run: () => {
      if (cursorRow) dom.setRowChecked(cursorRow, true);
      natemail.selection.afterRemove();
    },
  });
})();
