// Shared by the popup and the background worker: where "Record a new video"
// sends people, tagged so Ahoy can attribute recorder visits to the extension.
// One source/medium pair keeps the extension on a single row in the
// acquisition queries; the trigger (popup vs shortcut) goes in utm_content.
(function (root) {
  const CHAIRKICK_ORIGIN = "https://chairkick.com";

  function recorderUrl(trigger) {
    return `${CHAIRKICK_ORIGIN}/recordings/new?utm_source=chrome_extension&utm_medium=extension&utm_content=${encodeURIComponent(trigger)}`;
  }

  root.ChairkickRecorder = { CHAIRKICK_ORIGIN, recorderUrl };
})(typeof self !== "undefined" ? self : this);
