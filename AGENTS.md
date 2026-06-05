# Repository Guidelines

## Workflow

- Automatically commit after finishing a feature when asked to implement work.
- Do not push commits unless explicitly requested.
- Use concise, descriptive commit messages.
- Stage and commit only files relevant to the current task.
- Parallel sessions may share a branch. Make atomic commits with specific `git add` paths; avoid `git add -A`.
- Unrelated local modifications may exist; do not revert them or block on them unless the current task needs the same files.

## Project Structure & Module Organization

This is a Manifest V3 Chrome extension for collecting Loom and Cap share URLs.

- `manifest.json`: extension metadata, popup wiring, and permissions.
- `popup.html`: popup entry point.
- `src/collector.js`: page scanning and URL normalization; UMD-wrapped for Chrome and Node tests.
- `src/popup.js`: popup UI behavior and Chrome extension API calls.
- `src/popup.css`: popup styling.
- `test/collector.test.js`: collector internals tested with Node's built-in runner.

Keep shared parsing and normalization behavior in `src/collector.js`; keep browser UI orchestration in `src/popup.js`.

## Build, Test, and Development Commands

- `npm test`: runs all tests with `node --test`.

There is no build step. To run locally, open `chrome://extensions`, enable Developer mode, click `Load unpacked`, and select this directory. Reload after changing `manifest.json`, `popup.html`, or `src/`.

## Coding Style & Naming Conventions

Use plain JavaScript with CommonJS-compatible exports where tests need access. Follow the existing style: two-space indentation, semicolons, double quotes, `const` by default, and `let` only for reassignment. Prefer pure helpers such as `normalizeLoomUrl`, `normalizeCapUrl`, or `capGroupForPath`.

Name tests by behavior, not implementation details, for example: `test("normalizes Loom share and embed URLs", () => { ... })`.

## Testing Guidelines

Tests use `node:test` and `node:assert/strict`. Add focused tests in `test/collector.test.js` when changing collector behavior, especially URL normalization, origin detection, deduping, and route classification.

Run `npm test` before submitting changes. There is no formal coverage threshold, but new parsing branches and regression fixes should include direct assertions.

## Pull Request Guidelines

Pull requests should include a short description, user-facing behavior changed, and test results. Include screenshots or a short recording for visible popup UI changes. Mention any `manifest.json` permission changes.

## Security & Configuration Tips

The extension relies on `activeTab`, `scripting`, and `clipboardWrite`. Avoid broader host permissions unless required. Do not log page contents, cookies, tokens, or collected private URLs beyond local debugging needs.
