// remind.js
// `h`: Remind me. Pick a preset or type "tomorrow 9am", "mon", "3d", press
// Enter, and Gmail's own Snooze hides the thread until then.

(function () {
  const natemail = window.natemail;
  const dom = natemail.dom;
  const dates = natemail.dates;

  // These match the names in Gmail's Snooze menu, so picking one clicks
  // Gmail's own option and Gmail decides the exact time.
  const PRESETS = ["Later today", "Tomorrow", "This weekend", "Next week"];

  function el(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  // Is there something to remind about? A thread under the cursor, or an
  // open thread.
  function hasTarget() {
    return Boolean(natemail.selection.cursorRow() || dom.openThread());
  }

  function remind() {
    if (!hasTarget()) {
      natemail.toast("Point the cursor at a thread (or open one) first.");
      return;
    }
    const count = natemail.selection.cursorRow() ? natemail.selection.selectedRows().length : 1;
    let highlight = 0;

    natemail.ui.modal({
      title: count > 1 ? `Remind me about ${count} threads` : "Remind me",
      build(panel, close) {
        const input = el("input", "natemail-input");
        input.placeholder = "tomorrow 9am, mon, 3d, nov 20 ...";
        const list = el("div", "natemail-options");
        const preview = el("div", "natemail-note");
        panel.append(input, list, preview);

        function typed() {
          return input.value.trim() ? dates.parse(input.value) : null;
        }

        function draw() {
          const showPresets = !input.value.trim();
          list.replaceChildren(
            ...(showPresets ? PRESETS : []).map((name, i) => {
              const row = el("div", "natemail-option", name);
              row.setAttribute("aria-selected", String(i === highlight));
              row.addEventListener("mousedown", (e) => {
                e.preventDefault();
                go(name);
              });
              return row;
            })
          );
          preview.classList.remove("natemail-note--error");
          if (showPresets) {
            preview.textContent = "Or type a time. Enter to confirm.";
          } else if (typed()) {
            preview.textContent = dates.format(typed());
          } else {
            preview.textContent = "Not sure when that is. Try: tomorrow 9am, fri, 3d, nov 20.";
            preview.classList.add("natemail-note--error");
          }
        }

        let busy = false;
        async function go(when) {
          if (busy) return;
          busy = true;
          close();
          try {
            // Make Gmail's checkboxes match the selection before Gmail reads them.
            natemail.selection.sync();
            await dom.snooze(when);
            natemail.toast(
              typeof when === "string" ? `Snoozed: ${when.toLowerCase()}` : `Snoozed until ${dates.format(when)}`
            );
          } catch (err) {
            console.error("[natemail]", err);
            natemail.toast(err.message + " Gmail's layout may have changed.", { error: true, ms: 7000 });
          }
        }

        input.addEventListener("input", () => {
          highlight = 0;
          draw();
        });
        input.addEventListener("keydown", (e) => {
          const presets = !input.value.trim();
          if (presets && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            highlight = (highlight + (e.key === "ArrowDown" ? 1 : PRESETS.length - 1)) % PRESETS.length;
            draw();
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (presets) go(PRESETS[highlight]);
            else if (typed()) go(typed());
          }
        });
        draw();
      },
    });
  }

  natemail.keys.register({ key: "h", help: "Remind me (snooze until a time)", when: hasTarget, run: remind });
})();
