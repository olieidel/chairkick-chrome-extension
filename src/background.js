// Handles the "start-recording" keyboard shortcut. Chrome owns the key
// combination itself (chrome://extensions/shortcuts); the popup's settings
// only decide whether pressing it does anything.
importScripts("recorder_url.js");

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "start-recording") return;

  const { shortcutEnabled = true } = await chrome.storage.sync.get("shortcutEnabled");
  if (!shortcutEnabled) return;

  chrome.tabs.create({ url: self.ChairkickRecorder.recorderUrl("shortcut") });
});
