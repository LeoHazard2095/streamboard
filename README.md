# StreamBoard IPTV v1.1.1 — stability, persistent player, playlist diagnostics

**Android**: versionName `1.1.1`, versionCode `3`, application ID `com.techboard.streamboard` unchanged. Android 7.0+.
**Windows**: Electron installer `1.1.1` under the same GitHub repository.

## Changes made

**Android stability and responsiveness**
- Channel cache loads on a worker thread on startup, instead of blocking the main thread while reading a big JSON catalog.
- Channel groups are cached. They are recomputed only after source import/removal and are updated in-place for permission/category changes.
- Multi-source grouping no longer loops over every existing feed; a synthetic 8,000-alternative channel merges promptly in the regression fixture.
- Logo loader caps concurrent requests, deduplicates pending requests, caches failures briefly, caps memory to 3 MiB, and decodes images with a reduced bitmap sample before resizing. Reduces memory pressure; **not a proven fix for every device crash**.
- Search updates are debounced, and bulk stream checks are limited to 40 per batch.

**Android persistent picture-in-guide**
- The same ExoPlayer is kept in a dock above the Live, Favorites, Access and Sources tabs while you browse. Selecting another channel changes the stream without navigating away.
- Previous/next channel buttons, source selector, auto/adaptive quality selector, immersive landscape fullscreen and fullscreen exit.
- Automatically tries alternatives on playback error, ended playback, or extended buffering (30 seconds), with a bounded attempt set.
- Retains category visibility and channel approval gates. If the active channel becomes blocked or hidden, playback stops.
- Media3 adaptive bitrate is effective only for HLS masters advertising multiple quality renditions.

**Windows**
- Player remains visible while switching tabs and scrolling channels, using a pinned two-column layout on wide windows.
- Avoids recomputing merged channels on every keystroke/tab change, uses set-based stream de-duplication and asynchronous settings writes.

**Playlist inspection**
- Android Sources > **Inspect** shows counts from the last imported playlist: categories, streams, logo coverage, TV guide identifiers and top domains.
- Windows Sources > **Inspect** shows equivalent details.
- Codespaces CLI: `python3 tools/inspect_playlist.py` attempts to fetch the supplied Live TG TV playlist and prints a metadata report, **without fetching video segments**. Override with `python3 tools/inspect_playlist.py 'https://example.com/list.m3u'`.
- The Live TG TV endpoint was not retrievable from this environment during preparation; no channel count or quality claims were invented. Your device may retrieve it successfully even if an external crawler cannot.

## Upgrade your existing repository (Codespaces)

Upload `StreamBoard-IPTV-v1.1.1-UPDATE.zip` to your **StreamBoard** repo root:

```bash
git pull --rebase origin main
unzip -o StreamBoard-IPTV-v1.1.1-UPDATE.zip
rm -f StreamBoard-IPTV-v1.1.1-UPDATE.zip
git add -A
git commit -m "StreamBoard IPTV 1.1.1 persistent player and performance"
git push origin main
```

GitHub Actions will build the Android test APK and Windows installer separately. The source does **not** contain a compiled APK/EXE. These tasks were not compiled on Android/Windows in the current environment; GitHub Actions and real-device testing remain mandatory.

## Testing checklist

1. Install the APK over the same package+signer; if switching from debug to release signature, installation will conflict. Back up approval settings first if an uninstall is needed.
2. Confirm previous playlists, favorites, approvals and categories remain unchanged.
3. Test large playlists; scroll Live and Saved while video stays in view. Try switching category, Access, and Sources without stopping video.
4. Play Cartoon Network, then change to another allowed channel; use source selector to test fallback. Test fullscreen portrait/landscape transitions and return to guide.
5. Block the playing channel in Access: it should stop and disappear. Unblock and play again.
6. Sources > Live TG TV > Refresh, then Inspect. Record counts and any HTTP error/status; do not assume the response is valid just because URL returns 200.
7. Test a multi-quality HLS master under throttled bandwidth. Single-rendition HLS does not provide adaptive resolution.
8. For a remaining Android crash, capture `adb logcat -d -v time | grep -E 'FATAL EXCEPTION|com.techboard.streamboard|OutOfMemoryError'` (run from a connected PC) and share the first exception stack plus phone model/Android version. Remove stream tokens or login data from the log before sharing.

Only use streams you have permission to access. Playlist entries may be region-locked, tokenized, geo-restricted, offline or changing over time. Stream reachability checks cannot validate that the expected programme is playing.
