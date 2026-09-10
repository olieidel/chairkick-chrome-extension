// Shared by the popup and the background worker: where "Record a new video"
// sends people, tagged so Ahoy can attribute recorder visits to the extension.
(function (root) {
  const CHAIRKICK_ORIGIN = "https://chairkick.com";

  function recorderUrl(medium) {
    return `${CHAIRKICK_ORIGIN}/recordings/new?utm_source=chrome_extension&utm_medium=${encodeURIComponent(medium)}`;
  }

  root.ChairkickRecorder = { CHAIRKICK_ORIGIN, recorderUrl };
})(typeof self !== "undefined" ? self : this);
