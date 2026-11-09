// palette.js
// Shift+P: switch the reading pane (thread beside the list ↔ full screen).
// Cmd+K (Ctrl+K on Windows): search every action by name and run it.

(function () {
  const natemail = window.natemail;
  const dom = natemail.dom;
  const keys = natemail.keys;

  // ---- Shift+P ---------------------------------------------------------------

  let paneState = localStorage.getItem("natemail-pane") || "split";

  async function toggleReadingPane() {
    try {
      const result = await dom.toggleReadingPane(paneState);
      if (result) {
        paneState = result;
        localStorage.setItem("natemail-pane", paneState);
      }
    } catch (err) {
      natemail.toast(err.message, { error: true, ms: 6000 });
    }
  }

  keys.register({ key: "P", label: "Shift+P", help: "Switch reading pane (beside the list ↔ full screen)", run: toggleReadingPane });

  // ---- Cmd+K -----------------------------------------------------------------

  function el(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  // Gmail's own toolbar buttons, so the palette can archive etc. too.
  function clickToolbar(label) {
    return () => {
      natemail.selection.sync();
      const b = dom.toolbarButton(label);
      if (!b) throw new Error(`Couldn't find Gmail's ${label} button here.`);
      dom.realClick(b);
    };
  }

  function commands() {
    const list = [];
    // natemail's own shortcuts (and the help screen)
    for (const b of keys.list()) {
      if (!b.help || b.cmd) continue;
      list.push({ name: b.help, key: b.label || b.key, when: b.when, run: b.run });
    }
    // Gmail actions
    list.push({ name: "Archive", key: "e", run: clickToolbar("Archive") });
    list.push({ name: "Mark as unread", run: clickToolbar("Mark as unread") });
    list.push({ name: "Delete", key: "#", run: clickToolbar("Delete") });
    list.push({ name: "Compose", key: "c", run: () => (location.hash = "#inbox?compose=new") });
    // Splits
    for (const t of natemail.splitTabs.tabs()) {
      if (!t.query) continue;
      list.push({ name: "Go to " + t.name, run: () => natemail.splitTabs.goToTab(t) });
    }
    list.push({ name: "Go to Inbox (everything)", run: () => (location.hash = "#inbox") });
    list.push({ name: "Go to Snoozed", run: () => (location.hash = "#snoozed") });
    list.push({ name: "Go to Sent", run: () => (location.hash = "#sent") });
    list.push({ name: "Edit splits (options page)", run: () => chrome.runtime.sendMessage({ type: "open-options" }) });
    return list.filter((c) => !c.when || c.when());
  }

  // Every word you type must appear somewhere in the name, in any order.
  function filter(list, text) {
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    return list.filter((c) => words.every((w) => c.name.toLowerCase().includes(w)));
  }

  function openPalette() {
    const all = commands();
    let shown = all;
    let highlight = 0;

    natemail.ui.modal({
      build(panel, close) {
        panel.classList.add("natemail-palette");
        const input = el("input", "natemail-input");
        input.placeholder = "Type a command…";
        const list = el("div", "natemail-options");
        panel.append(input, list);

        function draw() {
          list.replaceChildren(
            ...shown.map((c, i) => {
              const row = el("div", "natemail-option natemail-command");
              row.setAttribute("aria-selected", String(i === highlight));
              row.append(el("span", "", c.name));
              if (c.key) row.append(el("kbd", "", c.key));
              row.addEventListener("mousedown", (e) => {
                e.preventDefault();
                run(c);
              });
              return row;
            })
          );
          const current = list.children[highlight];
          if (current) current.scrollIntoView({ block: "nearest" });
        }

        function run(c) {
          close();
          // Let the palette disappear and focus return to Gmail first.
          setTimeout(() => {
            try {
              c.run();
            } catch (err) {
              natemail.toast(err.message, { error: true, ms: 5000 });
            }
          }, 0);
        }

        input.addEventListener("input", () => {
          shown = filter(all, input.value);
          highlight = 0;
          draw();
        });
        input.addEventListener("keydown", (e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (shown.length) highlight = (highlight + (e.key === "ArrowDown" ? 1 : shown.length - 1)) % shown.length;
            draw();
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (shown[highlight]) run(shown[highlight]);
          }
        });
        draw();
      },
    });
  }

  keys.register({ key: "k", cmd: true, label: "Cmd+K", help: "Command palette", run: openPalette });

  natemail.palette = { commands, filter };
})();
