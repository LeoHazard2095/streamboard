# StreamBoard IPTV v1.1.0 — T Play-inspired navigation and adaptive HLS

**One repository, two separate app builds.** Original Android package ID: `com.techboard.streamboard` (unchanged). Android versionCode 2; min Android 7.0. New desktop companion (Electron) builds on Windows.

## Highlights

- Reworked Android navigation: Live TV, Favorites, Access, Sources; dark TV-first visual hierarchy, search, category chips, fast-scrolling recycled channel rows, channel art, favorite toggle and Resume last channel.
- Improved Android player: Media3 HLS adaptive track selection on multi-variant HLS masters; quality menu for Auto/360/480/720/1080 *maximum caps*; immersive landscape fullscreen with visible exit control and system Back key; current-video-resolution indicator; existing bounded source failover still attempts alternatives on error or 30 seconds buffering.
- The new supplied `https://livetgtv.lovable.app/api/public/playlist.m3u` URL is a **third default playlist**. Existing installations add it in a one-time settings migration without clearing channels, approvals, favorites, or categories. The importer reads `#EXTINF`, `group-title`, `tvg-logo`, language/country attributes, and merges compatible duplicate channel entries. All new entries are **blocked until explicitly allowed**.
- Added `desktop/` with a Windows Electron app: sidebar, built-in player, multiple playlist sources, category management, channel approval, favorites, source selection, basic HLS adaptive-quality caps and failover. Desktop preferences are stored separately in the operating system's application data directory.
- New Windows GitHub Action builds `.exe`; Android workflow builds `.apk`. Android and Windows share the feature design and sample playlist URLs, but do not yet synchronize permissions between devices.

## Build using GitHub Codespaces

For the **existing StreamBoard repository**, upload `StreamBoard-IPTV-v1.1.0-UPDATE.zip` at repo root, then:

```bash
git pull --rebase origin main
unzip -o StreamBoard-IPTV-v1.1.0-UPDATE.zip
rm -f StreamBoard-IPTV-v1.1.0-UPDATE.zip
git add -A
git commit -m "StreamBoard IPTV v1.1.0 player and UI overhaul"
git push origin main
```

Open GitHub Actions and choose `Build StreamBoard IPTV Android v1.1` or `Build StreamBoard Windows Desktop` (desktop workflow is a separate file). Download the produced debug APK/Windows EXE from the successful run's Artifacts. Debug APK is for testing, not release-signed. Changing Android signing keys prevents in-place install; maintain the same signing identity for upgrades.

For a **fresh repo**, upload/extract `StreamBoard-IPTV-v1.1.0-SOURCE.zip` instead. The ZIP contains all Android and Windows files at the repository root (no wrapper folder).

### Player limitations

- Auto HLS quality switching only works if the supplied HLS master contains multiple renditions. Single-bitrate streams have no other resolution to select. 360p/480p etc are *caps*, not guarantees of exact tracks.
- Failover detects playback errors, stream-ended events and prolonged buffering; it **cannot detect ad-only streams, the wrong programme, or a provider intentionally streaming an advertisement**.
- Some sources need login, token access, DRM licences or region access. Neither player circumvents authentication, DRM or geographic restrictions.
- **Desktop limitation:** HLS.js requires cross-origin access to the video chunks. Sources that do not provide suitable CORS headers may fail on Windows even when they work with Android ExoPlayer. The desktop build is a first functional prototype, not a complete replacement for an unrestricted native media engine.
- The new supplied playlist URL was not retrievable from this environment. It is configured for device-side import; **individual channel names, counts and playback cannot be claimed verified**.
- Only stream sources you are permitted to view. Public playlist publication is not proof of rebroadcast rights.

## Validation status

- `bash tests/run-tests.sh` — verified Android core logic (M3U parsing, category assignment, merging and fallback behavior).
- `cd desktop && npm test` — verified desktop parser and merging fixtures.
- ZIP structure and migration markers verified by archive checks.
- No Android SDK or Windows Electron runtime is installed here. The full APK/EXE builds, device behavior, and imported Live TG playlist require GitHub Actions and real-device tests.

## Project locations

- Android main UI: `app/src/main/java/com/techboard/streamboard/ui/MainActivity.java`
- Android HLS Player: `app/src/main/java/com/techboard/streamboard/ui/PlayerActivity.java`
- Android playlist defaults and migration: `app/src/main/java/com/techboard/streamboard/core/ChannelStore.java`
- Desktop: `desktop/`
- GitHub workflows: `.github/workflows/build-android.yml`, `.github/workflows/build-desktop.yml`
