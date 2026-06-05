const statusEl = document.getElementById("status");
const statusLabelEl = document.getElementById("status-label");
const progressTrackEl = document.getElementById("progress-track");
const progressBarEl = document.getElementById("progress-bar");
const resultsEl = document.getElementById("results");
const warningsEl = document.getElementById("warnings");
const copyListsEl = document.getElementById("copy-lists");
const pageLabelEl = document.getElementById("page-label");
const refreshButton = document.getElementById("refresh");

let activeRunId = null;

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  collectFromActiveTab();
});

function bindEvents() {
  refreshButton.addEventListener("click", collectFromActiveTab);
  copyListsEl.addEventListener("click", copyListUrls);
  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
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
  copyListsEl.hidden = true;

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
  setStatus("");
  statusEl.hidden = true;
  resultsEl.hidden = false;
  renderCopyLists(videos);
}

function renderWarnings(warnings) {
  const filtered = (warnings || []).filter(Boolean);
  warningsEl.hidden = filtered.length === 0;
  warningsEl.textContent = filtered.join(" ");
}

function renderCopyLists(videos) {
  copyListsEl.textContent = "";

  const lists = copyListDefinitions(videos);

  if (lists.length === 0) {
    copyListsEl.hidden = true;
    return;
  }

  const heading = document.createElement("h2");
  heading.textContent = "Import lists";
  copyListsEl.appendChild(heading);

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
        videos: sourceVideos.filter((video) => video.group === "authored")
      },
      {
        title: `Workspace ${source.name} videos`,
        videos: sourceVideos.filter((video) => video.group === "shared")
      },
      {
        title: `Other ${source.name} videos`,
        videos: sourceVideos.filter((video) => video.group === "unknown")
      }
    ];
  }).filter((list) => list.videos.length > 0);
}

function copyListPanel(list) {
  const panel = document.createElement("section");
  panel.className = "copy-list";

  const header = document.createElement("div");
  header.className = "copy-list-head";

  const title = document.createElement("h3");
  title.textContent = `${list.title} (${list.videos.length})`;

  const button = document.createElement("button");
  button.className = "primary-button copy-list-button";
  button.type = "button";
  button.dataset.urls = list.videos.map((video) => video.url).join("\n");
  button.textContent = "Copy";

  header.append(title, button);

  const textarea = document.createElement("textarea");
  textarea.readOnly = true;
  textarea.rows = Math.min(5, Math.max(2, list.videos.length));
  textarea.value = list.videos.map((video) => video.url).join("\n");

  panel.append(header, textarea);
  return panel;
}

async function copyListUrls(event) {
  const button = event.target.closest(".copy-list-button");
  if (!button) return;

  const urls = button.dataset.urls || "";
  if (!urls) return;

  await navigator.clipboard.writeText(urls);
  const count = urls.split("\n").filter(Boolean).length;
  setStatus(`Copied ${count} URL${count === 1 ? "" : "s"}.`);
  statusEl.hidden = false;
}

function setStatus(message) {
  statusEl.classList.remove("is-loading");
  progressTrackEl.hidden = true;
  statusEl.hidden = !message;
  statusLabelEl.textContent = message;
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
