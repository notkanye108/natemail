// keys.js
// One keyboard listener for all of natemail. Features register their keys
// here, and the `?` help screen is built from the same list.

(function () {
  const natemail = window.natemail;
  const dom = natemail.dom;
  const bindings = [];

  // Keys Gmail already handles. Listed in help, not intercepted.
  const GMAIL_KEYS = [
    ["e", "Archive / mark done (everything selected)"],
    ["r", "Reply (in an open thread)"],
    ["a", "Reply all (in an open thread)"],
    ["f", "Forward (in an open thread)"],
    ["c", "Compose"],
    ["/", "Search"],
  ];

  natemail.keys = {
    // binding = { key: "j", cmd: false, label: "j", help: "Next thread",
    //             when: () => boolean, run: (event) => void,
    //             passThrough: false }
    // `key` is the character Chrome reports, so Shift+S is "S" and ? is "?".
    // `passThrough: true` runs our code and then lets Gmail handle the key too.
    register(binding) {
      bindings.push(binding);
    },

    // Every binding with a help text, for the ? screen and the Cmd+K palette.
    list() {
      return bindings.slice();
    },

    // Modals (pickers, palette) set this so global keys pause while they're open.
    modalOpen: false,
  };

  function onKeyDown(e) {
    if (natemail.keys.modalOpen || dom.isTyping(e.target)) return;
    if (e.altKey) return;
    // `cmd: true` bindings answer to Cmd on a Mac and Ctrl elsewhere.
    const cmd = e.metaKey || e.ctrlKey;
    // Shift+S arrives as "S", so plain keys compare exactly. With Cmd/Ctrl,
    // compare without case (Cmd+K arrives as "k" or "K").
    const matches = (x) =>
      cmd ? Boolean(x.cmd) && x.key.toLowerCase() === e.key.toLowerCase() : !x.cmd && x.key === e.key;
    const b = bindings.find((x) => matches(x) && (!x.when || x.when()));
    if (!b) return;
    if (!b.passThrough) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
    try {
      b.run(e);
    } catch (err) {
      console.error("[natemail]", err);
      natemail.toast("natemail: " + err.message, { error: true, ms: 5000 });
    }
  }

  // ---- ? help screen ---------------------------------------------------------

  function showHelp() {
    const rows = [
      ...bindings.filter((b) => b.help && b.key !== "?").map((b) => [b.label || b.key, b.help]),
      ["Tab / Shift+Tab", "Next / previous split"],
      ...GMAIL_KEYS,
      ["?", "Show this help"],
    ];
    natemail.ui.modal({
      title: "Keyboard shortcuts",
      build(panel) {
        const table = document.createElement("div");
        table.className = "natemail-help";
        for (const [k, text] of rows) {
          const key = document.createElement("kbd");
          key.textContent = k;
          const label = document.createElement("span");
          label.textContent = text;
          table.append(key, label);
        }
        panel.append(table);
      },
    });
  }

  natemail.keys.register({ key: "?", help: "Show this help", run: showHelp });

  window.addEventListener("keydown", onKeyDown, true);
})();
