# Chairkick: Screen Recorder & Loom Export

Companion Chrome extension for [Chairkick](https://chairkick.com). The popup's "Record a new video" button opens the Chairkick recorder in a new tab. The Alt+Shift+K shortcut (Option+Shift+K on a Mac) opens the recorder directly from any tab; the gear icon in the popup shows the current keys, lets you switch the shortcut off, and links to `chrome://extensions/shortcuts`, the only place Chrome lets the key combination be changed. The default is Alt+Shift+K rather than the more obvious R because Loom's extension and Awesome Screenshot both bind Alt+Shift+R, and Chrome silently gives a shortcut to whichever extension claimed it first. Below it, the exporter collects your Loom and Cap videos from the active tab and sends them to Chairkick to import — or copies the share URLs so you can paste them into Chairkick's import page yourself.

The Record button is a plain link: no extra permissions, no auth in the extension. Signed-in users land in their recorder; everyone else gets the no-account recorder and signs up afterwards.

## Load Locally

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click `Load unpacked`.
4. Select this directory.

The extension uses `activeTab`, so it only inspects the tab where you open the popup. For self-hosted Cap instances, open the Cap page itself; the extension detects the active page origin automatically.

## Icons

`icons/icon.svg` is the source (a variation of the Chairkick app icon with an export badge). Regenerate the PNGs with:

```sh
cd icons && for size in 16 32 48 128; do rsvg-convert -w $size -h $size icon.svg -o "icon-${size}.png"; done
```

`icon-512.png` is kept for store listing assets.

## Package for the Web Store

```sh
version=$(node -p "require('./manifest.json').version")
mkdir -p dist && rm -f "dist/chairkick-screen-recorder-loom-export-${version}.zip"
zip -r "dist/chairkick-screen-recorder-loom-export-${version}.zip" manifest.json popup.html src icons/icon-16.png icons/icon-32.png icons/icon-48.png icons/icon-128.png -x '*.DS_Store'
```

## Test

```sh
npm test
```
