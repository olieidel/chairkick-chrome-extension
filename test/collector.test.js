const assert = require("node:assert/strict");
const test = require("node:test");

const collector = require("../src/collector.js");
const {
  addVideo,
  capGroupForPath,
  capGuidanceForPage,
  capHelpForPage,
  capOriginsForPage,
  looksLikeCapPage,
  loomLibraryQuery,
  normalizeCapUrl,
  normalizeConfiguredCapOrigins,
  normalizeLoomUrl,
  scanCapStateVideos
} = collector.__internals;

test("normalizes Loom share and embed URLs", () => {
  assert.deepEqual(
    normalizeLoomUrl("https://loom.com/embed/loom-url-id?sid=abc"),
    { id: "loom-url-id", url: "https://www.loom.com/share/loom-url-id" }
  );
  assert.deepEqual(
    normalizeLoomUrl("https://www.loom.com/share/loom-url-id#view"),
    { id: "loom-url-id", url: "https://www.loom.com/share/loom-url-id" }
  );
  assert.equal(normalizeLoomUrl("https://example.com/share/loom-url-id"), null);
});

test("normalizes Cap SaaS and self-hosted share URLs", () => {
  assert.deepEqual(
    normalizeCapUrl("https://cap.so/embed/cap-video-id?view=1", "https://cap.so", []),
    { id: "cap-video-id", url: "https://cap.so/s/cap-video-id", origin: "https://cap.so" }
  );
  assert.deepEqual(
    normalizeCapUrl("/s/self-hosted-id", "https://cap.example.com", ["https://cap.example.com"]),
    { id: "self-hosted-id", url: "https://cap.example.com/s/self-hosted-id", origin: "https://cap.example.com" }
  );
  assert.equal(normalizeCapUrl("https://example.com/s/cap-video-id", "https://cap.so", []), null);
});

test("dedupes Cap origins", () => {
  assert.deepEqual(
    normalizeConfiguredCapOrigins(["https://cap.example.com/path", "https://cap.example.com"]),
    ["https://cap.so", "https://www.cap.so", "https://cap.example.com"]
  );
});

test("detects self-hosted Cap origins from page HTML", () => {
  const html = [
    "<title>My Caps - Cap</title>",
    '<link rel="manifest" href="https://cap.example.com/site.webmanifest">',
    '<script>self.__next_f.push([1,"7:{\\"data\\":[{\\"id\\":\\"cap-video-id\\",\\"ownerId\\":\\"user-id\\",\\"name\\":\\"Demo\\",\\"hasPassword\\":false}]}"])</script>'
  ].join("");

  assert.equal(looksLikeCapPage(html, "https://cap.example.com/dashboard/caps"), true);
  assert.deepEqual(
    capOriginsForPage(html, "https://cap.example.com/dashboard/caps"),
    ["https://cap.so", "https://www.cap.so", "https://cap.example.com"]
  );
});

test("does not treat arbitrary pages with Cap-looking share paths as Cap", () => {
  const html = '<a href="https://example.com/s/cap-video-id">Not Cap</a>';

  assert.equal(looksLikeCapPage(html, "https://example.com/s/cap-video-id"), false);
  assert.deepEqual(
    capOriginsForPage(html, "https://example.com/s/cap-video-id"),
    ["https://cap.so", "https://www.cap.so"]
  );
});

test("merges duplicate videos and keeps strongest grouping", () => {
  const map = new Map();
  addVideo(map, {
    source: "loom",
    id: "video-id",
    url: "https://www.loom.com/share/video-id",
    group: "shared",
    discoveredBy: ["graphql:ALL"]
  });
  addVideo(map, {
    source: "loom",
    id: "video-id",
    url: "https://www.loom.com/share/video-id",
    title: "Demo",
    group: "authored",
    discoveredBy: ["graphql:MINE"]
  });

  assert.equal(map.size, 1);
  const [video] = map.values();
  assert.equal(video.group, "authored");
  assert.equal(video.title, "Demo");
  assert.deepEqual(video.discoveredBy, ["graphql:ALL", "graphql:MINE"]);
});

test("keeps the Loom GraphQL inventory query small while preserving titles", () => {
  assert.match(loomLibraryQuery, /\bid\b/);
  assert.match(loomLibraryQuery, /\bname\b/);
  assert.match(loomLibraryQuery, /\bendCursor\b/);
  assert.match(loomLibraryQuery, /\bhasNextPage\b/);
  assert.doesNotMatch(loomLibraryQuery, /__typename/);
  assert.doesNotMatch(loomLibraryQuery, /\bvisibility\b/);
  assert.doesNotMatch(loomLibraryQuery, /\bedges\s*\{\s*cursor\b/);
});

test("classifies Cap dashboard routes by view", () => {
  assert.equal(capGroupForPath("/dashboard/caps"), "authored");
  assert.equal(capGroupForPath("/dashboard/caps/folders/folder-id"), "authored");
  assert.equal(capGroupForPath("/dashboard/spaces/space-id"), "shared");
  assert.equal(capGroupForPath("/s/cap-video-id"), "unknown");
});

test("provides Cap page guidance for empty results", () => {
  assert.match(capGuidanceForPage("/dashboard/caps"), /My Caps/);
  assert.match(capGuidanceForPage("/dashboard/spaces/space-id"), /workspace/);
  assert.match(capGuidanceForPage("/s/cap-video-id"), /share URL/);
  assert.match(capGuidanceForPage("/dashboard/settings"), /My Caps/);
});

test("provides Cap page help for adjacent collection views", () => {
  assert.match(capHelpForPage("/dashboard/caps"), /workspace videos/);
  assert.match(capHelpForPage("/dashboard/spaces/space-id"), /private Caps/);
  assert.match(capHelpForPage("/s/cap-video-id"), /single Cap share page/);
  assert.match(capHelpForPage("/dashboard/settings"), /Cap page/);
});

test("extracts Cap videos from Next flight state", () => {
  const state = '7:["$","$L23",null,{"data":[{"id":"cap-video-id","ownerId":"user-id","name":"Cap Product Update","public":true},{"id":"second-video","ownerId":"user-id","name":"Second Cap","public":true}]}]';
  const html = `<script>self.__next_f.push([1,${JSON.stringify(state)}])</script>`;

  assert.deepEqual(
    scanCapStateVideos(html, "https://cap.example.com", ["https://cap.example.com"], "shared"),
    [
      {
        source: "cap",
        id: "cap-video-id",
        url: "https://cap.example.com/s/cap-video-id",
        title: "Cap Product Update",
        origin: "https://cap.example.com",
        group: "shared",
        discoveredBy: ["next_flight"]
      },
      {
        source: "cap",
        id: "second-video",
        url: "https://cap.example.com/s/second-video",
        title: "Second Cap",
        origin: "https://cap.example.com",
        group: "shared",
        discoveredBy: ["next_flight"]
      }
    ]
  );
});
