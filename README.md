# Chairkick: Export Loom & Cap Videos

Chrome extension that collects your Loom and Cap videos from the active tab and sends them to [Chairkick](https://chairkick.com) to import — or copies the share URLs so you can paste them into Chairkick's import page yourself.

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

## Test

```sh
npm test
```
