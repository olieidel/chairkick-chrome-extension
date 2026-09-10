// Store-screenshot harness: stubs the chrome extension APIs so the real
// popup.js renders a believable results state in a plain browser tab.
// Pick the dataset with ?state=loom (default) or ?state=cap.
(function () {
  const state = new URLSearchParams(location.search).get("state") || "loom";

  const loomVideo = (id, title, group) => ({
    source: "loom",
    id,
    url: `https://www.loom.com/share/${id}`,
    title,
    group,
    visibility: "",
    origin: "",
    discoveredBy: ["graphql:MINE"]
  });

  const capVideo = (id, title, group) => ({
    source: "cap",
    id,
    url: `https://cap.so/s/${id}`,
    title,
    group,
    visibility: "",
    origin: "https://cap.so",
    discoveredBy: ["next_flight"]
  });

  const datasets = {
    loom: {
      host: "loom.com",
      result: {
        ok: true,
        supported: true,
        page: { url: "https://www.loom.com/looms/videos", title: "My Library", host: "loom.com" },
        warnings: [],
        videos: [
          loomVideo("9f2c81d4e07b4c", "Onboarding walkthrough for new hires", "authored"),
          loomVideo("4b8e3a91c65d20", "Sprint 24 demo — billing flow", "authored"),
          loomVideo("7d1f5c28ab93e4", "Bug repro: checkout validation error", "authored"),
          loomVideo("2a6b9e47f18c35", "Customer call recap — Acme GmbH", "authored"),
          loomVideo("8c3d7f12b49a06", "How we review pull requests", "authored"),
          loomVideo("5e9a2c84d71f63", "Q3 roadmap review", "shared"),
          loomVideo("1f7b4d96e28a50", "Design crit: new dashboard", "shared"),
          loomVideo("6a2e8c31f95d74", "All-hands recording — June", "shared")
        ]
      }
    },
    cap: {
      host: "cap.so",
      result: {
        ok: true,
        supported: true,
        page: { url: "https://cap.so/dashboard/caps", title: "My Caps", host: "cap.so" },
        warnings: [],
        help: "This is your My Caps view. To collect workspace videos shared by others, open each Cap space and collect again.",
        videos: [
          capVideo("x2x4mrmcz80f31e", "Weekly product update", "authored"),
          capVideo("k9d3nqpvw52a87b", "API integration walkthrough", "authored"),
          capVideo("m5f8trxbc16e409", "Support macro: refund flow", "authored"),
          capVideo("q7a1wzkjd93c65f", "Release notes — v2.4", "authored")
        ]
      }
    }
  };

  const dataset = datasets[state] || datasets.loom;

  // ?settings=open renders the popup with the settings panel expanded.
  if (new URLSearchParams(location.search).get("settings") === "open") {
    window.addEventListener("DOMContentLoaded", () => document.getElementById("open-settings").click());
  }

  let executeCalls = 0;
  window.chrome = {
    tabs: {
      query: async () => [{ id: 1, url: dataset.result.page.url }],
      create: async () => ({})
    },
    commands: {
      getAll: async () => [{ name: "start-recording", shortcut: "Alt+Shift+R", description: "" }]
    },
    storage: {
      sync: {
        get: async () => ({ shortcutEnabled: true }),
        set: async () => {}
      }
    },
    runtime: {
      onMessage: { addListener: () => {} },
      sendMessage: () => Promise.resolve()
    },
    scripting: {
      executeScript: async () => {
        executeCalls += 1;
        return executeCalls >= 3 ? [{ result: dataset.result }] : [{}];
      }
    }
  };
})();
