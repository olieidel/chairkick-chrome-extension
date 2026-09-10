const statusEl = document.getElementById("status");
const statusLabelEl = document.getElementById("status-label");
const progressTrackEl = document.getElementById("progress-track");
const progressBarEl = document.getElementById("progress-bar");
const resultsEl = document.getElementById("results");
const warningsEl = document.getElementById("warnings");
const resultHelpEl = document.getElementById("result-help");
const copyListsEl = document.getElementById("copy-lists");
const pageLabelEl = document.getElementById("page-label");
const refreshButton = document.getElementById("refresh");
const emptyActionsEl = document.getElementById("empty-actions");
const openLoomButton = document.getElementById("open-loom");
const openCapButton = document.getElementById("open-cap");
const recordLink = document.getElementById("record");
const recordHintEl = document.getElementById("record-hint");
const settingsEl = document.getElementById("settings");
const openSettingsButton = document.getElementById("open-settings");
const shortcutEnabledEl = document.getElementById("shortcut-enabled");
const shortcutDescriptionEl = document.getElementById("shortcut-description");
const changeShortcutButton = document.getElementById("change-shortcut");

const CHAIRKICK_ORIGIN = "https://chairkick.com";
const LOOM_LIBRARY_URL = "https://www.loom.com/looms/videos";
const CAP_LIBRARY_URL = "https://cap.so/dashboard/caps";
const MAX_IMPORT_VIDEOS = 500;

let activeRunId = null;

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  // Enter should start a recording when the popup opens from the keyboard
  // shortcut; the autofocus attribute alone is not reliable in popups.
  recordLink.href = ChairkickRecorder.recorderUrl("popup");
  recordLink.focus();
  loadShortcutSettings();
  collectFromActiveTab();
});

function bindEvents() {
  refreshButton.addEventListener("click", collectFromActiveTab);
  copyListsEl.addEventListener("click", handleListAction);
  openLoomButton.addEventListener("click", () => chrome.tabs.create({ url: LOOM_LIBRARY_URL }));
  openCapButton.addEventListener("click", () => chrome.tabs.create({ url: CAP_LIBRARY_URL }));
  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
  openSettingsButton.addEventListener("click", toggleSettings);
  shortcutEnabledEl.addEventListener("change", saveShortcutEnabled);
  changeShortcutButton.addEventListener("click", () => chrome.tabs.create({ url: "chrome://extensions/shortcuts" }));
}

function toggleSettings() {
  settingsEl.hidden = !settingsEl.hidden;
  openSettingsButton.setAttribute("aria-expanded", String(!settingsEl.hidden));
  if (!settingsEl.hidden) shortcutEnabledEl.focus();
}

// The key combination is Chrome's to assign; we only read it back and decide
// whether pressing it does anything (see background.js).
async function loadShortcutSettings() {
  let shortcut = "";
  let enabled = true;

  try {
    const commands = await chrome.commands.getAll();
    shortcut = (commands.find((command) => command.name === "start-recording") || {}).shortcut || "";
  } catch {
    shortcut = "";
  }

  try {
    const stored = await chrome.storage.sync.get("shortcutEnabled");
    enabled = stored.shortcutEnabled !== false;
  } catch {
    enabled = true;
  }

  shortcutEnabledEl.checked = enabled;
  renderShortcut(shortcut, enabled);
}

function renderShortcut(shortcut, enabled) {
  const keys = shortcut ? formatShortcut(shortcut) : "";

  if (keys && enabled) {
    shortcutDescriptionEl.textContent = `${keys} starts a new recording from any tab.`;
  } else if (keys) {
    shortcutDescriptionEl.textContent = `Switched off. ${keys} does nothing until you turn it back on.`;
  } else {
    shortcutDescriptionEl.textContent = "No key combination is set — usually because another extension already uses the default. Use “Change keys” to pick one.";
  }

  recordHintEl.textContent = keys && enabled
    ? `Opens the Chairkick recorder in a new tab — or press ${keys} from any tab.`
    : "Opens the Chairkick recorder in a new tab — screen, camera, and mic.";

  shortcutEnabledEl.dataset.shortcut = shortcut;
}

// Chrome reports "Alt+Shift+K" on every platform; macOS users know the key as Option.
function formatShortcut(shortcut) {
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || "");
  return isMac ? shortcut.replace(/\bAlt\b/g, "Option").replace(/\bCtrl\b/g, "Control") : shortcut;
}

async function saveShortcutEnabled() {
  const enabled = shortcutEnabledEl.checked;
  try {
    await chrome.storage.sync.set({ shortcutEnabled: enabled });
  } catch {
    // The toggle still reflects the choice for this popup; it just will not persist.
  }
  renderShortcut(shortcutEnabledEl.dataset.shortcut || "", enabled);
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) throw new Error("No active tab is available.");
  return tab;
}

async function collectFromActiveTab() {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  activeRunId = runId;
  setCollecting(true);
  setProgress({ label: "Starting collection", percent: 3 });
  resultsEl.hidden = true;
  warningsEl.hidden = true;
  resultHelpEl.hidden = true;
  copyListsEl.hidden = true;
  emptyActionsEl.hidden = true;

  try {
    const tab = await activeTab();
    pageLabelEl.textContent = tab.url || "Current tab";

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "ISOLATED",
      args: [runId],
      func: (relayRunId) => {
        const existing = window.__chairkickCollectorProgressRelay;
        if (existing && existing.handler) {
          window.removeEventListener("message", existing.handler);
        }

        const handler = (event) => {
          if (event.source !== window) return;

          const data = event.data;
          if (!data || data.type !== "chairkick-collector-progress" || data.runId !== relayRunId) return;

          const sendResult = chrome.runtime.sendMessage({
            type: "chairkickCollectorProgress",
            runId: relayRunId,
            progress: data.progress
          });
          if (sendResult && typeof sendResult.catch === "function") sendResult.catch(() => {});
        };

        window.addEventListener("message", handler);
        window.__chairkickCollectorProgressRelay = { runId: relayRunId, handler };
      }
    });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["src/collector.js"],
      world: "MAIN"
    });

    const [injectionResult] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      args: [{ progressRunId: runId }],
      func: async (options) => window.__chairkickCollector.collect(options)
    });

    renderResult(injectionResult.result);
  } catch (error) {
    activeRunId = null;
    setCollecting(false);
    setStatus(error.message || "Could not collect videos from this tab.");
    emptyActionsEl.hidden = false;
  }
}

function handleRuntimeMessage(message) {
  if (!message || message.type !== "chairkickCollectorProgress") return;
  if (!activeRunId || message.runId !== activeRunId) return;

  setProgress(message.progress || {});
}

function renderResult(result) {
  const videos = Array.isArray(result && result.videos) ? result.videos : [];

  pageLabelEl.textContent = result && result.page && result.page.host
    ? result.page.host
    : pageLabelEl.textContent;

  renderWarnings(result && result.warnings);

  if (!result || !result.supported) {
    activeRunId = null;
    setCollecting(false);
    setStatus("Open Loom, or open Cap's My Caps or workspace videos page, then collect again.");
    emptyActionsEl.hidden = false;
    return;
  }

  if (videos.length === 0) {
    activeRunId = null;
    setCollecting(false);
    setStatus(result.guidance || "No Loom or Cap share URLs found on this page.");
    return;
  }

  activeRunId = null;
  setCollecting(false);
  hideStatus();
  resultsEl.hidden = false;
  renderResultHelp(result);
  renderCopyLists(videos);
}

function renderWarnings(warnings) {
  const filtered = Array.from(new Set((warnings || []).filter(Boolean)));
  warningsEl.hidden = filtered.length === 0;
  warningsEl.textContent = filtered.join(" ");
}

function renderResultHelp(result) {
  const help = result && result.help;
  if (!help) {
    resultHelpEl.hidden = true;
    resultHelpEl.textContent = "";
    return;
  }

  resultHelpEl.textContent = help;
  resultHelpEl.hidden = false;
}

function renderCopyLists(videos) {
  copyListsEl.textContent = "";
  panelLists.clear();

  const lists = copyListDefinitions(videos);

  if (lists.length === 0) {
    copyListsEl.hidden = true;
    return;
  }

  const heading = document.createElement("h2");
  heading.textContent = "Import lists";
  copyListsEl.appendChild(heading);

  const hint = document.createElement("p");
  hint.className = "lists-hint";
  hint.textContent = "Imported videos are saved under your name as the creator — send only lists of videos you recorded.";
  copyListsEl.appendChild(hint);

  for (const list of lists) {
    copyListsEl.appendChild(copyListPanel(list));
  }

  copyListsEl.hidden = false;
}

function copyListDefinitions(videos) {
  const sources = [
    { key: "loom", name: "Loom" },
    { key: "cap", name: "Cap" }
  ];

  return sources.flatMap((source) => {
    const sourceVideos = videos.filter((video) => video.source === source.key);
    return [
      {
        title: `My ${source.name} videos`,
        source: source.key,
        videos: sourceVideos.filter((video) => video.group === "authored")
      },
      {
        title: `Workspace ${source.name} videos`,
        source: source.key,
        videos: sourceVideos.filter((video) => video.group === "shared")
      },
      {
        title: `Other ${source.name} videos`,
        source: source.key,
        videos: sourceVideos.filter((video) => video.group === "unknown")
      }
    ];
  }).filter((list) => list.videos.length > 0);
}

const panelLists = new Map();

function copyListPanel(list) {
  const panel = document.createElement("section");
  panel.className = "copy-list";

  const panelId = `list-${panelLists.size}`;
  panelLists.set(panelId, list);
  panel.dataset.listId = panelId;

  const header = document.createElement("div");
  header.className = "copy-list-head";

  const title = document.createElement("h3");
  title.textContent = `${list.title} (${list.videos.length})`;

  const buttons = document.createElement("div");
  buttons.className = "copy-list-buttons";

  const sendButton = document.createElement("button");
  sendButton.className = "primary-button send-list-button";
  sendButton.type = "button";
  sendButton.textContent = "Send to Chairkick";

  const copyButton = document.createElement("button");
  copyButton.className = "secondary-button copy-list-button";
  copyButton.type = "button";
  copyButton.textContent = "Copy";

  buttons.append(sendButton, copyButton);
  header.append(title, buttons);

  const textarea = document.createElement("textarea");
  textarea.readOnly = true;
  textarea.rows = Math.min(5, Math.max(2, list.videos.length));
  textarea.value = list.videos.map((video) => video.url).join("\n");

  panel.append(header, textarea);

  if (list.videos.length > MAX_IMPORT_VIDEOS) {
    const note = document.createElement("p");
    note.className = "copy-list-note";
    note.textContent = `Chairkick imports the first ${MAX_IMPORT_VIDEOS} links per send — copy the list and import the rest in batches.`;
    panel.appendChild(note);
  }

  return panel;
}

function handleListAction(event) {
  const panel = event.target.closest(".copy-list");
  if (!panel) return;

  const list = panelLists.get(panel.dataset.listId);
  if (!list) return;

  if (event.target.closest(".send-list-button")) {
    sendListToChairkick(list, event.target.closest(".send-list-button"));
  } else if (event.target.closest(".copy-list-button")) {
    copyListUrls(list);
  }
}

async function sendListToChairkick(list, button) {
  if (!list.videos.length) return;

  button.disabled = true;
  setStatus(`Sending ${list.title.toLowerCase()} to Chairkick…`);

  try {
    const response = await fetch(`${CHAIRKICK_ORIGIN}/import_handoffs`, {
      method: "POST",
      headers: { "content-type": "application/json", "accept": "application/json" },
      body: JSON.stringify({
        source: list.source,
        videos: list.videos.map((video) => ({ url: video.url, title: video.title || "" }))
      })
    });

    if (!response.ok) throw new Error(`Chairkick responded with ${response.status}.`);

    const data = await response.json();
    if (!data || !data.url) throw new Error("Chairkick did not return an import link.");

    await chrome.tabs.create({ url: data.url });
    setStatus(`Opened Chairkick with ${data.count || list.videos.length} video${(data.count || list.videos.length) === 1 ? "" : "s"}.`);
  } catch (error) {
    setStatus(error.message || "Could not reach Chairkick. Use the copy lists instead.");
  } finally {
    button.disabled = false;
  }
}

async function copyListUrls(list) {
  const urls = list.videos.map((video) => video.url).join("\n");
  if (!urls) return;

  await navigator.clipboard.writeText(urls);
  const count = list.videos.length;
  setStatus(`Copied ${count} URL${count === 1 ? "" : "s"}.`);
  statusEl.hidden = false;
}

function setStatus(message) {
  statusEl.classList.remove("is-loading");
  progressTrackEl.hidden = true;
  progressBarEl.style.width = "0";
  statusLabelEl.textContent = message;
  statusEl.hidden = !message;
}

function hideStatus() {
  statusEl.classList.remove("is-loading");
  progressTrackEl.hidden = true;
  progressBarEl.style.width = "0";
  statusLabelEl.textContent = "";
  statusEl.hidden = true;
}

function setCollecting(collecting) {
  refreshButton.disabled = collecting;
}

function setProgress(progress) {
  const percent = Number.isFinite(progress.percent)
    ? Math.max(0, Math.min(100, progress.percent))
    : 10;

  statusEl.hidden = false;
  statusEl.classList.add("is-loading");
  progressTrackEl.hidden = false;
  progressBarEl.style.width = `${percent}%`;
  statusLabelEl.textContent = progress.label || "Collecting videos...";
}
