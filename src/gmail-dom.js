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

    // ---- Snooze --------------------------------------------------------------
    // natemail drives Gmail's own Snooze menu, so reminders sync to your phone
    // and come back even when your laptop is closed. Steps:
    //   1. click Gmail's Snooze button (toolbar, acts on the selected threads)
    //   2. in the menu, click a preset ("Tomorrow") or "Pick date & time"
    //   3. for a custom time: fill in the date and time boxes, click Save
    // Each step throws an error naming itself, so a break is easy to locate.

    visible(el) {
      return Boolean(el && el.getClientRects().length > 0);
    },

    // Resolves with the first visible match of `find()`, or rejects.
    async waitFor(find, step, timeoutMs = 2500) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const found = find();
        if (found) return found;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw new Error(`Couldn't snooze (step: ${step}).`);
    },

    snoozeButton() {
      const candidates = document.querySelectorAll(
        '[role="button"][aria-label^="Snooze"], [role="button"][data-tooltip^="Snooze"]'
      );
      return [...candidates].find(natemail.dom.visible) || null;
    },

    // Visible menu items in Gmail's open Snooze menu.
    snoozeMenuItems() {
      const items = [...document.querySelectorAll('[role="menu"] [role="menuitem"], [role="menuitem"]')].filter(
        natemail.dom.visible
      );
      return items.some((i) => /pick date/i.test(i.textContent)) ? items : null;
    },

    // Gmail's "Pick date & time" dialog, once open: its date box, time box, Save.
    snoozeDialog() {
      for (const d of document.querySelectorAll('[role="dialog"], [role="alertdialog"]')) {
        if (!natemail.dom.visible(d)) continue;
        const inputs = [...d.querySelectorAll("input")].filter(natemail.dom.visible);
        const byLabel = (re) =>
          inputs.find((i) => re.test((i.getAttribute("aria-label") || "") + " " + (i.getAttribute("placeholder") || "")));
        const date = byLabel(/date/i) || inputs[0];
        const time = byLabel(/time/i) || inputs[1];
        const save = [...d.querySelectorAll('[role="button"], button')].find(
          (b) => natemail.dom.visible(b) && /^\s*save\s*$/i.test(b.textContent)
        );
        if (date && time && save) return { dialog: d, date, time, save };
      }
      return null;
    },

    // Types into one of Gmail's text boxes the way a person would.
    fillInput(input, value) {
      input.focus();
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      input.blur();
    },

    // Snoozes whatever Gmail has selected (or the open thread).
    // `when` is a Date, or a preset name Gmail shows ("Tomorrow").
    async snooze(when) {
      const dom = natemail.dom;
      const button = await dom.waitFor(dom.snoozeButton, "finding Gmail's Snooze button", 1500);
      dom.realClick(button);
      const items = await dom.waitFor(dom.snoozeMenuItems, "opening Gmail's Snooze menu");

      if (typeof when === "string") {
        const item = items.find((i) => i.textContent.trim().toLowerCase().startsWith(when.toLowerCase()));
        if (!item) throw new Error(`Couldn't snooze (step: finding "${when}" in Gmail's menu).`);
        dom.realClick(item);
        return;
      }

      dom.realClick(items.find((i) => /pick date/i.test(i.textContent)));
      const box = await dom.waitFor(dom.snoozeDialog, "opening Gmail's date & time box");
      // Gmail shows these as "Nov 20, 2026" and "9:00 AM".
      // Chrome puts an invisible special space before "AM"; Gmail wants a normal one.
      const plain = (t) => t.replace(/[\u202f\u00a0]/g, " ");
      dom.fillInput(box.date, plain(when.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })));
      dom.fillInput(box.time, plain(when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })));
      dom.realClick(box.save);
      await dom.waitFor(() => !dom.visible(box.dialog), "saving the date & time (Gmail may not have accepted it)");
    },

    // ---- Reading pane --------------------------------------------------------
    // With Gmail's reading pane on, the list toolbar has a "Toggle split pane
    // mode" button. Clicking it either toggles directly or opens a small menu
    // (No split / Vertical split / Horizontal split).

    splitPaneButton() {
      const candidates = document.querySelectorAll(
        '[role="button"][aria-label*="split pane" i], [role="button"][data-tooltip*="split pane" i]'
      );
      return [...candidates].find(natemail.dom.visible) || null;
    },

    splitPaneMenuItems() {
      const items = [
        ...document.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]'),
      ].filter((i) => natemail.dom.visible(i) && /split/i.test(i.textContent));
      return items.length >= 2 ? items : null;
    },

    // Switches between the list beside the thread and full-screen reading.
    // `remembered` is "split" or "none": what we think it is now, used only if
    // Gmail's menu doesn't say which option is current.
    async toggleReadingPane(remembered) {
      const dom = natemail.dom;
      const button = dom.splitPaneButton();
      if (!button) {
        throw new Error(
          "Couldn't find Gmail's split-pane button. Check Gmail settings → Inbox → Reading pane is on."
        );
      }
      const hadSplit = Boolean(dom.openThread()) && dom.listRows().length > 0;
      dom.realClick(button);

      // Some Gmail versions open a menu; others toggle right away.
      let items = null;
      try {
        items = await dom.waitFor(dom.splitPaneMenuItems, "", 400);
      } catch (e) {
        return; // toggled directly
      }
      const isOn = (i) => i.getAttribute("aria-checked") === "true" || i.getAttribute("aria-selected") === "true";
      const current = items.find(isOn);
      const nowSplit = current ? !/^\s*no split/i.test(current.textContent) : remembered === "split" || hadSplit;
      const want = nowSplit
        ? items.find((i) => /no split/i.test(i.textContent))
        : items.find((i) => /vertical/i.test(i.textContent));
      if (!want) throw new Error("Couldn't switch the reading pane (step: finding the menu option).");
      dom.realClick(want);
      return nowSplit ? "none" : "split";
    },

    // ---- Toolbar actions for the Cmd+K palette ------------------------------

    toolbarButton(label) {
      const re = new RegExp("^" + label, "i");
      return (
        [...document.querySelectorAll('[role="button"][aria-label], [role="button"][data-tooltip]')].find(
          (b) => natemail.dom.visible(b) && (re.test(b.getAttribute("aria-label") || "") || re.test(b.getAttribute("data-tooltip") || ""))
        ) || null
      );
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
