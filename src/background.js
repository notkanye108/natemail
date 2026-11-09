// background.js
// The one thing a Gmail tab can't do by itself: open natemail's options page.

chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === "open-options") chrome.runtime.openOptionsPage();
});
