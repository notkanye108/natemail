// split-tabs.js
// The tab bar above Gmail's message list. Each tab is a Gmail search
// (built in splits.js). Clicking a tab, or pressing Tab / Shift+Tab, changes
// Gmail's URL to that search, and Gmail does the rest.

(function () {
  const natemail = window.natemail;
  const S = natemail.splits;
  const dom = natemail.dom;

  let splits = [];
  let bar = null;
  let painted = ""; // what the bar currently shows, so we only redraw on changes

  function currentTabs() {
    return S.tabs(splits);
  }

  // Show the bar on the inbox and on any split's search, not elsewhere
  // (Sent, Drafts, labels, other searches).
  function shouldShow() {
    const hash = location.hash;
    return dom.isInboxHash(hash) || S.activeTabId(splits, hash) !== null;
  }

  function goToTab(tab) {
    if (!tab.query) {
      natemail.toast(`${tab.name} has no senders yet. Press Shift+S on one of their emails.`, { ms: 4000 });
      return;
    }
    location.hash = S.searchHash(tab.query);
  }

  function build() {
    const el = document.createElement("div");
    el.className = "natemail-tabs";
    el.setAttribute("role", "tablist");
    el.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-natemail-tab]");
      if (!btn) return;
      const tab = currentTabs().find((t) => t.id === btn.dataset.natemailTab);
      if (tab) goToTab(tab);
    });
    return el;
  }

  function paint() {
    if (!bar) return;
    const active = S.activeTabId(splits, location.hash);
    // Redrawing changes the page, which would trigger another sync. Skip it
    // when nothing changed, or this would loop forever.
    const signature = JSON.stringify([active, currentTabs()]);
    if (signature === painted) return;
    painted = signature;
    bar.replaceChildren(
      ...currentTabs().map((t) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "natemail-tab";
        b.dataset.natemailTab = t.id;
        b.setAttribute("role", "tab");
        b.setAttribute("aria-selected", String(t.id === active));
        if (!t.query) {
          b.classList.add("natemail-tab--empty");
          b.title = "No senders yet";
        }
        b.textContent = t.name;
        return b;
      })
    );
  }

  // Put the bar at the top of the visible main area, or remove it when it
  // doesn't belong. Safe to call as often as we like.
  function sync() {
    if (!shouldShow()) {
      if (bar) bar.remove();
      return;
    }
    const main = dom.visibleMainArea();
    if (!main) return;
    if (!bar) bar = build();
    if (bar.parentElement !== main || main.firstElementChild !== bar) {
      main.prepend(bar);
    }
    paint();
  }

  // Gmail redraws its page constantly, so check again shortly after changes.
  let pending = null;
  function scheduleSync() {
    if (pending) return;
    pending = setTimeout(() => {
      pending = null;
      sync();
    }, 100);
  }

  function onKeyDown(e) {
    if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey) return;
    if (natemail.keys.modalOpen || dom.isTyping(e.target) || !shouldShow()) return;

    const list = currentTabs().filter((t) => t.query);
    if (list.length === 0) return;
    e.preventDefault();
    e.stopPropagation();

    const active = S.activeTabId(splits, location.hash);
    let i = list.findIndex((t) => t.id === active);
    if (i === -1) i = e.shiftKey ? 0 : -1; // from plain Inbox: Tab → first, Shift+Tab → last
    const next = list[(i + (e.shiftKey ? -1 : 1) + list.length) % list.length];
    goToTab(next);
  }

  natemail.splitTabs = {
    tabs: currentTabs,
    goToTab,
    async start() {
      splits = await natemail.store.loadSplits();
      natemail.store.onSplitsChanged((next) => {
        // If you're on a split whose rules just changed, its search changed
        // too. Follow it, so you stay on the same tab.
        const wasOn = S.activeTabId(splits, location.hash) || null;
        splits = next;
        if (wasOn) {
          const tab = currentTabs().find((t) => t.id === wasOn);
          if (tab && tab.query && S.activeTabId(splits, location.hash) !== wasOn) {
            location.hash = S.searchHash(tab.query);
          }
        }
        sync();
      });
      window.addEventListener("hashchange", sync);
      window.addEventListener("keydown", onKeyDown, true);
      new MutationObserver(scheduleSync).observe(document.body, { childList: true, subtree: true });
      sync();
    },
  };
})();
