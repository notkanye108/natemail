// content.js
// Entry point. Chrome runs this inside every Gmail tab, after gmail-dom.js.

(function () {
  const natemail = window.natemail;

  natemail.dom
    .waitForGmail()
    .then(() => natemail.splitTabs.start())
    .then(() => natemail.selection.start())
    .then(() => {
      console.log("[natemail] loaded");
      natemail.toast("natemail loaded");
    })
    .catch((err) => {
      console.error("[natemail]", err);
      natemail.toast("natemail didn't start: " + err.message, { error: true, ms: 6000 });
    });
})();
