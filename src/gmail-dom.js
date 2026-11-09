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
