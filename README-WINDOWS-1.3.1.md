# StreamBoard IPTV — Windows v1.4.0 cumulative repair and pinned player

This is a **Windows-only cumulative update** over the existing StreamBoard repository. It includes **all** Windows desktop runtime files from the full v1.3 release, including the `stream-bridge.js` and `repo-discovery.js` modules first introduced in v1.2. **You do not need to install v1.2.0 first.** The existing Android project is left unchanged.

## Fixes and experience improvements

- Corrects the Windows startup crash: `Cannot find module './stream-bridge'` caused by applying an incremental v1.3 ZIP over a repository that skipped v1.2.
- Electron Builder now includes `stream-bridge.js`, `repo-discovery.js`, `preload.js`, UI source, worker and HLS.js. The GitHub workflow checks the **packaged `app.asar`** after building and fails instead of publishing an incomplete installer.
- Video stays mounted in its own **pinned player**. The channel list scrolls separately, and switching between Live, Favorites, Access, Playlists or Playlist Studio does not recreate the player.
- At narrower window widths, the layout changes to a **top-docked video area** over a separate scrollable directory; the playing video is not pushed off screen by channel-list scrolling.
- New **Compact** toggle reduces player height while browsing; the toggle is stored locally. `F` continues to toggle video fullscreen.
- Existing HTTP/HTTPS HLS bridge, playlist analyzer, M3U/CSV compiler, automatic source failover and catalog settings are preserved.

## Update an existing repository using Codespaces

1. Upload `StreamBoard-IPTV-Windows-v1.4.0-CUMULATIVE-UPDATE.zip` into your **streamboard** GitHub repository's root and commit the upload.
2. In Codespaces terminal, from repository root:

```bash
git pull --rebase origin main
unzip -o StreamBoard-IPTV-Windows-v1.4.0-CUMULATIVE-UPDATE.zip
rm -f StreamBoard-IPTV-Windows-v1.4.0-CUMULATIVE-UPDATE.zip
bash VERIFY_WINDOWS_UPDATE.sh
git add -A
git commit -m "StreamBoard Windows v1.4.0 complete installer and pinned player"
git push origin main
```

3. Open Actions → **Build StreamBoard Windows Desktop (Complete v1.4.0)**. Download the installer artifact after a successful build.
4. Fully close StreamBoard before installing. The same Electron app identity and settings path are retained, so an ordinary same-identity update should preserve local library settings. Back up playlist URLs first if critical.

## Build verification and limits

- Local Node.js tests validate parsing, merging, bridge behavior, source selection, analyzer exports and UI structure. The test suite is **not** a substitute for a Windows installer/runtime smoke test.
- The Windows workflow runs source verification and **verifies that 11 essential files actually exist in `app.asar`** after packaging. If any are missing, the build fails without publishing the installer.
- Real HTTP/HTTPS playback depends on provider reachability, supported codecs, valid URLs and authorization. The bridge does not defeat DRM, geo restrictions or authentication.
- If a new installer fails even after a green build, capture the **full startup error** and the packaged verification step; settings are stored separately from the installation directory.
