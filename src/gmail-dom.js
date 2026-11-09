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
