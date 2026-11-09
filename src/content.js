// content.js
// Entry point. Chrome runs this inside every Gmail tab, after gmail-dom.js.

(function () {
  const natemail = window.natemail;

  // A small message in the bottom-left corner. Used for "loaded" now, and for
  // confirmations and errors in later phases.
  natemail.toast = function (text, { error = false, ms = 3000 } = {}) {
    const el = document.createElement("div");
    el.className = "natemail-toast" + (error ? " natemail-toast--error" : "");
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ms);
  };

  natemail.dom
    .waitForGmail()
    .then(() => {
      console.log("[natemail] loaded");
      natemail.toast("natemail loaded");
    })
    .catch((err) => {
      console.error("[natemail]", err);
      natemail.toast("natemail couldn't find Gmail on this page", { error: true, ms: 6000 });
    });
})();
