# Chrome Web Store listing — paste-ready copy

Upload package: `dist/chairkick-export-loom-cap-videos-1.0.0.zip` (rebuild: see README).

## Store listing tab

- **Title:** taken from the manifest — Chairkick: Export Loom & Cap Videos
- **Summary:** taken from the manifest description
- **Category:** Productivity → Tools
- **Language:** English

### Detailed description (paste as plain text — the store does not render markdown)

Export your Loom videos — and your Cap videos — in one click.

Chairkick: Export Loom & Cap Videos collects every video in your Loom or Cap library and moves it to Chairkick, the async video platform where viewers are always free. Back up your library before downgrading or cancelling, or migrate your whole team in minutes.

WHY EXPORT YOUR LOOM VIDEOS?
Loom's free plan is now capped at 25 videos (lifetime) with a 5-minute limit, and paid plans charge per seat. If you're downgrading, leaving, or just want a backup of your Loom library, this extension gets your videos out — no re-recording, no manual copy-paste.

HOW IT WORKS
1. Open loom.com (or Cap's My Caps page) and click the extension icon.
2. It collects your entire library — your own videos and workspace videos — with titles.
3. Click "Send to Chairkick" to import the videos you recorded, or copy the share-URL lists to use however you like.

Chairkick imports each video via its share link, keeps the title, and adds an AI summary and transcript. Your videos get a fresh link you control.

WHAT IT DOES
• Collects your full Loom library (up to thousands of videos), not just the links visible on the page
• Works with Cap (cap.so) too, including self-hosted Cap instances
• Groups videos into "My videos" and "workspace videos" so you only migrate what's yours
• One-click handoff to Chairkick's importer, or copy plain URL lists
• Runs only when you click it, and only on the tab you're viewing

WHY CHAIRKICK?
Chairkick is a Loom alternative built for teams: record your screen and camera in the browser, share instantly with an unlisted link, and never pay for viewers. The free plan includes 10-minute recordings and 30 active videos — more generous than Loom's free tier. Pro is $15/user/month for 2-hour recordings and unlimited videos. Learn more at https://chairkick.com/switch-from-loom

PRIVACY
The extension reads only the tab where you open it, transmits nothing until you press "Send to Chairkick", and contains no analytics or trackers. Details: https://chairkick.com/privacy

Not affiliated with or endorsed by Loom (Atlassian) or Cap. Loom and Cap are trademarks of their respective owners; this extension helps you export your own videos from those services.

### Graphics

- **Store icon 128×128:** `icons/icon-128.png`
- **Screenshots (1280×800, at least one REQUIRED):** take manually — popup open over your Loom library showing collected lists. Blur/crop personal video titles you don't want public.
- **Small promo tile 440×280 (optional but shown in search):** `store/promo-tile-small.png`
- **Marquee 1400×560 (optional):** skip for v1.

## Privacy tab

- **Single purpose description:**
  Collects the user's own Loom and Cap video share links from the active tab so the user can back them up or import them into chairkick.com.

- **activeTab justification:**
  The extension runs only when the user clicks the toolbar icon and needs access to the Loom/Cap tab they are viewing to find their video share links there. No broad site access is requested.

- **scripting justification:**
  Injects the collector script into the active tab (on user click) that scans the page for video share links and, on loom.com, lists the user's own videos using their existing session.

- **clipboardWrite justification:**
  The "Copy" buttons copy the collected share-URL lists to the user's clipboard.

- **Host permission (https://chairkick.com/*) justification:**
  The "Send to Chairkick" button submits the collected share links to chairkick.com to prepare the user's import. No other hosts are contacted.

- **Remote code:** No, I am not using remote code.

- **Data usage:** check **Website content** only (video share URLs and titles from the active tab; transmitted to chairkick.com only when the user clicks Send). Everything else unchecked. Certify the three "limited use" statements.

- **Privacy policy URL:** https://chairkick.com/privacy
  (⚠ the Chrome-extension section must be DEPLOYED before submitting)

## Distribution tab

- Visibility: Public · Regions: all · Free, no in-app purchases
