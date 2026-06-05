# Chairkick Chrome Extension

Collects Loom and Cap share URLs from the active tab so they can be pasted into Chairkick's import page.

## Load Locally

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click `Load unpacked`.
4. Select this directory.

The extension uses `activeTab`, so it only inspects the tab where you open the popup. For self-hosted Cap instances, open the Cap page itself; the extension detects the active page origin automatically.

## Test

```sh
npm test
```
