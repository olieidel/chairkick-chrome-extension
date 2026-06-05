(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.__chairkickCollector = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const LOOM_HOSTS = new Set(["loom.com", "www.loom.com"]);
  const DEFAULT_CAP_ORIGINS = ["https://cap.so", "https://www.cap.so"];
  const GROUP_RANK = { unknown: 0, shared: 1, authored: 2 };

  const loomLibraryQuery = `
    query GetLoomsForLibrary($limit: Int!, $cursor: String, $source: LoomsSource!, $sortType: LoomsSortType!, $sortOrder: LoomsSortOrder!) {
      getLooms {
        ... on GetLoomsPayload {
          videos(first: $limit, after: $cursor, source: $source, sortType: $sortType, sortOrder: $sortOrder) {
            edges {
              node {
                id
                name
              }
            }
            pageInfo {
              endCursor
              hasNextPage
            }
          }
        }
      }
    }
  `;

  function cleanId(value) {
    const id = String(value || "").trim();
    return /^[A-Za-z0-9_-]+$/.test(id) ? id : null;
  }

  function normalizeOrigin(value) {
    try {
      const url = new URL(String(value || "").trim());
      if (url.protocol !== "https:" && url.protocol !== "http:") return null;
      return url.origin;
    } catch (_error) {
      return null;
    }
  }

  function normalizeConfiguredCapOrigins(origins) {
    return Array.from(
      new Set(
        DEFAULT_CAP_ORIGINS.concat(origins || [])
          .map(normalizeOrigin)
          .filter(Boolean)
      )
    );
  }

  function capRouteKind(pathname) {
    if (/^\/dashboard\/caps(?:\/|$)/.test(pathname || "")) return "my_caps";
    if (/^\/dashboard\/spaces\/[^/]+(?:\/|$)/.test(pathname || "")) return "workspace_caps";
    if (/^\/(?:s|embed)\/[^/?#]+$/.test(pathname || "")) return "share";
    return "other";
  }

  function looksLikeCapPage(text, urlLike) {
    let url;
    try {
      url = new URL(urlLike || location.href);
    } catch (_error) {
      return false;
    }

    const origin = url.origin;
    const defaultOrigins = new Set(DEFAULT_CAP_ORIGINS);
    if (defaultOrigins.has(origin)) return true;

    const content = String(text || "");
    const routeKind = capRouteKind(url.pathname);
    const hasCapState = content.includes("self.__next_f.push") &&
      (content.includes('"ownerId"') || content.includes('\\"ownerId\\"')) &&
      (content.includes('"hasPassword"') || content.includes('\\"hasPassword\\"'));
    const hasCapAssets = /\/(?:favicon|site\.webmanifest|apple-touch-icon|safari-pinned-tab)\.(?:ico|png|svg|webmanifest)/.test(content);
    const hasCapDashboard = content.includes("DashboardContexts") || content.includes("UploadingProvider");
    const hasCapTitle = /<title>[^<]*\bCap\b[^<]*<\/title>/i.test(content) || /\bCap Recording\b/.test(content);

    return hasCapState ||
      (routeKind !== "other" && (hasCapAssets || hasCapDashboard || hasCapTitle)) ||
      (routeKind !== "other" && content.includes("self.__next_f.push") && content.includes("Cap"));
  }

  function capOriginsForPage(text, urlLike) {
    const origins = normalizeConfiguredCapOrigins([]);
    if (looksLikeCapPage(text, urlLike)) {
      const origin = normalizeOrigin(urlLike || location.href);
      if (origin) origins.push(origin);
    }

    return Array.from(new Set(origins));
  }

  function isLoomHost(hostname) {
    return LOOM_HOSTS.has(String(hostname || "").toLowerCase());
  }

  function normalizeLoomUrl(value) {
    try {
      const url = new URL(value, "https://www.loom.com");
      if (!isLoomHost(url.hostname)) return null;
      const match = url.pathname.match(/^\/(?:share|embed)\/([^/?#]+)$/);
      const id = match && cleanId(match[1]);
      return id ? { id, url: `https://www.loom.com/share/${id}` } : null;
    } catch (_error) {
      return null;
    }
  }

  function normalizeCapUrl(value, baseOrigin, capOrigins) {
    try {
      const url = new URL(value, baseOrigin || "https://cap.so");
      const allowedOrigins = new Set(normalizeConfiguredCapOrigins(capOrigins));
      if (!allowedOrigins.has(url.origin)) return null;
      const match = url.pathname.match(/^\/(?:s|embed)\/([^/?#]+)$/);
      const id = match && cleanId(match[1]);
      return id ? { id, url: `${url.origin}/s/${id}`, origin: url.origin } : null;
    } catch (_error) {
      return null;
    }
  }

  function emptyResult(supported, warnings) {
    return {
      ok: true,
      supported,
      page: {
        url: location.href,
        title: document.title,
        host: location.hostname
      },
      videos: [],
      warnings: warnings || []
    };
  }

  function addVideo(map, video) {
    if (!video || !video.id || !video.url || !video.source) return;

    const key = `${video.source}:${video.id}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        source: video.source,
        id: video.id,
        url: video.url,
        title: video.title || "",
        visibility: video.visibility || "",
        group: video.group || "unknown",
        origin: video.origin || "",
        discoveredBy: Array.from(new Set(video.discoveredBy || []))
      });
      return;
    }

    if (!existing.title && video.title) existing.title = video.title;
    if (!existing.visibility && video.visibility) existing.visibility = video.visibility;
    if (!existing.origin && video.origin) existing.origin = video.origin;
    if (GROUP_RANK[video.group] > GROUP_RANK[existing.group]) existing.group = video.group;
    existing.discoveredBy = Array.from(new Set(existing.discoveredBy.concat(video.discoveredBy || [])));
  }

  function emitProgress(options, progress) {
    if (!options || !options.progressRunId || typeof window === "undefined" || !window.postMessage) return;

    window.postMessage({
      type: "chairkick-collector-progress",
      runId: options.progressRunId,
      progress
    }, "*");
  }

  function textSources() {
    const values = [location.href, document.title || ""];
    for (const link of document.querySelectorAll("a[href], link[href]")) {
      values.push(link.getAttribute("href") || "");
      values.push(link.href || "");
      values.push(link.textContent || "");
    }
    for (const meta of document.querySelectorAll("meta[content]")) {
      values.push(meta.getAttribute("content") || "");
    }
    for (const script of document.scripts) {
      values.push(script.textContent || "");
    }
    if (document.body) values.push(document.body.innerText || "");
    return values.join("\n");
  }

  function decodeJsonString(value) {
    try {
      return JSON.parse(`"${value}"`);
    } catch (_error) {
      return value;
    }
  }

  function scanLoomUrls() {
    const videos = [];
    const text = textSources();
    const patterns = [
      /https?:\/\/(?:www\.)?loom\.com\/(?:share|embed)\/([A-Za-z0-9_-]+)/g,
      /(?:^|["'\s])\/(?:share|embed)\/([A-Za-z0-9_-]+)/g
    ];

    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        const candidate = match[0].trim().replace(/^["'\s]+/, "");
        const normalized = normalizeLoomUrl(candidate.startsWith("/") ? `https://www.loom.com${candidate}` : candidate);
        if (normalized) {
          videos.push({
            source: "loom",
            id: normalized.id,
            url: normalized.url,
            group: "unknown",
            discoveredBy: ["page"]
          });
        }
      }
    }

    const current = normalizeLoomUrl(location.href);
    if (current) {
      videos.push({
        source: "loom",
        id: current.id,
        url: current.url,
        title: document.title || "",
        group: "unknown",
        discoveredBy: ["current_page"]
      });
    }

    return videos;
  }

  async function fetchLoomPage(source, cursor) {
    const response = await fetch("https://www.loom.com/graphql", {
      method: "POST",
      credentials: "include",
      headers: {
        "accept": "*/*",
        "apollographql-client-name": "web",
        "content-type": "application/json",
        "x-loom-request-source": "chairkick_chrome_extension"
      },
      body: JSON.stringify({
        operationName: "GetLoomsForLibrary",
        variables: {
          source,
          sortType: "RECENT",
          sortOrder: "DESC",
          limit: 50,
          cursor: cursor || null
        },
        query: loomLibraryQuery
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Loom ${source} request failed with ${response.status}`);
    if (payload.errors && payload.errors.length) throw new Error(`Loom ${source} returned GraphQL errors`);
    return payload;
  }

  async function queryLoomLibrary(source, maxPages, options, progressConfig) {
    const videos = [];
    let cursor = null;
    let pageCount = 0;
    const start = progressConfig && progressConfig.startPercent ? progressConfig.startPercent : 20;
    const end = progressConfig && progressConfig.endPercent ? progressConfig.endPercent : 90;
    const label = progressConfig && progressConfig.label ? progressConfig.label : `Fetching Loom ${source} videos`;

    emitProgress(options, {
      label,
      percent: start,
      foundCount: 0
    });

    do {
      const payload = await fetchLoomPage(source, cursor);
      const connection = payload && payload.data && payload.data.getLooms && payload.data.getLooms.videos;
      const edges = connection && Array.isArray(connection.edges) ? connection.edges : [];

      for (const edge of edges) {
        const node = edge && edge.node;
        const normalized = node && normalizeLoomUrl(`https://www.loom.com/share/${node.id}`);
        if (normalized) {
          videos.push({
            source: "loom",
            id: normalized.id,
            url: normalized.url,
            title: node.name || "",
            group: source === "MINE" ? "authored" : "shared",
            discoveredBy: [`graphql:${source}`]
          });
        }
      }

      cursor = connection && connection.pageInfo && connection.pageInfo.hasNextPage
        ? connection.pageInfo.endCursor
        : null;
      pageCount += 1;
      emitProgress(options, {
        label: `${label} (${videos.length} found)`,
        percent: Math.min(end - 2, start + pageCount * 5),
        foundCount: videos.length
      });
    } while (cursor && pageCount < maxPages);

    emitProgress(options, {
      label: `${label} complete`,
      percent: end,
      foundCount: videos.length
    });

    return videos;
  }

  async function collectLoom(options) {
    const warnings = [];
    const map = new Map();

    emitProgress(options, { label: "Scanning current page", percent: 8, foundCount: 0 });
    const pageVideos = scanLoomUrls();
    for (const video of pageVideos) addVideo(map, video);
    emitProgress(options, {
      label: pageVideos.length ? `Found ${pageVideos.length} visible page link${pageVideos.length === 1 ? "" : "s"}` : "Page scan complete",
      percent: 15,
      foundCount: map.size
    });

    let mineVideos = [];
    try {
      mineVideos = await queryLoomLibrary("MINE", options.maxLoomPages || 50, options, {
        label: "Fetching authored Loom videos",
        startPercent: 20,
        endPercent: 50
      });
      for (const video of mineVideos) addVideo(map, video);
      emitProgress(options, {
        label: `${map.size} Loom videos found`,
        percent: 52,
        foundCount: map.size
      });
    } catch (error) {
      warnings.push(error.message || "Could not collect authored Loom videos.");
    }

    const authoredIds = new Set(mineVideos.map((video) => video.id));
    try {
      const allVideos = await queryLoomLibrary("ALL", options.maxLoomPages || 50, options, {
        label: "Fetching shared Loom videos",
        startPercent: 55,
        endPercent: 92
      });
      for (const video of allVideos) {
        addVideo(map, {
          ...video,
          group: authoredIds.has(video.id) ? "authored" : "shared"
        });
      }
      emitProgress(options, {
        label: `${map.size} Loom videos found`,
        percent: 94,
        foundCount: map.size
      });
    } catch (error) {
      warnings.push(error.message || "Could not collect Loom library videos.");
    }

    emitProgress(options, {
      label: "Preparing results",
      percent: 98,
      foundCount: map.size
    });

    return {
      ...emptyResult(true, warnings),
      videos: sortedVideos(map)
    };
  }

  function capGroupForPath(pathname) {
    const routeKind = capRouteKind(pathname);
    if (routeKind === "my_caps") return "authored";
    if (routeKind === "workspace_caps") return "shared";
    return "unknown";
  }

  function decodedNextFlightChunks(text) {
    const chunks = [];
    const pattern = /self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)/g;

    for (const match of text.matchAll(pattern)) {
      chunks.push(decodeJsonString(match[1]));
    }

    return chunks.join("\n");
  }

  function scanCapStateVideos(text, baseOrigin, capOrigins, group) {
    const videos = [];
    const state = decodedNextFlightChunks(text);
    if (!state) return videos;

    const pattern = /"id":"([^"]+)","ownerId":"([^"]+)","name":"((?:\\.|[^"\\])*)"/g;
    for (const match of state.matchAll(pattern)) {
      const normalized = normalizeCapUrl(`/s/${match[1]}`, baseOrigin, capOrigins);
      if (normalized) {
        videos.push({
          source: "cap",
          id: normalized.id,
          url: normalized.url,
          title: decodeJsonString(match[3]),
          origin: normalized.origin,
          group,
          discoveredBy: ["next_flight"]
        });
      }
    }

    return videos;
  }

  function scanCapUrls(capOrigins, text) {
    const videos = [];
    const allowedOrigins = normalizeConfiguredCapOrigins(capOrigins);
    const group = capGroupForPath(location.pathname);
    const pageText = text || textSources();
    const absolutePattern = /https?:\/\/[^"'\s<>()]+\/(?:s|embed)\/[A-Za-z0-9_-]+/g;
    const relativePattern = /(?:^|["'\s])\/(?:s|embed)\/([A-Za-z0-9_-]+)/g;

    videos.push(...scanCapStateVideos(pageText, location.origin, allowedOrigins, group));

    for (const match of pageText.matchAll(absolutePattern)) {
      const normalized = normalizeCapUrl(match[0], location.origin, allowedOrigins);
      if (normalized) {
        videos.push({
          source: "cap",
          id: normalized.id,
          url: normalized.url,
          origin: normalized.origin,
          group,
          discoveredBy: ["page"]
        });
      }
    }

    for (const match of pageText.matchAll(relativePattern)) {
      const candidate = match[0].trim().replace(/^["'\s]+/, "");
      const normalized = normalizeCapUrl(candidate, location.origin, allowedOrigins);
      if (normalized) {
        videos.push({
          source: "cap",
          id: normalized.id,
          url: normalized.url,
          origin: normalized.origin,
          group,
          discoveredBy: ["page"]
        });
      }
    }

    const current = normalizeCapUrl(location.href, location.origin, allowedOrigins);
    if (current) {
      videos.push({
        source: "cap",
        id: current.id,
        url: current.url,
        title: document.title || "",
        origin: current.origin,
        group,
        discoveredBy: ["current_page"]
      });
    }

    return videos;
  }

  function capGuidanceForPage(pathname) {
    const routeKind = capRouteKind(pathname);
    if (routeKind === "my_caps") return "No Cap videos found on My Caps. Check that the page has loaded, then collect again.";
    if (routeKind === "workspace_caps") return "No Cap videos found in this workspace view. Check that the page has loaded, then collect again.";
    if (routeKind === "share") return "No Cap share URL found on this page.";
    return "Open Cap's My Caps page or a workspace videos page, then collect again.";
  }

  function capHelpForPage(pathname) {
    const routeKind = capRouteKind(pathname);
    if (routeKind === "my_caps") return "This is your My Caps view. To collect workspace videos shared by others, open each Cap space and collect again.";
    if (routeKind === "workspace_caps") return "This is a workspace space view. To collect your own private Caps too, open My Caps and collect again.";
    if (routeKind === "share") return "This is a single Cap share page. Open My Caps or a workspace space to collect lists in bulk.";
    return "You are on a Cap page. Open My Caps or one of your workspace spaces, then collect again.";
  }

  function sortedVideos(map) {
    return Array.from(map.values()).sort((a, b) => {
      const groupDelta = GROUP_RANK[b.group] - GROUP_RANK[a.group];
      if (groupDelta !== 0) return groupDelta;
      return (a.title || a.url).localeCompare(b.title || b.url);
    });
  }

  async function collect(options) {
    const opts = options || {};

    if (isLoomHost(location.hostname)) return collectLoom(opts);

    const text = textSources();
    const capOrigins = capOriginsForPage(text, location.href);

    if (looksLikeCapPage(text, location.href)) {
      const map = new Map();
      emitProgress(opts, { label: "Scanning Cap page", percent: 25, foundCount: 0 });
      for (const video of scanCapUrls(capOrigins, text)) addVideo(map, video);
      emitProgress(opts, {
        label: `${map.size} Cap video${map.size === 1 ? "" : "s"} found`,
        percent: 95,
        foundCount: map.size
      });
      return {
        ...emptyResult(true, []),
        guidance: capGuidanceForPage(location.pathname),
        help: capHelpForPage(location.pathname),
        videos: sortedVideos(map)
      };
    }

    return emptyResult(false, []);
  }

  return {
    collect,
    __internals: {
      addVideo,
      capGroupForPath,
      capGuidanceForPage,
      capHelpForPage,
      capOriginsForPage,
      looksLikeCapPage,
      scanCapStateVideos,
      normalizeCapUrl,
      normalizeConfiguredCapOrigins,
      normalizeLoomUrl,
      loomLibraryQuery
    }
  };
});
