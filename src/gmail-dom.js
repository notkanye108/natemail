// gmail-dom.js
// Every piece of code that depends on how Gmail's page is built lives in this
// file. When Gmail changes its layout and something breaks, fix it here.

(function () {
  const natemail = (window.natemail = window.natemail || {});

  natemail.dom = {
    // Gmail's main content area. Present once Gmail has finished loading.
    mainArea() {
      return document.querySelector('div[role="main"]');
    },

    // Gmail keeps several main areas in the page and hides the inactive ones.
    // This returns the one you can see.
    visibleMainArea() {
      const all = document.querySelectorAll('div[role="main"]');
      for (const el of all) {
        if (el.offsetParent !== null || el.getClientRects().length > 0) return el;
      }
      return null;
    },

    // True when a key press should be left alone because you're typing:
    // compose window, reply box, search bar, or any other text field.
    isTyping(target) {
      if (!target || !target.closest) return false;
      if (target.isContentEditable) return true;
      return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"], [role="combobox"]'));
    },

    // True on the main inbox list (also while a thread is open beside it in the
    // reading pane, which adds "/<thread id>" to the URL).
    isInboxHash(hash) {
      return /^#inbox(\/|$|\?)/.test(hash || "");
    },

    // ---- Message list -------------------------------------------------------
    // Gmail's list rows are <tr class="zA"> inside the visible main area.
    // (Class names like "zA" are Gmail's internal ones and are the most likely
    // thing to change.)

    listRows() {
      const main = natemail.dom.visibleMainArea();
      if (!main) return [];
      return [...main.querySelectorAll("tr.zA")].filter((r) => r.getClientRects().length > 0);
    },

    // A stable id for a row, so a selection survives Gmail redrawing the list.
    rowKey(row) {
      const el = row.querySelector("[data-thread-id], [data-legacy-thread-id]");
      return el ? el.getAttribute("data-thread-id") || el.getAttribute("data-legacy-thread-id") : row;
    },

    isRowChecked(row) {
      const box = row.querySelector('[role="checkbox"]');
      return Boolean(box && box.getAttribute("aria-checked") === "true");
    },

    setRowChecked(row, checked) {
      const box = row.querySelector('[role="checkbox"]');
      if (!box || natemail.dom.isRowChecked(row) === checked) return;
      natemail.dom.realClick(box);
    },

    // Opens the thread in a row (in the reading pane, if that's on).
    openRow(row) {
      const target = row.querySelector('[role="link"], .xT, .y6') || row;
      natemail.dom.realClick(target);
    },

    // Gmail listens for the whole mouse sequence, not just "click".
    realClick(el) {
      const opts = { bubbles: true, cancelable: true, view: window };
      el.dispatchEvent(new MouseEvent("mousedown", opts));
      el.dispatchEvent(new MouseEvent("mouseup", opts));
      el.dispatchEvent(new MouseEvent("click", opts));
    },

    // ---- People on a thread -------------------------------------------------
    // Gmail tags names with <span email="..." name="...">, both in list rows
    // and in an open thread.

    addressesIn(root) {
      const seen = new Map();
      for (const el of root.querySelectorAll("span[email]")) {
        const email = (el.getAttribute("email") || "").trim().toLowerCase();
        if (email && !seen.has(email)) seen.set(email, el.getAttribute("name") || el.textContent.trim() || email);
      }
      return [...seen].map(([email, name]) => ({ email, name }));
    },

    // The open thread (full screen or in the reading pane), or null.
    openThread() {
      for (const subject of document.querySelectorAll("h2.hP")) {
        if (subject.getClientRects().length > 0) {
          return subject.closest('div[role="main"]') || document.body;
        }
      }
      return null;
    },

    // Your own address. Gmail puts it in the tab title: "Inbox (3) - you@x.com - Gmail".
    myEmail() {
      const m = /[\w.+-]+@[\w-]+(\.[\w-]+)+/.exec(document.title);
      return m ? m[0].toLowerCase() : "";
    },

    // Resolves once Gmail's main area exists, or rejects after `timeoutMs`.
    waitForGmail(timeoutMs = 30000) {
      return new Promise((resolve, reject) => {
        const found = natemail.dom.mainArea();
        if (found) return resolve(found);

        const observer = new MutationObserver(() => {
          const el = natemail.dom.mainArea();
          if (el) {
            observer.disconnect();
            clearTimeout(timer);
            resolve(el);
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        const timer = setTimeout(() => {
          observer.disconnect();
          reject(new Error("Gmail's main area never appeared"));
        }, timeoutMs);
      });
    },
  };
})();
