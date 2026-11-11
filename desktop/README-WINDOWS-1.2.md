# StreamBoard IPTV — Windows v1.2.0

This is a **Windows-only** change. The Android project is left untouched.

## Changes

- Redesigned the Windows UI using a familiar desktop navigation layout, prominent persistent player, grouped controls, contextual empty states, keyboard focus states, and accessible labels.
- The picture stays mounted while using Live, Favorites, Channel Access and Playlists. Switching panels does not restart playback.
- Virtualized lists render only visible rows (plus a small overscan), rather than 100+ cards and images on every search.
- Playlist parsing runs in a worker. If worker loading is unavailable, the normal parser remains as a fallback.
- All channels remain controlled by individual approvals and category visibility. New channels are still blocked by default.
- **Stream bridge connected for HTTP and HTTPS HLS.** A session-scoped, localhost-only bridge rewrites nested HLS manifests, media URIs, and keys, allowing playback without dependence on upstream browser CORS headers. Electron web security remains enabled. No stream host is guaranteed to work: expired links, geo-blocks, access controls and unsupported codecs still apply.
- Improved source dropdown, quality caps where bitrate variants exist, fullscreen, previous/next channel, favorites, channel search and streamer statuses.
- Public GitHub repository discovery: paste `https://github.com/owner/repository` (including `https://github.com/Diljan707/new`) under Playlists -> Import from GitHub repository. The app discovers genuine `.m3u` and `.m3u8` file paths using the public GitHub API and lets you import them. Do not treat repository homepage HTML as a playlist. GitHub API rate limits apply; if the project lists URLs in its README or GitHub Pages that aren't repository M3U files, paste those published URLs manually.
- Native Electron sandbox, context isolation, denied permissions, navigation blocking, strict CSP, and no `webSecurity:false`.
- Stream bridge and repo discovery are now included in `electron-builder` distribution files.

## GitHub build

Upload the `StreamBoard-IPTV-Windows-v1.2.0-UPDATE.zip` into the root of your existing repository, then in Codespaces:

```bash
unzip -o StreamBoard-IPTV-Windows-v1.2.0-UPDATE.zip
rm -f StreamBoard-IPTV-Windows-v1.2.0-UPDATE.zip
git add -A
git commit -m "StreamBoard Windows v1.2 player and UI redesign"
git push origin main
```

Open GitHub Actions -> **Build StreamBoard Windows Desktop**. Download and run the generated Windows installer artifact.

Use the **SOURCE ZIP** only if you are starting a new repository.

## Checks and boundaries

Run `cd desktop && npm test` for parser, repository discovery, and HTTP HLS bridge tests. These tests use local streams, not subscription broadcasts.

The Windows installer and real video playback have **not** been compiled or tested on this machine. GitHub Actions and a real Windows PC are still required for end-to-end testing.

The public GitHub listings describe `Diljan707/new` as an Indian IPTV playlist hub. We couldn't inspect its files from the build environment, so no unsupported channel count or fabricated M3U links are bundled. Check channel rights and access requirements before redistribution.

Keyboard: **F** fullscreen player, **Ctrl+Right/Left** next/previous channel, **Esc** exits fullscreen. Lists can be scrolled with mouse or keyboard.
