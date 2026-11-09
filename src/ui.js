// ui.js
// Shared on-screen pieces: the small toast message and a centered modal box.

(function () {
  const natemail = (window.natemail = window.natemail || {});

  natemail.ui = {
    // Opens a centered box. `build(panel, close)` fills it in.
    // Esc or a click outside closes it. Returns `close`.
    modal({ title, build, onClose }) {
      const backdrop = document.createElement("div");
      backdrop.className = "natemail-backdrop";
      const panel = document.createElement("div");
      panel.className = "natemail-modal";
      panel.setAttribute("role", "dialog");
      if (title) {
        const h = document.createElement("div");
        h.className = "natemail-modal-title";
        h.textContent = title;
        panel.append(h);
      }
      backdrop.append(panel);

      const previousFocus = document.activeElement;
      let closed = false;
      function close() {
        if (closed) return;
        closed = true;
        backdrop.remove();
        window.removeEventListener("keydown", guard, true);
        natemail.keys.modalOpen = false;
        if (previousFocus && previousFocus.focus) previousFocus.focus();
        if (onClose) onClose();
      }
      // Keys typed inside the modal bubble up to the backdrop. Stop them there
      // so Gmail never sees them.
      function onKey(e) {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        }
      }

      backdrop.addEventListener("mousedown", (e) => {
        if (e.target === backdrop) close();
      });
      // Safety net for keys that arrive while focus has escaped the modal:
      // Esc still closes it, Tab is kept inside it, nothing reaches Gmail.
      function guard(e) {
        if (backdrop.contains(e.target)) {
          if (e.key === "Tab" && !panel.querySelector("input, button")) e.preventDefault();
          return;
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.key === "Escape") close();
        else (panel.querySelector("input") || panel).focus();
      }

      backdrop.addEventListener("keydown", onKey);
      window.addEventListener("keydown", guard, true);
      natemail.keys.modalOpen = true;
      build(panel, close);
      document.body.append(backdrop);
      panel.tabIndex = -1;
      (panel.querySelector("input") || panel).focus();
      return close;
    },
  };

  // A small message in the bottom-left corner.
  natemail.toast = function (text, { error = false, ms = 3000 } = {}) {
    const el = document.createElement("div");
    el.className = "natemail-toast" + (error ? " natemail-toast--error" : "");
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ms);
  };
})();
