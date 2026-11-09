// store.js
// Loads and saves splits with chrome.storage.sync, so they follow you to any
// Chrome where you're signed in. Used by both Gmail and the options page.

(function () {
  const natemail = (window.natemail = window.natemail || {});
  const KEY = "splits";

  natemail.store = {
    async loadSplits() {
      const data = await chrome.storage.sync.get(KEY);
      return natemail.splits.normalizeSplits(data[KEY]);
    },

    async saveSplits(splits) {
      const clean = natemail.splits.normalizeSplits(splits);
      await chrome.storage.sync.set({ [KEY]: clean });
      return clean;
    },

    // Calls `fn(splits)` whenever splits change (for example, saved from the
    // options page in another tab).
    onSplitsChanged(fn) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "sync" && changes[KEY]) {
          fn(natemail.splits.normalizeSplits(changes[KEY].newValue));
        }
      });
    },
  };
})();
